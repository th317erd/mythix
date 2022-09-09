'use strict';

const { Model: _Model } = require('mythix-orm');

class Model extends _Model {
  static getModel(modelName) {
    if (modelName) {
      let connection = this.getConnection();
      return connection.getModel(modelName);
    }

    return this;
  }

  static getModels() {
    let connection = this.getConnection();
    return connection.getModels();
  }

  getModel(modelName) {
    return this.constructor.getModel(modelName);
  }

  getModels() {
    return this.constructor.getModels();
  }

  getApplication() {
    return this.constructor.getApplication();
  }

  getLogger() {
    let application = this.getApplication();
    return application.getLogger();
  }

  getDBConnection(connection) {
    if (connection)
      return connection;

    let application = this.getApplication();
    if (!application)
      return null;

    if (typeof application.getDBConnection === 'function')
      return application.getDBConnection();

    return null;
  }

  getConnection(connection) {
    if (connection)
      return connection;

    return this.getDBConnection();
  }
}

module.exports = { Model };
