const { Application }   = require('./application');
const Models            = require('./models');
const HTTPServerScope   = require('./http-server');
const ControllerScope   = require('./controllers');
const CLIUtilsScope     = require('./cli');
const TasksScope        = require('./tasks');
const { Logger }        = require('./logger');

module.exports = {
  defineModel:      Models.defineModel,
  defineController: ControllerScope.defineController,
  defineCommand:    CLIUtilsScope.defineCommand,
  defineTask:       TasksScope.defineTask,
  HTTPServer:       HTTPServerScope.HTTPServer,
  HTTPErrors:       HTTPServerScope.HTTPErrors,
  Middleware:       HTTPServerScope.Middleware,
  ControllerBase:   ControllerScope.ControllerBase,
  TaskBase:         TasksScope.TaskBase,
  HTTP:             HTTPServerScope,
  Controllers:      ControllerScope,
  CLI:              CLIUtilsScope,
  Tasks:            TasksScope,
  Application,
  Models,
  Logger,
};
