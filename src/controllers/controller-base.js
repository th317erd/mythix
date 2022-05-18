'use strict';

const Nife        = require('nife');
const HTTPErrors  = require('../http-server/http-errors');

class ControllerBase {
  constructor(application, logger, request, response) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        application,
      },
      'request': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        request,
      },
      'response': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        response,
      },
      'logger': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        logger,
      },
      'route': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        null,
      },
      'method': {
        enumberable:  false,
        configurable: true,
        get:          () => {
          return this.request.method.toUpperCase();
        },
        set:          () => {},
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
    let application = this.application;
    return application.getModel(name);
  }

  getModels() {
    let application = this.application;
    return application.getModels();
  }

  getDBConnection() {
    let application = this.getApplication();
    return application.getDBConnection();
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

  throwInternalServerError(...args) {
    throw this.prepareToThrowError(HTTPErrors.HTTPInternalServerError, args);
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

  async handleIncomingRequest(request, response, { route, controllerMethod, startTime, params, query /* , controller, controllerInstance, */ }) {
    this.route = route;

    return await this[controllerMethod].call(this, { params, query, body: request.body, request, response, startTime }, this.getModels());
  }

  async handleOutgoingResponse(_controllerResult, request, response /*, { route, controller, controllerMethod, controllerInstance, startTime, params } */) {
    // Has a response already been sent?
    if (response.statusMessage)
      return;

    let controllerResult  = _controllerResult;
    let contentType       = Nife.get(request, 'headers.content-type');

    if (!('' + contentType).match(/application\/json/i)) {
      if (controllerResult == null)
        controllerResult = '';

      response.status(200).send(('' + controllerResult));

      return;
    }

    if (controllerResult == null)
      controllerResult = {};

    response.header('Content-Type', 'application/json; charset=UTF-8');
    response.status(200).send(JSON.stringify(controllerResult));
  }
}

module.exports = {
  ControllerBase,
};
