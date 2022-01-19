const Nife                    = require('nife');
const Path                    = require('path');
const { Sequelize }           = require('sequelize');
const chokidar                = require('chokidar');
const { Logger }              = require('./logger');
const { HTTPServer }          = require('./http-server');
const { buildModelRelations } = require('./models/model-utils');
const { buildRoutes }         = require('./controllers/controller-utils');
const {
  wrapConfig,
  fileNameWithoutExtension,
  walkDir,
} = require('./utils');


class Application {
  static APP_NAME = 'mythix';

  constructor(_opts) {
    var ROOT_PATH = (_opts && _opts.rootPath) ? _opts.rootPath : Path.resolve(__dirname);

    var opts = Nife.extend(true, {
      appName:          this.constructor.APP_NAME,
      rootPath:         ROOT_PATH,
      configPath:       Path.resolve(ROOT_PATH, 'config'),
      migrationsPath:   Path.resolve(ROOT_PATH, 'migrations'),
      modelsPath:       Path.resolve(ROOT_PATH, 'models'),
      seedersPath:      Path.resolve(ROOT_PATH, 'seeders'),
      controllersPath:  Path.resolve(ROOT_PATH, 'controllers'),
      templatesPath:    Path.resolve(ROOT_PATH, 'templates'),
      logger:           {
        rootPath: ROOT_PATH,
      },
      httpServer: {
        routeParserTypes: undefined,
        middleware:       null,
      },
      autoReload:         (process.env.NODE_ENV || 'development') === 'development',
    }, _opts || {});

    Object.defineProperties(this, {
      'dbConnection': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'dbConfig': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
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
      'controllers': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
      'models': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
      'server': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'fileWatcher': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
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
          Object.assign({}, opts.logger || {}, this.getConfigValue('LOGGER', {})),
          Logger,
        ),
      },
    });

    this.bindToProcessSignals();
  }

  async autoReload(_set, shuttingDown) {
    var options = this.getOptions();
    if (arguments.length === 0)
      return options.autoReload;

    var set = !!_set;

    if (!shuttingDown)
      options.autoReload = set;

    if (this.fileWatcher)
      await this.fileWatcher.close();

    if (shuttingDown)
      return;

    if (set) {
      var getFileScope = (path) => {
        if (path.substring(0, options.controllersPath.length) === options.controllersPath)
          return 'controllers';

        if (path.substring(0, options.modelsPath.length) === options.modelsPath)
          return 'models';

        return 'default';
      };

      const filesChanged = (eventName, path) => {
        if (filesChangedTimeout)
          clearTimeout(filesChangedTimeout);

        var scopeName = getFileScope(path);
        var scope     = filesChangedQueue[scopeName];
        if (!scope)
          scope = filesChangedQueue[scopeName] = {};

        scope[path] = eventName;

        filesChangedTimeout = setTimeout(() => {
          this.watchedFilesChanged(Object.assign({}, filesChangedQueue));

          filesChangedTimeout = null;
          filesChangedQueue = {};
        }, 500);
      };

      var filesChangedQueue = {};
      var filesChangedTimeout;

      this.fileWatcher = chokidar.watch([ options.modelsPath, options.controllersPath ], {
        persistent:     true,
        followSymlinks: true,
        usePolling:     false,
        ignoreInitial:  true,
        interval:       200,
        binaryInterval: 500,
        depth:          10,
      });

      this.fileWatcher.on('all', filesChanged);
    }
  }

  async watchedFilesChanged(files) {
    const flushRequireCache = (path) => {
      try {
        delete require.cache[require.resolve(path)];
      } catch (error) {}
    };

    const flushRequireCacheForFiles = (type, files) => {
      for (var i = 0, il = files.length; i < il; i++) {
        var fileName = files[i];
        flushRequireCache(fileName);

        this.getLogger().info(`Loading ${type} ${fileName}...`);
      }
    }

    var options = this.getOptions();

    var controllerScope = files['controllers'];
    if (controllerScope && this.server) {
      var fileNames = Object.keys(controllerScope);
      flushRequireCacheForFiles('controller', fileNames);

      try {
        var controllers = await this.loadControllers(options.controllersPath, this.server);
        this.controllers = controllers;
      } catch (error) {
        this.getLogger().error('Error while attempting to reload controllers', error);
      }
    }

    var modelScope = files['models'];
    if (modelScope && this.dbConfig) {
      var fileNames = Object.keys(modelScope);
      flushRequireCacheForFiles('model', fileNames);

      try {
        var models = await this.loadModels(options.modelsPath, this.dbConfig);
        this.models = models;
      } catch (error) {
        this.getLogger().error('Error while attempting to reload models', error);
      }
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

    var options = this.getOptions();
    Nife.extend(true, options, opts);
  }

  getApplicationName() {
    var options = this.getOptions();
    return options.appName;
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

  getModelFilePaths(modelsPath) {
    return walkDir(modelsPath, {
      filter: (fullFileName, fileName) => {
        if (fileName.match(/^_/))
          return false;

        if (!fileNameWithoutExtension(fileName).match(/-model$/))
          return false;

        return true;
      }
    });
  }

  loadModels(modelsPath, dbConfig) {
    var modelFiles  = this.getModelFilePaths(modelsPath);
    var models      = {};
    var args        = { application: this, Sequelize, connection: this.dbConnection, dbConfig };

    for (var i = 0, il = modelFiles.length; i < il; i++) {
      var modelFile = modelFiles[i];

      try {
        var modelGenerator = require(modelFile);
        if (modelGenerator['default'] && typeof modelGenerator['default'] === 'function')
          modelGenerator = modelGenerator['default'];

        Object.assign(models, modelGenerator(args));
      } catch (error) {
        this.getLogger().error(`Error while loading model ${modelFile}: `, error);
        throw error;
      }
    }

    buildModelRelations(models);

    Object.defineProperties(models, {
      '_files': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        modelFiles,
      },
    });

    return models;
  }

  getModel(name) {
    var models = this.models;
    return models[name];
  }

  getModels() {
    return this.models || {};
  }

  getControllerFilePaths(controllersPath) {
    return walkDir(controllersPath, {
      filter: (fullFileName, fileName) => {
        if (fileName.match(/^_/))
          return false;

        if (!fileNameWithoutExtension(fileName).match(/-controller$/))
          return false;

        return true;
      }
    });
  }

  loadControllers(controllersPath, server) {
    var controllerFiles = this.getControllerFilePaths(controllersPath);
    var controllers     = {};
    var args            = { application: this, server };

    for (var i = 0, il = controllerFiles.length; i < il; i++) {
      var controllerFile = controllerFiles[i];

      try {
        var controllerGenerator = require(controllerFile);
        if (controllerGenerator['default'] && typeof controllerGenerator['default'] === 'function')
          controllerGenerator = controllerGenerator['default'];

        Object.assign(controllers, controllerGenerator(args));
      } catch (error) {
        this.getLogger().error(`Error while loading model ${controllerFile}: `, error);
        throw error;
      }
    }

    Object.defineProperties(controllers, {
      '_files': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        controllerFiles,
      },
    });

    return controllers;
  }

  getController(name) {
    var controllers     = this.controllers;
    var controllerName  = name.replace(/(.*?)\b\w+$/, '$1');
    var methodName      = name.substring(controllerName.length);
    if (!methodName)
      methodName = undefined;

    controllerName = controllerName.replace(/\W+$/g, '');

    return {
      controller:       Nife.get(controllers, controllerName),
      controllerMethod: methodName,
    };
  }

  getRoutes() {
    throw new Error('Error: child application expected to implement "getRoutes" method');
  }

  getCustomRouteParserTypes() {
    var options = this.getOptions();
    return options.routeParserTypes;
  }

  buildRoutes(server, routes) {
    var customParserTypes = this.getCustomRouteParserTypes(server, routes);
    return buildRoutes(routes, customParserTypes);
  }

  getConfigValue(key, defaultValue) {
    return this.config.ENV(key, defaultValue);
  }

  createLogger(loggerOpts, Logger) {
    return new Logger(loggerOpts);
  }

  getLogger() {
    if (!this.logger)
      return console;

    return this.logger;
  }

  async connectToDatabase(databaseConfig) {
    if (!databaseConfig) {
      this.getLogger().error(`Error: database connection options not defined`);
      return;
    }

    var sequelize = new Sequelize(databaseConfig);

    var dbConnectionString = `${databaseConfig.dialect}://${databaseConfig.host}:${databaseConfig.port || '<default port>'}/${databaseConfig.database}`;
    try {
      await sequelize.authenticate();

      this.getLogger().log(`Connection to ${dbConnectionString} has been established successfully!`);

      return sequelize;
    } catch (error) {
      this.getLogger().error(`Unable to connect to database ${dbConnectionString}:`, error);
      await this.stop();
    }
  }

  getDBConnection() {
    return this.dbConnection;
  }

  async createHTTPServer(options) {
    var server = new HTTPServer(this, options);

    await server.start();

    return server;
  }

  async start() {
    var options = this.getOptions();

    var databaseConfig = this.getConfigValue('DATABASE.{ENVIRONMENT}');
    if (!databaseConfig)
      databaseConfig = this.getConfigValue('DATABASE');

    if (!databaseConfig) {
      this.getLogger().error(`Error: database connection for "${this.getConfigValue('ENVIRONMENT')}" not defined`);
      return;
    }

    if (Nife.isEmpty(databaseConfig.tablePrefix))
      databaseConfig.tablePrefix = `${this.getApplicationName()}_`;

    this.dbConnection = await this.connectToDatabase(databaseConfig);
    this.dbConfig = databaseConfig;

    if (options.httpServer !== false) {
      var httpServerConfig = this.getConfigValue('SERVER.{ENVIRONMENT}');
      if (!httpServerConfig)
        httpServerConfig = this.getConfigValue('SERVER');

      this.server = await this.createHTTPServer(Nife.extend(true, {}, options.httpServer || {}, httpServerConfig || {}));
    }

    var models = await this.loadModels(options.modelsPath, databaseConfig);
    this.models = models;

    if (options.httpServer !== false) {
      var controllers = await this.loadControllers(options.controllersPath, this.server);
      this.controllers = controllers;

      var routes = await this.buildRoutes(this.server, this.getRoutes());
      this.server.setRoutes(routes);
    }

    await this.autoReload(options.autoReload, false);

    this.isStarted = true;
  }

  async stop() {
    if (this.isStopping || !this.isStarted)
      return;

    this.getLogger().log('Shutting down...');

    this.isStopping = true;
    this.isStarted = false;

    await this.autoReload(false, true);

    if (this.server)
      await this.server.stop();

    if (this.dbConnection)
      await this.dbConnection.close();

    this.getLogger().log('Shut down complete!');
  }
}

module.exports = {
  Application,
};
