import Nife                 from 'nife';
import { RouteCapture }     from './route-capture.mjs';
import { RouteScopeBase }   from './route-scope-base.mjs';
import { RouteEndpoint }    from './route-endpoint.mjs';

export class RouteScope extends RouteScopeBase {
  path = (_pathPart, callback, options) => {
    if (typeof callback !== 'function')
      return this.endpoint(_pathPart, { ...(options || {}), wild: true });

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

    if (typeof callback === 'function')
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
