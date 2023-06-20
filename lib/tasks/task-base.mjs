import { DateTime }  from 'luxon';

export class TaskBase {
  static getWorkerCount() {
    return 1;
  }

  static getTaskName() {
    return this.name.toLowerCase().replace(/task$/i, '');
  }

  // eslint-disable-next-line no-unused-vars
  static nextRun(taskInstance, lastTime, currentTime, diff) {
    return DateTime.now().plus({ seconds: 60 });
  }

  constructor(application, logger, workerIndex) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        application,
      },
      'logger': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        logger,
      },
      'workerIndex': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        workerIndex || 0,
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
    if (this.logger)
      return this.logger;

    let application = this.getApplication();
    return application.getLogger();
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
}
