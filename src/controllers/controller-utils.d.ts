import { Application } from '../application';
import { HTTPServer } from '../http-server';
import { ControllerClass } from './controller-base';

export declare interface DefineControllerContext<T = ControllerClass> {
  Parent: T;
  application: Application;
  server: HTTPServer;
  controllerName: string;
}

export declare function defineController<T = ControllerClass>(
  controllerName: string,
  definer: (context: DefineControllerContext<T>) => ControllerClass,
  parent?: T
): (context: {
  application: Application,
  server: HTTPServer,
}) => ControllerClass;
