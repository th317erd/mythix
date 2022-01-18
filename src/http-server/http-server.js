const OS            = require('os');
const Path          = require('path');
const FileSystem    = require('fs');
const HTTP          = require('http');
const HTTPS         = require('https');
const Nife          = require('nife');
const Express       = require('express');
const ExpressBusBoy = require('express-busboy');

const {
  HTTPBaseError,
  HTTPNotFoundError,
  HTTPBadRequestError,
  HTTPInternalServerError,
} = require('./http-errors');

const {
  statusCodeToMessage,
} = require('./http-utils');

class HTTPServer {
  constructor(application, _opts) {
    var appName = application.getApplicationName();

    var uploadPath = Path.resolve(OS.tmpdir(), 'appName', ('' + process.pid));

    var opts = Nife.extend(true, {
      host:   'localhost',
      port:   '8000',
      https:  false,
      uploads: {
        upload:       true,
        path:         uploadPath,
        allowedPath:  /./i,
      },
    });

    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        application,
      },
      'server': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        null,
      },
      'options': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        opts,
      },
      'routes': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'middleware': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        opts.middleware,
      },
    });
  }

  getApplication() {
    return this.application;
  }

  getLogger() {
    var application = this.getApplication();
    return application.getLogger();
  }

  getOptions() {
    return this.options;
  }

  getHTTPSCredentials(options) {
    var keyContent = options.key;
    if (!keyContent && options.keyPath)
      keyContent = FileSystem.readFileSync(options.keyPath, 'latin1');

    var certContent = options.cert;
    if (!certContent && options.certPath)
      certContent = FileSystem.readFileSync(options.certPath, 'latin1');

    return {
      key:  keyContent,
      cert: certContent,
    };
  }

  setRoutes(routes) {
    this.routes = routes;
  }

  baseMiddleware(request, response, rootNext) {
    var middleware = this.middleware;
    if (!middleware || !middleware.length)
      return rootNext.call(this);

    var middlewareIndex = 0;
    const next = () => {
      if (middlewareIndex >= middleware.length)
        return rootNext();

      var middlewareFunc = middleware[middlewareIndex++];
      return middlewareFunc.call(this, request, response, next);
    };

    return next();
  }

  findFirstMatchingRoute(request, _routes) {
    const routeMatcher = (route, method, path, contentType) => {
      var {
        methodMatcher,
        contentTypeMatcher,
        pathMatcher,
      } = route;

      if (typeof methodMatcher === 'function' && !methodMatcher(method))
        return;

      var result = (typeof pathMatcher !== 'function') ? false : pathMatcher(path);
      if (!result)
        return;

      if (typeof contentTypeMatcher === 'function' && !contentTypeMatcher(contentType))
        throw new HTTPBadRequestError(route);

      return result;
    };

    var routes      = _routes || [];
    var method      = request.method;
    var contentType = Nife.get(request, 'headers.content-type');
    var path        = request.url;

    for (var i = 0, il = routes.length; i < il; i++) {
      var route   = routes[i];
      var result  = routeMatcher(route, method, path, contentType);
      if (!result)
        continue;

      return { route, params: result };
    }

    throw new HTTPNotFoundError();
  }

  getRouteController(_controller, route, params, request) {
    var controller = _controller;

    if (typeof controller === 'function') {
      if (controller.constructor === Function.prototype.constructor) {
        controller = controller.call(this, request, route, params);
        if (Nife.instanceOf(controller, 'string'))
          controller = this.getApplication().getController(controller);
        else if (typeof controller === 'function')
          controller = { controller };
      } else {
        controller = { controller };
      }
    } else if (Nife.instanceOf(controller, 'string'))
      controller = this.getApplication().getController(controller);

    return controller;
  }

  createRequestLogger(application, request, { controller, controllerMethod }) {
    var logger        = application.getLogger();
    var loggerMethod  = ('' + request.method).toUpperCase();
    var loggerURL     = ('' + request.url);
    var requestID     = (Date.now() + Math.random()).toFixed(4);
    var ipAddress     = Nife.get(request, 'client.remoteAddress', '<unknown IP address>');

    return logger.clone({ formatter: (output) => `{${ipAddress}} - [#${requestID} ${loggerMethod} ${loggerURL}]: ${output}`});
  }

  sendRequestToController(...args) {
    var context             = args[2];
    var controllerInstance  = context.controllerInstance;

    return controllerInstance.handleIncomingRequest.apply(controllerInstance, args);
  }

  async baseRouter(request, response, next) {
    var startTime = Nife.now();

    try {
      var application = this.getApplication();
      var logger      = this.createRequestLogger(application, request, { controller, controllerMethod });

      logger.log(`Starting request`);

      var { route, params } = (this.findFirstMatchingRoute(request, this.routes) || {});

      request.params = params || {};

      var controller = this.getRouteController(route.controller, route, params, request);
      var {
        controller,
        controllerMethod,
      } = (controller || {});

      if (!controller)
        throw new HTTPInternalServerError(route, `Controller not found for route ${route.url}`);

      if (Nife.isEmpty(controllerMethod))
        controllerMethod = (request.method || 'get').toLowerCase();

      var controllerInstance = new controller(application, logger || application.getLogger(), request, response);

      var context = {
        params: request.params,
        route,
        controller,
        controllerMethod,
        controllerInstance,
        startTime,
      };

      var controllerResult = await this.sendRequestToController(request, response, context);

      if (!response.finished)
        await controllerInstance.handleOutgoingResponse(controllerResult, request, response, context);

      var statusCode  = response.statusCode || 200;
      var requestTime = Nife.now() - startTime;
      logger.log(`Completed request in ${requestTime.toFixed(3)}ms: ${statusCode} ${response.statusMessage || statusCodeToMessage(statusCode)}`);
    } catch (error) {
      try {
        var statusCode  = error.statusCode || error.status_code || 500;
        var requestTime = Nife.now() - startTime;

        if (controllerInstance && typeof controllerInstance.errorHandler === 'function')
          await controllerInstance.errorHandler(error, statusCode, request, response);
        else if (error instanceof HTTPBadRequestError) {
          await this.errorHandler(error.getMessage(), statusCode, response, request);
        } else if (error instanceof HTTPBaseError) {
          await this.errorHandler(error.getMessage(), statusCode, response, request);
        } else {
          await this.errorHandler(error.message, statusCode, response, request);
        }
      } catch (error2) {
        var statusCode = error.statusCode || error.status_code || 500;
        await this.errorHandler(error.message, statusCode, response, request);

        logger.log(`Completed request in ${requestTime.toFixed(3)}ms: ${statusCode} ${statusCodeToMessage(statusCode)}`, error2);

        return;
      }

      logger.log(`Completed request in ${requestTime.toFixed(3)}ms: ${statusCode} ${statusCodeToMessage(statusCode)}`, error);
    }

    return next();
  }

  errorHandler(message, statusCode, response, request) {
    response.status(statusCode || 500).send(message || statusCodeToMessage(statusCode) || 'Internal Server Error');
  }

  createExpressApplication(options) {
    var app = Express();

    ExpressBusBoy.extend(app, options.uploads);

    return app;
  }

  async start() {
    var options = this.getOptions();
    var app     = this.createExpressApplication(options);
    var server;

    app.use(this.baseMiddleware.bind(this));
    app.all('*', this.baseRouter.bind(this));

    this.getLogger().log(`Starting ${(options.https) ? 'HTTPS' : 'HTTP'} server ${(options.https) ? 'https' : 'http'}://${options.host}:${options.port}...`);

    if (options.https) {
      var credentials = await this.getHTTPSCredentials(options.https);
      server = HTTPS.createServer(credentials, app);
    } else {
      server = HTTP.createServer(app);
    }

    server.listen(options.port);

    this.server = server;

    this.getLogger().log(`Web server listening at ${(options.https) ? 'https' : 'http'}://${options.host}:${options.port}`);

    return server;
  }

  async stop() {
    var server = this.server;
    if (!server)
      return;

    try {
      this.getLogger().log('Shutting down web server...');

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error)
            return reject(error);

          resolve();
        });
      });

      this.getLogger().log('Web server shut down successfully!');
    } catch (error) {
      this.getLogger().error('Error stopping HTTP server: ', error);
    }
  }
}

module.exports = {
  HTTPServer,
};
