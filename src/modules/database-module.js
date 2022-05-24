'use strict';

const Nife            = require('nife');
const { Sequelize }   = require('sequelize');
const { BaseModule }  = require('../modules/base-module');

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
        enumberable:  false,
        configurable: true,
        value:        this.getTablePrefix.bind(this),
      },
      'getDBConnection': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        this.getConnection.bind(this),
      },
      'getDBConfig': {
        writable:     true,
        enumberable:  false,
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

    if (options.testMode)
      databaseConfig.logging = false;
    else
      databaseConfig.logging = (this.getLogger().isDebugLevel()) ? this.getLogger().log.bind(this.getLogger()) : false;

    return databaseConfig;
  }

  getTablePrefix() {
    let userSpecifiedPrefix = (this.databaseConfig) ? this.databaseConfig.tablePrefix : undefined;
    if (Nife.isNotEmpty(userSpecifiedPrefix))
      return userSpecifiedPrefix;

    return `${this.getApplication().getApplicationName()}_`;
  }

  getConnection() {
    return this.connection;
  }

  async connectToDatabase(databaseConfig) {
    if (!databaseConfig) {
      this.getLogger().error('Error: database connection options not defined');
      return;
    }

    let sequelize = new Sequelize(databaseConfig);
    let dbConnectionString;

    if (Nife.instanceOf(databaseConfig, 'string'))
      dbConnectionString = databaseConfig;
    else
      dbConnectionString = `${databaseConfig.dialect}://${databaseConfig.host}:${databaseConfig.port || '<default port>'}/${databaseConfig.database}`;

    try {
      await sequelize.authenticate();

      this.getLogger().info(`Connection to ${dbConnectionString} has been established successfully!`);

      // SQLite needs foreign keys TURNED ON
      // when we first connect (they default to off)
      let dialect = sequelize.getDialect();
      if (dialect === 'sqlite')
        await sequelize.query('PRAGMA foreign_keys = ON');

      return sequelize;
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
    await this.connection.close();
    this.getLogger().info('All database connections closed successfully!');
  }
}

module.exports = {
  DatabaseModule,
};
