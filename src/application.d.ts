import { ControllerClass } from './controllers/controller-base';
import { HTTPServer } from './http-server/http-server';
import { GenericObject } from './interfaces/common';
import { Logger, LoggerClass, LoggerOptions } from './logger';
import { ModelClass, ModelClasses } from './models/model';
import { Modules, ModuleClasses, BaseModuleClass } from './modules/base-module';

export declare interface ApplicationClass {
  new(options?: ApplicationOptions): Application;
}

export declare interface ApplicationOptions {
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
  routeParserTypes: { [ key: string ]: (value: string, param: GenericObject, index?: number) => any };
}

export declare class Application {
  declare public static APP_NAME: string;

  public static getDefaultModules(): ModuleClasses;
  public static findModuleIndex(modules: ModuleClasses, moduleKlass: BaseModuleClass): number;
  public static replaceModule(modules: ModuleClasses, moduleKlass: BaseModuleClass, replacementModuleKlass: BaseModuleClass): ModuleClasses;

  public constructor(options?: ApplicationOptions);
  public getTempPath(): string | null;
  public getModules(): Modules;
  public initializeModules(modules: ModuleClasses): Promise<void>;
  public startAllModules(options: ApplicationOptions): Promise<void>;
  public stopAllModules(options: ApplicationOptions): Promise<Array<Error>>;
  public bindToProcessSignals(): void;
  public getOptions(): ApplicationOptions;
  public setOptions(options: ApplicationOptions): Application;
  public loadConfig(configPath: string): GenericObject;
  public getConfigValue(key: string, defaultValue: any, type: string): any;
  public getConfig(): GenericObject;
  public setConfig(options: GenericObject): Application;
  public getApplicationName(): string;
  public getRoutes(): GenericObject;
  public getCustomRouteParserTypes(): { [ key: string ]: (value: string, param: GenericObject, index?: number) => any };
  public createLogger(loggerOptions: LoggerOptions, LoggerClass: LoggerClass): Logger;
  public getLogger(): Logger;
  public start(): Promise<void>;
  public stop(exitCode?: number): Promise<void>;

  // From DatabaseModule
  public getDBConfig(): GenericObject;
  public getDBTablePrefix(): string | null;
  public getDBConnection(): any; // TODO: Need to be a mythix-orm connection

  // From FileWatcherModule
  public autoReload(enable?: boolean, shuttingDown?: boolean): Promise<void>;

  // From ModelModule
  public getModel(modelName?: string): ModelClass | undefined;
  public getModels(): ModelClasses;

  // From ControllerModule
  public getController(name: string): { controller: ControllerClass, controllerMethod: string | undefined };

  // From HTTPServerModule
  public getHTTPServer(): HTTPServer | null;
  public getHTTPServerConfig(): GenericObject;

  declare public isStarted: boolean;
  declare public isStopping: boolean;
  declare public options: ApplicationOptions;
  declare public moduleInstances: Modules;
  declare public config: GenericObject;
  declare public logger: Logger;
}
