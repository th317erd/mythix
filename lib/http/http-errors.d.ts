import { GenericObject } from '../interfaces/common';

export declare class HTTPBaseError extends Error {
  declare public route: GenericObject;
  declare public statusCode: number;
  declare public headers: GenericObject;

  constructor(route?: GenericObject | null | undefined, message?: string, statusCode?: number);
  getMessage(): string;
}

export declare class HTTPNotFoundError extends HTTPBaseError { }
export declare class HTTPBadRequestError extends HTTPBaseError { }
export declare class HTTPBadContentTypeError extends HTTPBaseError { }
export declare class HTTPUnauthorizedError extends HTTPBaseError { }
export declare class HTTPForbiddenError extends HTTPBaseError { }
export declare class HTTPInternalServerError extends HTTPBaseError { }
