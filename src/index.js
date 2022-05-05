'use strict';

const { Application }   = require('./application');
const Models            = require('./models');
const HTTPServerScope   = require('./http-server');
const ControllerScope   = require('./controllers');
const CLIUtilsScope     = require('./cli');
const TasksScope        = require('./tasks');
const { Logger }        = require('./logger');
const Utils             = require('./utils');

module.exports = {
  defineCommand:          CLIUtilsScope.defineCommand,
  defineController:       ControllerScope.defineController,
  defineModel:            Models.defineModel,
  defineTask:             TasksScope.defineTask,
  createTestApplication:  Utils.TestUtils.createTestApplication,

  CLI:                    CLIUtilsScope,
  ControllerBase:         ControllerScope.ControllerBase,
  Controllers:            ControllerScope,
  CryptoUtils:            Utils.CryptoUtils,
  HTTP:                   HTTPServerScope,
  HTTPErrors:             HTTPServerScope.HTTPErrors,
  HTTPServer:             HTTPServerScope.HTTPServer,
  HTTPUtils:              Utils.HTTPUtils,
  Middleware:             HTTPServerScope.Middleware,
  TaskBase:               TasksScope.TaskBase,
  Tasks:                  TasksScope,
  TestUtils:              Utils.TestUtils,
  Model:                  Models.Model,

  Application,
  Logger,
  Models,
  Utils,
};
