'use strict';

/* global process, __dirname */

const Nife                  = require('nife');
const Path                  = require('path');
const EventEmitter          = require('events');
const { Logger }            = require('./logger');
const { DatabaseModule }    = require('./modules/database-module');
const { ModelModule }       = require('./models/model-module');
const { HTTPServerModule }  = require('./http-server/http-server-module');
const { ControllerModule }  = require('./controllers/controller-module');
const { TaskModule }        = require('./tasks/task-module');
const { FileWatcherModule } = require('./modules/file-watcher-module.js');
const { wrapConfig }        = require('./utils');

// Trace what is requesting the application exit

// (function doExit(_exit) {
//   process.exit = function() {
//     console.trace('EXIT');
//     return _exit.apply(process, arguments);
//   };
// })(process.exit);

class Application extends EventEmitter {
  static APP_NAME = 'mythix';

  static getDefaultModules() {
    return [
      DatabaseModule,
      ModelModule,
      HTTPServerModule,
      ControllerModule,
      TaskModule,
      FileWatcherModule,
    ];
  }

  constructor(_opts) {
    super();

    let ROOT_PATH = (_opts && _opts.rootPath) ? _opts.rootPath : Path.resolve(__dirname);

    let opts = Nife.extend(true, {
      appName:                  this.constructor.APP_NAME,
      rootPath:                 ROOT_PATH,
      configPath:               Path.resolve(ROOT_PATH, 'config'),
      migrationsPath:           Path.resolve(ROOT_PATH, 'migrations'),
      modelsPath:               Path.resolve(ROOT_PATH, 'models'),
      seedersPath:              Path.resolve(ROOT_PATH, 'seeders'),
      controllersPath:          Path.resolve(ROOT_PATH, 'controllers'),
      templatesPath:            Path.resolve(ROOT_PATH, 'templates'),
      commandsPath:             Path.resolve(ROOT_PATH, 'commands'),
      tasksPath:                Path.resolve(ROOT_PATH, 'tasks'),
      modules:                  this.constructor.getDefaultModules(),
      autoReload:               (process.env.NODE_ENV || 'development') === 'development',
      exitOnShutdown:           null,
      runTasks:                 true,
      testMode:                 false,
      noInternalMigrationTable: false,
      logger:                   {
        rootPath: ROOT_PATH,
      },
      database:                 {},
      httpServer:               {
        routeParserTypes:       undefined,
        middleware:             null,
      },
    }, _opts || {});

    Object.defineProperties(this, {
      'isStarted': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        false,
      },
      'isStopping': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        false,
      },
      'options': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        opts,
      },
      'moduleInstances': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        [],
      },
    });

    Object.defineProperties(this, {
      'config': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        this.loadConfig(opts.configPath),
      },
    });

    Object.defineProperties(this, {
      'logger': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.createLogger(
          Object.assign({}, this.getConfigValue('logger', {}), opts.logger || {}),
          Logger,
        ),
      },
    });

    this.bindToProcessSignals();
  }

  getModules() {
    return this.moduleInstances || [];
  }

  async initializeModules(_modules) {
    // Shutdown modules, if any are active
    let stopPromises = this.getModules().map((moduleInstance) => moduleInstance.stop());
    await Promise.all(stopPromises);

    let modules         = _modules || [];
    let moduleInstances = [];
    let options         = this.getOptions();

    for (let i = 0, il = modules.length; i < il; i++) {
      let ModuleClass = modules[i];
      if (typeof ModuleClass.shouldUse === 'function' && ModuleClass.shouldUse.call(this, options) === false)
        continue;

      let moduleInstance = new ModuleClass(this);
      moduleInstances.push(moduleInstance);
    }

    this.moduleInstances = moduleInstances;
  }

  async startAllModules(options) {
    let moduleInstances = this.getModules();

    for (let i = 0, il = moduleInstances.length; i < il; i++) {
      let moduleInstance = moduleInstances[i];
      await moduleInstance.start(options);
    }
  }

  async stopAllModules(options) {
    let moduleInstances = this.getModules();
    let errors = [];

    for (let i = moduleInstances.length - 1; i >= 0; i--) {
      let moduleInstance = moduleInstances[i];

      try {
        await moduleInstance.stop(options);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0)
      return errors;
  }

  bindToProcessSignals() {
    process.on('SIGINT',  this.stop.bind(this));
    process.on('SIGTERM', this.stop.bind(this));
    process.on('SIGHUP',  this.stop.bind(this));
  }

  getOptions() {
    return this.options;
  }

  setOptions(opts) {
    if (!opts)
      return;

    let options = this.getOptions();
    Nife.extend(true, options, opts);

    return this;
  }

  loadConfig(configPath) {
    try {
      const config = require(configPath);
      return wrapConfig(config);
    } catch (error) {
      this.getLogger().error(`Error while trying to load application configuration ${configPath}: `, error);
      throw error;
    }
  }

  getConfigValue(key, defaultValue, type) {
    let result = this.config.ENV(key, defaultValue);

    // Coerce to type, if type was specified
    if (type)
      Nife.coerceValue(result, type);

    return result;
  }

  getConfig() {
    return this.config;
  }

  setConfig(opts) {
    Nife.extend(true, this.config.CONFIG, opts);
    return this;
  }

  getApplicationName() {
    let options = this.getOptions();
    return options.appName;
  }

  getRoutes() {
    throw new Error('Error: child application expected to implement "getRoutes" method');
  }

  getCustomRouteParserTypes() {
    let options = this.getOptions();
    return options.routeParserTypes;
  }

  createLogger(loggerOpts, LoggerClass) {
    return new LoggerClass(loggerOpts);
  }

  getLogger() {
    if (!this.logger)
      return console;

    return this.logger;
  }

  async start() {
    let options = this.getOptions();

    await this.initializeModules(options.modules);
    await this.startAllModules(options);

    this.isStarted = true;

    this.emit('start');
  }

  async stop(exitCode) {
    if (this.isStopping || !this.isStarted)
      return;

    try {
      let options = this.getOptions();

      this.getLogger().info('Shutting down...');

      this.isStopping = true;
      this.isStarted = false;

      let errors = await this.stopAllModules(options);
      if (errors && errors.length > 0) {
        for (let i = 0, il = errors.length; i < il; i++) {
          let error = errors[i];
          this.getLogger().error('Error while shutting down: ', error);
        }
      }

      this.getLogger().info('Shut down complete!');

      this.emit('stop');

      if (options.exitOnShutdown != null || exitCode != null) {
        let code = (exitCode != null) ? exitCode : options.exitOnShutdown;
        this.emit('exit', code);
        process.exit(code);
      }
    } catch (error) {
      this.getLogger().error('Error while shutting down: ', error);
      process.exit(1);
    }
  }
}

module.exports = {
  Application,
};
