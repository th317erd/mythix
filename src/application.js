'use strict';

/* global process, __dirname */

const Nife                    = require('nife');
const Path                    = require('path');
const EventEmitter            = require('events');
const { Sequelize }           = require('sequelize');
const chokidar                = require('chokidar');
const { Logger }              = require('./logger');
const { HTTPServer }          = require('./http-server');
const { buildModelRelations } = require('./models/model-utils');
const { buildRoutes }         = require('./controllers/controller-utils');
const {
  wrapConfig,
  fileNameWithoutExtension,
  walkDir,
} = require('./utils');

const MILLISECONDS_PER_SECOND = 1000;
const TASK_MAX_FAIL_ATTEMPTS = 5;

function nowInSeconds() {
  return Date.now() / MILLISECONDS_PER_SECOND;
}

// Trace what is requesting the application exit

// (function doExit(_exit) {
//   process.exit = function() {
//     console.trace('EXIT');
//     return _exit.apply(process, arguments);
//   };
// })(process.exit);

let globalTaskRunID = 1;

class Application extends EventEmitter {
  static APP_NAME = 'mythix';

  constructor(_opts) {
    super();

    let ROOT_PATH = (_opts && _opts.rootPath) ? _opts.rootPath : Path.resolve(__dirname);

    let opts = Nife.extend(true, {
      appName:          this.constructor.APP_NAME,
      rootPath:         ROOT_PATH,
      configPath:       Path.resolve(ROOT_PATH, 'config'),
      migrationsPath:   Path.resolve(ROOT_PATH, 'migrations'),
      modelsPath:       Path.resolve(ROOT_PATH, 'models'),
      seedersPath:      Path.resolve(ROOT_PATH, 'seeders'),
      controllersPath:  Path.resolve(ROOT_PATH, 'controllers'),
      templatesPath:    Path.resolve(ROOT_PATH, 'templates'),
      commandsPath:     Path.resolve(ROOT_PATH, 'commands'),
      tasksPath:        Path.resolve(ROOT_PATH, 'tasks'),
      logger:           {
        rootPath: ROOT_PATH,
      },
      database:   {},
      httpServer: {
        routeParserTypes: undefined,
        middleware:       null,
      },
      autoReload:         (process.env.NODE_ENV || 'development') === 'development',
      exitOnShutdown:     null,
      runTasks:           true,
      testMode:           false,
    }, _opts || {});

    Object.defineProperties(this, {
      'dbConnection': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'isStarted': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        false,
      },
      'isStopping': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        false,
      },
      'options': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        opts,
      },
      'controllers': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
      'models': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
      'server': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'fileWatcher': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'tasks': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
      'taskInfo': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
    });

    Object.defineProperties(this, {
      'config': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        this.loadConfig(opts.configPath),
      },
    });

    Object.defineProperties(this, {
      'logger': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.createLogger(
          Object.assign({}, this.getConfigValue('logger', {}), opts.logger || {}),
          Logger,
        ),
      },
    });

    this.bindToProcessSignals();
  }

  async autoReload(_set, shuttingDown) {
    let options = this.getOptions();
    if (arguments.length === 0)
      return options.autoReload;

    let set = !!_set;

    if (!shuttingDown)
      options.autoReload = set;

    if (this.fileWatcher) {
      try {
        await this.fileWatcher.close();
      } catch (error) {
        console.error(error);
      }
    }

    if (shuttingDown)
      return;

    if (!set)
      return;

    let getFileScope = (path) => {
      if (path.substring(0, options.controllersPath.length) === options.controllersPath)
        return 'controllers';

      if (path.substring(0, options.modelsPath.length) === options.modelsPath)
        return 'models';

      if (path.substring(0, options.tasksPath.length) === options.tasksPath)
        return 'tasks';

      return 'default';
    };

    const filesChanged = (eventName, path) => {
      if (filesChangedTimeout)
        clearTimeout(filesChangedTimeout);

      let scopeName = getFileScope(path);
      let scope     = filesChangedQueue[scopeName];
      if (!scope)
        scope = filesChangedQueue[scopeName] = {};

      scope[path] = eventName;

      filesChangedTimeout = setTimeout(() => {
        this.watchedFilesChanged(Object.assign({}, filesChangedQueue));

        filesChangedTimeout = null;
        filesChangedQueue = {};
      }, 500);
    };

    let filesChangedQueue = {};
    let filesChangedTimeout;

    this.fileWatcher = chokidar.watch([ options.modelsPath, options.controllersPath, options.tasksPath ], {
      persistent:     true,
      followSymlinks: true,
      usePolling:     false,
      ignoreInitial:  true,
      interval:       200,
      binaryInterval: 500,
      depth:          10,
    });

    this.fileWatcher.on('all', filesChanged);
  }

  async watchedFilesChanged(files) {
    const flushRequireCache = (path) => {
      try {
        delete require.cache[require.resolve(path)];
      } catch (error) {
        console.error('Error while trying to flush require cache to reload modified files: ', error);
      }
    };

    const flushRequireCacheForFiles = (type, filesToFlushCache) => {
      for (let i = 0, il = filesToFlushCache.length; i < il; i++) {
        let fileName = filesToFlushCache[i];
        flushRequireCache(fileName);

        this.getLogger().info(`Loading ${type} ${fileName}...`);
      }
    };

    let options   = this.getOptions();
    let handlers  = {
      'controllers': {
        type:           'controller',
        reloadHandler:  async () => {
          if (!this.server)
            return;

          let controllers = await this.loadControllers(options.controllersPath, this.server);
          this.controllers = controllers;
        },
      },
      'models': {
        type:           'model',
        reloadHandler:  async () => {
          if (!options.database)
            return;

          let models = await this.loadModels(options.modelsPath, options.database);
          this.models = models;
        },
      },
      'tasks': {
        type:           'tasks',
        reloadHandler:  async () => {
          await this.waitForAllTasksToFinish();

          let tasks = await this.loadTasks(options.tasksPath, options.database);

          this.tasks    = tasks;
          this.taskInfo = { _startTime: nowInSeconds() };

          this.startTasks();
        },
      },
    };

    let handlerNames = Object.keys(handlers);
    for (let i = 0, il = handlerNames.length; i < il; i++) {
      let handlerName = handlerNames[i];
      let handler     = handlers[handlerName];
      let scope       = files[handlerName];
      let fileNames   = Object.keys(scope || {});

      if (Nife.isEmpty(fileNames))
        continue;

      let {
        type,
        reloadHandler,
      } = handler;

      flushRequireCacheForFiles(type, fileNames);

      try {
        await reloadHandler();
      } catch (error) {
        this.getLogger().error(`Error while attempting to reload ${handlerName}`, error);
      }
    }
  }

  bindToProcessSignals() {
    process.on('SIGINT',  this.stop.bind(this));
    process.on('SIGTERM', this.stop.bind(this));
    process.on('SIGHUP',  this.stop.bind(this));
  }

  getOptions() {
    return this.options;
  }

  setOptions(opts) {
    if (!opts)
      return;

    let options = this.getOptions();
    Nife.extend(true, options, opts);

    return this;
  }

  loadConfig(configPath) {
    try {
      const config = require(configPath);
      return wrapConfig(config);
    } catch (error) {
      this.getLogger().error(`Error while trying to load application configuration ${configPath}: `, error);
      throw error;
    }
  }

  getConfigValue(key, defaultValue, type) {
    let result = this.config.ENV(key, defaultValue);

    // Coerce to type, if type was specified
    if (type)
      Nife.coerceValue(result, type);

    return result;
  }

  getConfig() {
    return this.config;
  }

  setConfig(opts) {
    Nife.extend(true, this.config.CONFIG, opts);
    return this;
  }

  getApplicationName() {
    let options = this.getOptions();
    return options.appName;
  }

  getModelFilePaths(modelsPath) {
    return walkDir(modelsPath, {
      filter: (fullFileName, fileName, stats) => {
        if (fileName.match(/^_/))
          return false;

        if (stats.isFile() && !fileNameWithoutExtension(fileName).match(/-model$/))
          return false;

        return true;
      },
    });
  }

  loadModels(modelsPath, dbConfig) {
    let modelFiles  = this.getModelFilePaths(modelsPath);
    let models      = {};
    let args        = { application: this, Sequelize, connection: this.dbConnection, dbConfig };

    for (let i = 0, il = modelFiles.length; i < il; i++) {
      let modelFile = modelFiles[i];

      try {
        let modelGenerator = require(modelFile);
        if (modelGenerator['default'] && typeof modelGenerator['default'] === 'function')
          modelGenerator = modelGenerator['default'];

        Object.assign(models, modelGenerator(args));
      } catch (error) {
        this.getLogger().error(`Error while loading model ${modelFile}: `, error);
        throw error;
      }
    }

    buildModelRelations(models);

    Object.defineProperties(models, {
      '_files': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        modelFiles,
      },
    });

    return models;
  }

  getModel(name) {
    let models = this.models;
    return models[name];
  }

  getModels() {
    return this.models || {};
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

  loadControllers(controllersPath, server) {
    let controllerFiles = this.getControllerFilePaths(controllersPath);
    let controllers     = {};
    let args            = { application: this, server };

    for (let i = 0, il = controllerFiles.length; i < il; i++) {
      let controllerFile = controllerFiles[i];

      try {
        let controllerGenerator = require(controllerFile);
        if (controllerGenerator['default'] && typeof controllerGenerator['default'] === 'function')
          controllerGenerator = controllerGenerator['default'];

        Object.assign(controllers, controllerGenerator(args));
      } catch (error) {
        this.getLogger().error(`Error while loading model ${controllerFile}: `, error);
        throw error;
      }
    }

    Object.defineProperties(controllers, {
      '_files': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        controllerFiles,
      },
    });

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

  getRoutes() {
    throw new Error('Error: child application expected to implement "getRoutes" method');
  }

  getCustomRouteParserTypes() {
    let options = this.getOptions();
    return options.routeParserTypes;
  }

  buildRoutes(server, routes) {
    let customParserTypes = this.getCustomRouteParserTypes(server, routes);
    return buildRoutes(routes, customParserTypes);
  }

  getTaskFilePaths(tasksPath) {
    return walkDir(tasksPath, {
      filter: (fullFileName, fileName, stats) => {
        if (fileName.match(/^_/))
          return false;

        if (stats.isFile() && !fileNameWithoutExtension(fileName).match(/-task$/))
          return false;

        return true;
      },
    });
  }

  loadTasks(tasksPath, dbConfig) {
    let taskFiles = this.getTaskFilePaths(tasksPath);
    let tasks     = {};
    let args      = { application: this, Sequelize, connection: this.dbConnection, dbConfig };

    for (let i = 0, il = taskFiles.length; i < il; i++) {
      let taskFile = taskFiles[i];

      try {
        let taskGenerator = require(taskFile);
        if (taskGenerator['default'] && typeof taskGenerator['default'] === 'function')
          taskGenerator = taskGenerator['default'];

        Object.assign(tasks, taskGenerator(args));
      } catch (error) {
        this.getLogger().error(`Error while loading task ${taskFile}: `, error);
        throw error;
      }
    }

    Object.defineProperties(tasks, {
      '_files': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        taskFiles,
      },
    });

    return tasks;
  }

  async runTasks() {
    const executeTask = (TaskKlass, taskIndex, taskInfo, lastTime, currentTime, diff) => {
      const createTaskLogger = () => {
        let logger = this.getLogger();
        return logger.clone({ formatter: (output) => `[[ Running task ${taskName}[${taskIndex}](${runID}) @ ${currentTime} ]]: ${output}`});
      };

      const successResult = (value) => {
        taskInfo.failedCount = 0;
        promise.resolve(value);
      };

      const errorResult = (error) => {
        let thisLogger = logger;
        if (!thisLogger)
          thisLogger = this.getLogger();

        thisLogger.error(`Task "${taskName}[${taskIndex}]" failed with an error: `, error);

        promise.reject(error);
      };

      const runTask = () => {
        let result = taskInstance.execute(lastTime, currentTime, diff);

        if (Nife.instanceOf(result, 'promise')) {
          result.then(
            successResult,
            errorResult,
          );
        } else
          promise.resolve(result);

      };

      let taskName      = TaskKlass.taskName;
      let promise       = Nife.createResolvable();
      let taskInstance  = taskInfo.taskInstance;
      let runID;
      let logger;

      if (!TaskKlass.keepAlive || !taskInstance) {
        globalTaskRunID++;

        // eslint-disable-next-line no-magic-numbers
        runID = `${Math.floor(Date.now() + (Math.random() * 1000000)) + globalTaskRunID}-${taskIndex}`;
      }

      taskInfo.runID = runID;

      // No op, since promises are handled differently here
      promise.then(() => {}, () => {});

      try {
        if (!TaskKlass.keepAlive || !taskInstance) {
          logger        = createTaskLogger();
          taskInstance  = new TaskKlass(this, logger, runID, { lastTime, currentTime, diff });

          taskInfo.taskInstance = taskInstance;

          taskInstance.start().then(runTask, errorResult);
        } else {
          logger = taskInstance.getLogger();
          runTask();
        }
      } catch (error) {
        errorResult(error);
      }

      return promise;
    };

    const handleTask = (taskName, taskKlass, taskInfo, taskIndex, failAfterAttempts) => {
      let lastTime      = taskInfo.lastTime;
      let startTime     = lastTime || allTasksInfo._startTime;
      let diff          = (currentTime - startTime);
      let lastRunStatus = (taskInfo && taskInfo.promise && taskInfo.promise.status());

      if (lastRunStatus === 'pending')
        return;

      if (lastRunStatus === 'rejected') {
        taskInfo.promise = null;
        taskInfo.failedCount++;

        if (taskInfo.failedCount >= failAfterAttempts)
          this.getLogger().error(`Task "${taskName}[${taskIndex}]" failed permanently after ${taskInfo.failedCount} failed attempts`);

        return;
      }

      if (taskInfo.failedCount >= failAfterAttempts)
        return;

      if (!taskKlass.shouldRun(taskIndex, lastTime, currentTime, diff))
        return;

      taskInfo.lastTime = currentTime;
      taskInfo.promise = executeTask(taskKlass, taskIndex, taskInfo, lastTime, currentTime, diff);
    };

    const handleTaskQueue = (taskName, taskKlass, infoForTasks) => {
      let failAfterAttempts = taskKlass.failAfterAttempts || TASK_MAX_FAIL_ATTEMPTS;
      let workers           = taskKlass.workers || 1;

      for (let taskIndex = 0; taskIndex < workers; taskIndex++) {
        let taskInfo = infoForTasks[taskIndex];
        if (!taskInfo)
          taskInfo = infoForTasks[taskIndex] = { failedCount: 0, promise: null, stop: false };

        if (taskInfo.stop)
          continue;

        handleTask(taskName, taskKlass, taskInfo, taskIndex, failAfterAttempts);
      }
    };

    let currentTime   = nowInSeconds();
    let allTasksInfo  = this.taskInfo;
    let tasks         = this.tasks;
    let taskNames     = Object.keys(tasks);

    for (let i = 0, il = taskNames.length; i < il; i++) {
      let taskName  = taskNames[i];
      let taskKlass = tasks[taskName];
      if (taskKlass.enabled === false)
        continue;

      let tasksInfo = allTasksInfo[taskName];
      if (!tasksInfo)
        tasksInfo = allTasksInfo[taskName] = [];

      handleTaskQueue(taskName, taskKlass, tasksInfo);
    }
  }

  stopTasks() {
    let intervalTimerID = (this.tasks && this.tasks._intervalTimerID);
    if (intervalTimerID) {
      clearInterval(intervalTimerID);
      this.tasks._intervalTimerID = null;
    }
  }

  async startTasks(flushTaskInfo) {
    this.stopTasks();

    if (!this.tasks)
      this.tasks = {};

    Object.defineProperties(this.tasks, {
      '_intervalTimerID': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        setInterval(this.runTasks.bind(this), 1 * MILLISECONDS_PER_SECOND),
      },
    });

    if (flushTaskInfo !== false)
      this.taskInfo = { _startTime: nowInSeconds() };
    else
      this.taskInfo._startTime = nowInSeconds();

  }

  iterateAllTaskInfos(callback) {
    let tasks         = this.tasks;
    let allTasksInfo  = this.taskInfo;
    let taskNames     = Object.keys(tasks);

    for (let i = 0, il = taskNames.length; i < il; i++) {
      let taskName  = taskNames[i];
      let tasksInfo = allTasksInfo[taskName];
      if (!tasksInfo)
        continue;

      for (let j = 0, jl = tasksInfo.length; j < jl; j++) {
        let taskInfo = tasksInfo[j];
        callback(taskInfo, j, taskName);
      }
    }
  }

  getAllTaskPromises() {
    let promises = [];

    this.iterateAllTaskInfos((taskInfo) => {
      let promise = taskInfo.promise;
      if (promise)
        promises.push(promise);
    });

    return promises;
  }

  async waitForAllTasksToFinish() {
    // Request all tasks to stop
    this.iterateAllTaskInfos((taskInfo) => (taskInfo.stop = true));

    // Stop the tasks interval timer
    this.stopTasks();

    // Await on all running tasks to complete
    let promises = this.getAllTaskPromises();
    if (promises && promises.length) {
      try {
        await Promise.allSettled(promises);
      } catch (error) {
        this.getLogger().error('Error while waiting for tasks to finish: ', error);
      }
    }

    promises = [];

    this.iterateAllTaskInfos((taskInfo) => {
      let taskInstance = taskInfo.taskInstance;
      if (!taskInstance)
        return;

      promises.push(taskInstance.stop());
    });

    if (promises && promises.length) {
      try {
        await Promise.allSettled(promises);
      } catch (error) {
        this.getLogger().error('Error while stopping tasks: ', error);
      }
    }
  }

  createLogger(loggerOpts, LoggerClass) {
    return new LoggerClass(loggerOpts);
  }

  getLogger() {
    if (!this.logger)
      return console;

    return this.logger;
  }

  async connectToDatabase(databaseConfig) {
    if (!databaseConfig) {
      this.getLogger().error('Error: database connection options not defined');
      return;
    }

    let sequelize = new Sequelize(databaseConfig);
    let dbConnectionString;

    if (Nife.instanceOf(databaseConfig, 'string'))
      dbConnectionString = databaseConfig;
    else
      dbConnectionString = `${databaseConfig.dialect}://${databaseConfig.host}:${databaseConfig.port || '<default port>'}/${databaseConfig.database}`;

    try {
      await sequelize.authenticate();

      this.getLogger().info(`Connection to ${dbConnectionString} has been established successfully!`);

      return sequelize;
    } catch (error) {
      this.getLogger().error(`Unable to connect to database ${dbConnectionString}:`, error);
      throw error;
    }
  }

  getDBConnection() {
    return this.dbConnection;
  }

  async createHTTPServer(options) {
    let server = new HTTPServer(this, options);

    await server.start();

    return server;
  }

  getDBTablePrefix(userSpecifiedPrefix) {
    if (Nife.isNotEmpty(userSpecifiedPrefix))
      return userSpecifiedPrefix;

    return `${this.getApplicationName()}_`;
  }

  async start() {
    let options = this.getOptions();

    let databaseConfig = this.getConfigValue('database.{environment}');
    if (!databaseConfig)
      databaseConfig = this.getConfigValue('database');

    databaseConfig = Nife.extend(true, {}, databaseConfig || {}, options.database || {});

    if (options.database !== false) {
      if (Nife.isEmpty(databaseConfig)) {
        this.getLogger().error(`Error: database connection for "${this.getConfigValue('environment')}" not defined`);
        return;
      }

      if (options.testMode)
        databaseConfig.logging = false;
      else
        databaseConfig.logging = (this.getLogger().isDebugLevel()) ? this.getLogger().log.bind(this.getLogger()) : false;


      databaseConfig.tablePrefix = this.getDBTablePrefix(databaseConfig.tablePrefix);

      this.dbConnection = await this.connectToDatabase(databaseConfig);

      this.setOptions({ database: databaseConfig });
    }

    if (options.httpServer !== false) {
      let httpServerConfig = this.getConfigValue('httpServer.{environment}');
      if (!httpServerConfig)
        httpServerConfig = this.getConfigValue('httpServer');

      httpServerConfig = Nife.extend(true, {}, httpServerConfig || {}, options.httpServer || {});
      if (Nife.isEmpty(httpServerConfig)) {
        this.getLogger().error(`Error: httpServer options for "${this.getConfigValue('environment')}" not defined`);
        return;
      }

      this.server = await this.createHTTPServer(httpServerConfig);

      this.setOptions({ httpServer: httpServerConfig });
    }

    if (options.database !== false) {
      let models = await this.loadModels(options.modelsPath, databaseConfig);
      this.models = models;
    }

    if (options.httpServer !== false) {
      let controllers = await this.loadControllers(options.controllersPath, this.server);
      this.controllers = controllers;

      let routes = await this.buildRoutes(this.server, this.getRoutes());
      this.server.setRoutes(routes);
    }

    if (options.runTasks !== false) {
      let tasks = await this.loadTasks(options.tasksPath, databaseConfig);
      this.tasks = tasks;

      this.startTasks();
    }

    await this.autoReload(options.autoReload, false);

    this.isStarted = true;

    this.emit('start');
  }

  async closeDBConnections() {
    if (this.dbConnection) {
      this.getLogger().info('Closing database connections...');
      await this.dbConnection.close();
      this.getLogger().info('All database connections closed successfully!');
    }
  }

  async stopHTTPServer() {
    if (this.server) {
      this.getLogger().info('Stopping HTTP server...');
      await this.server.stop();
      this.getLogger().info('HTTP server stopped successfully!');
    }
  }

  async stopAllTasks() {
    if (Nife.isNotEmpty(this.tasks) && this.tasks._intervalTimerID) {
      this.getLogger().info('Waiting for all tasks to complete...');
      await this.waitForAllTasksToFinish();
      this.getLogger().info('All tasks completed!');
    }
  }

  async stop(exitCode) {
    if (this.isStopping || !this.isStarted)
      return;

    try {
      this.getLogger().info('Shutting down...');

      this.isStopping = true;
      this.isStarted = false;

      await this.autoReload(false, true);

      await this.stopHTTPServer();

      await this.stopAllTasks();

      await this.closeDBConnections();

      this.getLogger().info('Shut down complete!');

      this.emit('stop');

      let options = this.getOptions();
      if (options.exitOnShutdown != null || exitCode != null) {
        let code = (exitCode != null) ? exitCode : options.exitOnShutdown;
        this.emit('exit', code);
        process.exit(code);
      }
    } catch (error) {
      this.getLogger().error('Error while shutting down: ', error);
    }
  }
}

module.exports = {
  Application,
};
