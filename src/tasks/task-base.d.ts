import { GenericObject } from "../interfaces/common";
import Application from "../application";
import Logger from "../logger";
import { ModelClass, ModelClasses } from "../models/model";

declare type _Tasks = { [key: string]: TaskBase };

declare interface _TaskClass {
  new(application: Application, logger: Logger, runID: string): TaskBase;
}

declare interface _TaskInfo {
  _startTime: number;
  lastTime: number;
  failedCount: number;
  taskInstance: TaskBase;
  runID: string;
  promise: Promise<any>;
  stop: boolean;
}

declare class TaskBase {
  public static onTaskClassCreate(Klass: Function): Function;

  public static getFrequency(Task: TaskBase, taskIndex?: number): number;
  public static getStartDelay(Task: TaskBase, taskIndex?: number): number;
  public static shouldRun(Task: TaskBase, taskIndex: number, lastTime: number | null, currentTime: number, diff: number): boolean;

  public constructor(application: Application, logger: Logger, runID: string);
  public start(options?: GenericObject): Promise<any>;
  public stop(): Promise<any>;
  public getApplication(): Application;
  public getLogger(): Logger;
  public getRunID(): string;
  public getNumberOfWorkers(): number;
  public getModel(name: string): ModelClass;
  public getModels(): ModelClasses;
  public getDBConnection(): any; // TODO: Needs Connection from mythix-orm
  public getFrequency(task: TaskBase, taskIndex?: number): number;
  public getStartDelay(task: TaskBase, taskIndex?: number): number;

  declare public application: Application;
  declare public logger: Logger;
  declare public runID: string;
}

declare namespace TaskBase {
  export type TaskClass = _TaskClass;
  export type Tasks = _Tasks;
  export type TaskInfo = _TaskInfo;
}

export = TaskBase;
