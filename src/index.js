const ApplicationScope  = require('./application');
const ModelScope        = require('./models');
const HTTPServerScope   = require('./http-server');
const ControllerScope   = require('./controllers');
const CLIUtilsScope     = require('./cli');
const LoggerScope       = require('./logger');

module.exports = Object.assign(module.exports,
  ApplicationScope,
  ModelScope,
  HTTPServerScope,
  ControllerScope,
  CLIUtilsScope,
  LoggerScope,
);
