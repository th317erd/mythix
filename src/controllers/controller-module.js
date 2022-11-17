'use strict';

const Nife            = require('nife');
const { BaseModule }  = require('../modules/base-module');
const {
  fileNameWithoutExtension,
  walkDir,
} = require('../utils');

class ControllerModule extends BaseModule {
  static fileWatcherQueueName = 'controllers';

  static shouldUse(application, options) {
    if (options.httpServer === false)
      return false;

    return true;
  }

  static getModuleName() {
    return 'ControllerModule';
  }

  constructor(application) {
    super(application);

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

  fileWatcherGetMonitorPaths(options) {
    return [ options.controllersPath ];
  }

  async fileWatcherHandler(options) {
    let controllers = await this.loadControllers(options.controllersPath);
    this.controllers = controllers;
  }

  getControllerFilePaths(controllersPath) {
    return walkDir(controllersPath, {
      filter: (fullFileName, fileName, stats) => {
        if (fileName.match(/^_/))
          return false;

        if (stats.isFile() && !fileNameWithoutExtension(fileName).match(/-controller$/))
          return false;

        return true;
      },
    });
  }

  loadControllers(controllersPath) {
    let application     = this.getApplication();
    let httpServer      = (typeof application.getHTTPServer() === 'function') ? application.getHTTPServer() : null;
    let controllerFiles = this.getControllerFilePaths(controllersPath);
    let controllers     = {};
    let args            = { application, httpServer };

    for (let i = 0, il = controllerFiles.length; i < il; i++) {
      let controllerFile = controllerFiles[i];

      try {
        let controllerGenerator = require(controllerFile);
        if (controllerGenerator.__esModule)
          controllerGenerator = controllerGenerator['default'];

        Object.assign(controllers, controllerGenerator(args));
      } catch (error) {
        this.getLogger().error(`Error while loading model ${controllerFile}: `, error);
        throw error;
      }
    }

    return controllers;
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
    let controllers = await this.loadControllers(options.controllersPath);

    this.controllers = controllers;

    httpServer.setRoutes(application._getRoutes());
  }

  async stop() {
  }
}

module.exports = {
  ControllerModule,
};
