'use strict';

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
    let helperKeys  = Object.keys(CONDITIONAL_OBJECT_HELPERS);
    let keys        = Object.keys(obj);
    let matchers    = [];

    for (let i = 0, il = keys.length; i < il; i++) {
      let key = keys[i];
      if (helperKeys.indexOf(key) < 0)
        continue;

      let helper  = CONDITIONAL_OBJECT_HELPERS[key];
      let value   = obj[key];

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
      for (let i = 0, il = matchers.length; i < il; i++) {
        let matcher = matchers[i];
        let helper  = matcher.helper;
        let value   = helper.call(this, request);

        if (!matcher.matcher.call(this, value))
          return false;
      }

      return true;
    };
  };

  const createConditionsFromArray = (conditionsToCreate) => {
    let matchers = [];
    for (let i = 0, il = conditionsToCreate.length; i < il; i++) {
      let condition = conditionsToCreate[i];

      if (typeof condition === 'function')
        matchers.push(condition);
      else if (Nife.instanceOf(condition, 'object'))
        matchers.push(createConditionsFromObject(condition));
    }

    return function patternMatcher(request) {
      for (let i = 0, il = matchers.length; i < il; i++) {
        let matcher = matchers[i];
        if (!matcher.call(this, request))
          return false;
      }

      return true;
    };
  };

  let conditionChecker;

  if (Nife.instanceOf(conditions, 'object'))
    conditionChecker = createConditionsFromObject(conditions);
  else if (Nife.instanceOf(conditions, 'array'))
    conditionChecker = createConditionsFromArray(conditions);
  else if (Nife.instanceOf(conditions, 'function'))
    conditionChecker = conditions;
  else
    throw new Error('Invalid condition supplied');

  return function(request, response, next) {
    if (!conditionChecker.call(this, request))
      return next();

    return middleware.call(this, request, response, next);
  };
}

function jsonParser() {
  return function(request, response, next) {
    if (('' + request.headers['content-type']).match(/application\/json/i) && typeof request.body === 'string') {
      request.rawBody = request.body;
      request.body = JSON.parse(request.body);
    }

    return next();
  };
}

module.exports = {
  conditional,
  jsonParser,
};
