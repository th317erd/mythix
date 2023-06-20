import { GenericObject } from '../interfaces/common';
import { Application } from '../application';
import { Logger } from '../logger';
import { ConnectionBase, ModelClass, Models } from 'mythix-orm';
import { DateTime } from 'luxon';

export declare type Tasks = { [key: string]: TaskBase };

export declare type TaskClass = typeof TaskBase;

export declare interface TaskInfo {
  _startTime: number;
  lastTime: number;
  failedCount: number;
  taskInstance: TaskBase;
  runID: string;
  promise: Promise<any>;
  stop: boolean;
}

export declare class TaskBase {
  public static getWorkerCount(): number;
  public static getTaskName(): string;
  public static nextRun(taskInstance: TaskBase, lastTime: null | number, currentTime: number, diff: null | number): DateTime;

  declare public application: Application;
  declare public logger: Logger;

  public constructor(application: Application, logger: Logger, runID: string);
  public start(options?: GenericObject): Promise<any>;
  public stop(): Promise<any>;
  public getApplication(): Application;
  public getLogger(): Logger;
  public getModel(name: string): ModelClass;
  public getModels(): Models;
  public getConnection(connection?: ConnectionBase): ConnectionBase;
}
