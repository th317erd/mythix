import Nife             from 'nife';
import { ModuleBase }   from '../modules/module-base.mjs';

export class ControllerModule extends ModuleBase {
  static getOptionsScopeName() {
    return 'controllers';
  }

  static shouldUse(application, options) {
    if (options.httpServer === false)
      return false;

    return true;
  }

  constructor(application, opts) {
    super(application, opts);

    let _controllers;

    Object.defineProperties(this, {
      'controllers': {
        enumerable:   false,
        configurable: true,
        get:          () => {
          if (!_controllers)
            _controllers = application.getAppControllerClasses();

          return _controllers;
        },
        set:          () => {},
      },
    });

    // Inject methods into the application
    Object.defineProperties(application, {
      'getController': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.getController.bind(this),
      },
    });
  }

  getController(name) {
    let controllers     = this.controllers;
    let controllerName  = name.replace(/(.*?)\b\w+$/, '$1');
    let methodName      = name.substring(controllerName.length);
    if (!methodName)
      methodName = undefined;

    controllerName = controllerName.replace(/\W+$/g, '');

    return {
      controller:       Nife.get(controllers, controllerName),
      controllerMethod: methodName,
    };
  }

  async start() {
    let application = this.getApplication();
    let httpServer  = (typeof application.getHTTPServer === 'function') ? application.getHTTPServer() : null;

    httpServer.setRoutes(application._getRoutes());
  }

  async stop() {
  }
}
