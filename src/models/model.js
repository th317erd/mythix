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

  overrideMethod(name, newMethod) {
    let originalMethod = this[name];
    if (typeof originalMethod !== 'function')
      throw new TypeError(`Model: Error while attempting to override method "${name}: No such method found"`);

    let boundMethod = newMethod.bind(this, originalMethod.bind(this));
    boundMethod.unbound = newMethod;
    boundMethod.super = originalMethod;

    Object.defineProperties(this, {
      [name]: {
        writable:     true,
        enumerable:  false,
        configurable: true,
        value:        boundMethod,
      },
    });

    return originalMethod;
  }

  overrideMethods(methodsObj) {
    let keys = Object.keys(methodsObj);
    for (let i = 0, il = keys.length; i < il; i++) {
      let name    = keys[i];
      let method  = methodsObj[name];

      this.overrideMethod(name, method);
    }
  }
}

module.exports = {
  Model,
};
