import Nife               from 'nife';
import { RouteCapture }   from './route-capture.mjs';

export class RouteScopeBase {
  constructor(parentScope, pathParts, options) {
    Object.defineProperties(this, {
      '_parentScope': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        parentScope || null,
      },
      '_pathParts': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        pathParts || [],
      },
      '_options': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        Nife.extend(true, {}, ((parentScope && parentScope.getOptions()) || {}), (options || {})),
      },
      '_routes': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        new Map(),
      },
      '_routeMatchCache': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        new Map(),
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
        value:        false,
      },
    });
  }

  getParentScope = () => {
    return this._parentScope;
  };

  getOptions = () => {
    return this._options;
  };

  updateOptions = (newOptions) => {
    let options = this.getOptions();
    this._options = Nife.extend(true, {}, options, (newOptions || {}));
  };

  addRoute(pathPart, route) {
    let set = this._routes.get(pathPart);
    if (!set) {
      set = new Set();
      this._routes.set(pathPart, set);
    }

    set.add(route);
  }

  getPathRoute(pathPart) {
    let set = this._routes.get(pathPart);
    if (!set)
      return;

    let firstRoute = Array.from(set.values()).find((route) => {
      if (route instanceof RouteScopeBase) {
        if (route._pathParts && route._pathParts[route._pathParts.length - 1] === pathPart)
          return true;
      }

      return false;
    });

    return firstRoute;
  }

  isDynamicPathPart(pathPart) {
    if (pathPart instanceof RouteCapture)
      return true;

    return false;
  }

  walkRoutes(callback) {
    const walk = (routeScope, pathParts) => {
      for (let [ pathPart, children ] of routeScope._routes) {
        if (isStopped)
          break;

        let newPathParts = pathParts.concat(pathPart);
        for (let child of children) {
          if (child.isEndpoint)
            callback({ endpoint: child, pathParts: newPathParts, stop, scope: routeScope });
          else
            walk(child, newPathParts);
        }
      }
    };

    let finalResult;
    let isStopped = false;
    let stop      = (result) => {
      isStopped = true;
      finalResult = result;
    };

    walk(this, []);

    return finalResult;
  }

  findFirstMatchingRoute(request) {
    let method      = request.method.toUpperCase();
    let contentType = Nife.get(request, 'headers.content-type');
    let path        = decodeURIComponent(request.path);

    if (contentType) {
      contentType = contentType.split(';')[0];
      if (contentType)
        contentType = contentType.trim().toLowerCase();
    }

    let cacheKey    = `${method}:${contentType}:${path}`;
    let routeMatch  = this._routeMatchCache.get(cacheKey);
    if (routeMatch)
      return routeMatch;

    const matchesPathParts = (pathParts, endpoint) => {
      let params = {};

      for (let i = 0, il = pathParts.length; i < il; i++) {
        let pathPart          = pathParts[i];
        let incomingPathPart  = incomingPathParts[i] || '';

        if (pathPart instanceof RouteCapture) {
          let result = pathPart.matches({ value: incomingPathPart, request, method, path, contentType, params });
          if (result == null) {
            if (pathPart.isOptional())
              continue;

            return;
          }

          params[pathPart.getName()] = result;
        } else {
          if (pathPart !== incomingPathPart)
            return;
        }
      }

      // If this is a wild endpoint, then grab the remaining path
      // and store it as a param named "_relativePath"
      if (endpoint.wild && pathParts[pathParts.length - 1] === incomingPathParts[pathParts.length - 1])
        params['_relativePath'] = incomingPathParts.slice(pathParts.length).join('/');

      return params;
    };

    const contentTypeMatches = (endpointContentTypes) => {
      if (!endpointContentTypes || !contentType)
        return true;

      for (let i = 0, il = endpointContentTypes.length; i < il; i++) {
        let thisContentType = endpointContentTypes[i];
        if ((thisContentType instanceof RegExp) && thisContentType.test(contentType))
          return true;
        else if (thisContentType === contentType)
          return true;
      }

      return false;
    };

    let incomingPathParts = path.trim().replace(/^\/+/, '').split('/');
    let possibleMatch;

    let result = this.walkRoutes(({ endpoint, pathParts, stop }) => {
      // Does method match route?
      if (endpoint.methods.indexOf(method) < 0)
        return;

      // Because of optional capture groups, it is possible
      // that the length could deviate by one.
      if (pathParts.length !== incomingPathParts.length && endpoint.wild !== true) {
        if (Math.abs(pathParts.length - incomingPathParts.length) > 1)
          return;

        let lastPathPart = pathParts[pathParts.length - 1];
        if (!((lastPathPart instanceof RouteCapture) && lastPathPart.isOptional()))
          return;
      }

      let params = matchesPathParts(pathParts, endpoint);
      if (params) {
        // Does the contentType match?
        if ((method !== 'GET' && method !== 'HEAD') && !contentTypeMatches(endpoint.contentType)) {
          possibleMatch = endpoint;
          return;
        }

        return stop({ endpoint, params });
      }
    });

    if (!result) {
      if (possibleMatch)
        return { endpoint: possibleMatch, error: 'BadContentType' };

      return {};
    }

    if (!result.endpoint.isDynamic)
      this._routeMatchCache.set(cacheKey, result);

    return result;
  }
}
