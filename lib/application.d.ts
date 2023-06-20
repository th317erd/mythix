import { ConnectionBase, ModelClass, Models } from 'mythix-orm';
import { ControllerClass } from './controllers/controller-base';
import { RouteScope } from './controllers/routes/route-scope';
import { HTTPServer } from './http/http-server';
import { GenericObject } from './interfaces/common';
import { Logger, LoggerClass, LoggerOptions } from './logger';
import { ModuleBase } from './modules/module-base';
import { TaskBase } from './tasks/task-base';
import { CommandClasses } from './cli/command-base';

export declare type ApplicationClass = typeof Application;

export declare interface ModuleDictionary {
  [key: string]: typeof ModuleBase;
}

export declare interface ApplicationOptions {
  cli: boolean;
  environment: string;
  exitOnShutdown: number | null;
  logger: LoggerOptions;
  controllers: { [key: string]: ControllerClass } | Array<ControllerClass>;
  database: boolean | GenericObject;
  httpServer: boolean | GenericObject;
  tasks: boolean | { [key: string]: TaskBase } | Array<TaskBase>;
  tempPath: string;
}

export declare class Application {
  public static getName(): string;
  public static getCommandList(): CommandClasses;
  public static getModules(): ModuleDictionary;

  public constructor(options?: ApplicationOptions);
  public getTempPath(): string | null;
  public initializeModules(modules: ModuleDictionary): Promise<void>;
  public startAllModules(options: ApplicationOptions): Promise<void>;
  public stopAllModules(options: ApplicationOptions): Promise<Array<Error>>;
  public bindToProcessSignals(): void;
  public getOptions(): ApplicationOptions;
  public setOptions(options: ApplicationOptions): Application;
  public loadConfig(configPath: string): GenericObject;
  public getConfigValue(key: string, defaultValue?: any, type?: string): any;
  public getConfig(): GenericObject;
  public setConfig(options: GenericObject): Application;
  public getApplicationName(): string;
  public _getRoutes(): RouteScope;
  public getRoutes(context: RouteScope): void;
  public getCustomRouteParserTypes(): { [key: string]: (value: string, param: GenericObject, index?: number) => any };
  public createLogger(loggerOptions: LoggerOptions, LoggerClass: LoggerClass): Logger;
  public getLogger(): Logger;
  public start(): Promise<void>;
  public stop(exitCode?: number): Promise<void>;

  // From DatabaseModule
  public getDBConfig(): GenericObject;
  public getDBTablePrefix(): string | null;
  public getConnection(connection?: ConnectionBase): ConnectionBase;

  // From ModelModule
  public getModel(modelName?: string): ModelClass | undefined;
  public getModels(): Models;

  // From ControllerModule
  public getController(name: string): { controller: ControllerClass, controllerMethod: string | undefined };

  // From HTTPServerModule
  public getHTTPServer(): HTTPServer | null;
  public getHTTPServerConfig(): GenericObject;

  declare public isStarted: boolean;
  declare public isStopping: boolean;
  declare public options: ApplicationOptions;
  declare public moduleInstances: Array<ModuleBase>;
  declare public config: GenericObject;
  declare public logger: Logger;
}
