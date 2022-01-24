class TaskBase {
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

  getModels() {
    var application = this.application;
    return application.getModels();
  }

  getFrequency() {
    return this.constructor.getFrequency();
  }

  getStartDelay() {
    return this.constructor.getStartDelay();
  }

  static onTaskClassCreate(Klass) {
    Klass.getFrequency  = Klass.getFrequency.bind(this, Klass);
    Klass.getStartDelay = Klass.getStartDelay.bind(this, Klass);
    Klass.shouldRun     = Klass.shouldRun.bind(this, Klass);

    return Klass;
  }

  static getFrequency(Task) {
    return Task._frequency || 0;
  }

  static getStartDelay(Task) {
    return Task._startDelay || 0;
  }

  static shouldRun(Task, lastTime, currentTime, diff) {
    if (!lastTime) {
      if (diff >= Task.getStartDelay())
        return true;

      return false;
    }

    if (diff >= Task.getFrequency())
      return true;

    return false;
  }
}

module.exports = {
  TaskBase,
};
