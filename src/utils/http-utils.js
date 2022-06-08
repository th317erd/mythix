'use strict';

/* global Buffer */

const Nife                      = require('nife');
const http                      = require('http');
const { URL, URLSearchParams }  = require('url');

let defaultURL;
let defaultHeaders;

function getDefaultURL() {
  return defaultURL;
}

function setDefaultURL(url) {
  defaultURL = (url) ? url.replace(/\/+$/, '') : url;
}

function getDefaultHeader(headerName) {
  if (!defaultHeaders)
    return;

  return defaultHeaders[headerName];
}

function getDefaultHeaders() {
  if (!defaultHeaders)
    return {};

  return defaultHeaders;
}

function setDefaultHeader(headerName, value) {
  if (!defaultHeaders)
    defaultHeaders = {};

  if (value == null) {
    delete defaultHeaders[headerName];
    return;
  }

  defaultHeaders[headerName] = value;
}

function setDefaultHeaders(headers) {
  if (!defaultHeaders)
    defaultHeaders = {};

  let headerNames = Object.keys(headers);
  for (let i = 0, il = headerNames.length; i < il; i++) {
    let headerName  = headerNames[i];
    let value       = headers[headerName];

    if (value == null) {
      delete defaultHeaders[headerName];
      continue;
    }

    defaultHeaders[headerName] = value;
  }
}

function makeRequest(requestOptions) {
  return new Promise((resolve, reject) => {
    if (Nife.isEmpty(requestOptions.url))
      reject('"url" key not found and is required');

    let method      = (requestOptions.method || 'GET').toUpperCase();
    let url         = new URL(requestOptions.url);
    let data        = requestOptions.data;
    let extraConfig = {};
    let headers     = Object.assign({
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
    }, defaultHeaders || {}, requestOptions.headers || {});

    if (data) {
      if ((!method.match(/^(GET|HEAD)$/i) && requestOptions.data)) {
        if (Nife.get(headers, 'Content-Type', '').match(/application\/json/i))
          data = JSON.stringify(data);

        extraConfig = {
          headers: {
            'Content-Length': Buffer.byteLength(data),
          },
        };
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

    if (data)
      thisRequest.write(data);

    thisRequest.end();
  });
}

function getRequestOptions(_url, _options, method) {
  let url     = _url;
  let options = _options;

  if (Nife.instanceOf(url, 'object')) {
    options = url;
    url     = options.url;
  }

  let finalOptions = Nife.extend({}, options || {}, { url });

  if (defaultURL && finalOptions.url.charAt(0) === '/')
    finalOptions.url = defaultURL + finalOptions.url;

  if (method)
    finalOptions.method = method;

  return finalOptions;
}

function request(url, options) {
  return makeRequest(getRequestOptions(url, options));
}

function getRequest(url, options) {
  return makeRequest(getRequestOptions(url, options, 'GET'));
}

function postRequest(url, options) {
  return makeRequest(getRequestOptions(url, options, 'POST'));
}

function patchRequest(url, options) {
  return makeRequest(getRequestOptions(url, options, 'PATCH'));
}

function putRequest(url, options) {
  return makeRequest(getRequestOptions(url, options, 'PUT'));
}

function deleteRequest(url, options) {
  return makeRequest(getRequestOptions(url, options, 'DELETE'));
}

function headRequest(url, options) {
  return makeRequest(getRequestOptions(url, options, 'HEAD'));
}

function optionsRequest(url, options) {
  return makeRequest(getRequestOptions(url, options, 'OPTIONS'));
}

function dataToQueryString(data, nameFormatter, resolveInitial) {
  function fromObject(path, data) {
    let parts = [];
    let keys  = Object.keys(data);

    for (let i = 0, il = keys.length; i < il; i++) {
      let key = keys[i];
      let value = data[key];

      if (value && typeof value === 'object' && typeof value.valueOf === 'function')
        value = value.valueOf();

      if (Array.isArray(value))
        parts = parts.concat(fromArray(`${path}[${key}]`, value));
      else if (value instanceof Object)
        parts = parts.concat(fromObject(`${path}[${key}]`, value));
      else
        parts.push(`${encodeURIComponent(`${path}[${key}]`)}=${encodeURIComponent(value)}`);
    }

    return parts.filter(Boolean);
  }

  function fromArray(path, data) {
    let parts = [];

    for (let i = 0, il = data.length; i < il; i++) {
      let value = data[i];
      if (value && typeof value === 'object' && typeof value.valueOf === 'function')
        value = value.valueOf();

      if (Array.isArray(value))
        parts = parts.concat(fromArray(`${path}[]`, value));
      else if (value instanceof Object)
        parts = parts.concat(fromObject(`${path}[]`, value));
      else
        parts.push(`${encodeURIComponent(`${path}[]`)}=${encodeURIComponent(value)}`);
    }

    return parts.filter(Boolean);
  }

  if (!data || Nife.sizeOf(data) === 0)
    return '';

  let initial = '?';
  let parts   = [];
  let keys    = Object.keys(data);

  if (resolveInitial != null)
    initial = (typeof resolveInitial === 'function') ? resolveInitial.call(this) : resolveInitial;

  for (let i = 0, il = keys.length; i < il; i++) {
    let name  = keys[i];
    let value = data[name];

    if (Nife.isEmpty(value))
      continue;

    if (value && typeof value === 'object' && typeof value.valueOf === 'function')
      value = value.valueOf();

    name = (typeof nameFormatter === 'function') ? nameFormatter.call(this, name, value) : name;
    if (!name)
      continue;

    if (Array.isArray(value))
      parts = parts.concat(fromArray(name, value));
    else if (value instanceof Object)
      parts = parts.concat(fromObject(name, value));
    else
      parts.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
  }

  if (parts.length === 0)
    return '';

  return initial + parts.join('&');
}

module.exports = {
  'get':      getRequest,
  'post':     postRequest,
  'patch':    patchRequest,
  'put':      putRequest,
  'delete':   deleteRequest,
  'head':     headRequest,
  'options':  optionsRequest,
  getDefaultURL,
  setDefaultURL,
  getDefaultHeader,
  getDefaultHeaders,
  setDefaultHeader,
  setDefaultHeaders,
  makeRequest,
  request,
  dataToQueryString,
};

