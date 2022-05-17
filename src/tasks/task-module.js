'use strict';

const Nife            = require('nife');
const { Sequelize }   = require('sequelize');
const { BaseModule }  = require('../modules/base-module');
const {
  fileNameWithoutExtension,
  walkDir,
} = require('../utils');

const MILLISECONDS_PER_SECOND = 1000;
const TASK_MAX_FAIL_ATTEMPTS = 5;

var globalTaskRunID = 1;

function nowInSeconds() {
  return Date.now() / MILLISECONDS_PER_SECOND;
}

class TaskModule extends BaseModule {
  static getModuleName() {
    return 'TaskModule';
  }

  static fileWatcherQueueName = 'tasks';

  static shouldUse(options) {
    if (options.runTasks === false)
      return false;

    return true;
  }

  constructor(application) {
    super(application);

    Object.defineProperties(this, {
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
  }

  fileWatcherGetMonitorPaths(options) {
    return [ options.tasksPath ];
  }

  async fileWatcherHandler(options) {
    await this.waitForAllTasksToFinish();

    let tasks = await this.loadTasks(options.tasksPath);

    this.tasks    = tasks;
    this.taskInfo = { _startTime: nowInSeconds() };

    this.startTasks();
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

  loadTasks(tasksPath) {
    let application = this.getApplication();
    let taskFiles   = this.getTaskFilePaths(tasksPath);
    let connection  = (typeof application.getDBConnection === 'function') ? application.getDBConnection() : null;
    let dbConfig    = (typeof application.getDBConfig === 'function') ? application.getDBConfig() : null;
    let tasks       = {};
    let args        = { application: this, Sequelize, connection, dbConfig };

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
        } else {
          promise.resolve(result);
        }
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

  async stopAllTasks() {
    if (Nife.isNotEmpty(this.tasks) && this.tasks._intervalTimerID) {
      this.getLogger().info('Waiting for all tasks to complete...');
      await this.waitForAllTasksToFinish();
      this.getLogger().info('All tasks completed!');
    }
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

  async start(options) {
    if (options.runTasks === false)
      return;

    let tasks = await this.loadTasks(options.tasksPath);
    this.tasks = tasks;

    this.startTasks();
  }

  async stop() {
  }
}

module.exports = {
  TaskModule,
};
