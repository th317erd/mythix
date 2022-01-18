const Nife = require('nife');
const {
  buildPatternMatcher,
  buildMethodMatcher,
  buildContentTypeMatcher,
} = require('../../controllers/controller-utils');

const CONDITIONAL_OBJECT_HELPERS = {
  'controller':   (request) => Nife.get(request, 'routeInfo.controller'),
  'path':         (request) => Nife.get(request, 'url'),
  'methods':      (request) => Nife.get(request, 'method'),
  'contentType':  (request) => Nife.get(request, 'headers.content-type'),
};

function conditional(middleware, conditions) {
  const createConditionsFromObject = (obj) => {
    var helperKeys  = Object.keys(CONDITIONAL_OBJECT_HELPERS);
    var keys        = Object.keys(obj);
    var matchers    = [];

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i];
      if (helperKeys.indexOf(key) < 0)
        continue;

      var helper  = CONDITIONAL_OBJECT_HELPERS[key];
      var value   = obj[key];

      if (Nife.instanceOf(value, 'string', 'array', RegExp)) {
        if (key === 'methods')
          value = buildMethodMatcher(value);
        else if (key === 'contentType')
          value = buildContentTypeMatcher(value);
        else
          value = buildPatternMatcher(value);
      } else if (typeof value !== 'function') {
        continue;
      }

      matchers.push({
        matcher: value,
        helper,
      });
    }

    if (!matchers.length)
      throw new Error('No matchable patterns found');

    return function patternMatcher(request) {
      for (var i = 0, il = matchers.length; i < il; i++) {
        var matcher = matchers[i];
        var helper  = matcher.helper;
        var value   = helper.call(this, request);

        if (!matcher.matcher.call(this, value))
          return false;
      }

      return true;
    };
  };

  const createConditionsFromArray = (conditions) => {
    var matchers = [];
    for (var i = 0, il = conditions.length; i < il; i++) {
      var condition = conditions[i];

      if (typeof condition === 'function')
        matchers.push(condition);
      else if (Nife.instanceOf(condition, 'object'))
        matchers.push(createConditionsFromObject(condition));
    }

    return function patternMatcher(request) {
      for (var i = 0, il = matchers.length; i < il; i++) {
        var matcher = matchers[i];
        if (!matcher.call(this, request))
          return false;
      }

      return true;
    };
  };

  var conditionChecker;

  if (Nife.instanceOf(conditions, 'object')) {
    conditionChecker = createConditionsFromObject(conditions);
  } else if (Nife.instanceOf(conditions, 'array')) {
    conditionChecker = createConditionsFromArray(conditions);
  } else if (Nife.instanceOf(conditions, 'function')) {
    conditionChecker = conditions;
  } else
    throw new Error('Invalid condition supplied');

  return function(request, response, next) {
    if (!conditionChecker.call(this, request))
      return next();

    return middleware.call(this, request, response, next);
  };
}

module.exports = {
  conditional,
};
