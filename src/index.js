'use strict';

const { Application }   = require('./application');
const ModelScope        = require('./models');
const HTTPServerScope   = require('./http-server');
const ControllerScope   = require('./controllers');
const CLIUtilsScope     = require('./cli');
const TasksScope        = require('./tasks');
const Logger            = require('./logger');
const Utils             = require('./utils');
const Modules           = require('./modules');

module.exports = {
  defineCommand:          CLIUtilsScope.defineCommand,
  defineController:       ControllerScope.defineController,
  defineModel:            ModelScope.defineModel,
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
  MimeUtils:              Utils.MimeUtils,
  Model:                  ModelScope.Model,
  Modules:                {
    BaseModule:         Modules.BaseModule,
    DatabaseModule:     Modules.DatabaseModule,
    FileWatcherModule:  Modules.FileWatcherModule,
    HTTPServerModule:   HTTPServerScope.HTTPServerModule,
    ModelModule:        ModelScope.ModelModule,
    TaskModule:         TasksScope.TaskModule,
    ControllerModule:   ControllerScope.ControllerModule,
  },

  Application,
  Logger,
  Models: ModelScope,
  Utils,
};
