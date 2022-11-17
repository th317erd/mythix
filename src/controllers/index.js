'use strict';

const { ControllerBase }              = require('./controller-base');
const { ControllerModule }            = require('./controller-module');
const { generateClientAPIInterface }  = require('./generate-client-api-interface');

const {
  defineController,
} = require('./controller-utils');

const Routes = require('./routes');

module.exports = {
  ControllerBase,
  ControllerModule,
  Routes,
  defineController,
  generateClientAPIInterface,
};
