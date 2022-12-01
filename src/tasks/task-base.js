'use strict';

class TaskBase {
  static onTaskClassCreate(Klass) {
    return Klass;
  }

  // eslint-disable-next-line no-unused-vars
  static getFrequency(taskIndex) {
    return this._frequency || 0;
  }

  static getStartDelay(taskIndex) {
    let workers     = this.workers || 1;
    let frequency   = this.getFrequency(taskIndex);
    let startDelay  = this._startDelay || 0;

    if (workers > 1) {
      let shift = (frequency / workers);
      startDelay = startDelay + (shift * taskIndex);
    }

    return startDelay;
  }

  static shouldRun(taskIndex, lastTime, currentTime, diff) {
    if (!lastTime) {
      if (diff >= this.getStartDelay(taskIndex))
        return true;

      return false;
    }

    if (diff >= this.getFrequency(taskIndex))
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

  getConnection(connection) {
    let application = this.getApplication();
    return application.getConnection(connection);
  }

  // Deprecated
  getDBConnection(connection) {
    return this.getConnection(connection);
  }

  getFrequency(taskIndex) {
    return this.constructor.getFrequency(taskIndex);
  }

  getStartDelay(taskIndex) {
    return this.constructor.getStartDelay(taskIndex);
  }
}

module.exports = { TaskBase };
