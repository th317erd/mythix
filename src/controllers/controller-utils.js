const Nife                = require('nife');
const { ControllerBase }  = require('./controller-base');
const {
  coerceValue,
  regexpEscape,
} = require('../utils/misc-utils');

function defineController(controllerName, definer, _parent) {
  var parentKlass = _parent || ControllerBase;

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
  'middleWare',
  'priority',
];

function buildPatternMatcher(_patterns, _opts) {
  var opts          = _opts || {};
  var patterns      = _patterns;
  var sanitizeFunc  = opts.sanitize;
  var strict        = opts.strict;
  var flags         = (Nife.instanceOf(opts.flags, 'string') && Nife.isNotEmpty(opts.flags)) ? opts.flags : 'i';

  if (Nife.instanceOf(patterns, 'array'))
    patterns = Nife.uniq(patterns);

  if (patterns === '*' || (Nife.instanceOf(patterns, 'array') && patterns.indexOf('*') >= 0) || patterns instanceof RegExp) {
    var matchRE = (patterns instanceof RegExp) ? patterns : /.*/i;

    var matchFunc = function patternMatcher(value) {
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

  var parts           = [];
  var directPatterns  = [];

  for (var i = 0, il = patterns.length; i < il; i++) {
    var part = patterns[i];

    if (part instanceof RegExp) {
      directPatterns.push(part);
      continue;
    }

    if (typeof sanitizeFunc === 'function') {
      part = sanitizeFunc(part);
    } else {
      part = part.replace(/\*/g, '@@@WILD_MATCH@@@');
      part = regexpEscape(part);
      part = part.replace(/@@@WILD_MATCH@@@/g, '.*?');
    }

    parts.push(part);
  }

  var matchRE;

  if (parts && parts.length)
    matchRE = new RegExp((strict) ? `^(${parts.join('|')})$` : `(${parts.join('|')})`, flags);

  var matchFunc = function patternMatcher(value) {
    if (!value || !Nife.instanceOf(value, 'string'))
      return false;

    if (directPatterns && directPatterns.length) {
      for (var i = 0, il = directPatterns.length; i < il; i++) {
        var pattern = directPatterns[i];
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
  var params      = [];
  var parts       = [];
  var lastOffset  = 0;

  routeName.replace(/<\s*([^\s:]+?\??)\s*(:\w+?)?\s*(=\s*[^>]+)?>/g, function(m, _name, _type, _defaultValue, offset, str) {
    if (offset > lastOffset) {
      parts.push(str.substring(lastOffset, offset));
      lastOffset = offset + m.length;
    }

    var defaultValue  = _defaultValue;
    var type          = _type;
    var optional      = false;
    var name          = _name;

    if (name.match(/\?$/)) {
      optional = true;
      name = name.substring(0, name.length - 1);
    }

    if (type) {
      type = type.replace(/\W/g, '');
    }

    if (defaultValue) {
      defaultValue = defaultValue.trim().replace(/^=\s*/, '');
      defaultValue = coerceValue(defaultValue, type);
    }

    var matcher;

    if (type === 'number' || type === 'int' || type === 'integer' || type === 'bigint')
      matcher = '([\\d.e-]+)';
    else if (type === 'boolean' || type === 'bool')
      matcher = '(true|True|TRUE|false|False|FALSE)';
    else
      matcher = (optional) ? '(.*?)' : '(.+?)';

    if (optional)
      matcher = matcher + '?';

    var param = {
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

  var finalRegExpStr = parts.reduce((items, _item, index) => {
    var item = _item;

    if (typeof item === 'string') {
      item = item.replace(/\?/g, '@@@CHAR_MATCH@@@').replace(/\*/g, '@@@WILD_MATCH@@@').replace(/\/+/g, '@@@FORWARD_SLASH@@@');
      item = regexpEscape(item);
      item = item.replace(/@@@CHAR_MATCH@@@/g, '.').replace(/@@@WILD_MATCH@@@/g, '.*?').replace(/@@@FORWARD_SLASH@@@/g, '/');

      if (item.match(/\/$/)) {
        var nextItem = parts[index + 1];
        if (nextItem && typeof nextItem !== 'string' && nextItem.optional)
          item = item + '?';
      }

      items.push(item);
    } else {
      items.push(item.matcher);
    }

    return items;
  }, []).join('');

  var matcherRE = new RegExp(`^${finalRegExpStr}$`);
  var matchFunc = function routeMatcher(pathPart) {
    var match = pathPart.match(matcherRE);
    if (!match)
      return;

    var result = {};
    for (var i = 1, il = match.length; i < il; i++) {
      var part = match[i];
      if (!part)
        continue;

      var paramIndex  = i - 1;
      var param       = params[paramIndex];
      if (!param)
        continue;

      if (customParserTypes && customParserTypes.hasOwnProperty(param.type))
        result[param.name] = customParserTypes[param.type](part, param, paramIndex);
      else
        result[param.name] = coerceValue(part, param.type);
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
  var props = {};

  for (var i = 0, il = ROUTE_PROPERTIES.length; i < il; i++) {
    var propName  = ROUTE_PROPERTIES[i];
    var value     = route[propName];
    if (value === undefined)
      continue;

    props[propName] = value;
  }

  return props;
}

function compileRoutes(routes, customParserTypes, _context) {
  const sortRoutes = (routes) => {
    return routes.sort((a, b) => {
      var x = a.priority;
      var y = b.priority;

      if (x === y)
        return 0;

      return (x < y) ? -1 : 1;
    });
  };

  const addRoute = (theseRoutes, route, path, priority) => {
    var newRoute = Object.assign(
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

  var context     = _context || {};
  var theseRoutes = [];
  var isArray     = (routes instanceof Array);
  var {
    routeName,
    path,
    alreadyVisited,
  } = context;

  if (!alreadyVisited)
    alreadyVisited = new Map();

  if (alreadyVisited.get(routes))
    return [];

  alreadyVisited.set(routes, true);

  if (Nife.isEmpty(routeName))
    routeName = '/';

  if (!path)
    path = '/';

  if (routeName !== '/')
    path = `${(path)}/${routeName}`;

  path = path.replace(/\/{2,}/g, '/');

  var keys = Object.keys(routes);
  for (var i = 0, il = keys.length; i < il; i++) {
    var key   = keys[i];
    var route = routes[key];

    if (route && Nife.isNotEmpty(route.controller)) {
      var newPath = (isArray) ? path : `${path}/${key}`;
      addRoute(theseRoutes, route, newPath, i);
    }

    if (ROUTE_PROPERTIES.indexOf(key) >= 0)
      continue;

    var thisRouteName = (isArray) ? routeName : key;
    if (Nife.instanceOf(route, 'object', 'array')) {
      var subRoutes = sortRoutes(compileRoutes(route, customParserTypes, {
        routeName:  thisRouteName,
        path:       path,
        priority:   i,
        alreadyVisited,
      })).map((route, index) => {
        route.priority = 0 - index;
        return route;
      });

      theseRoutes = [].concat(subRoutes, theseRoutes);
    }
  }

  return sortRoutes(theseRoutes);
}

function buildRoutes(_routes, customParserTypes) {
  var routes = compileRoutes(_routes, customParserTypes);

  return routes.map((route) => {
    // Filter out priority key
    var route = Nife.extend(Nife.extend.FILTER, (key) => !key.match(/^(priority)$/), {}, route);

    // Inject route matchers
    route.methodMatcher       = buildMethodMatcher(route.methods || '*');
    route.contentTypeMatcher  = buildContentTypeMatcher(route.accept || '*');
    route.pathMatcher         = buildPathMatcher(route.path, customParserTypes);

    return route;
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
