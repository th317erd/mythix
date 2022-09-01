import BaseModule from "../modules/base-module";
import { Tasks, TaskInfo } from "./task-base";

declare class TaskModule extends BaseModule {
  public getTaskFilePaths(tasksPath: string): Array<string>;
  public loadTasks(tasksPath: string): Tasks;
  public runTasks(): Promise<void>;
  public stopTasks(): void;
  public startTasks(flushTaskInfo): Promise<void>;
  public stopAllTasks(): Promise<void>
  public iterateAllTaskInfos(callback: (taskInfo: TaskInfo, index: number, taskName: string) => void): void;
  public getAllTaskPromises(): Array<Promise<any>>;
  public waitForAllTasksToFinish(): Promise<void>;

  declare public tasks: Tasks;
  declare public taskInfo: { [key: string]: TaskInfo };
}

export = TaskModule;
