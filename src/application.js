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

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

class Application extends EventEmitter {
  static APP_NAME = 'mythix';

  constructor(_opts) {
    super();

    var ROOT_PATH = (_opts && _opts.rootPath) ? _opts.rootPath : Path.resolve(__dirname);

    var opts = Nife.extend(true, {
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
          Object.assign({}, opts.logger || {}, this.getConfigValue('LOGGER', {})),
          Logger,
        ),
      },
    });

    this.bindToProcessSignals();
  }

  async autoReload(_set, shuttingDown) {
    var options = this.getOptions();
    if (arguments.length === 0)
      return options.autoReload;

    var set = !!_set;

    if (!shuttingDown)
      options.autoReload = set;

    if (this.fileWatcher)
      await this.fileWatcher.close();

    if (shuttingDown)
      return;

    if (set) {
      var getFileScope = (path) => {
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

        var scopeName = getFileScope(path);
        var scope     = filesChangedQueue[scopeName];
        if (!scope)
          scope = filesChangedQueue[scopeName] = {};

        scope[path] = eventName;

        filesChangedTimeout = setTimeout(() => {
          this.watchedFilesChanged(Object.assign({}, filesChangedQueue));

          filesChangedTimeout = null;
          filesChangedQueue = {};
        }, 500);
      };

      var filesChangedQueue = {};
      var filesChangedTimeout;

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
  }

  async watchedFilesChanged(files) {
    const flushRequireCache = (path) => {
      try {
        delete require.cache[require.resolve(path)];
      } catch (error) {}
    };

    const flushRequireCacheForFiles = (type, files) => {
      for (var i = 0, il = files.length; i < il; i++) {
        var fileName = files[i];
        flushRequireCache(fileName);

        this.getLogger().info(`Loading ${type} ${fileName}...`);
      }
    }

    var options   = this.getOptions();
    var handlers  = {
      'controllers': {
        type:           'controller',
        reloadHandler:  async () => {
          if (!this.server)
            return;

          var controllers = await this.loadControllers(options.controllersPath, this.server);
          this.controllers = controllers;
        },
      },
      'models': {
        type:           'model',
        reloadHandler:  async () => {
          if (!options.database)
            return;

          var models = await this.loadModels(options.modelsPath, options.database);
          this.models = models;
        },
      },
      'tasks': {
        type:           'tasks',
        reloadHandler:  async () => {
          this.stopTasks();

          var tasks = await this.loadTasks(options.tasksPath, options.database);

          this.tasks    = tasks;
          this.taskInfo = { _startTime: nowInSeconds() };

          this.startTasks();
        },
      },
    };

    var handlerNames = Object.keys(handlers);
    for (var i = 0, il = handlerNames.length; i < il; i++) {
      var handlerName = handlerNames[i];
      var handler     = handlers[handlerName];
      var scope       = files[handlerName];
      var fileNames   = Object.keys(scope || {});

      if (Nife.isEmpty(fileNames))
        continue;

      var {
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

    var options = this.getOptions();
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

  getConfigValue(key, defaultValue) {
    return this.config.ENV(key, defaultValue);
  }

  getConfig() {
    return this.config;
  }

  setConfig(opts) {
    Nife.extend(true, this.config.CONFIG, opts);
    return this;
  }

  getApplicationName() {
    var options = this.getOptions();
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
      }
    });
  }

  loadModels(modelsPath, dbConfig) {
    var modelFiles  = this.getModelFilePaths(modelsPath);
    var models      = {};
    var args        = { application: this, Sequelize, connection: this.dbConnection, dbConfig };

    for (var i = 0, il = modelFiles.length; i < il; i++) {
      var modelFile = modelFiles[i];

      try {
        var modelGenerator = require(modelFile);
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
    var models = this.models;
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
      }
    });
  }

  loadControllers(controllersPath, server) {
    var controllerFiles = this.getControllerFilePaths(controllersPath);
    var controllers     = {};
    var args            = { application: this, server };

    for (var i = 0, il = controllerFiles.length; i < il; i++) {
      var controllerFile = controllerFiles[i];

      try {
        var controllerGenerator = require(controllerFile);
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
    var controllers     = this.controllers;
    var controllerName  = name.replace(/(.*?)\b\w+$/, '$1');
    var methodName      = name.substring(controllerName.length);
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
    var options = this.getOptions();
    return options.routeParserTypes;
  }

  buildRoutes(server, routes) {
    var customParserTypes = this.getCustomRouteParserTypes(server, routes);
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
      }
    });
  }

  loadTasks(tasksPath, dbConfig) {
    var taskFiles = this.getTaskFilePaths(tasksPath);
    var tasks     = {};
    var args      = { application: this, Sequelize, connection: this.dbConnection, dbConfig };

    for (var i = 0, il = taskFiles.length; i < il; i++) {
      var taskFile = taskFiles[i];

      try {
        var taskGenerator = require(taskFile);
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
    const executeTask = (TaskKlass, lastTime, currentTime, diff) => {
      const createTaskLogger = (TaskKlass) => {
        var logger  = this.getLogger();
        var runID   = (Date.now() + Math.random()).toFixed(4);

        return logger.clone({ formatter: (output) => `[[ Running task ${taskName}(${runID}) @ ${currentTime} ]]: ${output}`});
      };

      const successResult = (value) => {
        var tasksInfo     = this.taskInfo;
        var thisTaskInfo  = tasksInfo[TaskClass.taskName];
        if (thisTaskInfo)
          thisTaskInfo.failedCount = 0;

        promise.resolve(value);
      };

      const errorResult = (error) => {
        var thisLogger = logger;
        if (!thisLogger)
          thisLogger = this.getLogger();

        thisLogger.error(`Task ${taskName} failed with an error: `, error);

        promise.reject(error);
      };

      var taskName  = TaskKlass.taskName;
      var promise   = Nife.createResolvable();

       // No op, since promises are handled differently here
      promise.then(() => {}, () => {});

      try {
        var logger        = createTaskLogger(TaskKlass);
        var taskInstance  = new TaskKlass(this, logger, { lastTime, currentTime, diff });
        var result        = taskInstance.execute(lastTime, currentTime, diff);

        if (Nife.instanceOf(result, 'promise')) {
          result.then(
            successResult,
            errorResult,
          );
        } else {
          promise.resolve(result);
        }
      } catch (error) {
        errorResult(error);
      }

      return promise;
    };

    var currentTime = nowInSeconds();
    var tasksInfo   = this.taskInfo;
    var tasks       = this.tasks;
    var taskNames   = Object.keys(tasks);

    for (var i = 0, il = taskNames.length; i < il; i++) {
      var taskName      = taskNames[i];
      var taskKlass     = tasks[taskName];
      var taskInfo      = tasksInfo[taskName] || { lastTime: null, failedCount: 0, promise: null };
      var lastTime      = taskInfo.lastTime;
      var startTime     = lastTime || tasksInfo._startTime;
      var diff          = (currentTime - startTime);
      var lastRunStatus = (taskInfo && taskInfo.promise && taskInfo.promise.status());
      var failAfter     = taskKlass.failAfterAttempts || 5;

      if (!tasksInfo[taskName])
        tasksInfo[taskName] = taskInfo;

      if (lastRunStatus === 'pending')
        continue;

      if (lastRunStatus === 'rejected') {
        taskInfo.promise = null;
        taskInfo.failedCount++;

        if (taskInfo.failedCount >= failAfter) {
          this.getLogger().error(`Task "${taskName}" failed permanently after ${taskInfo.failedCount} failed attempts`);
          continue;
        }

        continue;
      }

      if (taskInfo.failedCount >= failAfter)
        continue;

      if (!taskKlass.shouldRun(lastTime, currentTime, diff))
        continue;

      taskInfo.lastTime = currentTime;
      taskInfo.promise = executeTask(taskKlass, lastTime, currentTime, diff);
    }
  }

  stopTasks() {
    var intervalTimerID = (this.tasks && this.tasks._intervalTimerID);
    if (intervalTimerID) {
      clearInterval(intervalTimerID);
      this.tasks._intervalTimerID = null;
    }
  }

  startTasks(flushTaskInfo) {
    this.stopTasks();

    if (!this.tasks)
      this.tasks = {};

    Object.defineProperties(this.tasks, {
      '_intervalTimerID': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        setInterval(this.runTasks.bind(this), 1000),
      },
    });

    if (flushTaskInfo !== false)
      this.taskInfo = { _startTime: nowInSeconds() };
    else
      this.taskInfo._startTime = nowInSeconds();
  }

  createLogger(loggerOpts, Logger) {
    return new Logger(loggerOpts);
  }

  getLogger() {
    if (!this.logger)
      return console;

    return this.logger;
  }

  async connectToDatabase(databaseConfig) {
    if (!databaseConfig) {
      this.getLogger().error(`Error: database connection options not defined`);
      return;
    }

    var sequelize = new Sequelize(databaseConfig);

    var dbConnectionString = `${databaseConfig.dialect}://${databaseConfig.host}:${databaseConfig.port || '<default port>'}/${databaseConfig.database}`;
    try {
      await sequelize.authenticate();

      this.getLogger().log(`Connection to ${dbConnectionString} has been established successfully!`);

      return sequelize;
    } catch (error) {
      this.getLogger().error(`Unable to connect to database ${dbConnectionString}:`, error);
      await this.stop();
    }
  }

  getDBConnection() {
    return this.dbConnection;
  }

  async createHTTPServer(options) {
    var server = new HTTPServer(this, options);

    await server.start();

    return server;
  }

  async start() {
    var options = this.getOptions();

    var databaseConfig = this.getConfigValue('database.{environment}');
    if (!databaseConfig)
      databaseConfig = this.getConfigValue('database');

    databaseConfig = Nife.extend(true, {}, databaseConfig || {}, options.database || {});

    if (options.database !== false) {
      if (Nife.isEmpty(databaseConfig)) {
        this.getLogger().error(`Error: database connection for "${this.getConfigValue('environment')}" not defined`);
        return;
      }

      if (Nife.isEmpty(databaseConfig.tablePrefix))
        databaseConfig.tablePrefix = `${this.getApplicationName()}_`;

      this.dbConnection = await this.connectToDatabase(databaseConfig);

      this.setOptions({ database: databaseConfig });
    }

    if (options.httpServer !== false) {
      var httpServerConfig = this.getConfigValue('httpServer.{environment}');
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
      var models = await this.loadModels(options.modelsPath, databaseConfig);
      this.models = models;
    }

    if (options.httpServer !== false) {
      var controllers = await this.loadControllers(options.controllersPath, this.server);
      this.controllers = controllers;

      var routes = await this.buildRoutes(this.server, this.getRoutes());
      this.server.setRoutes(routes);
    }

    if (options.runTasks !== false) {
      var tasks = await this.loadTasks(options.tasksPath, databaseConfig);
      this.tasks = tasks;

      this.startTasks();
    }

    await this.autoReload(options.autoReload, false);

    this.isStarted = true;

    this.emit('start');
  }

  async stop(exitCode) {
    if (this.isStopping || !this.isStarted)
      return;

    this.getLogger().info('Shutting down...');

    this.isStopping = true;
    this.isStarted = false;

    await this.autoReload(false, true);

    if (this.server)
      await this.server.stop();

    if (this.dbConnection)
      await this.dbConnection.close();

    this.getLogger().info('Shut down complete!');

    this.emit('stop');

    var options = this.getOptions();
    if (options.exitOnShutdown != null || exitCode != null) {
      var code = (exitCode != null) ? exitCode : options.exitOnShutdown;
      this.emit('exit', code);
      process.exit(code);
    }
  }
}

module.exports = {
  Application,
};
