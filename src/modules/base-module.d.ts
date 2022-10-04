import { GenericObject } from '../interfaces/common';
import { Application } from '../application';
import { Logger } from '../logger';

export declare type BaseModuleClass = typeof BaseModule;

export declare type ModuleClasses = Array<BaseModuleClass>;
export declare type Modules = Array<BaseModule>;

export declare class BaseModule {
  public declare static fileWatcherQueueName: string;

  public static getModuleName(): string;
  public static shouldUse(application: Application, options: GenericObject): boolean;

  public fileWatcherGetMonitorPaths(options?: GenericObject): Array<string>;
  public fileWatcherHandler(options?: GenericObject): Promise<void>;

  public constructor(application: Application);
  public getApplication(): Application;
  public getLogger(): Logger;
  public getConfigValue(...args: Array<any>): any;
  public start(options?: GenericObject): Promise<any>;
  public stop(): Promise<any>;

  declare public application: Application;
}
