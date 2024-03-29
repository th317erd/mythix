import { Application } from '../application';
import { Logger } from '../logger';
import { Request, Response } from 'express';
import { GenericObject } from '../interfaces/common';
import { ConnectionBase, ModelClass, Models } from 'mythix-orm';
import { HTTPBaseError } from '../http/http-errors';

export declare type ControllerClass = typeof ControllerBase;

export declare type ControllerClasses = { [key: string]: ControllerClass };

export declare interface ControllerContext {
  params: GenericObject;
  query: GenericObject;
  route: GenericObject;
  controller: ControllerClass;
  controllerMethod: string;
  controllerInstance: ControllerBase;
  startTime: number;
  body?: any;
}

export declare class ControllerBase {
  public static getControllerName(): string;

  declare public application: Application;
  declare public logger: Logger;
  declare public request: Request;
  declare public response: Response;
  declare public route: GenericObject;
  declare public method: string;
  declare public contentType: string | null;
  declare public responseStatusCode: number;

  public constructor(application: Application, logger: Logger, request: Request, response: Response);
  public getApplication(): Application;
  public getLogger(): Logger;
  public getModel(name?: string): ModelClass | undefined;
  public getModels(): Models;
  public getConnection(connection?: ConnectionBase): ConnectionBase;

  // Deprecated
  public getDBConnection(connection?: ConnectionBase): ConnectionBase;

  public prepareToThrowError(ErrorClass: Function, args: Array<any>): HTTPBaseError;
  public throwNotFoundError(...args: Array<any>): void;
  public throwBadRequestError(...args: Array<any>): void;
  public throwUnauthorizedError(...args: Array<any>): void;
  public throwForbiddenError(...args: Array<any>): void;
  public throwInternalServerError(...args: Array<any>): void;
  public isHTTPError(error: any): boolean;
  public redirectTo(url: string, status?: number);
  public getCookie(name: string);
  public setCookie(name: string, value: any, options?: GenericObject);
  public getHeader(name: string): string;
  public getHeaders(names: Array<string>): GenericObject;
  public setHeader(name: string, value: any): void;
  public setHeaders(headers: GenericObject): void;
  public setContentType(contentType: string): void;
  public setStatusCode(code: number): void;
  public handleIncomingRequest(request: Request, response: Response, context: ControllerContext): Promise<any>;
  public handleOutgoingResponse(controllerResult: any, request: Request, response: Response, context: ControllerContext): Promise<void>;
}
