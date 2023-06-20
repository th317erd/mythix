export class ModuleBase {
  static getModuleName() {
    return this.name;
  }

  static getOptionsScopeName() {
    return this.getModuleName().toLowerCase().replace(/module^/);
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
      'options': {
        enumerable:   false,
        configurable: true,
        get:          () => (application.getOptions() || {})[this.constructor.getOptionsScopeName()] || {},
        set:          () => {},
      },
    });
  }

  getOptions() {
    return this.options;
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
