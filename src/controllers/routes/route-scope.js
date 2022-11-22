'use strict';

const Nife                = require('nife');
const { RouteCapture }    = require('./route-capture');
const { RouteScopeBase }  = require('./route-scope-base');
const { RouteEndpoint }   = require('./route-endpoint');

class RouteScope extends RouteScopeBase {
  path = (_pathPart, callback, options) => {
    let pathPart = _pathPart;
    if (!Nife.instanceOf(pathPart, 'string') && !(pathPart instanceof RouteCapture))
      throw new TypeError('RouteScope::path: First argument must be a string or a capture.');

    if (pathPart instanceof RouteCapture)
      pathPart = pathPart.clone({ optional: false });

    let routeScope = this.getPathRoute(pathPart);
    if (!routeScope) {
      routeScope = new RouteScope(this, this._pathParts.concat(pathPart), options);
      routeScope.isDynamic = this.isDynamic || this.isDynamicPathPart(pathPart);
      this.addRoute(pathPart, routeScope);
    } else if (options) {
      routeScope.updateOptions(options);
    }

    callback(routeScope);
  };

  endpoint = (pathPart, _options) => {
    if (!Nife.instanceOf(pathPart, 'string') && !(pathPart instanceof RouteCapture))
      throw new TypeError('RouteScope::endpoint: First argument must be a string or a capture.');

    if (!_options)
      throw new TypeError('RouteScope::endpoint: Endpoint "options" required.');

    let options = (Nife.instanceOf(_options, 'string')) ? { controller: ('' + _options) } : { ..._options };
    options = Nife.extend(true, {}, (this.getOptions() || {}).endpointDefaults || {}, options);
    options.path = this._pathParts.concat(pathPart).join('/');

    let endpoint  = new RouteEndpoint(this, options);
    endpoint.isDynamic = this.isDynamic || this.isDynamicPathPart(pathPart);

    this.addRoute(pathPart, endpoint);
  };

  capture = (...args) => {
    return new RouteCapture(this, ...args);
  };
}

module.exports = {
  RouteScope,
};
