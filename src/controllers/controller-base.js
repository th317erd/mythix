class ControllerBase {
  constructor(application, logger) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        application,
      },
      'logger': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        logger,
      },
    });
  }

  getApplication() {
    return this.application;
  }

  getLogger() {
    var logger = this.logger;
    if (!logger) {
      var application = this.getApplication();
      logger = application.getLogger();
    }

    return logger;
  }

  getModel(name) {
    var application = this.application;
    return application.getModel(name);
  }
}

module.exports = {
  ControllerBase,
};
