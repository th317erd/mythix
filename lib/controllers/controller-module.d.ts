import { HTTPServer } from '../http';
import { GenericObject } from '../interfaces/common';
import { ModuleBase } from '../modules/module-base';
import { ControllerClass, ControllerClasses } from './controller-base';

export class ControllerModule extends ModuleBase {
  public getControllerFilePaths(controllersPath: string): Array<string>;
  public loadControllers(controllersPath: string): ControllerClasses;
  public getController(name: string): { controller: ControllerClass, controllerMethod: string | undefined };
}
