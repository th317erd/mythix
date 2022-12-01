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

  getConnection(connection) {
    if (connection)
      return connection;

    let application = this.getApplication();
    if (!application)
      return null;

    if (typeof application.getConnection === 'function')
      return application.getConnection();

    return null;
  }

  // Deprecated
  getDBConnection(connection) {
    return this.getConnection(connection);
  }

  static _getConnection(_connection) {
    let connection = super._getConnection(_connection);
    if (connection)
      return connection;

    return this.getApplication().getConnection();
  }
}

module.exports = { Model };
