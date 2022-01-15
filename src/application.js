const Path                    = require('path');
const FileSystem              = require('fs');
const { Sequelize }           = require('sequelize');
const { wrapConfig }          = require('./utils');
const { Logger }              = require('./logger');
const { buildModelRelations } = require('./models/model-utils');

class Application {
  static APP_NAME = 'mythix';

  constructor(_opts) {
    var ROOT_PATH = (_opts && _opts.rootPath) ? _opts.rootPath : Path.resolve(__dirname);

    var opts = Object.assign({
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
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        opts,
      },
    });

    Object.defineProperties(this, {
      'config': {
        writable:     true,
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
      console.error(`Error while trying to load application configuration ${configPath}: `, error);
      throw error;
    }
  }

  loadModels(modelsPath) {
    var modelFiles  = FileSystem.readdirSync(modelsPath).filter((fileName) => !fileName.match(/^_/)).map((fileName) => Path.resolve(modelsPath, fileName));
    var models      = {};
    var args        = { app: this, Sequelize, connection: this.dbConnection };

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

  getConfigValue(key, defaultValue) {
    return this.config.ENV(key, defaultValue);
  }

  createLogger(loggerOpts, Logger) {
    return new Logger(loggerOpts);
  }

  getLogger() {
    return this.logger;
  }

  async connectToDatabase() {
    var databaseConfig  = this.getConfigValue('DATABASES.{ENVIRONMENT}');
    if (!databaseConfig) {
      this.getLogger().error(`Error: database connection for "${this.getConfigValue('ENVIRONMENT')}" not defined`);
      return;
    }

    var sequelize = new Sequelize(databaseConfig);

    var dbConnectionString = `${databaseConfig.dialect}://${databaseConfig.host}:${databaseConfig.port || '<default port>'}/${databaseConfig.database}`;
    try {
      await sequelize.authenticate();

      this.dbConnection = sequelize;

      this.getLogger().log(`Connection to ${dbConnectionString} has been established successfully!`);
    } catch (error) {
      this.getLogger().error(`Unable to connect to database ${dbConnectionString}:`, error);
      await this.stop();
    }
  }

  async start() {
    await this.connectToDatabase();

    this.isStarted = true;
  }

  async stop() {
    this.getLogger().log('Shutting down...');

    this.isStopping = true;
    this.isStarted = false;

    if (this.dbConnection)
      await this.dbConnection.close();

    this.getLogger().log('Shut down complete!');
  }
}

module.exports = {
  Application,
};
