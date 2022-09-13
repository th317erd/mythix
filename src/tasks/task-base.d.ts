import { GenericObject } from '../interfaces/common';
import { Application } from '../application';
import { Logger } from '../logger';
import { ConnectionBase, ModelClass, Models } from 'mythix-orm';

export declare type Tasks = { [ key: string ]: TaskBase };

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
  public static onTaskClassCreate(Klass: TaskClass): TaskClass;

  public static getFrequency(taskIndex?: number): number;
  public static getStartDelay(taskIndex?: number): number;
  public static shouldRun(taskIndex: number, lastTime: number | null, currentTime: number, diff: number): boolean;

  declare public application: Application;
  declare public logger: Logger;
  declare public runID: string;

  public constructor(application: Application, logger: Logger, runID: string);
  public start(options?: GenericObject): Promise<any>;
  public stop(): Promise<any>;
  public getApplication(): Application;
  public getLogger(): Logger;
  public getRunID(): string;
  public getNumberOfWorkers(): number;
  public getModel(name: string): ModelClass;
  public getModels(): Models;
  public getDBConnection(): ConnectionBase;
  public getFrequency(taskIndex?: number): number;
  public getStartDelay(taskIndex?: number): number;
}
