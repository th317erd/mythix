const Nife    = require('nife');
const http    = require('http');
const { URL } = require('url');

let defaultURL;
let defaultHeaders;

function getDefaultURL() {
  return defaultURL;
}

function setDefaultURL(url) {
  defaultURL = (url) ? url.replace(/\/+$/, '') : url;
}

function getDefaultHeader(headerName) {
  if (defaultHeaders)
    return;

  return defaultHeaders[headerName];
}

function getDefaultHeaders() {
  if (defaultHeaders)
    return {};

  return defaultHeaders;
}

function setDefaultHeader(headerName, value) {
  if (!defaultHeaders)
    defaultHeaders = {};

  defaultHeaders[headerName] = value;
}

function setDefaultHeaders(headers) {
  if (!defaultHeaders)
    defaultHeaders = {};

  let keys = Object.keys(headers);
  for (let i = 0, il = keys.length; i < il; i++) {
    let key   = keys[i];
    let value = headers[key];

    if (value == null)
      continue;

    defaultHeaders[key] = value;
  }
}

function makeRequest(requestOptions) {
  return new Promise((resolve, reject) => {
    if (Nife.isEmpty(requestOptions.url))
      reject('"url" key not found and is required');

    let method      = (requestOptions.method || 'GET').toUpperCase();
    let url         = new URL(requestOptions.url);
    let data        = (!method.match(/^(GET|HEAD)$/i) && requestOptions.data) ? requestOptions.data : undefined;
    let extraConfig = {};
    let headers     = Object.assign({
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
    }, defaultHeaders || {}, requestOptions.headers || {});

    if (data) {
      if (Nife.get(headers, 'Content-Type', '').match(/application\/json/))
        data = JSON.stringify(data);

      extraConfig = {
        headers: {
          'Content-Length': Buffer.byteLength(data),
        },
      };
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

    let request = http.request(options, (response) => {
      let data = Buffer.alloc(0);

      response.on('data', (chunk) => {
        data = Buffer.concat([ data, chunk ]);
      });

      response.on('error', (error) => {
        reject(error);
      });

      response.on('end', () => {
        response.rawBody = response.body = data;

        try {
          let contentType = response.headers['content-type'];
          if (contentType && contentType.match(/application\/json/))
            response.body = JSON.parse(data.toString('utf8'));
          else if (contentType && contentType.match(/text\/(plain|html)/))
            response.body = data.toString('utf8');
        } catch (error) {
          return reject(error);
        }

        resolve(response);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    if (data)
      request.write(data);


    request.end();
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

module.exports = {
  'get':      getRequest,
  'post':     postRequest,
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
};

