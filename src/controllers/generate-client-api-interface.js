'use strict';

/* global Buffer, Utils, globalScope */

const Nife            = require('nife');
const ControllerUtils = require('./controller-utils');
const HTTPUtils       = require('../utils/http-utils');

function tabIn(str, amount) {
  let padding = ''.padStart((amount || 1) * 2, ' ');
  let firstLine = true;

  return str.replace(/^/gm, () => {
    if (firstLine) {
      firstLine = false;
      return '';
    }

    return padding;
  });
}

function buildRoutes(httpServer, routes) {
  let customParserTypes = this.getCustomRouteParserTypes(httpServer, routes);
  return ControllerUtils.buildRoutes(routes, customParserTypes);
}

function nodeRequestHandler(routeName, requestOptions) {
  return new Promise((function(resolve, reject) {
    if (!requestOptions || Utils.isEmpty(requestOptions.url)) {
      reject([ 'API::', routeName, ': "url" is required.' ].join(''));
      return;
    }

    var HTTP  = (requestOptions.httpModule) ? requestOptions.httpModule : require('http');
    var URL   = require('url');

    var method      = (requestOptions.method || 'GET').toUpperCase();
    var url         = new URL.URL(requestOptions.url);
    var data        = requestOptions.data;
    var extraConfig = {};
    var headers     = Object.assign({}, this.defaultHeaders || {}, requestOptions.headers || {});

    if (data) {
      if (!method.match(/^(GET|HEAD)$/i)) {
        if ((headers['Content-Type'] || '').match(/application\/json/i))
          data = JSON.stringify(data);

        extraConfig = {
          headers: {
            'Content-Length': Buffer.byteLength(data),
          },
        };
      } else {
        let queryString = Utils.dataToQueryString(data);
        if (queryString) {
          let newParams = new URL.URLSearchParams(queryString);
          let keys      = Array.from(newParams.keys());

          for (let i = 0, il = keys.length; i < il; i++) {
            let key = keys[i];
            url.searchParams.set(key, newParams.get(key));
          }
        }

        data = undefined;
      }
    }

    var options = Object.assign(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port:     url.port,
        path:     `${url.pathname}${url.search}`,
        method,
      },
      requestOptions,
      extraConfig,
      { headers:  Object.assign({}, headers, extraConfig.headers || {}) },
    );

    delete options.data;

    var thisRequest = HTTP.request(options, function(response) {
      var responseData = Buffer.alloc(0);

      response.on('data', function(chunk) {
        responseData = Buffer.concat([ responseData, chunk ]);
      });

      response.on('error', function(error) {
        reject(error);
      });

      response.on('end', function() {
        response.rawBody = response.body = responseData;

        try {
          var contentType = response.headers['content-type'];

          if (contentType && contentType.match(/application\/json/i)) {
            var data = JSON.parse(responseData.toString('utf8'));

            Object.defineProperties(data, {
              '__response': {
                writable:     true,
                enumberable:  false,
                configurable: true,
                value:        response,
              },
              '__statusCode': {
                writable:     true,
                enumberable:  false,
                configurable: true,
                value:        response.status,
              },
              '__statusText': {
                writable:     true,
                enumberable:  false,
                configurable: true,
                value:        response.statusText,
              },
            });

            response.body = data;

            resolve(data);
          } else if (contentType && contentType.match(/text\/(plain|html)/)) {
            response.body = responseData.toString('utf8');
            resolve(response.body);
          } else {
            resolve(response);
          }
        } catch (error) {
          return reject(error);
        }
      });
    });

    thisRequest.on('error', function(error) {
      reject(error);
    });

    if (data)
      thisRequest.write(data);

    thisRequest.end();
  }).bind(this));
}

function browserRequestHandler(routeName, requestOptions) {
  return new Promise((function(resolve, reject) {
    if (!requestOptions || Utils.isEmpty(requestOptions.url)) {
      reject([ 'API::', routeName, ': "url" is required.' ].join(''));
      return;
    }

    var method      = (requestOptions.method || 'GET').toUpperCase();
    var url         = requestOptions.url;
    var data        = requestOptions.data;
    var extraConfig = {};
    var headers     = Object.assign({ 'Content-Type': 'application/json; charset=UTF-8' }, this.defaultHeaders || {}, requestOptions.headers || {});

    if (data) {
      if (!method.match(/^(GET|HEAD)$/i)) {
        if ((headers['Content-Type'] || '').match(/application\/json/i))
          data = JSON.stringify(data);

        extraConfig = {
          body: data,
        };
      } else {
        var queryString = Utils.dataToQueryString(data);
        if (queryString)
          url = url + queryString;
      }
    }

    var options = Object.assign(
      { method },
      requestOptions,
      extraConfig,
      { headers:  Object.assign({}, headers, extraConfig.headers || {}) },
    );

    delete options.data;

    globalScope.fetch(url, options).then(
      function(response) {
        if (typeof requestOptions.responseHandler === 'function')
          return requestOptions.responseHandler(response);

        if (!response.ok) {
          var error = new Error(response.statusText);
          error.response = response;

          reject(error);
          return;
        }

        var contentType = response.headers.get('Content-Type');
        if (contentType && contentType.match(/application\/json/i)) {
          var data = response.json();

          Object.defineProperties(data, {
            '__response': {
              writable:     true,
              enumberable:  false,
              configurable: true,
              value:        response,
            },
            '__statusCode': {
              writable:     true,
              enumberable:  false,
              configurable: true,
              value:        response.status,
            },
            '__statusText': {
              writable:     true,
              enumberable:  false,
              configurable: true,
              value:        response.statusText,
            },
          });

          return data;
        } else if (contentType && contentType.match(/text\/(plain|html)/i)) {
          return response.text();
        } else {
          return response;
        }
      },
      function(error) {
        reject(error);
      },
    );
  }).bind(this));
}

function generateUtils() {
  return `
  var Utils = (function() {
    ${tabIn(Nife.instanceOf.toString(), 2)}\n
    ${tabIn(Nife.sizeOf.toString(), 2)}\n
    ${tabIn(Nife.isEmpty.toString(), 2)}\n
    ${tabIn(HTTPUtils.dataToQueryString.toString().replace(/\bNife\b/g, 'Utils'), 2).replace(/\b(const|let)\b/g, 'var')}

    function injectURLParams(routeName, _options) {
      var options = _options || {};
      var params = options.params || {};

      if (Utils.isEmpty(options.url))
        throw new Error([ 'API::', routeName, ': "url" is required.' ].join(''));

      return options.url.replace(/<<(\\w+)(\\?)?>>/g, function(m, name, _optional) {
        var optional = (_optional === '?');
        var param = params[name];

        if (Utils.isEmpty(param)) {
          if (!optional)
            throw new Error([ 'API::', routeName, ': Parameter "', name, '" is required. You need to add the following to your call: ', routeName, '({ params: { "', name, '": (value) } })' ].join(''));

          param = '';
        }

        return param;
      });
    }

    return {
      instanceOf,
      sizeOf,
      isEmpty,
      dataToQueryString,
      injectURLParams,
    };
  })();
`;
}

function generateRoutes(routes, _options) {
  let options         = _options || {};
  let methods         = {};
  let domain          = options.domain;

  if (Nife.isEmpty(domain))
    domain = '';
  else
    domain = ('' + domain).replace(/\/+$/, '');

  for (let i = 0, il = routes.length; i < il; i++) {
    let route       = routes[i];
    let methodName  = route.name;
    if (Nife.isEmpty(methodName))
      continue;

    let pathMatcher   = route.pathMatcher;
    let clientOptions = route.clientOptions;
    let sanitizedPath = pathMatcher.sanitizedPath;

    if (clientOptions == null) {
      let contentType = route.accept;
      if (Nife.isEmpty(contentType))
        contentType = 'application/json; charset=UTF-8';
      else if (Array.isArray(contentType))
        contentType = contentType[0];

      clientOptions = {
        credentials:  'same-origin',
        headers:      {
          'Content-Type': contentType,
        },
      };
    }

    clientOptions = JSON.stringify(clientOptions, (key, value) => {
      if (typeof value === 'function')
        return value.toString();

      return value;
    });

    let defaultMethod = Nife.toArray(route.methods).filter(Boolean);
    if (Nife.isEmpty(defaultMethod))
      defaultMethod = 'GET';
    else if (Array.isArray(defaultMethod))
      defaultMethod = defaultMethod[0];

    let url = `${domain}${sanitizedPath}`;
    methods[methodName] = `function ${methodName}(_options) { var clientOptions = ${clientOptions}; var options = Object.assign({ url: '${url}', method: '${defaultMethod}' }, defaultRouteOptions, clientOptions, Object.assign({}, _options || {}, { headers: Object.assign({}, defaultRouteOptions.headers || {}, clientOptions.headers || {}, ((_options || {}).headers) || {}) })); options.url = Utils.injectURLParams('${methodName}', options); delete options.params; return makeRequest.call(this, '${methodName}', options); }`;
  }

  return methods;
}

function generateAPIInterface(routes, _options) {
  let options           = _options || {};
  let environment       = options.environment;
  let routeMethods      = generateRoutes(routes, options);
  let routeMethodNames  = Object.keys(routeMethods).sort();
  let injectMethodsStr  = routeMethodNames.map((methodName) => {
    let method = routeMethods[methodName];
    return `    apiInterface['${methodName}'] = (${method}).bind(apiInterface);`;
  }).join('\n\n');

  let defaultRouteOptions = options.defaultRouteOptions;
  if (Nife.isNotEmpty(defaultRouteOptions)) {
    defaultRouteOptions = JSON.stringify(defaultRouteOptions, (key, value) => {
      if (typeof value === 'function')
        return value.toString();

      return value;
    });
  } else {
    defaultRouteOptions = '{}';
  }

  return `function generateAPIInterface(globalScope, environmentType) {
    function getDefaultHeader(headerName) {
      return apiInterface.defaultHeaders[headerName];
    }

    function getDefaultHeaders() {
      return apiInterface.defaultHeaders;
    }

    function setDefaultHeader(headerName, value) {
      if (value == null) {
        delete apiInterface.defaultHeaders[headerName];
        return;
      }

      apiInterface.defaultHeaders[headerName] = value;
    }

    function setDefaultHeaders(headers) {
      let headerNames = Object.keys(headers);
      for (let i = 0, il = headerNames.length; i < il; i++) {
        let headerName  = headerNames[i];
        let value       = headers[headerName];

        if (value == null) {
          delete apiInterface.defaultHeaders[headerName];
          continue;
        }

        apiInterface.defaultHeaders[headerName] = value;
      }
    }

    ${(environment == null || environment === 'node') ? tabIn(nodeRequestHandler.toString(), 2) : ''}\n
    ${(environment == null || environment === 'browser') ? tabIn(browserRequestHandler.toString(), 2) : ''}

    function makeRequest(routeName, options) {
      ${(environment === 'node') ? 'return nodeRequestHandler.call(this, routeName, options);' : ''}
      ${(environment === 'browser') ? 'return browserRequestHandler.call(this, routeName, options);' : ''}
      ${(environment == null) ? 'return (environmentType === \'browser\') ? browserRequestHandler.call(this, routeName, options) : nodeRequestHandler.call(this, routeName, options);' : ''}
    }

    var apiInterface = Object.create({
      defaultHeaders: {},
      makeRequest,
      getDefaultHeader,
      getDefaultHeaders,
      setDefaultHeader,
      setDefaultHeaders,
    });

    var defaultRouteOptions = ${defaultRouteOptions};

    ${injectMethodsStr.trim()}

    return apiInterface;
  }`;
}

function generateClientAPIInterface(application, _options) {
  let options     = _options || {};
  let httpServer  = application.getHTTPServer() || null;
  let routes      = buildRoutes.call(application, httpServer, application.getRoutes());
  let globalName  = (Object.prototype.hasOwnProperty.call(options, 'globalName')) ? options.globalName : '';

  if (Nife.isNotEmpty(globalName))
    globalName = `globalScope['${globalName}'] = APIInterface`;
  else
    globalName = '';

  return `'use strict';\n
(function(globalScope, environmentType) {
  ${generateUtils()}\n
  ${tabIn(generateAPIInterface(routes, options), 1)}\n

  var APIInterface = generateAPIInterface(globalScope, environmentType);

  ${globalName}

  return APIInterface;
}).call(this, (typeof window === 'undefined') ? global : window, (typeof window !== 'undefined') ? 'browser' : 'node');
`;
}

module.exports = {
  generateClientAPIInterface,
};
