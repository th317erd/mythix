import { HelpInterface, Runner } from 'cmded';
import { Stats } from 'fs';
import { ConnectionBase } from 'mythix-orm';
import { Application, ApplicationClass, ApplicationOptions } from '../application';
import { GenericObject } from '../interfaces/common';
import { Logger } from '../logger';

export declare type CommandClass = typeof CommandBase;

export declare type CommandClasses = { [key: string]: CommandClass };

export declare type FileFilterCallback = (fullFileName: string, fileName: string, stats?: Stats) => boolean;

export declare class CommandBase {
  declare public static commands: GenericObject;
  declare public static commandName: string;
  declare public static applicationConfig?: GenericObject | (() => GenericObject);
  declare public static commandArguments?: () => { help: HelpInterface, runner: Runner };
  declare public static runtimeArguments?: { [key: string]: Array<string> };
  public static execute(): Promise<void>;

  declare public application: Application;
  declare public options: GenericObject;

  constructor(application: Application, options?: GenericObject);
  getOptions(): GenericObject;
  getApplication(): Application;
  getLogger(): Logger;
  getConnection(connection?: ConnectionBase): ConnectionBase;

  // Deprecated
  getDBConnection(connection?: ConnectionBase): ConnectionBase;

  spawnCommand(
    command: string,
    args: Array<string>,
    options?: GenericObject
  ): Promise<{ stdout: string, stderr: string, error: any, code: number }>;

  getCommandFiles(filterFunc?: FileFilterCallback): Array<string>;
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

export declare function getInternalCommandsPath(): string;
export declare function getCommandFiles(commandsPath: string, filterFunc?: FileFilterCallback): Array<string>;