'use strict';

/* global Buffer */

const Nife                      = require('nife');
const http                      = require('http');
const { URL, URLSearchParams }  = require('url');
const { dataToQueryString }     = require('./http-utils');

class HTTPInterface {
  constructor() {
    Object.defineProperties(this, {
      'defaultURL': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'defaultHeaders': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
    });
  }

  getDefaultURL() {
    return this.defaultURL;
  }

  setDefaultURL(url) {
    this.defaultURL = (url) ? url.replace(/\/+$/, '') : url;
  }

  getDefaultHeader(headerName) {
    return this.defaultHeaders[headerName];
  }

  getDefaultHeaders() {
    return this.defaultHeaders;
  }

  setDefaultHeader(headerName, value) {
    if (value == null) {
      delete this.defaultHeaders[headerName];
      return;
    }

    this.defaultHeaders[headerName] = value;
  }

  setDefaultHeaders(headers) {
    let headerNames = Object.keys(headers);
    for (let i = 0, il = headerNames.length; i < il; i++) {
      let headerName  = headerNames[i];
      let value       = headers[headerName];

      if (value == null) {
        delete this.defaultHeaders[headerName];
        continue;
      }

      this.defaultHeaders[headerName] = value;
    }
  }

  keysToLowerCase(obj) {
    let keys    = Object.keys(obj || {});
    let newObj  = {};

    for (let i = 0, il = keys.length; i < il; i++) {
      let key   = keys[i];
      let value = obj[key];
      newObj[key.toLowerCase()] = value;
    }

    return newObj;
  }

  makeRequest(requestOptions) {
    return new Promise((resolve, reject) => {
      if (Nife.isEmpty(requestOptions.url))
        reject('"url" key not found and is required');

      let method      = (requestOptions.method || 'GET').toUpperCase();
      let url         = new URL(requestOptions.url);
      let data        = requestOptions.data;
      let extraConfig = {};
      let headers     = Object.assign({
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
      }, this.keysToLowerCase(this.defaultHeaders || {}), this.keysToLowerCase(requestOptions.headers || {}));

      if (data) {
        if ((!method.match(/^(GET|HEAD)$/i) && requestOptions.data)) {
          if (data.constructor.name === 'FormData') {
            extraConfig = {
              headers: data.getHeaders(),
            };
          } else {
            if (Nife.get(headers, 'content-type', '').match(/application\/json/i))
              data = JSON.stringify(data);

            extraConfig = {
              headers: {
                'content-length': Buffer.byteLength(data),
              },
            };
          }
        } else {
          let queryString = dataToQueryString(data);
          if (queryString) {
            let newParams = new URLSearchParams(queryString);
            let keys      = Array.from(newParams.keys());

            for (let i = 0, il = keys.length; i < il; i++) {
              let key = keys[i];
              url.searchParams.set(key, newParams.get(key));
            }
          }

          data = undefined;
        }
      }

      const options = Nife.extend(true, {
        protocol: url.protocol,
        hostname: url.hostname,
        port:     url.port,
        path:     `${url.pathname}${url.search}`,
        method,
        headers,
      }, requestOptions, extraConfig);

      delete options.data;

      let thisRequest = http.request(options, (response) => {
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
    });
  }

  getRequestOptions(_url, _options, method) {
    let url     = _url;
    let options = _options;

    if (Nife.instanceOf(url, 'object')) {
      options = url;
      url     = options.url;
    }

    let finalOptions = Nife.extend({}, options || {}, { url });

    if (this.defaultURL && finalOptions.url.charAt(0) === '/')
      finalOptions.url = this.defaultURL + finalOptions.url;

    if (method)
      finalOptions.method = method;

    return finalOptions;
  }

  request(url, options) {
    return this.makeRequest(this.getRequestOptions(url, options));
  }

  getRequest(url, options) {
    return this.makeRequest(this.getRequestOptions(url, options, 'GET'));
  }

  postRequest(url, options) {
    return this.makeRequest(this.getRequestOptions(url, options, 'POST'));
  }

  patchRequest(url, options) {
    return this.makeRequest(this.getRequestOptions(url, options, 'PATCH'));
  }

  putRequest(url, options) {
    return this.makeRequest(this.getRequestOptions(url, options, 'PUT'));
  }

  deleteRequest(url, options) {
    return this.makeRequest(this.getRequestOptions(url, options, 'DELETE'));
  }

  headRequest(url, options) {
    return this.makeRequest(this.getRequestOptions(url, options, 'HEAD'));
  }

  optionsRequest(url, options) {
    return this.makeRequest(this.getRequestOptions(url, options, 'OPTIONS'));
  }
}

module.exports = {
  HTTPInterface,
};
