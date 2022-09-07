'use strict';

/* global Buffer */

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
  HTTPBadContentTypeError,
  HTTPInternalServerError,
} = require('./http-errors');

const {
  statusCodeToMessage,
} = require('../utils/http-utils');

const REQUEST_ID_POSTFIX_LENGTH = 4;
const REQUEST_TIME_RESOLUTION   = 3;

const DEFAULT_FILE_UPLOAD_BUFFER_SIZE = 2 * 1024 * 1024; // 2mb
const DEFAULT_FILE_UPLOAD_SIZE_LIMIT  = 2 * 1024 * 1024; // 10mb

class HTTPServer {
  constructor(application, _opts) {
    let uploadPath = Path.resolve(application.getTempPath(), 'uploads');

    let opts = Nife.extend(true, {
      host:    'localhost',
      port:    '8000',
      https:   false,
      uploads: {
        upload:         true,
        path:           uploadPath,
        allowedPath:    /./i,
        highWaterMark:  DEFAULT_FILE_UPLOAD_BUFFER_SIZE,
        limits:         {
          fileSize: DEFAULT_FILE_UPLOAD_SIZE_LIMIT,
        },
      },
    }, _opts || {});

    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        application,
      },
      'server': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'options': {
        writable:     false,
        enumerable:   false,
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
    let application = this.getApplication();
    return application.getLogger();
  }

  getOptions() {
    return this.options;
  }

  getHTTPSCredentials(options) {
    let keyContent = options.key;
    if (!keyContent && options.keyPath)
      keyContent = FileSystem.readFileSync(options.keyPath, 'latin1');

    let certContent = options.cert;
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
    let { route, params } = (this.findFirstMatchingRoute(request, this.routes) || {});

    return new Promise((resolve, reject) => {
      if (Nife.isEmpty(middleware)) {
        resolve();
        return;
      }

      let application = this.getApplication();
      if (!request.mythixApplication)
        request.mythixApplication = application;

      let logger = request.mythixLogger;
      if (!logger)
        logger = request.mythixLogger = this.createRequestLogger(application, request);

      request.route = route;
      request.params = params;

      let middlewareIndex = 0;
      const next = async () => {
        if (middlewareIndex >= middleware.length)
          return resolve();

        let middlewareFunc = middleware[middlewareIndex++];

        try {
          await middlewareFunc.call(this, request, response, next);
        } catch (error) {
          let statusCode  = error.statusCode || error.status_code || 500;

          if (error instanceof HTTPBaseError) {
            logger.error(`Error: ${statusCode} ${statusCodeToMessage(statusCode)}`);
            this.errorHandler(error, error.getMessage(), statusCode, response, request);
          } else {
            if (statusCode) {
              logger.error(`Error: ${statusCode} ${statusCodeToMessage(statusCode)}`);
              this.errorHandler(error, error.message, statusCode, response, request);
            } else {
              logger.error(`Error: ${error.message}`, error);
              this.errorHandler(error, error.message, 500, response, request);
            }
          }

          reject(error);
        }
      };

      next().catch(reject);
    });
  }

  baseMiddleware(request, response, rootNext) {
    let middleware = this.middleware;
    if (Nife.isEmpty(middleware))
      return rootNext();

    this.executeMiddleware(middleware, request, response).then(
      () => rootNext(),
      (error) => {
        if (!(error instanceof HTTPBaseError))
          this.getApplication().getLogger().error('Error in middleware: ', error);
      },
    );
  }

  findFirstMatchingRoute(request, _routes) {
    const routeMatcher = (route, method, path, contentType) => {
      let {
        methodMatcher,
        contentTypeMatcher,
        pathMatcher,
      } = route;

      if (typeof methodMatcher === 'function' && !methodMatcher(method))
        return;

      let result = (typeof pathMatcher !== 'function') ? false : pathMatcher(path);
      if (!result)
        return;

      if (typeof contentTypeMatcher === 'function' && !contentTypeMatcher(contentType))
        throw new HTTPBadContentTypeError(route);

      return result;
    };

    let routes      = _routes || [];
    let method      = request.method;
    let contentType = Nife.get(request, 'headers.content-type');
    let path        = request.path;

    for (let i = 0, il = routes.length; i < il; i++) {
      let route   = routes[i];
      let result  = routeMatcher(route, method, path, contentType);
      if (!result)
        continue;

      return { route, params: result };
    }

    throw new HTTPNotFoundError();
  }

  getRouteController(_controller, route, params, request) {
    let controller = _controller;

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
    } else if (Nife.instanceOf(controller, 'string')) {
      controller = this.getApplication().getController(controller);
    }

    return controller;
  }

  createRequestLogger(application, request) {
    let requestID = (Date.now() + Math.random()).toFixed(REQUEST_ID_POSTFIX_LENGTH);

    if (request.mythixLogger) {
      if (!request.mythixRequestID)
        request.mythixRequestID = requestID;

      return request.mythixLogger;
    }

    let logger        = application.getLogger();
    let loggerMethod  = ('' + request.method).toUpperCase();
    let loggerURL     = ('' + request.path);
    let ipAddress     = Nife.get(request, 'client.remoteAddress', '<unknown IP address>');

    request.mythixRequestID = requestID;

    return logger.clone({ formatter: (output) => `{${ipAddress}} - [#${requestID} ${loggerMethod} ${loggerURL}]: ${output}`});
  }

  validateQueryParam(route, query, paramName, queryValue, queryParams) {
    let { validate } = queryParams;
    if (!validate)
      return true;

    if (validate instanceof RegExp)
      return !!('' + queryValue).match(validate);
    else if (typeof validate === 'function')
      return !!validate.call(route, queryValue, paramName, query, queryParams);

    return true;
  }

  compileQueryParams(route, query, queryParams) {
    let finalQuery = Object.assign({}, query || {});

    let paramNames = Object.keys(queryParams || {});
    for (let i = 0, il = paramNames.length; i < il; i++) {
      let paramName   = paramNames[i];
      let queryParam  = queryParams[paramName];
      if (!queryParam)
        continue;

      let queryValue = finalQuery[paramName];
      if (queryValue == null) {
        if (queryParam.required)
          throw new HTTPBadRequestError(route, `Query param "${paramName}" is required`);

        if (Object.prototype.hasOwnProperty.call(queryParam, 'defaultValue'))
          finalQuery[paramName] = queryParam['defaultValue'];
      } else {
        if (!this.validateQueryParam(route, finalQuery, paramName, queryValue, queryParam))
          throw new HTTPBadRequestError(route, `Query param "${paramName}" is invalid`);

        if (Object.prototype.hasOwnProperty.call(queryParam, 'type'))
          finalQuery[paramName] = Nife.coerceValue(queryValue, queryParam['type']);
      }
    }

    return finalQuery;
  }

  async sendRequestToController(request, response, context) {
    let controllerInstance = context.controllerInstance;

    // Compile query params
    context.query = this.compileQueryParams(context.route, context.query, (context.route && context.route.queryParams));

    let route = context.route;

    // Execute middleware if any exists
    let middleware = (typeof controllerInstance.getMiddleware === 'function') ? controllerInstance.getMiddleware.call(controllerInstance, context) : [];
    if (route && Nife.instanceOf(route.middleware, 'array') && Nife.isNotEmpty(route.middleware))
      middleware = route.middleware.concat((middleware) ? middleware : []);

    if (Nife.isNotEmpty(middleware))
      await this.executeMiddleware(middleware, request, response);

    return await controllerInstance.handleIncomingRequest.apply(controllerInstance, [ request, response, context ]);
  }

  async baseRouter(request, response, next) {
    let startTime   = Nife.now();
    let application = this.getApplication();
    let controllerInstance;
    let logger;

    try {
      logger = this.createRequestLogger(application, request);
      logger.info('Starting request');

      let { route, params } = (this.findFirstMatchingRoute(request, this.routes) || {});

      request.params = params || {};

      let _controller = this.getRouteController(route.controller, route, params, request);
      let {
        controller,
        controllerMethod,
      } = (_controller || {});

      let ControllerConstructor = controller;

      if (!controller)
        throw new HTTPInternalServerError(route, `Controller not found for route ${route.url}`);

      if (Nife.isEmpty(controllerMethod))
        controllerMethod = (request.method || 'get').toLowerCase();

      controllerInstance = new ControllerConstructor(application, logger || application.getLogger(), request, response);

      let context = {
        params: request.params,
        query:  request.query,
        route,
        controller,
        controllerMethod,
        controllerInstance,
        startTime,
      };

      let controllerResult = await this.sendRequestToController(request, response, context);

      if (!(response.finished || response.statusMessage))
        await controllerInstance.handleOutgoingResponse(controllerResult, request, response, context);
      else if (!response.finished)
        response.end();

      let statusCode  = response.statusCode || 200;
      let requestTime = Nife.now() - startTime;

      logger.log(`Completed request in ${requestTime.toFixed(REQUEST_TIME_RESOLUTION)}ms: ${statusCode} ${response.statusMessage || statusCodeToMessage(statusCode)}`);
    } catch (error) {
      if ((error instanceof HTTPInternalServerError || !(error instanceof HTTPBaseError)) && application.getOptions().testMode)
        (logger || application.getLogger()).error(error);

      let requestTime = Nife.now() - startTime;
      let statusCode;

      try {
        statusCode = error.statusCode || error.status_code || 500;

        if (controllerInstance && typeof controllerInstance.errorHandler === 'function')
          await controllerInstance.errorHandler(error, statusCode, request, response);
        else if (error instanceof HTTPBaseError)
          await this.errorHandler(error, error.getMessage(), statusCode, response, request);
        else
          await this.errorHandler(error, error.message, statusCode, response, request);

      } catch (error2) {
        statusCode = error2.statusCode || error2.status_code || 500;

        await this.errorHandler(error2, error2.message, statusCode, response, request);

        logger.log(`Completed request in ${requestTime.toFixed(REQUEST_TIME_RESOLUTION)}ms: ${statusCode} ${statusCodeToMessage(statusCode)}`, error2);

        return;
      }

      (logger || application.getLogger()).log(`Completed request in ${requestTime.toFixed(REQUEST_TIME_RESOLUTION)}ms: ${statusCode} ${statusCodeToMessage(statusCode)}`, error);
    }

    return next();
  }

  errorHandler(error, message, statusCode, response /*, request */) {
    if (response.statusMessage)
      return;

    if (error && error.headers) {
      let headers = error.headers;
      let headerKeys = Object.keys(headers);

      for (let i = 0, il = headerKeys.length; i < il; i++) {
        let headerKey = headerKeys[i];
        let value     = headers[headerKey];
        if (value == null)
          continue;

        response.header(headerKey, ('' + value));
      }
    }

    response.status(statusCode || 500).send(message || statusCodeToMessage(statusCode) || 'Internal Server Error');
  }

  createExpressApplication(options) {
    // eslint-disable-next-line new-cap
    let app = Express();

    app.use(Express.raw({ type: 'application/json' }));

    // Store _rawBody for request
    app.use((request, response, next) => {
      if ((/application\/json/i).test(request.headers['content-type']) && Buffer.isBuffer(request.body)) {
        let bodyStr = request.body.toString('utf8');
        request._rawBody = request.body = bodyStr;
      }

      next();
    });

    ExpressBusBoy.extend(app, options.uploads);

    return app;
  }

  async start() {
    let options     = this.getOptions();
    let app         = this.createExpressApplication(options);
    let portString  = (options.port) ? `:${options.port}` : '';
    let server;

    app.use(this.baseMiddleware.bind(this));
    app.all('*', this.baseRouter.bind(this));

    this.getLogger().log(`Starting ${(options.https) ? 'HTTPS' : 'HTTP'} server ${(options.https) ? 'https' : 'http'}://${options.host}${portString}...`);

    if (options.https) {
      let credentials = await this.getHTTPSCredentials(options.https);
      server = HTTPS.createServer(credentials, app);
    } else {
      server = HTTP.createServer(app);
    }

    server.listen(options.port);

    this.server = server;

    let listeningPort = server.address().port;

    this.getLogger().info(`Web server listening at ${(options.https) ? 'https' : 'http'}://${options.host}:${listeningPort}`);

    return server;
  }

  async stop() {
    let server = this.server;
    if (!server)
      return;

    try {
      this.getLogger().info('Shutting down web server...');

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error)
            return reject(error);

          resolve();
        });
      });

      this.getLogger().info('Web server shut down successfully!');
    } catch (error) {
      this.getLogger().error('Error stopping HTTP server: ', error);
    }
  }
}

module.exports = {
  HTTPServer,
};
