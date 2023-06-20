import { ModuleBase } from '../modules/module-base';
import { Tasks, TaskInfo } from './task-base';

export declare class TaskModule extends ModuleBase {
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
