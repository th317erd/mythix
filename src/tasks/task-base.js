'use strict';

class TaskBase {
  static onTaskClassCreate(Klass) {
    Klass.getFrequency  = Klass.getFrequency.bind(this, Klass);
    Klass.getStartDelay = Klass.getStartDelay.bind(this, Klass);
    Klass.shouldRun     = Klass.shouldRun.bind(this, Klass);

    return Klass;
  }

  // eslint-disable-next-line no-unused-vars
  static getFrequency(Task, taskIndex) {
    return Task._frequency || 0;
  }

  static getStartDelay(Task, taskIndex) {
    let workers     = Task.workers || 1;
    let frequency   = Task.getFrequency(taskIndex);
    let startDelay  = Task._startDelay || 0;

    if (workers > 1) {
      let shift = (frequency / workers);
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

  constructor(application, logger, runID) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        application,
      },
      'logger': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        logger,
      },
      'runID': {
        writable:     false,
        enumerable:   false,
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
    let logger = this.logger;
    if (!logger) {
      let application = this.getApplication();
      logger = application.getLogger();
    }

    return logger;
  }

  getRunID() {
    return this.runID;
  }

  getNumberOfWorkers() {
    let workers = this.constructor.workers || 1;
    return workers;
  }

  getModel(name) {
    let application = this.getApplication();
    return application.getModel(name);
  }

  getModels() {
    let application = this.getApplication();
    return application.getModels();
  }

  getDBConnection() {
    let application = this.getApplication();
    return application.getDBConnection();
  }

  getFrequency(task, taskIndex) {
    return this.constructor.getFrequency(task, taskIndex);
  }

  getStartDelay(task, taskIndex) {
    return this.constructor.getStartDelay(task, taskIndex);
  }
}

module.exports = TaskBase;
