'use strict';

const Nife = require('nife');

class RouteEndpoint {
  constructor(parentScope, attributes) {
    Object.defineProperties(this, {
      '_parentScope': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        parentScope || null,
      },
      'isDynamic': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        false,
      },
    });

    Object.assign(
      this,
      {
        methods:      [ 'GET' ],
        contentType:  [ 'application/json', 'multipart/form-data' ],
      },
      attributes,
    );

    this.methods = Nife.arrayFlatten(Nife.toArray(this.methods || []).filter(Boolean).map((method) => {
      if (method === '*')
        return [ 'GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS' ];

      return ('' + method).toUpperCase();
    }));

    this.contentType = Nife.arrayFlatten(Nife.toArray(this.contentType || []).filter(Boolean).map((contentType) => {
      if (contentType === '*')
        return [];

      if (contentType instanceof RegExp)
        return contentType;

      return ('' + contentType).split(';')[0].trim().toLowerCase();
    }));

    if (Nife.isEmpty(this.contentType))
      this.contentType = null;
  }

  getParentScope = () => {
    return this._parentScope;
  };
}

module.exports = {
  RouteEndpoint,
};
