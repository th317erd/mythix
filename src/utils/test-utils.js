const Nife        = require('nife');
const { Logger }  = require('../logger');
const HTTPUtils   = require('./http-utils');

function createTestApplication(Application) {
  const Klass = class TestApplication extends Application {
    static APP_NAME = `${(Nife.isNotEmpty(Application.APP_NAME)) ? Application.APP_NAME : 'mythix'}_test`;

    constructor(_opts) {
      let opts = Nife.extend(true, {
        autoReload: false,
        runTasks:   false,
        testMode:   true,
      }, _opts || {});

      super(opts);
    }

    getDBTablePrefix(userSpecifiedPrefix) {
      let prefix = super.getDBTablePrefix(userSpecifiedPrefix);
      return `${prefix.replace(/_test/g, '')}_test_`.replace(/_+/g, '_');
    }

    getTestingDatabaseConfig() {
      return { dialect: 'sqlite', logging: false };
    }

    getTestingHTTPServerConfig(options) {
      return Object.assign({}, options || {}, {
        host:   'localhost',
        port:   0, // Select a random port
        https:  false,
      });
    }

    getTestingLoggerConfig(loggerOpts) {
      return Object.assign({}, loggerOpts, {
        level:  Logger.ERROR,
        writer: null,
      });
    }

    createLogger(loggerOpts, Logger) {
      return super.createLogger(this.getTestingLoggerConfig(loggerOpts), Logger);
    }

    async connectToDatabase() {
      let connection = await super.connectToDatabase(this.getTestingDatabaseConfig());
      return connection;
    }

    async createHTTPServer(options) {
      let httpServerConfig  = this.getTestingHTTPServerConfig(options);
      let server            = await super.createHTTPServer(httpServerConfig);

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

      this.setDefaultURL(`http://${this.host.hostname}:${this.host.port}/`);

      return server;
    }

    async start(...args) {
      let result = await super.start(...args);

      let dbConnection = this.getDBConnection();
      await dbConnection.sync({ force: true, logging: false });

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
          await dbConnection.query(`DELETE FROM ${model.tableName}`);
        }
      } catch (error) {
        await dbConnection.query('PRAGMA foreign_keys = ON');
      }
    }

    getDefaultURL(...args) {
      return HTTPUtils.getDefaultURL(...args);
    }

    setDefaultURL(...args) {
      return HTTPUtils.setDefaultURL(...args);
    }

    async getDefaultHeader(...args) {
      return HTTPUtils.getDefaultHeader(...args);
    }

    async getDefaultHeaders(...args) {
      return HTTPUtils.getDefaultHeaders(...args);
    }

    async setDefaultHeader(...args) {
      return HTTPUtils.setDefaultHeader(...args);
    }

    async setDefaultHeaders(...args) {
      return HTTPUtils.setDefaultHeaders(...args);
    }

    async request(...args) {
      return HTTPUtils.request(...args);
    }

    async get(...args) {
      return HTTPUtils.get(...args);
    }

    async post(...args) {
      return HTTPUtils.post(...args);
    }

    async put(...args) {
      return HTTPUtils.put(...args);
    }

    async delete(...args) {
      return HTTPUtils.delete(...args);
    }

    async head(...args) {
      return HTTPUtils.head(...args);
    }

    async options(...args) {
      return HTTPUtils.options(...args);
    }
  };

  return Klass;
}

module.exports = {
  createTestApplication,
};
