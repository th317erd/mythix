import { HTTPServer } from '../http-server';
import { GenericObject } from '../interfaces/common';
import { BaseModule } from '../modules/base-module';
import { ControllerClass, ControllerClasses } from './controller-base';

export class ControllerModule extends BaseModule {
  public getControllerFilePaths(controllersPath: string): Array<string>;
  public loadControllers(controllersPath: string): ControllerClasses;
  public getController(name: string): { controller: ControllerClass, controllerMethod: string | undefined };
}
