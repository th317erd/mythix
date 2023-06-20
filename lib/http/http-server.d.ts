import { GenericObject } from '../interfaces/common';
import { Application } from '../application';
import { Application as ExpressApplication, Request, Response } from 'express';
import { Logger } from '../logger';
import { ControllerClass, ControllerContext } from '../controllers/controller-base';
import { RouteScope } from '../controllers/routes/route-scope';
import { RouteEndpoint } from '../controllers/routes/route-endpoint';

export declare class HTTPServer {
  declare public application: Application;
  declare public server: ExpressApplication | null;
  declare public options: GenericObject;
  declare public routes: Array<GenericObject>;
  declare public middleware: Array<Function> | null;

  public constructor(application: Application, options?: GenericObject);
  public getApplication(): Application;
  public getLogger(): Logger;
  public getOptions(): GenericObject;
  public getHTTPSCredentials(options): { key: string; cert: string; }
  public setRoutes(routes): void;
  public executeMiddleware(middleware: Array<Function>, request: Request, response: Response): Promise<void>;
  public baseMiddleware(request: Request, response: Response, rootNext: Function): void;
  public findFirstMatchingRoute(request: Request, routes: RouteScope): { endpoint?: RouteEndpoint, params?: GenericObject };
  public getRouteController(controller: string | Function, route, params, request): { controller: ControllerClass | undefined } | undefined;
  public createRequestLogger(application: Application, request: Request): Logger;
  public validateQueryParam(route: GenericObject, query: GenericObject, paramName: string, queryValue: any, queryParams: GenericObject): boolean;
  public compileQueryParams(route: GenericObject, query: GenericObject, queryParams: GenericObject): GenericObject;
  public sendRequestToController(request: Request, response: Response, context: ControllerContext): Promise<any>;
  public baseRouter(request: Request, response: Response, next: Function): void;
  public errorHandler(error: Error | any, message: string | null | undefined, statusCode: number | null | undefined, response: Response, request: Request): void;
  public createExpressApplication(options?: GenericObject): ExpressApplication;
  public start(): Promise<ExpressApplication>;
  public stop(): Promise<void>;
}
