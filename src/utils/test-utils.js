'use strict';

/* global process */

const Nife                  = require('nife');
const { Logger }            = require('../logger');
const HTTPUtils             = require('./http-utils');
const { HTTPInterface }     = require('./http-interface');
const { DatabaseModule }    = require('../modules/database-module');
const { HTTPServerModule }  = require('../http-server/http-server-module');

class TestDatabaseModule extends DatabaseModule {
  getDatabaseConfig() {
    let config = super.getDatabaseConfig();
    return Object.assign({}, config, { dialect: 'sqlite', storage: ':memory:' });
  }

  getTablePrefix() {
    let prefix = super.getTablePrefix();
    return `${prefix.replace(/_test/g, '')}_test_`.replace(/_+/g, '_');
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
        enumberable:  false,
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

function createTestApplication(Application) {
  const Klass = class TestApplication extends Application {
    static APP_NAME = `${(Nife.isNotEmpty(Application.APP_NAME)) ? Application.APP_NAME : 'mythix'}_test`;

    // Swap out modules for test config
    static getDefaultModules() {
      let defaultModules = Application.getDefaultModules();

      defaultModules = Application.replaceModule(defaultModules, DatabaseModule, TestDatabaseModule);
      defaultModules = Application.replaceModule(defaultModules, HTTPServerModule, TestHTTPServerModule);

      return defaultModules;
    }

    constructor(_opts) {
      let opts = Nife.extend(true, {
        autoReload: false,
        runTasks:   false,
        testMode:   true,
      }, _opts || {});

      super(opts);

      process.setMaxListeners(0);

      Object.defineProperties(this, {
        'httpInterface': {
          writable:     true,
          enumberable:  false,
          configurable: true,
          value:        new HTTPInterface(),
        },
      });
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
        let dbConnection = this.getDBConnection();
        await dbConnection.sync({ force: true, logging: false });
      }

      return result;
    }

    async truncateAllTables(exclude) {
      let dbConnection  = this.getDBConnection();
      let models        = this.getModels();
      let modelNames    = Object.keys(models);

      await dbConnection.query('PRAGMA foreign_keys = OFF');

      try {
        for (let i = 0, il = modelNames.length; i < il; i++) {
          let modelName = modelNames[i];
          if (exclude && exclude.indexOf(modelName) >= 0)
            continue;

          let model = models[modelName];
          await dbConnection.query(`DELETE FROM "${model.tableName}"`);
        }
      } catch (error) {
        console.error('TRUNCATE ERROR: ', error);
      } finally {
        await dbConnection.query('PRAGMA foreign_keys = ON');
      }
    }

    async hijackModel(modelName, callback, runner) {
      let models = this.getModels();
      let OriginalModel = models[modelName];

      try {
        let Klass = callback.call(this, OriginalModel);

        const modelConverter = (model) => {
          if (model == null)
            return model;

          if (model instanceof Array)
            return model.map(modelConverter);

          // Do a direct assign to "dataValues"
          // "set" modifies the id
          let newModelInstance = new Klass();
          Object.assign(newModelInstance.dataValues, model.dataValues);

          return newModelInstance;
        };

        const modelStaticBind = (name) => {
          const originalMethod = Klass[name];

          return (async function(...args) {
            let results = await originalMethod.call(Klass, ...args);
            return modelConverter(results);
          }).bind(Klass);
        };

        Klass.where = modelStaticBind('where');
        Klass.all = modelStaticBind('all');
        Klass.first = modelStaticBind('first');
        Klass.last = modelStaticBind('last');

        models[modelName] = Klass;

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

module.exports = {
  createTestApplication,
};
