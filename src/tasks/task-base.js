class TaskBase {
  constructor(application, logger, runID) {
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
      'runID': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        runID,
      },
    });
  }

  async start() {
  }

  async stop() {

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

  getRunID() {
    return this.runID;
  }

  getNumberOfWorkers() {
    var workers = this.constructor.workers || 1;
    return workers;
  }

  getModel(name) {
    var application = this.application;
    return application.getModel(name);
  }

  getModels() {
    var application = this.application;
    return application.getModels();
  }

  getDBConnection() {
    var application = this.application;
    return application.getDBConnection();
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

  static getFrequency(Task, taskIndex) {
    return Task._frequency || 0;
  }

  static getStartDelay(Task, taskIndex) {
    var workers     = Task.workers || 1;
    var frequency   = Task.getFrequency(taskIndex);
    var startDelay  = Task._startDelay || 0;

    if (workers > 1) {
      var shift = (frequency / workers);
      startDelay = startDelay + (shift * taskIndex);
    }

    return startDelay;
  }

  static shouldRun(Task, taskIndex, lastTime, currentTime, diff) {
    if (!lastTime) {
      if (diff >= Task.getStartDelay(taskIndex))
        return true;

      return false;
    }

    if (diff >= Task.getFrequency(taskIndex))
      return true;

    return false;
  }
}

module.exports = {
  TaskBase,
};
