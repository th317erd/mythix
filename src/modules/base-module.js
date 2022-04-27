'use strict';

class BaseModule {
  constructor(application) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumberable:  false,
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

module.exports = {
  BaseModule,
};
