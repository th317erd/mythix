import { Application, ApplicationClass, ApplicationOptions } from '../application';
import { GenericObject } from '../interfaces/common';
import { CommandClass } from './command-base';

export declare function loadMythixConfig(
  mythixConfigPath: string,
  appRootPath: string
): Promise<GenericObject>;

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
): Promise<undefined>;
