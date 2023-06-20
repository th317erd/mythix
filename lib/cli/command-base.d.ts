import { HelpInterface, Runner } from 'cmded';
import { ConnectionBase } from 'mythix-orm';
import { Application } from '../application';
import { GenericObject } from '../interfaces/common';
import { Logger } from '../logger';

export declare type CommandClass = typeof CommandBase;

export declare type CommandClasses = { [key: string]: CommandClass };

export declare class CommandBase {
  public static getCommandName(): string;

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

  spawnCommand(
    command: string,
    args: Array<string>,
    options?: GenericObject
  ): Promise<{ stdout: string, stderr: string, error: any, code: number }>;
}
