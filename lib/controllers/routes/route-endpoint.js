import Nife  from 'nife';

export class RouteEndpoint {
  constructor(parentScope, attributes) {
    const mapMethods = (methods) => {
      return Nife.arrayFlatten(Nife.toArray(methods || []).filter(Boolean).map((method) => {
        if (method === '*')
          return [ 'GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD' ];

        return ('' + method).toUpperCase();
      }));
    };

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
      'isEndpoint': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        true,
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

    this.methods = mapMethods(this.methods);
    this.methods = Nife.uniq(this.methods.concat('OPTIONS'));

    this.contentType = Nife.arrayFlatten(Nife.toArray(this.contentType || []).filter(Boolean).map((contentType) => {
      if (contentType === '*')
        return [];

      if (contentType instanceof RegExp)
        return contentType;

      return ('' + contentType).split(';')[0].trim().toLowerCase();
    }));

    if (Nife.isEmpty(this.contentType))
      this.contentType = null;

    let cors = this.cors;
    if (cors) {
      if (cors === true)
        cors = this.cors = {};

      if (cors.allowOrigin == null)
        cors.allowOrigin = '*';

      if (cors.allowMethods == null)
        cors.allowMethods = this.methods;

      if (cors.allowHeaders == null) {
        cors.allowHeaders = [
          'DNT',
          'User-Agent',
          'X-Requested-With',
          'If-Modified-Since',
          'Cache-Control',
          'Content-Type',
          'Range',
        ];
      }

      if (cors.maxAge == null)
        cors.maxAge = 86400;

      cors.allowMethods = mapMethods(cors.allowMethods).join(',');

      if (Array.isArray(cors.allowHeaders))
        cors.allowHeaders = cors.allowHeaders.filter(Boolean).join(',');
    }
  }

  getParentScope = () => {
    return this._parentScope;
  };
}
