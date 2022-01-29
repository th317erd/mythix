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
    });
  }

  getApplication() {
    return this.application;
  }

  getLogger() {
    var logger = this.logger;
    if (!logger) {
      var application = this.getApplication();
      logger = application.getLogger();
    }

    return logger;
  }

  getModel(name) {
    var application = this.application;
    return application.getModel(name);
  }

  getModels() {
    var application = this.application;
    return application.getModels();
  }

  getDBConnection() {
    var application = this.getApplication();
    return application.getDBConnection();
  }

  throwNotFoundError(message) {
    throw new HTTPErrors.HTTPNotFoundError(this.route, message);
  }

  throwBadRequestError(message) {
    throw new HTTPErrors.HTTPBadRequestError(this.route, message);
  }

  throwUnauthorizedError(message) {
    throw new HTTPErrors.HTTPUnauthorizedError(this.route, message);
  }

  throwInternalServerError(message) {
    throw new HTTPErrors.HTTPInternalServerError(this.route, message);
  }

  async handleIncomingRequest(request, response, { route, controller, controllerMethod, controllerInstance, startTime, params }) {
    this.route = route;

    return await this[controllerMethod].call(this, params, request.query || {}, request.body, this.getModels());
  }

  async handleOutgoingResponse(_controllerResult, request, response, { route, controller, controllerMethod, controllerInstance, startTime, params }) {
    var controllerResult  = _controllerResult;
    var contentType       = Nife.get(request, 'headers.content-type');

    if (!('' + contentType).match(/application\/json/i)) {
      if (controllerResult == null)
        controllerResult = '';

      response.status(200).send(('' + controllerResult));

      return;
    }

    if (controllerResult == null)
      controllerResult = {};

    response.status(200).send(JSON.stringify(controllerResult));
  }
}

module.exports = {
  ControllerBase,
};
