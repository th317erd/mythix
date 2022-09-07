'use strict';

/* global __dirname */

const Path        = require('path');
const BaseModule  = require('../modules/base-module');
const {
  fileNameWithoutExtension,
  walkDir,
} = require('../utils');

class ModelModule extends BaseModule {
  static fileWatcherQueueName = 'models';

  static getModuleName() {
    return 'ModelModule';
  }

  static shouldUse(options) {
    if (options.database === false)
      return false;

    return true;
  }

  constructor(application) {
    super(application);

    // Inject methods into the application
    Object.defineProperties(application, {
      'getModel': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.getModel.bind(this),
      },
      'getModels': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.getModels.bind(this),
      },
    });
  }

  fileWatcherGetMonitorPaths(options) {
    return [ options.modelsPath ];
  }

  async fileWatcherHandler(options) {
    await this.loadModels(options.modelsPath);
  }

  getModelFilePaths(modelsPath) {
    let modelFiles = walkDir(modelsPath, {
      filter: (fullFileName, fileName, stats) => {
        if (fileName.match(/^_/))
          return false;

        if (stats.isFile() && !fileNameWithoutExtension(fileName).match(/-model$/))
          return false;

        return true;
      },
    });

    let application = this.getApplication();
    let options     = application.getOptions();

    if (options.noInternalMigrationTable !== true)
      modelFiles.push(Path.resolve(__dirname, 'migration-model.js'));

    return modelFiles;
  }

  loadModels(modelsPath) {
    let application = this.getApplication();
    let connection  = (typeof application.getDBConnection === 'function') ? application.getDBConnection() : null;
    let dbConfig    = (typeof application.getDBConfig === 'function') ? application.getDBConfig() : null;
    let modelFiles  = this.getModelFilePaths(modelsPath);
    let models      = {};
    let args        = { application, connection, dbConfig };

    for (let i = 0, il = modelFiles.length; i < il; i++) {
      let modelFile = modelFiles[i];

      try {
        let modelGenerator = require(modelFile);
        if (modelGenerator['default'] && typeof modelGenerator['default'] === 'function')
          modelGenerator = modelGenerator['default'];

        Object.assign(models, modelGenerator(args));
      } catch (error) {
        this.getLogger().error(`Error while loading model ${modelFile}: `, error);
        throw error;
      }
    }

    models = connection.registerModels(models);

    return models;
  }

  getModel(modelName) {
    let application = this.getApplication();
    let connection  = (typeof application.getDBConnection === 'function') ? application.getDBConnection() : null;
    if (!connection)
      return;

    return connection.getModel(modelName);
  }

  getModels() {
    let application = this.getApplication();
    let connection  = (typeof application.getDBConnection === 'function') ? application.getDBConnection() : null;
    if (!connection)
      return {};

    return connection.getModels();
  }

  async start(options) {
    await this.loadModels(options.modelsPath);
  }

  async stop() {
  }
}

module.exports = ModelModule;
