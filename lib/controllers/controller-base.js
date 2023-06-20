import Nife             from 'nife';
import * as HTTPErrors  from '../http/http-errors.mjs';

export class ControllerBase {
  constructor(application, logger, request, response) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        application,
      },
      'request': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        request,
      },
      'response': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        response,
      },
      'logger': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        logger,
      },
      'route': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'method': {
        enumerable:   false,
        configurable: true,
        get:          () => {
          if (!this.request)
            return null;

          return this.request.method.toUpperCase();
        },
        set:          () => {},
      },
      'contentType': {
        enumerable:   false,
        configurable: true,
        get:          () => {
          if (!this.request)
            return null;

          return Nife.get(this.request, 'headers.content-type');
        },
        set:          () => {},
      },
      'responseStatusCode': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        200,
      },
    });
  }

  getApplication() {
    return this.application;
  }

  getLogger() {
    let logger = this.logger;
    if (!logger) {
      let application = this.getApplication();
      logger = application.getLogger();
    }

    return logger;
  }

  getModel(name) {
    let application = this.getApplication();
    if (typeof application.getModel !== 'function')
      return;

    return application.getModel(name);
  }

  getModels() {
    let application = this.getApplication();
    if (typeof application.getModels !== 'function')
      return {};

    return application.getModels();
  }

  getConnection(connection) {
    let application = this.getApplication();
    return application.getConnection(connection);
  }

  // Deprecated
  getDBConnection(connection) {
    return this.getConnection(connection);
  }

  prepareToThrowError(ErrorClass, args) {
    return new ErrorClass(this.route, ...args);
  }

  throwNotFoundError(...args) {
    throw this.prepareToThrowError(HTTPErrors.HTTPNotFoundError, args);
  }

  throwBadRequestError(...args) {
    throw this.prepareToThrowError(HTTPErrors.HTTPBadRequestError, args);
  }

  throwUnauthorizedError(...args) {
    throw this.prepareToThrowError(HTTPErrors.HTTPUnauthorizedError, args);
  }

  throwForbiddenError(...args) {
    throw this.prepareToThrowError(HTTPErrors.HTTPForbiddenError, args);
  }

  throwInternalServerError(...args) {
    throw this.prepareToThrowError(HTTPErrors.HTTPInternalServerError, args);
  }

  isHTTPError(error) {
    return (error instanceof HTTPErrors.HTTPBaseError);
  }

  redirectTo(url, status = 302) {
    this.response.header('Location', url);
    this.response.status(status).send('');
  }

  getCookie(name) {
    return this.request.cookies[name];
  }

  setCookie(name, value, options) {
    this.response.cookie(name, ('' + value), options || {});
  }

  getHeader(name) {
    return this.request.headers[name];
  }

  getHeaders(_names) {
    let names   = Nife.toArray(_names).filter(Boolean);
    let headers = {};

    for (let i = 0, il = names.length; i < il; i++) {
      let name = names[i];
      headers[name] = this.getHeader(name);
    }

    return headers;
  }

  setHeader(name, value) {
    this.response.header(name, value);
  }

  setHeaders(headers) {
    let keys = Object.keys(headers || {});
    for (let i = 0, il = keys.length; i < il; i++) {
      let key   = keys[i];
      let value = headers[key];
      if (value == null)
        continue;

      this.response.header(key, value);
    }
  }

  setContentType(str) {
    this.setHeader('Content-Type', str);
  }

  setStatusCode(code) {
    this.responseStatusCode = parseInt(code, 10);
  }

  async handleIncomingRequest(request, response, context) {
    this.route = context.route;

    if (typeof this[context.controllerMethod] !== 'function')
      this.throwInternalServerError(`Specified route handler named "${this.constructor.name}::${context.controllerMethod}" not found.`);

    return await this[context.controllerMethod].call(this, { body: request.body, request, response, ...context }, this.getModels());
  }

  // eslint-disable-next-line no-unused-vars
  async handleOutgoingResponse(_controllerResult, request, response, context) {
    // Has a response already been sent?
    if (response.statusMessage)
      return;

    let controllerResult  = _controllerResult;
    let contentType       = Nife.get(response, 'headers.content-type');

    if (('' + contentType).match(/application\/json/i) || Nife.instanceOf(controllerResult, 'object', 'array')) {
      if (controllerResult == null)
        controllerResult = {};

      response.header('Content-Type', 'application/json; charset=UTF-8');
      response.status(this.responseStatusCode).send(JSON.stringify(controllerResult));
    } else {
      if (controllerResult == null)
        controllerResult = '';

      response.status(this.responseStatusCode).send(('' + controllerResult));
    }
  }
}
