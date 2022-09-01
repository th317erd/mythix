'use strict';

const chokidar    = require('chokidar');
const Nife        = require('nife');
const BaseModule  = require('../modules/base-module');

class FileWatcherModule extends BaseModule {
  static getModuleName() {
    return 'FileWatcherModule';
  }

  static shouldUse(options) {
    if (options.autoReload === false)
      return false;

    return true;
  }

  constructor(application) {
    super(application);

    Object.defineProperties(this, {
      'fileWatcher': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'watchedPathsCache': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
    });

    // Inject methods into the application
    Object.defineProperties(application, {
      'autoReload': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        this.autoReload.bind(this),
      },
    });
  }

  getMonitoredPaths(options) {
    if (this.watchedPathsCache)
      return this.watchedPathsCache;

    let application     = this.getApplication();
    let moduleInstances = application.getModules();
    let allPaths        = [];

    for (let i = 0, il = moduleInstances.length; i < il; i++) {
      let moduleInstance = moduleInstances[i];
      let queueName = moduleInstance.constructor.fileWatcherQueueName;
      if (!queueName || typeof moduleInstance.fileWatcherGetMonitorPaths !== 'function')
        continue;

      let paths = moduleInstance.fileWatcherGetMonitorPaths(options);
      if (paths)
        allPaths = allPaths.concat(paths);
    }

    this.watchedPathsCache = Nife.uniq(allPaths);

    return this.watchedPathsCache;
  }

  isWatchedFile(_monitoredPaths, filePath) {
    let monitoredPaths = Nife.toArray(_monitoredPaths);

    for (let i = 0, il = monitoredPaths.length; i < il; i++) {
      let monitoredPath = monitoredPaths[i];
      if (!monitoredPath)
        continue;

      if (filePath.substring(0, monitoredPath.length) === monitoredPath)
        return true;
    }

    return false;
  }

  getFileScope(options, filePath) {
    let application     = this.getApplication();
    let moduleInstances = application.getModules();

    for (let i = 0, il = moduleInstances.length; i < il; i++) {
      let moduleInstance = moduleInstances[i];
      let queueName = moduleInstance.constructor.fileWatcherQueueName;
      if (!queueName)
        continue;

      let paths = moduleInstance.fileWatcherGetMonitorPaths(options);
      if (this.isWatchedFile(paths, filePath))
        return queueName;
    }

    return 'default';
  }

  async autoReload(_set, shuttingDown) {
    let options = this.getApplication().getOptions();
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

    this.watchedPathsCache = null;

    const filesChanged = (eventName, path) => {
      if (filesChangedTimeout)
        clearTimeout(filesChangedTimeout);

      let scopeName = this.getFileScope(options, path);
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
    let monitoredPaths = this.getMonitoredPaths(options);

    this.fileWatcher = chokidar.watch(monitoredPaths, {
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

    let application     = this.getApplication();
    let options         = application.getOptions();
    let moduleInstances = application.getModules();

    for (let i = 0, il = moduleInstances.length; i < il; i++) {
      let moduleInstance = moduleInstances[i];
      let queueName = moduleInstance.constructor.fileWatcherQueueName;
      if (!queueName || typeof moduleInstance.fileWatcherHandler !== 'function')
        continue;

      let scope       = files[queueName];
      let fileNames   = Object.keys(scope || {});

      if (Nife.isEmpty(fileNames))
        continue;

      flushRequireCacheForFiles(queueName, fileNames);

      try {
        await moduleInstance.fileWatcherHandler.call(moduleInstance, options);
      } catch (error) {
        this.getLogger().error(`Error while attempting to reload ${queueName}`, error);
      }
    }
  }

  async start(options) {
    await this.autoReload(options.autoReload, false);
  }

  async stop() {
    await this.autoReload(false, true);
  }
}

module.exports = FileWatcherModule;
