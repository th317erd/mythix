'use strict';

class BaseModule {
  static getModuleName() {
    throw new Error('BaseModule::getModuleName: Should not have been called. Child module must implement "static getModuleName(){}"');
  }

  static shouldUse() {
    return true;
  }

  constructor(application) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        application,
      },
    });
  }

  getApplication() {
    return this.application;
  }

  getLogger() {
    let application = this.getApplication();
    return application.getLogger();
  }

  getConfigValue(...args) {
    return this.getApplication().getConfigValue(...args);
  }

  async start() {
  }

  async stop() {
  }
}

module.exports = { BaseModule };
