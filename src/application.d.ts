import { GenericObject } from './interfaces/common';
import Logger, { LoggerClass, LoggerOptions } from './logger';
import { Modules, ModuleClasses, BaseModuleClass } from './modules/base-module';

declare interface _ApplicationOptions {
  environment: string;
  appName: string;
  rootPath: string;
  configPath: string;
  migrationsPath: string;
  modelsPath: string;
  seedersPath: string;
  controllersPath: string;
  templatesPath: string;
  commandsPath: string;
  tasksPath: string;
  modules: ModuleClasses;
  autoReload: boolean;
  exitOnShutdown: number | null;
  runTasks: boolean;
  testMode: boolean;
  noInternalMigrationTable: boolean;
  logger: LoggerOptions;
  database: boolean | GenericObject;
  httpServer: boolean | GenericObject;
  tempPath: string;
  routeParserTypes: { [key: string]: (value: string, param: GenericObject, index?: number) => any };
}

declare class Application {
  declare public static APP_NAME: string;

  public static getDefaultModules(): ModuleClasses;
  public static findModuleIndex(modules: ModuleClasses, moduleKlass: BaseModuleClass): number;
  public static replaceModule(modules: ModuleClasses, moduleKlass: BaseModuleClass, replacementModuleKlass: BaseModuleClass): ModuleClasses;

  public constructor(options?: _ApplicationOptions);
  public getTempPath(): string | null;
  public getModules(): Modules;
  public initializeModules(modules: ModuleClasses): Promise<void>;
  public startAllModules(options: _ApplicationOptions): Promise<void>;
  public stopAllModules(options: _ApplicationOptions): Promise<Array<Error>>;
  public bindToProcessSignals(): void;
  public getOptions(): _ApplicationOptions;
  public setOptions(options: _ApplicationOptions): Application;
  public loadConfig(configPath: string): GenericObject;
  public getConfigValue(key: string, defaultValue: any, type: string): any;
  public getConfig(): GenericObject;
  public setConfig(options: GenericObject): Application;
  public getApplicationName(): string;
  public getRoutes(): GenericObject;
  public getCustomRouteParserTypes(): { [key: string]: (value: string, param: GenericObject, index?: number) => any };
  public createLogger(loggerOptions: LoggerOptions, LoggerClass: LoggerClass): Logger;
  public getLogger(): Logger;
  public start(): Promise<void>;
  public stop(exitCode?: number): Promise<void>;

  declare public isStarted: boolean;
  declare public isStopping: boolean;
  declare public options: _ApplicationOptions;
  declare public moduleInstances: Modules;
  declare public config: GenericObject;
  declare public logger: Logger;
}

declare namespace Application {
  export type ApplicationOptions = _ApplicationOptions;
}

export = Application;
