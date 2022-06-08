'use strict';

const { ControllerBase }              = require('./controller-base');
const { ControllerModule }            = require('./controller-module');
const { generateClientAPIInterface }  = require('./generate-client-api-interface');

const {
  buildPatternMatcher,
  buildMethodMatcher,
  buildContentTypeMatcher,
  buildPathMatcher,
  buildRoutes,
  defineController,
} = require('./controller-utils');

module.exports = {
  ControllerBase,
  ControllerModule,
  buildPatternMatcher,
  buildMethodMatcher,
  buildContentTypeMatcher,
  buildPathMatcher,
  buildRoutes,
  defineController,
  generateClientAPIInterface,
};
