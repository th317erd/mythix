import Path                   from 'node:path';
import FileSystem             from 'node:fs';
import OS                     from 'node:os';
import Nife                   from 'nife';
import { Logger }             from './logger.mjs';
import { DatabaseModule }     from './modules/database-module.mjs';
import { HTTPServerModule }   from './http/http-server-module.mjs';
import { ControllerModule }   from './controllers/controller-module.mjs';
import { TaskModule }         from './tasks/task-module.mjs';
import { wrapConfig }         from './utils/config-utils.mjs';
import * as ControllerRoutes  from './controllers/routes/index.mjs';
import { COMMANDS }           from './cli/commands/index.mjs';
import { Migration }          from './models/migration-model.mjs';

export class Application {
  static getName() {
    return 'mythix';
  }

  static getCommandList() {
    return COMMANDS;
  }

  static getModules() {
    return {
      database:    DatabaseModule,
      httpServer:  HTTPServerModule,
      controllers: ControllerModule,
      tasks:       TaskModule,
    };
  }

  constructor(_opts) {
    let opts = Nife.extend(true, {
      environment:    (process.env.NODE_ENV || 'development'),
      exitOnShutdown: null,
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
        value:        wrapConfig(Object.assign({}, opts.config || {}, { environment: opts.environment })),
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

    if (opts.bindToProcessSignals !== false)
      this.bindToProcessSignals();

    if (Nife.isEmpty(opts.tempPath))
      opts.tempPath = Path.resolve(OS.tmpdir(), this.getApplicationName().replace(/[^\w-]/g, ''), ('' + process.pid));
  }

  getApplicationName() {
    return this.constructor.getName();
  }

  getTempPath() {
    let options = this.getOptions();
    return options.tempPath;
  }

  getModuleInstances() {
    return this.moduleInstances || [];
  }

  async initializeModules(_modules) {
    // Shutdown modules, if any are active
    await this.stopAllModules(this.getOptions());

    let modules         = _modules || {};
    let moduleNames     = Object.keys(modules);
    let moduleInstances = [];
    let options         = this.getOptions();

    for (let i = 0, il = moduleNames.length; i < il; i++) {
      let moduleName  = moduleNames[i];
      let ModuleClass = modules[moduleName];
      if (typeof ModuleClass !== 'function')
        throw new TypeError(`Specified module "${moduleName}" is not a module class`);

      if (typeof ModuleClass.shouldUse === 'function' && ModuleClass.shouldUse.call(ModuleClass, this, options) === false)
        continue;

      let moduleInstance = new ModuleClass(this);
      moduleInstances.push(moduleInstance);
    }

    this.moduleInstances = moduleInstances;
  }

  async startAllModules(options) {
    let moduleInstances = this.getModuleInstances();

    for (let i = 0, il = moduleInstances.length; i < il; i++) {
      let moduleInstance = moduleInstances[i];
      await moduleInstance.start(options);
    }
  }

  async stopAllModules(options) {
    let moduleInstances = this.getModuleInstances();
    let errors = [];

    for (let i = moduleInstances.length - 1; i >= 0; i--) {
      let moduleInstance = moduleInstances[i];

      try {
        await moduleInstance.stop(options);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      let error = new AggregateError('Errors were encountered while shutting down modules');
      error.errors = errors;
      throw error;
    }
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

  getConfigValue(key, defaultValue, type) {
    let result = this.config.ENV(key, defaultValue);

    // Coerce to type, if type was specified
    if (type)
      return Nife.coerceValue(result, type);

    return result;
  }

  getConfig() {
    return this.config;
  }

  setConfig(opts) {
    Nife.extend(true, this.config.CONFIG, opts);
    return this;
  }

  getAppControllerClasses() {
    return {};
  }

  getAppModelClasses() {
    return {
      Migration,
    };
  }

  bindModels(connection, models) {
    const generateBoundModelClass = (connection, modelName, ModelClass) => {
      if (typeof ModelClass !== 'function')
        return;

      const app = this;

      return class BoundModel extends ModelClass {
        static getApplication() {
          return app;
        }

        static getModelName() {
          return modelName;
        }
      };
    };

    let modelNames  = Object.keys(models);
    let boundModels = [];

    for (let i = 0, il = modelNames.length; i < il; i++) {
      let modelName = modelNames[i];
      let ModelClass  = generateBoundModelClass(connection, modelName, models[modelName]);
      if (!ModelClass)
        continue;

      boundModels[modelName] = ModelClass;
    }

    return boundModels;
  }

  _getRoutes() {
    let routeScope = new ControllerRoutes.RouteScope();
    this.getRoutes(routeScope);
    return routeScope;
  }

  getRoutes() {
    throw new Error('Error: child application expected to implement "getRoutes" method');
  }

  getCustomRouteParserTypes() {
    return [];
  }

  createLogger(loggerOpts, LoggerClass) {
    return new LoggerClass(loggerOpts);
  }

  getLogger() {
    if (!this.logger)
      return console;

    return this.logger;
  }

  getModel(name) {
    if (typeof this.getConnection !== 'function')
      return;

    let connection = this.getConnection();
    return connection.getModel(name);
  }

  getModels() {
    if (typeof this.getConnection !== 'function')
      return {};

    let connection = this.getConnection();
    return connection.getModels();
  }

  async start() {
    let options = this.getOptions();
    let tempDir = this.getTempPath();
    if (Nife.isNotEmpty(tempDir)) {
      if (!FileSystem.existsSync(tempDir))
        FileSystem.mkdirSync(tempDir, { recursive: true });
    }

    await this.initializeModules(this.constructor.getModules());
    await this.startAllModules(options);

    this.isStarted = true;
  }

  async stop(exitCode) {
    if (this.isStopping)
      process.exit(1);

    if (!this.isStarted)
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

      this.getLogger().info('Removing temporary files...');

      let tempDir = this.getTempPath();
      if (Nife.isNotEmpty(tempDir)) {
        FileSystem.rmSync(tempDir, {
          force:      true,
          recursive:  true,
          maxRetries: 3,
        });
      }

      this.getLogger().info('Shut down complete!');

      if (options.exitOnShutdown != null || exitCode != null) {
        let code = (exitCode != null) ? exitCode : options.exitOnShutdown;
        process.exit(code);
      }
    } catch (error) {
      this.getLogger().error('Error while shutting down: ', error);
      process.exit(1);
    }
  }
}
