import { Application, ApplicationClass, ApplicationOptions } from "../application";
import { GenericObject } from "../interfaces/common";
import { Logger } from "../logger";

export declare interface CommandClass {
  new(application: Application, options?: GenericObject): CommandBase;
}

export declare type CommandClasses = { [ key: string ]: CommandClass };

export declare class CommandBase {
  declare public static commands: GenericObject;
  declare public static commandName: string;
  public static execute(): Promise<void>;

  declare public application: Application;
  declare public options: GenericObject;

  constructor(application: Application, options?: GenericObject);
  getOptions(): GenericObject;
  getApplication(): Application;
  getLogger(): Logger;
  getDBConnection(): any; // TODO: needs mythix-orm connection
}

export declare interface DefineCommandContext {
  Parent: CommandClass;
  commandName: string;
}

export declare function loadMythixConfig(
  mythixConfigPath: string,
  appRootPath: string
): GenericObject;

export declare function loadCommand(name: string): CommandClass;

export declare function loadCommands(
  applicationCommandsPath: string,
  skip: Array<string>
): CommandClasses;

export declare function defineCommand(
  commandName: string,
  definer: (context: DefineCommandContext) => CommandClass,
  parent?: string | CommandClass,
): CommandClass;

export declare function createApplication(
  applicationClass: ApplicationClass,
  options?: ApplicationOptions
): Application;

export declare function executeCommand(
  config: GenericObject,
  appOptions: ApplicationOptions,
  commandContext: GenericObject,
  CommandKlass: CommandClass,
  argv: Array<string>
): void;
