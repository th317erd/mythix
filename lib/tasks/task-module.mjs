import { DateTime }     from 'luxon';
import Nife             from 'nife';
import { ModuleBase }   from '../modules/module-base.mjs';

const MILLISECONDS_PER_SECOND = 1000;
const TASK_MAX_FAIL_ATTEMPTS  = 5;

function nowInSeconds() {
  return Date.now() / MILLISECONDS_PER_SECOND;
}

export class TaskModule extends ModuleBase {
  static getOptionsScopeName() {
    return 'tasks';
  }

  static shouldUse(application, options) {
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

  async runTasks() {
    const executeTask = (TaskKlass, taskIndex, taskInfo, lastTime, currentTime, diff) => {
      const createTaskLogger = () => {
        let appLogger = this.getLogger();
        return appLogger.clone({ formatter: (output) => `[[ Running task ${taskName}[${taskIndex}] @ ${currentTime} ]]: ${output}`});
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

      const _runTask = async () => {
        try {
          let result = await taskInstance.execute(lastTime, currentTime, diff);
          successResult(result);
        } catch (error) {
          errorResult(error);
        } finally {
          taskInfo.nextRunAt = TaskKlass.nextRun(taskInstance, lastTime, currentTime, diff);
        }
      };

      const runTask = async () => {
        let application   = this.getApplication();
        let dbConnection  = (typeof application.getConnection === 'function') ? application.getConnection() : undefined;

        if (dbConnection && typeof dbConnection.createContext === 'function')
          await dbConnection.createContext(_runTask, dbConnection, dbConnection);
        else
          await _runTask();
      };

      let taskName      = TaskKlass.taskName;
      let promise       = Nife.createResolvable();
      let taskInstance  = taskInfo.taskInstance;
      let logger;

      try {
        if (TaskKlass.KEEP_ALIVE === false || !taskInstance) {
          logger        = createTaskLogger();
          taskInstance  = new TaskKlass(this.getApplication(), logger, taskInfo.index);

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

      if (+taskInfo.nextRunAt >= DateTime.now().toMillis())
        return;

      taskInfo.lastTime = currentTime;
      taskInfo.promise = executeTask(taskKlass, taskIndex, taskInfo, lastTime, currentTime, diff);
    };

    const handleTaskQueue = (taskName, taskKlass, infoForTasks) => {
      let failAfterAttempts = taskKlass.failAfterAttempts || TASK_MAX_FAIL_ATTEMPTS;
      let workers           = taskKlass.workers || 1;

      for (let taskIndex = 0; taskIndex < workers; taskIndex++) {
        let taskInfo = infoForTasks[taskIndex];
        if (!taskInfo) {
          taskInfo = infoForTasks[taskIndex] = {
            index:        taskIndex,
            failedCount:  0,
            promise:      null,
            stop:         false,
            nextRunAt:    taskKlass.nextRun(null, undefined, DateTime.now()),
          };
        }

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
        enumerable:   false,
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
    if (options.tasks === false)
      return;

    const mapTaskClassesToObject = () => {
      return Nife.iterate(options.tasks, ({ index, key, value, context }) => {
        let taskName  = key;
        let TaskClass = value;

        // If this is an array, then the
        // index will match the task
        // name. In that case, pull the name
        // from the task class directly.
        if (index === taskName) {
          if (typeof TaskClass.getTaskName === 'function')
            taskName = TaskClass.getTaskName();
          else
            taskName = TaskClass.name;
        }

        context[taskName] = TaskClass;
      }, {});
    };

    this.tasks = mapTaskClassesToObject();

    this.startTasks();
  }

  async stop() {
  }
}
