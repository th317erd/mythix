/* eslint-disable no-magic-numbers */
/* global Utils, globalScope, HTTP */

import Nife           from 'nife';
import * as HTTPUtils from '../utils/http-utils.mjs';

function tabIn(str, amount) {
  var padding = ''.padStart((amount || 1) * 2, ' ');
  var firstLine = true;

  return str.replace(/^/gm, () => {
    if (firstLine) {
      firstLine = false;
      return '';
    }

    return padding;
  });
}

function nodeRequestHandler(routeName, requestOptions) {
  return new Promise((function(resolve, reject) {
    if (!requestOptions || Utils.isEmpty(requestOptions.url)) {
      reject([ 'API::', routeName, ': "url" is required.' ].join(''));
      return;
    }

    var HTTPModule  = (requestOptions.httpModule) ? requestOptions.httpModule : HTTP;
    var URLModule   = (requestOptions.urlModule) ? requestOptions.urlModule : URL;

    var method      = (requestOptions.method || 'GET').toUpperCase();
    var url         = new URLModule.URL(requestOptions.url);
    var data        = requestOptions.data;
    var extraConfig = {};
    var headers     = Object.assign({}, Utils.keysToLowerCase(this.defaultHeaders || {}), Utils.keysToLowerCase(requestOptions.headers || {}));

    if (data) {
      if (!method.match(/^(GET|HEAD)$/i)) {
        if (data.constructor.name === 'FormData') {
          extraConfig = {
            headers: data.getHeaders(),
          };
        } else {
          if ((headers['content-type'] || '').match(/application\/json/i))
            data = JSON.stringify(data);

          extraConfig = {
            headers: {
              'content-length': Buffer.byteLength(data),
            },
          };
        }
      } else {
        var queryString = Utils.dataToQueryString(data);
        if (queryString) {
          var newParams = new URLModule.URLSearchParams(queryString);
          var keys      = Array.from(newParams.keys());

          for (var i = 0, il = keys.length; i < il; i++) {
            var key = keys[i];
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
      {
        headers: Utils.cleanObjectProperties(Object.assign(
          {},
          headers,
          Utils.keysToLowerCase(extraConfig.headers || {}),
        )),
      },
    );

    delete options.data;

    var thisRequest = HTTPModule.request(Utils.cleanObjectProperties(options), function(response) {
      var responseData = Buffer.alloc(0);

      response.on('data', function(chunk) {
        responseData = Buffer.concat([ responseData, chunk ]);
      });

      response.on('error', function(error) {
        reject(error);
      });

      response.on('end', function() {
        response.rawBody = responseData;

        if (response.statusCode > 399) {
          var error = new Error(response.statusText);
          error.response = response;

          reject(error);
          return;
        }

        try {
          var contentType = response.headers['content-type'];
          var data;

          if (contentType && contentType.match(/application\/json/i))
            data = JSON.parse(responseData.toString('utf8'));
          else if (contentType && contentType.match(/text\/(plain|html)/))
            data = responseData.toString('utf8');
          else
            data = response.body;

          resolve({ response, body: data });
        } catch (error) {
          return reject(error);
        }
      });
    });

    thisRequest.on('error', function(error) {
      reject(error);
    });

    if (data) {
      if (data.constructor.name === 'FormData') {
        data.pipe(thisRequest);
      } else if (data) {
        thisRequest.write(data);
        thisRequest.end();
      }
    } else {
      thisRequest.end();
    }
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
    var headers     = Object.assign(Utils.keysToLowerCase(this.defaultHeaders || {}), Utils.keysToLowerCase(requestOptions.headers || {}));
    var isFormData  = (data && (data instanceof FormData || data.constructor.name === 'FormData'));

    if (data) {
      if (!method.match(/^(GET|HEAD)$/i)) {
        if (isFormData) {
          extraConfig = {
            body: data,
          };
        } else {
          if ((headers['content-type'] || '').match(/application\/json/i))
            data = JSON.stringify(data);

          extraConfig = {
            body: data,
          };
        }
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
      {
        headers: Utils.cleanObjectProperties(Object.assign(
          {},
          headers,
          Utils.keysToLowerCase(extraConfig.headers || {}),
        )),
      },
    );

    delete options.data;
    if (isFormData && options.headers)
      delete options.headers['content-type'];

    globalScope.fetch(url, Utils.cleanObjectProperties(options)).then(
      async function(response) {
        if (typeof requestOptions.responseHandler === 'function')
          return requestOptions.responseHandler(response);

        if (!response.ok || response.statusCode > 399) {
          var error = new Error(response.statusText);
          error.response = response;

          reject(error);
          return;
        }

        var contentType = response.headers.get('Content-Type');
        let data;

        if (contentType && contentType.match(/application\/json/i))
          data = await response.json();
        else if (contentType && contentType.match(/text\/(plain|html)/i))
          data = await response.text();
        else
          data = response.body;

        resolve({ response, body: data });
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
    ${tabIn(HTTPUtils.dataToQueryString.toString().replace(/\bNife\b/g, 'Utils'), 2).replace(/\b(const|var)\b/g, 'var')}

    function keysToLowerCase(obj) {
      var keys    = Object.keys(obj || {});
      var newObj  = {};

      for (var i = 0, il = keys.length; i < il; i++) {
        var key   = keys[i];
        var value = obj[key];
        newObj[key.toLowerCase()] = value;
      }

      return newObj;
    }

    function cleanObjectProperties(obj) {
      var keys    = Object.keys(obj || {});
      var newObj  = {};

      for (var i = 0, il = keys.length; i < il; i++) {
        var key   = keys[i];
        var value = obj[key];
        if (value == null || value == '')
          continue;

        newObj[key] = value;
      }

      return newObj;
    }

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
      keysToLowerCase,
      cleanObjectProperties,
      injectURLParams,
    };
  })();
`;
}

function generateRoutes(applicationRoutes, _options) {
  let options     = _options || {};
  let methods     = {};
  let domain      = options.domain;
  let routeFilter = options.routeFilter;

  if (Nife.isEmpty(domain))
    domain = '';
  else
    domain = ('' + domain).replace(/\/+$/, '');

  applicationRoutes.walkRoutes((context) => {
    if (typeof routeFilter === 'function') {
      if (!routeFilter(context))
        return;
    }

    let { endpoint }  = context;
    let methodName    = endpoint.name;
    if (Nife.isEmpty(methodName))
      return;

    let clientOptions = endpoint.clientOptions;
    if (clientOptions == null) {
      let contentType = endpoint.contentType;
      if (Nife.isEmpty(contentType))
        contentType = 'application/json';
      else if (Array.isArray(contentType))
        contentType = contentType[0];

      clientOptions = {
        credentials: 'same-origin',
      };

      // Don't set content type for multipart/form-data
      if (!(/multipart\/form-data/i).test(contentType)) {
        clientOptions.headers = {
          'Content-Type': contentType,
        };
      }
    }

    clientOptions = JSON.stringify(clientOptions, (key, value) => {
      if (typeof value === 'function')
        return value.toString();

      return value;
    });

    let defaultMethod = endpoint.methods[0];
    let url = `${domain}/${endpoint.path.replace(/^\/+/, '')}`;
    methods[methodName] = {
      method: `function ${methodName}(_options) { var clientOptions = ${clientOptions}; var options = Object.assign({ url: '${url}', method: '${defaultMethod}' }, defaultRouteOptions, clientOptions, Object.assign({}, _options || {}, { headers: Object.assign({}, defaultRouteOptions.headers || {}, clientOptions.headers || {}, ((_options || {}).headers) || {}) })); options.url = Utils.injectURLParams('${methodName}', options); delete options.params; return makeRequest.call(this, '${methodName}', options); }`,
      endpoint,
    };
  });

  return methods;
}

const PRINT_TABLE = `
    function printTable(columns, rows, title, prefix) {
      function print(message) {
        lines.push((prefix || '') + message);
      }

      const sanitizeValue = (value) => {
        return ('' + value).replace(/\\u001B\\[\\d+m/g, '');
      };

      const findLongestValue = (column) => {
        var maxSize = column.length;

        for (var i = 0, il = rows.length; i < il; i++) {
          var row = rows[i];
          if (!row)
            continue;

          var value = sanitizeValue('' + row[column]);
          if (value.length > maxSize)
            maxSize = value.length;
        }

        return maxSize;
      };

      const generateSequence = (size, char) => {
        var array = new Array(size);
        for (var i = 0, il = array.length; i < il; i++)
          array[i] = char;

        return array.join('');
      };

      const padColumnValue = (_value, columnSize) => {
        var value = sanitizeValue(_value);
        var prefixSize = Math.floor((columnSize - value.length) / 2.0);
        var prefix = generateSequence(prefixSize, ' ');
        var postfix = generateSequence(columnSize - value.length - prefixSize, ' ');

        return [ prefix, _value, postfix ].join('');
      };

      const capitalize = (value) => {
        return value.replace(/^./, (m) => {
          return m.toUpperCase();
        });
      };

      var lines = [];
      var columnSizes = {};
      var columnPadding = 4;
      var totalWidth = columns.length + 1;

      var lineChar = '~';
      var sepChar = bold('|');

      for (var i = 0, il = columns.length; i < il; i++) {
        var column = columns[i];
        var columnWidth = findLongestValue(column) + (columnPadding * 2);

        totalWidth += columnWidth;

        columnSizes[column] = columnWidth;
      }

      var hrLine = bold(sepChar + generateSequence(totalWidth - 2, lineChar) + sepChar);
      var hrLine2 = columns.map((column) => generateSequence(columnSizes[column], lineChar));

      hrLine2 = bold(sepChar + hrLine2.join(sepChar) + sepChar);

      if (title) {
        print(hrLine);
        print(sepChar + bold(padColumnValue(title, totalWidth - 2)) + sepChar);
      }

      print(hrLine);

      var line = [ sepChar ];
      for (var j = 0, jl = columns.length; j < jl; j++) {
        var column = columns[j];
        var columnSize = columnSizes[column];

        line.push(bold(padColumnValue(capitalize(column), columnSize)));

        line.push(sepChar);
      }

      print(line.join(''));
      print(hrLine);

      for (var i = 0, il = rows.length; i < il; i++) {
        var row = rows[i];

        if (i > 0)
          print(hrLine2);

        var line = [ sepChar ];

        for (var j = 0, jl = columns.length; j < jl; j++) {
          var column = columns[j];
          var columnSize = columnSizes[column];
          var value = ('' + row[column]);

          line.push(padColumnValue(value, columnSize));

          line.push(sepChar);
        }

        print(line.join(''));
      }

      print(hrLine);

      console.info(lines.join('\\n'));
    }
`;

function generateAPIInterface(routes, _options) {
  var options           = _options || {};
  var environment       = options.environment;
  var routeMethods      = generateRoutes(routes, options);
  var routeMethodNames  = Object.keys(routeMethods).sort();
  var injectMethodsStr  = routeMethodNames.map((methodName) => {
    var info      = routeMethods[methodName];
    var method    = info.method;
    var endpoint  = info.endpoint;
    var help      = endpoint.help;

    if (!help || options.mode !== 'development')
      help = '{}';
    else
      help = JSON.stringify(help);

    return `    apiInterface['${methodName}'] = assignHelp((${method}).bind(apiInterface), '${methodName}', ${help});`;
  }).join('\n\n');

  var defaultRouteOptions = options.defaultRouteOptions;
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
    var helpStyles = {
      'error': 'font-weight: 800; color: red;',
      'normal': 'font-weight: 200;',
      'bold': 'font-weight: 800;',
      'boldYellow': 'font-weight: 800; color: yellow;',
    };

    const bold = (value) => {
      return '\u001b[1m' + value + '\u001b[0m';
    };

    const orange = (value) => {
      return '\u001b[33m' + value + '\u001b[0m';
    };

    ${(options.mode === 'development') ? PRINT_TABLE : ''}

    function assignHelp(func, methodName, help) {
      Object.defineProperty(func, 'help', {
        enumerable:   false,
        configurable: false,
        get: () => {
          if (!help || !help.description) {
            console.log('%cNo help found for route "' + methodName + '"', helpStyles.error);
            return;
          }

          console.info('%cHelp for %c' + methodName + '%c route:', helpStyles.bold, helpStyles.boldYellow, helpStyles.bold);
          console.info('  %cDescription:%c ' + help.description, helpStyles.bold, helpStyles.normal);

          if (!Utils.isEmpty(help.data))
            printTable([ 'property', 'type', 'description', 'required' ], help.data, bold('data: ') + orange('{ data: { ... } }'), '  ');

          if (!Utils.isEmpty(help.params))
            printTable([ 'property', 'type', 'description', 'required' ], help.params, bold('parameters: ') + orange('{ params: { ... } }'), '  ');

          if (!Utils.isEmpty(help.extra)) {
            for (var i = 0, il = help.extra.length; i < il; i++) {
              var item = help.extra[i];

              if (item.type === 'table')
                printTable(item.columns, item.rows, item.title, '  ');
              else if (item.title)
                console.log([ '  %c' + item.title + ':%c ', item.description ].join(''), helpStyles.bold, helpStyles.normal);
            }
          }

          if (help.example)
            console.info('  %cExample:%c ' + orange(help.example), helpStyles.bold, helpStyles.normal);

          if (!Utils.isEmpty(help.notes)) {
            for (var i = 0, il = help.notes.length; i < il; i++) {
              var note = help.notes[i];
              console.log([ '  %cNote ', i + 1, ':%c ', note ].join(''), helpStyles.bold, helpStyles.normal);
            }
          }
        },
        set: () => {},
      });

      return func;
    }

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
      var headerNames = Object.keys(headers);
      for (var i = 0, il = headerNames.length; i < il; i++) {
        var headerName  = headerNames[i];
        var value       = headers[headerName];

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
      ${(environment === 'node') ? 'loaded: () => Promise.all(_loadingPromises).then(() => true)' : 'loaded: () => Promise.resolve(true)'},
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

export function generateClientAPIInterface(application, _options) {
  var options     = _options || {};
  var routes      = application._getRoutes();
  var globalName  = (Object.prototype.hasOwnProperty.call(options, 'globalName')) ? options.globalName : '';
  var environment = options.environment;

  if (Nife.isNotEmpty(globalName))
    globalName = `globalScope['${globalName}'] = APIInterface`;
  else
    globalName = '';

  var preamble;
  if (options.type === 'commonjs') {
    preamble = [ '\'use strict\';\n' ];

    if (environment === 'node') {
      preamble = preamble.concat([
        'var HTTP = require(\'node:http\');',
        'var URL = require(\'node:url\');',
        'var _loadingPromises = [ Promise.resolve() ];',
      ]);
    }
  } else {
    if (environment === 'node') {
      preamble = [
        'var HTTP;',
        'var URL;',
        'var _loadingPromises = [',
        '  import(\'node:http\').then((M) => (HTTP = M), (error) => { throw error }),',
        '  import(\'node:url\').then((M) => (URL = M), (error) => { throw error }),',
        '];',
      ];
    } else {
      preamble = [ '\'use strict\';\n' ];
    }
  }

  return `${preamble.join('\n')}
(function(globalScope, environmentType) {
  ${generateUtils()}\n
  ${tabIn(generateAPIInterface(routes, options), 1)}\n

  var APIInterface = generateAPIInterface(globalScope, environmentType);

  ${globalName}

  return APIInterface;
}).call(this, (typeof window === 'undefined') ? global : window, (typeof window !== 'undefined') ? 'browser' : 'node');
`;
}
