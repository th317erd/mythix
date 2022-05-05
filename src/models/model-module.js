'use strict';

/* global __dirname */

const Path                    = require('path');
const { Sequelize }           = require('sequelize');
const { BaseModule }          = require('../modules/base-module');
const { buildModelRelations } = require('./model-utils');
const {
  fileNameWithoutExtension,
  walkDir,
} = require('../utils');

class ModelModule extends BaseModule {
  static fileWatcherQueueName = 'models';

  static getName() {
    return 'ModelModule';
  }

  static shouldUse(options) {
    if (options.database === false)
      return false;

    return true;
  }

  constructor(application) {
    super(application);

    Object.defineProperties(this, {
      'models': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
    });

    // Inject methods into the application
    Object.defineProperties(application, {
      'getModel': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        this.getModel.bind(this),
      },
      'getModels': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        this.getModels.bind(this),
      },
    });
  }

  fileWatcherGetMonitorPaths(options) {
    return [ options.modelsPath ];
  }

  async fileWatcherHandler(options) {
    let models = await this.loadModels(options.modelsPath);
    this.models = models;
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
    let args        = { application, Sequelize, connection, dbConfig };

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
    let models = this.models;
    return models[name];
  }

  getModels() {
    return this.models || {};
  }

  async start(options) {
    let models = await this.loadModels(options.modelsPath);
    this.models = models;
  }

  async stop() {
  }
}

module.exports = {
  ModelModule,
};
