'use strict';

const Nife                = require('nife');
const BaseModule          = require('../modules/base-module');
const { ConnectionBase }  = require('mythix-orm');

class DatabaseModule extends BaseModule {
  static getModuleName() {
    return 'DatabaseModule';
  }

  static shouldUse(options) {
    if (options.database === false)
      return false;

    return true;
  }

  constructor(application) {
    super(application);

    Object.defineProperties(this, {
      'connection': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'databaseConfig': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
    });

    // Inject methods into the application
    Object.defineProperties(application, {
      'getDBTablePrefix': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.getTablePrefix.bind(this),
      },
      'getDBConnection': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.getConnection.bind(this),
      },
      'getDBConfig': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.getConfig.bind(this),
      },
    });
  }

  getConfig() {
    return this.databaseConfig;
  }

  getDatabaseConfig() {
    if (this.databaseConfig)
      return this.databaseConfig;

    let app     = this.getApplication();
    let options = app.getOptions();

    let databaseConfig = this.getConfigValue('database.{environment}');
    if (!databaseConfig)
      databaseConfig = this.getConfigValue('database');

    databaseConfig = Nife.extend(true, {}, databaseConfig || {}, options.database || {});

    if (Nife.isEmpty(databaseConfig)) {
      this.getLogger().error(`Error: database connection for "${this.getConfigValue('environment')}" not defined`);
      return;
    }

    databaseConfig.logging = (this.getLogger().isDebugLevel()) ? this.getLogger().log.bind(this.getLogger()) : false;

    return databaseConfig;
  }

  getTablePrefix() {
    let userSpecifiedPrefix = (this.databaseConfig) ? this.databaseConfig.tablePrefix : undefined;
    if (userSpecifiedPrefix != null)
      return ('' + userSpecifiedPrefix);

    return `${this.getApplication().getApplicationName()}_`.replace(/[^A-Za-z0-9_]+/g, '');
  }

  getConnection() {
    return this.connection;
  }

  async connectToDatabase(databaseConfig) {
    if (!databaseConfig)
      throw new Error('DatabaseModule::connectToDatabase: Database connection options not defined.');

    let dbConnectionString;
    if (Nife.instanceOf(databaseConfig, 'string'))
      dbConnectionString = databaseConfig;
    else
      dbConnectionString = `${databaseConfig.dialect}://${databaseConfig.host}:${databaseConfig.port || '<default port>'}/${databaseConfig.database}`;

    try {
      let app = this.getApplication();
      if (typeof app.createDatabaseConnection !== 'function')
        throw new Error('DatabaseModule::connectToDatabase: You must define a "createDatabaseConnection" method on your Application class.');

      let connection = await app.createDatabaseConnection(databaseConfig);
      if (!connection)
        throw new Error('DatabaseModule::connectToDatabase: Application::createDatabaseConnection must return a connection.');

      if (!(connection instanceof ConnectionBase) && typeof connection === 'function' && connection.prototype instanceof ConnectionBase) {
        const ConnectionKlass = connection;
        connection = new ConnectionKlass(databaseConfig);

        await connection.start();
      } else if (!connection.isStarted()) {
        await connection.start();
      }

      this.getLogger().info(`Connection to ${dbConnectionString} has been established successfully!`);

      return connection;
    } catch (error) {
      this.getLogger().error(`Unable to connect to database ${dbConnectionString}:`, error);
      throw error;
    }
  }

  async start(options) {
    if (options.database === false)
      return;

    let databaseConfig = this.databaseConfig = this.getDatabaseConfig();

    databaseConfig.tablePrefix = this.getTablePrefix();

    this.connection = await this.connectToDatabase(databaseConfig);

    this.getApplication().setOptions({ database: databaseConfig });
  }

  async stop() {
    if (!this.connection)
      return;

    this.getLogger().info('Closing database connections...');
    await this.connection.stop();
    this.getLogger().info('All database connections closed successfully!');
  }
}

module.exports = DatabaseModule;
