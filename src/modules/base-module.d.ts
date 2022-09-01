import { GenericObject } from '../interfaces/common';
import Application from '../application';
import Logger from '../logger';

declare interface _BaseModuleClass {
  new(application: Application): BaseModule;
}

declare type _ModuleClasses = Array<_BaseModuleClass>;
declare type _Modules = Array<BaseModule>;

declare class BaseModule {
  public declare static fileWatcherQueueName: string;

  public static getModuleName(): string;
  public static shouldUse(options?: GenericObject)

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

declare namespace BaseModule {
  export type BaseModuleClass = _BaseModuleClass;
  export type ModuleClasses = _ModuleClasses;
  export type Modules = _Modules;
}

export = BaseModule;
