'use strict';

/* global process */

const Nife                  = require('nife');
const { Utils }             = require('mythix-orm');
const { Logger }            = require('../logger');
const { DatabaseModule }    = require('../modules/database-module');
const { HTTPInterface }     = require('./http-interface');
const { HTTPServerModule }  = require('../http-server/http-server-module');

class TestDatabaseModule extends DatabaseModule {
  getTablePrefix() {
    let app = this.getApplication();
    if (typeof app.getTestTablePrefix === 'function')
      return (app.getTestTablePrefix() || '');

    let prefix = super.getTablePrefix();
    return `${prefix.replace(/_test/g, '')}_test_`.replace(/_+/g, '_').replace(/\W+/g, '_');
  }
}

class TestHTTPServerModule extends HTTPServerModule {
  getHTTPServerConfig() {
    let httpServerConfig = super.getHTTPServerConfig();

    return Object.assign({}, httpServerConfig, {
      host:   'localhost',
      port:   0, // Select a random port
      https:  false,
    });
  }

  async createHTTPServer(httpServerConfig) {
    let server = await super.createHTTPServer(httpServerConfig);

    Object.defineProperties(this, {
      'host': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {
          hostname: httpServerConfig.host,
          port:     server.server.address().port,
        },
      },
    });

    this.getApplication().setDefaultURL(`http://${this.host.hostname}:${this.host.port}/`);

    return server;
  }
}

function createTestApplication(ApplicationClass) {
  const Klass = class TestApplication extends ApplicationClass {
    // Swap out modules for test config
    static getDefaultModules() {
      let defaultModules = ApplicationClass.getDefaultModules();

      defaultModules = ApplicationClass.replaceModule(defaultModules, DatabaseModule, TestDatabaseModule);
      defaultModules = ApplicationClass.replaceModule(defaultModules, HTTPServerModule, TestHTTPServerModule);

      return defaultModules;
    }

    constructor(_opts) {
      let opts = Nife.extend(true, {
        environment:  'test',
        autoReload:   false,
        runTasks:     false,
        testMode:     true,
        appName:      `${(Nife.isNotEmpty(ApplicationClass.APP_NAME)) ? ApplicationClass.APP_NAME : 'mythix'}_test`,
      }, _opts || {});

      super(opts);

      process.setMaxListeners(0);

      Object.defineProperties(this, {
        'httpInterface': {
          writable:     true,
          enumerable:   false,
          configurable: true,
          value:        new HTTPInterface(),
        },
      });

      if (!this.createDatabaseConnection) {
        this.createDatabaseConnection = (function createDatabaseConnection() {
          const NOOP = () => {};

          return {
            isStarted:      () => true,
            start:          NOOP,
            stop:           NOOP,
            registerModels: NOOP,
            getModels:      () => ({}),
          };
        }).bind(this);
      }
    }

    getTestingLoggerConfig(loggerOpts) {
      return Object.assign({}, {
        level:  Logger.LEVEL_ERROR,
        writer: null,
      }, loggerOpts || {});
    }

    createLogger(loggerOpts, LoggerClass) {
      return super.createLogger(this.getTestingLoggerConfig(loggerOpts), LoggerClass);
    }

    async start(...args) {
      let result = await super.start(...args);

      if (typeof this.getDBConnection === 'function') {
        let connection = this.getDBConnection();
        await this.createAllTables(connection);
      }

      return result;
    }

    async createAllTables(connection) {
      const createTable = async (connection, Model, options) => {
        return await connection.createTable(Model, options);
      };

      let models      = connection.getModels();
      let modelNames  = Object.keys(models);

      modelNames = Utils.sortModelNamesByCreationOrder(connection, modelNames);

      for (let i = 0, il = modelNames.length; i < il; i++) {
        let modelName = modelNames[i];
        let model     = models[modelName];

        await createTable(connection, model, { ifNotExists: true });
      }
    }

    async truncateAllTables(exclude) {
      let connection  = this.getDBConnection();
      let models      = this.getModels();
      let modelNames  = Object.keys(models);

      modelNames = Utils.sortModelNamesByCreationOrder(connection, modelNames);

      await connection.enableForeignKeyConstraints(false);

      try {
        for (let i = modelNames.length - 1; i >= 0; i--) {
          let modelName = modelNames[i];
          if (exclude && exclude.indexOf(modelName) >= 0)
            continue;

          let Model = models[modelName];
          await connection.truncate(Model);
        }
      } catch (error) {
        console.error('TRUNCATE ERROR: ', error);
      } finally {
        await connection.enableForeignKeyConstraints(true);
      }
    }

    async hijackModel(modelName, callback, runner) {
      let models = this.getModels();
      let OriginalModel = models[modelName];

      try {
        let Klass = callback.call(this, OriginalModel);

        let connection = this.getDBConnection();
        connection.registerModel(Klass);

        return await runner.call(this, Klass);
      } finally {
        models[modelName] = OriginalModel;
      }
    }

    getDefaultURL(...args) {
      return this.httpInterface.getDefaultURL(...args);
    }

    setDefaultURL(...args) {
      return this.httpInterface.setDefaultURL(...args);
    }

    async getDefaultHeader(...args) {
      return this.httpInterface.getDefaultHeader(...args);
    }

    async getDefaultHeaders(...args) {
      return this.httpInterface.getDefaultHeaders(...args);
    }

    async setDefaultHeader(...args) {
      return this.httpInterface.setDefaultHeader(...args);
    }

    async setDefaultHeaders(...args) {
      return this.httpInterface.setDefaultHeaders(...args);
    }

    async request(...args) {
      return this.httpInterface.request(...args);
    }

    async get(...args) {
      return this.httpInterface.getRequest(...args);
    }

    async post(...args) {
      return this.httpInterface.postRequest(...args);
    }

    async patch(...args) {
      return this.httpInterface.patchRequest(...args);
    }

    async put(...args) {
      return this.httpInterface.putRequest(...args);
    }

    async delete(...args) {
      return this.httpInterface.deleteRequest(...args);
    }

    async head(...args) {
      return this.httpInterface.headRequest(...args);
    }

    async options(...args) {
      return this.httpInterface.optionsRequest(...args);
    }
  };

  return Klass;
}

module.exports = { createTestApplication };
