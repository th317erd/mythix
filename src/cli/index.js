const CLIUtils = require('./cli-utils');

function loadCommand(name) {
  var fullPath      = require.resolve(name);
  var CommandKlass  = require(fullPath);

  CommandKlass.path = fullPath;

  return CommandKlass;
}

function loadCommands(Commander, program) {
  loadCommand('./shell');
}

module.exports = {
  CommandBase:    CLIUtils.CommandBase,
  defineCommand:  CLIUtils.defineCommand,
  loadCommand:    loadCommand,
  loadCommands,
};
