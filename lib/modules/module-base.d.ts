import { GenericObject } from '../interfaces/common';
import { Application } from '../application';
import { Logger } from '../logger';

export declare type Modules = Array<ModuleBase>;

export declare class ModuleBase {
  public static getModuleName(): string;
  public static getOptionsScopeName(): string;
  public static shouldUse(application: Application, options: GenericObject): boolean;

  public constructor(application: Application);
  public getApplication(): Application;
  public getLogger(): Logger;
  public getConfigValue(...args: Array<any>): any;
  public start(options?: GenericObject): Promise<any>;
  public stop(): Promise<any>;

  declare public application: Application;
}
