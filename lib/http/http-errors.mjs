/* eslint-disable no-magic-numbers */
/* eslint-disable max-classes-per-file */

import { statusCodeToMessage }  from '../utils/http-utils.js';

export class HTTPBaseError extends Error {
  constructor(route, message, _statusCode) {
    let statusCode  = _statusCode || 500;

    super(message || statusCodeToMessage(statusCode));

    this.route      = route;
    this.statusCode = statusCode;
    this.headers    = {};
  }

  getMessage() {
    return this.message;
  }
}

export class HTTPNotFoundError extends HTTPBaseError {
  constructor(route, message) {
    super(route, message, 404);
  }
}

export class HTTPBadRequestError extends HTTPBaseError {
  constructor(route, message) {
    super(route, message, 400);
  }
}

export class HTTPBadContentTypeError extends HTTPBaseError {
  constructor(route, message) {
    super(route, message, 400);
  }

  getMessage() {
    let route = this.route;
    if (!route)
      return this.message;

    let contentType = route.contentType;
    if (!(contentType instanceof Array))
      contentType = [ contentType ];

    contentType = contentType
      .filter((part) => {
        if (!(typeof part === 'string' || part instanceof String) && !(part instanceof RegExp))
          return false;

        return true;
      })
      .map((part) => {
        return (part instanceof RegExp) ? `RegExp[${part.toString()}]` : `'${part}'`;
      });

    if (this.message)
      return `${this.message}: Accepted Content-Types are [ ${contentType.join(', ')} ]`;
    else
      return `Accepted Content-Types are [ ${contentType.join(', ')} ]`;
  }
}

export class HTTPUnauthorizedError extends HTTPBaseError {
  constructor(route, message) {
    super(route, message, 401);
  }
}

export class HTTPForbiddenError extends HTTPBaseError {
  constructor(route, message) {
    super(route, message, 403);
  }
}

export class HTTPInternalServerError extends HTTPBaseError {
  constructor(route, message) {
    super(route, message, 500);
  }
}
