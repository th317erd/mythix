'use strict';

const Nife = require('nife');

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

function statusCodeToMessage(statusCode) {
  let codes = {
    200: 'OK',
    204: 'No Content',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    413: 'Request Entity Too Large',
    500: 'Internal Server Error',
    501: 'Not Implemented',
  };

  let code = codes[statusCode];

  return code || 'Unknown';
}

module.exports = {
  dataToQueryString,
  statusCodeToMessage,
};
