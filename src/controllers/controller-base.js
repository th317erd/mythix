const Nife = require('nife');

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

  async handleIncomingRequest(request, response, { route, controller, controllerMethod, controllerInstance, startTime, params }) {
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
