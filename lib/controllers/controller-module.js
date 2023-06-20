import Nife             from 'nife';
import { ModuleBase }   from '../modules/module-base.js';

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

    Object.defineProperties(this, {
      'controllers': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
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

  async start(options) {
    let application = this.getApplication();
    let httpServer  = (typeof application.getHTTPServer === 'function') ? application.getHTTPServer() : null;

    const mapControllerClassesToObject = () => {
      return Nife.iterate(options.controllers, ({ index, key, value, context }) => {
        let controllerName  = key;
        let ControllerClass = value;

        // If this is an array, then the
        // index will match the controller
        // name. In that case, pull the name
        // from the controller class directly.
        if (index === controllerName) {
          if (typeof ControllerClass.getControllerName === 'function')
            controllerName = ControllerClass.getControllerName();
          else
            controllerName = ControllerClass.name;
        }

        context[controllerName] = ControllerClass;
      }, {});
    };

    this.controllers = mapControllerClassesToObject();

    httpServer.setRoutes(application._getRoutes());
  }

  async stop() {
  }
}
