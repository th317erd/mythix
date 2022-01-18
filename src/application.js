const Path                    = require('path');
const { Sequelize }           = require('sequelize');
const { Logger }              = require('./logger');
const { HTTPServer }          = require('./http-server');
const { buildModelRelations } = require('./models/model-utils');
const {
  wrapConfig,
  fileNameWithoutExtension,
} = require('./utils');

class Application {
  static APP_NAME = 'mythix';

  constructor(_opts) {
    var ROOT_PATH = (_opts && _opts.rootPath) ? _opts.rootPath : Path.resolve(__dirname);

    var opts = Object.assign({
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
      routeParserTypes: undefined,
    }, _opts);

    Object.defineProperties(this, {
      'dbConnection': {
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
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
      'models': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
      'server': {
        writable:     false,
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

  bindToProcessSignals() {
    process.on('SIGINT',  this.stop.bind(this));
    process.on('SIGTERM', this.stop.bind(this));
    process.on('SIGHUP',  this.stop.bind(this));
  }

  getOptions() {
    return this.options;
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

    return models;
  }

  getModel(name) {
    var models = this.models;
    return models[name];
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

    return controllers;
  }

  getController(name) {
    var controllers = this.controllers;
    return controllers[name];
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

  async createHTTPServer(options) {
    var server = new HTTPServer(options);

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
      databaseConfig.tablePrefix = `${options.appName}_`;

    this.dbConnection = await this.connectToDatabase(databaseConfig);

    var httpServerConfig = this.getConfigValue('SERVER.{ENVIRONMENT}');
    if (!httpServerConfig)
      httpServerConfig = this.getConfigValue('SERVER');

    this.server = await this.createHTTPServer(httpServerConfig);

    var models = await this.loadModels(options.modelsPath, databaseConfig);
    Object.assign(this.models, models);

    var controllers = await this.loadControllers(options.controllersPath, this.server);
    Object.assign(this.controllers, controllers);

    var routes = await this.buildRoutes(this.server, this.getRoutes());
    this.server.setRoutes(routes);

    this.isStarted = true;
  }

  async stop() {
    this.getLogger().log('Shutting down...');

    this.isStopping = true;
    this.isStarted = false;

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
