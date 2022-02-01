const OS            = require('os');
const Path          = require('path');
const FileSystem    = require('fs');
const HTTP          = require('http');
const HTTPS         = require('https');
const Nife          = require('nife');
const Express       = require('express');
const ExpressBusBoy = require('express-busboy');
const Sequelize     = require('sequelize');

const {
  HTTPBaseError,
  HTTPNotFoundError,
  HTTPBadRequestError,
  HTTPBadContentTypeError,
  HTTPInternalServerError,
} = require('./http-errors');

const {
  statusCodeToMessage,
} = require('./http-utils');

class HTTPServer {
  constructor(application, _opts) {
    var appName = application.getApplicationName();

    var uploadPath = Path.resolve(OS.tmpdir(), appName.replace(/[^\w-]/g, ''), ('' + process.pid));

    var opts = Nife.extend(true, {
      host:   'localhost',
      port:   '8000',
      https:  false,
      uploads: {
        upload:       true,
        path:         uploadPath,
        allowedPath:  /./i,
      },
    }, _opts || {});

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

  executeMiddleware(middleware, request, response) {
    return new Promise((resolve, reject) => {
      if (Nife.isEmpty(middleware))
        return resolve();

      var application = this.getApplication();
      if (!request.mythixApplication)
        request.mythixApplication = application;

      var logger = request.mythixLogger;
      if (!logger)
        logger = request.mythixLogger = this.createRequestLogger(application, request);

      if (!request.Sequelize)
        request.Sequelize = Sequelize;

      var middlewareIndex = 0;
      const next = async () => {
        if (middlewareIndex >= middleware.length)
          return resolve();

        var middlewareFunc = middleware[middlewareIndex++];

        try {
          await middlewareFunc.call(this, request, response, next);
        } catch (error) {
          var statusCode  = error.statusCode || error.status_code || 500;

          if (error instanceof HTTPBaseError) {
            logger.log(`Error: ${statusCode} ${statusCodeToMessage(statusCode)}`);
            this.errorHandler(error.getMessage(), statusCode, response, request);
          } else {
            if (statusCode) {
              logger.log(`Error: ${statusCode} ${statusCodeToMessage(statusCode)}`);
              this.errorHandler(error.message, statusCode, response, request);
            } else {
              logger.log(`Error: ${error.message}`, error);
              this.errorHandler(error.message, 500, response, request);
            }
          }

          reject(error);
        }
      };

      next().catch(reject);
    });
  }

  baseMiddleware(request, response, rootNext) {
    var middleware = this.middleware;
    if (Nife.isEmpty(middleware))
      return rootNext();

    this.executeMiddleware(middleware, request, response).then(
      () => rootNext(),
      (error) => {
        if (!(error instanceof HTTPBaseError))
          this.getApplication().error('Error in middleware: ', error);
      }
    );
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
        throw new HTTPBadContentTypeError(route);

      return result;
    };

    var routes      = _routes || [];
    var method      = request.method;
    var contentType = Nife.get(request, 'headers.content-type');
    var path        = request.path;

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

  createRequestLogger(application, request, context) {
    if (request.mythixLogger)
      return request.mythixLogger;

    var logger        = application.getLogger();
    var loggerMethod  = ('' + request.method).toUpperCase();
    var loggerURL     = ('' + request.path);
    var requestID     = (Date.now() + Math.random()).toFixed(4);
    var ipAddress     = Nife.get(request, 'client.remoteAddress', '<unknown IP address>');

    return logger.clone({ formatter: (output) => `{${ipAddress}} - [#${requestID} ${loggerMethod} ${loggerURL}]: ${output}`});
  }

  validateQueryParam(route, query, paramName, queryValue, queryParams) {
    var { validate } = queryParams;
    if (!validate)
      return true;

    if (validate instanceof RegExp)
      return !!('' + queryValue).match(validate);
    else if (typeof validate === 'function')
      return !!validate.call(route, queryValue, paramName, query, queryParams);

    return true;
  }

  compileQueryParams(route, query, queryParams) {
    var finalQuery = Object.assign({}, query || {});

    var paramNames = Object.keys(queryParams || {});
    for (var i = 0, il = paramNames.length; i < il; i++) {
      var paramName   = paramNames[i];
      var queryParam  = queryParams[paramName];
      if (!queryParam)
        continue;

      var queryValue = finalQuery[paramName];
      if (queryValue == null) {
        if (queryParam.required)
          throw new HTTPBadRequestError(route, `Query param "${paramName}" is required`);

        if (queryParam.hasOwnProperty('defaultValue'))
          finalQuery[paramName] = queryParam['defaultValue'];
      } else {
        if (!this.validateQueryParam(route, finalQuery, paramName, queryValue, queryParam))
          throw new HTTPBadRequestError(route, `Query param "${paramName}" is invalid`);

        if (queryParam.hasOwnProperty('type'))
          finalQuery[paramName] = Nife.coerceValue(queryValue, queryParam['type']);
      }
    }

    return finalQuery;
  }

  async sendRequestToController(...args) {
    var context             = args[2];
    var controllerInstance  = context.controllerInstance;

    // Compile query params
    context.query = this.compileQueryParams(context.route, context.query, (context.route && context.route.queryParams));

    var route = context.route;

    // Execute middleware if any exists
    var middleware = (typeof controllerInstance.getMiddleware === 'function') ? controllerInstance.getMiddleware.call(controllerInstance, context) : [];
    if (route && Nife.instanceOf(route.middleware, 'array') && Nife.isNotEmpty(route.middleware))
      middleware = route.middleware.concat((middleware) ? middleware : []);

    if (Nife.isNotEmpty(middleware))
      await this.executeMiddleware(middleware, request, response);

    return await controllerInstance.handleIncomingRequest.apply(controllerInstance, args);
  }

  async baseRouter(request, response, next) {
    var startTime   = Nife.now();
    var application = this.getApplication();

    try {
      var logger = this.createRequestLogger(application, request, { controller, controllerMethod });

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
        query:  request.query,
        route,
        controller,
        controllerMethod,
        controllerInstance,
        startTime,
      };

      var controllerResult = await this.sendRequestToController(request, response, context);

      if (!(response.finished || response.statusMessage))
        await controllerInstance.handleOutgoingResponse(controllerResult, request, response, context);
      else if (!response.finished)
        response.end();

      var statusCode  = response.statusCode || 200;
      var requestTime = Nife.now() - startTime;
      logger.log(`Completed request in ${requestTime.toFixed(3)}ms: ${statusCode} ${response.statusMessage || statusCodeToMessage(statusCode)}`);
    } catch (error) {
      if ((error instanceof HTTPInternalServerError || !(error instanceof HTTPBaseError)) && application.getOptions().testMode)
        console.error(error);

      try {
        var statusCode  = error.statusCode || error.status_code || 500;
        var requestTime = Nife.now() - startTime;

        if (controllerInstance && typeof controllerInstance.errorHandler === 'function')
          await controllerInstance.errorHandler(error, statusCode, request, response);
        else if (error instanceof HTTPBaseError) {
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
    var options     = this.getOptions();
    var app         = this.createExpressApplication(options);
    var portString  = (options.port) ? `:${options.port}` : '';
    var server;

    app.use(this.baseMiddleware.bind(this));
    app.all('*', this.baseRouter.bind(this));

    this.getLogger().log(`Starting ${(options.https) ? 'HTTPS' : 'HTTP'} server ${(options.https) ? 'https' : 'http'}://${options.host}${portString}...`);

    if (options.https) {
      var credentials = await this.getHTTPSCredentials(options.https);
      server = HTTPS.createServer(credentials, app);
    } else {
      server = HTTP.createServer(app);
    }

    server.listen(options.port);

    this.server = server;

    var listeningPort = server.address().port;
    this.getLogger().log(`Web server listening at ${(options.https) ? 'https' : 'http'}://${options.host}:${listeningPort}`);

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
