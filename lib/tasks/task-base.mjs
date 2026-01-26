import { DateTime }  from 'luxon';
import { Utils }     from 'mythix-orm';

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

  /// Capture the current AsyncLocalStorage context and return a function
  /// that will execute callbacks within that captured context.
  ///
  /// This is useful for preserving database context across event emitters,
  /// setTimeout, or other callbacks where context might otherwise be lost.
  ///
  /// Return: Function
  ///   A function that takes a callback and executes it in the captured context.
  captureContext() {
    return Utils.captureContext();
  }

  /// Wrap a callback function to preserve the current AsyncLocalStorage context.
  ///
  /// This is a convenience wrapper for use with event handlers and other callbacks
  /// where you want to ensure database context is preserved.
  ///
  /// Arguments:
  ///   callback: Function
  ///     The callback function to wrap.
  ///
  /// Return: Function
  ///   A wrapped version of the callback that will execute in the captured context.
  bindCallback(callback) {
    return Utils.bindCallback(callback);
  }
}
