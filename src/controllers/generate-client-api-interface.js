'use strict';

/* global Buffer, Utils */

const Nife            = require('nife');
const ControllerUtils = require('./controller-utils');
const HTTPUtils       = require('../utils/http-utils');

function buildRoutes(httpServer, routes) {
  let customParserTypes = this.getCustomRouteParserTypes(httpServer, routes);
  return ControllerUtils.buildRoutes(routes, customParserTypes);
}

function nodeRequestHandler(requestOptions) {
  return new Promise((resolve, reject) => {
    if (!Utils.isEmpty(requestOptions.url))
      reject('"url" key not found and is required');

    const HTTP = require('http');

    let method      = (requestOptions.method || 'GET').toUpperCase();
    let url         = new URL(requestOptions.url);
    let data        = requestOptions.data;
    let extraConfig = {};
    let headers     = Object.assign({
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
    }, this.defaultHeaders || {}, requestOptions.headers || {});

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

      }
    }

    const options = Object.assign({
      protocol: url.protocol,
      hostname: url.hostname,
      port:     url.port,
      path:     `${url.pathname}${url.search}`,
      headers:  Object.assign({}, headers, extraConfig.headers || {}),
      method,
    }, requestOptions, extraConfig);

    delete options.data;

    let thisRequest = HTTP.request(options, (response) => {
      let responseData = Buffer.alloc(0);

      response.on('data', (chunk) => {
        responseData = Buffer.concat([ responseData, chunk ]);
      });

      response.on('error', (error) => {
        reject(error);
      });

      response.on('end', () => {
        response.rawBody = response.body = responseData;

        try {
          let contentType = response.headers['content-type'];

          if (contentType && contentType.match(/application\/json/i))
            response.body = JSON.parse(responseData.toString('utf8'));
          else if (contentType && contentType.match(/text\/(plain|html)/))
            response.body = responseData.toString('utf8');
        } catch (error) {
          return reject(error);
        }

        resolve(response);
      });
    });

    thisRequest.on('error', (error) => {
      reject(error);
    });

    if (data)
      thisRequest.write(data);

    thisRequest.end();
  });
}

function generateUtils() {
  return `
  var Utils = (function() {
    ${Nife.instanceOf.toString()}\n\n
    ${Nife.sizeOf.toString()}\n\n
    ${Nife.isEmpty.toString()}\n\n

    return {
      instanceOf,
      sizeOf,
      isEmpty,
      dataToQueryString: ${HTTPUtils.dataToQueryString.toString().replace(/\bNife\b/g, 'Utils')},
    };
  })();
`.trim();
}

function generateAPIInterface(_options) {
  let options = _options || {};

  return `generateAPIInterface(globalScope, environmentType) {

    var interface = {};
  }`;
}

function generateClientAPIInterface(application, _options) {
  let options     = _options || {};
  let httpServer  = application.getHTTPServer() || null;
  let routes      = buildRoutes.call(application, httpServer, application.getRoutes());
  let globalName  = (Object.prototype.hasOwnProperty.call(options, 'globalName')) ? options.globalName : 'API';

  console.log('ROUTES: ', routes);

  return `'use strict';\n
(function(globalScope, environmentType) {
  ${generateUtils()}\n\n
  globalScope['${globalName}'] = generateAPIInterface(globalScope, environmentType);
}).call((typeof window === 'undefined') ? global : window, (typeof window !== 'undefined') ? 'browser' : 'node');
`;

}

module.exports = {
  generateClientAPIInterface,
};
