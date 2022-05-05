'use strict';

const Nife                = require('nife');
const { ControllerBase }  = require('./controller-base');

function defineController(controllerName, definer, _parent) {
  let parentKlass = _parent || ControllerBase;

  return function({ application, server }) {
    const Klass = definer({
      Parent: parentKlass,
      application,
      server,
      controllerName,
    });

    return { [controllerName]: Klass };
  };
}

const ROUTE_PROPERTIES = [
  'accept',
  'controller',
  'methods',
  'middleware',
  'priority',
  'queryParams',
];

function buildPatternMatcher(_patterns, _opts) {
  let opts          = _opts || {};
  let patterns      = _patterns;
  let sanitizeFunc  = opts.sanitize;
  let strict        = opts.strict;
  let flags         = (Nife.instanceOf(opts.flags, 'string') && Nife.isNotEmpty(opts.flags)) ? opts.flags : 'i';
  let matchRE;
  let matchFunc;

  if (Nife.instanceOf(patterns, 'array'))
    patterns = Nife.uniq(patterns);

  if (patterns === '*' || (Nife.instanceOf(patterns, 'array') && patterns.indexOf('*') >= 0) || patterns instanceof RegExp) {
    matchRE = (patterns instanceof RegExp) ? patterns : /.*/i;

    matchFunc = function patternMatcher(value) {
      if (!value || !Nife.instanceOf(value, 'string'))
        return true;

      return !!value.match(matchRE);
    };

    Object.defineProperties(matchFunc, {
      'regexp': {
        writable:     false,
        enumberable:  false,
        configurable: false,
        value:        matchRE,
      },
      'directPatterns': {
        writable:     false,
        enumberable:  false,
        configurable: false,
        value:        undefined,
      },
    });

    return matchFunc;
  }

  if (!Nife.instanceOf(patterns, 'array'))
    patterns = [ patterns ];

  let parts           = [];
  let directPatterns  = [];

  for (let i = 0, il = patterns.length; i < il; i++) {
    let part = patterns[i];

    if (part instanceof RegExp) {
      directPatterns.push(part);
      continue;
    }

    if (typeof sanitizeFunc === 'function') {
      part = sanitizeFunc(part);
    } else {
      part = part.replace(/\*/g, '@@@WILD_MATCH@@@');
      part = Nife.regexpEscape(part);
      part = part.replace(/@@@WILD_MATCH@@@/g, '.*?');
    }

    parts.push(part);
  }

  if (parts && parts.length)
    matchRE = new RegExp((strict) ? `^(${parts.join('|')})$` : `(${parts.join('|')})`, flags);

  matchFunc = function patternMatcher(value) {
    if (!value || !Nife.instanceOf(value, 'string'))
      return false;

    if (directPatterns && directPatterns.length) {
      for (let j = 0, jl = directPatterns.length; j < jl; j++) {
        let pattern = directPatterns[j];
        if (value.match(pattern))
          return true;
      }
    }

    if (!matchRE)
      return false;

    return !!value.match(matchRE);
  };

  Object.defineProperties(matchFunc, {
    'regexp': {
      writable:     false,
      enumberable:  false,
      configurable: false,
      value:        matchRE,
    },
    'directPatterns': {
      writable:     false,
      enumberable:  false,
      configurable: false,
      value:        directPatterns,
    },
  });

  return matchFunc;
}

function buildMethodMatcher(methods) {
  return buildPatternMatcher(methods, { strict: true });
}

function buildContentTypeMatcher(contentTypePatterns) {
  return buildPatternMatcher(contentTypePatterns);
}

function buildPathMatcher(routeName, customParserTypes) {
  let params      = [];
  let parts       = [];
  let lastOffset  = 0;

  routeName.replace(/<\s*([^\s:]+?\??)\s*(:\w+?)?\s*(=\s*[^>]+)?>/g, function(m, _name, _type, _defaultValue, offset, str) {
    if (offset > lastOffset) {
      parts.push(str.substring(lastOffset, offset));
      lastOffset = offset + m.length;
    }

    let defaultValue  = _defaultValue;
    let type          = _type;
    let optional      = false;
    let name          = _name;

    if (name.match(/\?$/)) {
      optional = true;
      name = name.substring(0, name.length - 1);
    }

    if (type)
      type = type.replace(/\W/g, '');


    if (defaultValue) {
      defaultValue = defaultValue.trim().replace(/^=\s*/, '');
      defaultValue = Nife.coerceValue(defaultValue, type);
    }

    let matcher;

    if (type === 'number' || type === 'int' || type === 'integer' || type === 'bigint')
      matcher = '([\\d.e-]+)';
    else if (type === 'boolean' || type === 'bool')
      matcher = '(true|True|TRUE|false|False|FALSE)';
    else
      matcher = (optional) ? '(.*?)' : '(.+?)';

    if (optional)
      matcher = matcher + '?';

    let param = {
      startOffset:  offset,
      endOffset:    offset + m.length,
      name,
      type,
      defaultValue,
      matcher,
      optional,
    };

    params.push(param);
    parts.push(param);

    return '';
  });

  if (lastOffset < routeName.length)
    parts.push(routeName.substring(lastOffset));

  let finalRegExpStr = parts.reduce((items, _item, index) => {
    let item = _item;

    if (typeof item === 'string') {
      item = item.replace(/\?/g, '@@@CHAR_MATCH@@@').replace(/\*/g, '@@@WILD_MATCH@@@').replace(/\/+/g, '@@@FORWARD_SLASH@@@');
      item = Nife.regexpEscape(item);
      item = item.replace(/@@@CHAR_MATCH@@@/g, '.').replace(/@@@WILD_MATCH@@@/g, '.*?').replace(/@@@FORWARD_SLASH@@@/g, '/');

      if (item.match(/\/$/)) {
        let nextItem = parts[index + 1];
        if (nextItem && typeof nextItem !== 'string' && nextItem.optional)
          item = item + '?';
      }

      items.push(item);
    } else {
      items.push(item.matcher);
    }

    return items;
  }, []).join('');

  let matcherRE = new RegExp(`^${finalRegExpStr}$`);
  let matchFunc = function routeMatcher(pathPart) {
    let match = pathPart.match(matcherRE);
    if (!match)
      return;

    let result = {};
    for (let i = 1, il = match.length; i < il; i++) {
      let part = match[i];
      if (!part)
        continue;

      let paramIndex  = i - 1;
      let param       = params[paramIndex];
      if (!param)
        continue;

      if (customParserTypes && Object.prototype.hasOwnProperty.call(customParserTypes, param.type))
        result[param.name] = customParserTypes[param.type](part, param, paramIndex);
      else
        result[param.name] = Nife.coerceValue(part, param.type);
    }

    return result;
  };

  Object.defineProperties(matchFunc, {
    'regexp': {
      writable:     false,
      enumberable:  false,
      configurable: false,
      value:        matcherRE,
    },
    'params': {
      writable:     false,
      enumberable:  false,
      configurable: false,
      value:        params,
    },
  });

  return matchFunc;
}

function getRouteProperties(route) {
  let props = {};

  for (let i = 0, il = ROUTE_PROPERTIES.length; i < il; i++) {
    let propName  = ROUTE_PROPERTIES[i];
    let value     = route[propName];
    if (value === undefined)
      continue;

    props[propName] = value;
  }

  return props;
}

function compileRoutes(routes, customParserTypes, _context) {
  const sortRoutes = (routesToSort) => {
    return routesToSort.sort((a, b) => {
      let pathA = a.path;
      let pathB = b.path;

      if (Nife.arrayUnion(a.methods, b.methods).length > 0) {
        // If the routes are at the same level
        // but one of them has a capture parameter
        // then the one without a capture parameter comes first.
        // If we don't do this, then the capture parameter wild-card
        // might match the route name of the non-parameter route
        let lastForwardSlashIndexA = pathA.lastIndexOf('/');
        let lastForwardSlashIndexB = pathB.lastIndexOf('/');

        if (lastForwardSlashIndexA >= 0 && lastForwardSlashIndexB >= 0 && pathA.substring(0, lastForwardSlashIndexA) === pathB.substring(0, lastForwardSlashIndexB)) {
          if (pathA.indexOf('<', lastForwardSlashIndexA) >= 0 && pathB.indexOf('<', lastForwardSlashIndexB) < 0)
            return 1;
          else if (pathA.indexOf('<', lastForwardSlashIndexA) < 0 && pathB.indexOf('<', lastForwardSlashIndexB) >= 0)
            return -1;
        }
      }

      let x = a.priority;
      let y = b.priority;

      if (x === y)
        return 0;

      return (x < y) ? -1 : 1;
    });
  };

  const addRoute = (theseRoutes, route, path, priority) => {
    let newRoute = Object.assign(
      {
        methods:  'GET',
        accept:   '*',
        priority,
      },
      getRouteProperties(route),
      {
        path: path.replace(/\/{2,}/g, '/'),
      },
    );

    if (Nife.instanceOf(newRoute.methods, 'array')) {
      newRoute.methods = Nife
        .uniq(newRoute.methods)
        .filter((method) => ((typeof method === 'string' || method instanceof String) && Nife.isNotEmpty(method)))
        .map((method) => method.toUpperCase());

      if (newRoute.methods.indexOf('*') >= 0)
        newRoute.methods = '*';
    } else {
      if (Nife.instanceOf(newRoute.methods, 'string') || Nife.isEmpty(newRoute.methods))
        newRoute.methods = 'GET';

      newRoute.methods = newRoute.methods.toUpperCase();
    }

    theseRoutes.push(newRoute);
  };

  let context     = _context || {};
  let theseRoutes = [];
  let isArray     = (routes instanceof Array);
  let {
    routeName,
    path,
    alreadyVisited,
    depth,
  } = context;

  if (!alreadyVisited)
    alreadyVisited = new Map();

  if (alreadyVisited.get(routes))
    return [];

  alreadyVisited.set(routes, true);

  if (!depth)
    depth = 0;

  if (Nife.isEmpty(routeName))
    routeName = '/';

  if (!path)
    path = '/';

  path = path.replace(/\/{2,}/g, '/');

  // eslint-disable-next-line no-magic-numbers
  let basePriority = 1000000 - (depth * 1000);
  let keys = Object.keys(routes);

  for (let i = 0, il = keys.length; i < il; i++) {
    let key   = keys[i];
    let route = routes[key];

    if (route && Nife.isNotEmpty(route.controller)) {
      let newPath = (isArray) ? path : `${path}/${key}`;
      addRoute(theseRoutes, route, newPath, basePriority + i);
    }

    if (ROUTE_PROPERTIES.indexOf(key) >= 0)
      continue;

    let thisRouteName = (isArray) ? routeName : key;
    let newPath       = (isArray) ? path : `${path}/${key}`;

    if (Nife.instanceOf(route, 'object', 'array')) {
      let subRoutes = compileRoutes(route, customParserTypes, {
        routeName:  thisRouteName,
        path:       newPath,
        priority:   i,
        depth:      depth + 1,
        alreadyVisited,
      });

      if (!subRoutes || !subRoutes.length)
        continue;

      theseRoutes = [].concat(subRoutes, theseRoutes);
    }
  }

  return sortRoutes(theseRoutes);
}

function buildRoutes(_routes, customParserTypes) {
  let routes = compileRoutes(_routes, customParserTypes);

  return routes.map((route) => {
    // Filter out priority key
    let thisRoute = Nife.extend(Nife.extend.FILTER, (key) => !key.match(/^(priority)$/), {}, route);

    // Inject route matchers
    thisRoute.methodMatcher       = buildMethodMatcher(thisRoute.methods || '*');
    thisRoute.contentTypeMatcher  = buildContentTypeMatcher(thisRoute.accept || '*');
    thisRoute.pathMatcher         = buildPathMatcher(thisRoute.path, customParserTypes);

    return thisRoute;
  });
}

module.exports = {
  buildPatternMatcher,
  buildMethodMatcher,
  buildContentTypeMatcher,
  buildPathMatcher,
  buildRoutes,
  defineController,
};
