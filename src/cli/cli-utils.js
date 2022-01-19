const Path = require('path');

class CommandBase {

}

function defineCommand(_name, definer, _parent) {
  if (!CommandBase.commands)
    CommandBase.commands = {};

  var name        = _name.toLowerCase();
  var parentClass = _parent || CommandBase;

  var Klass = definer({ Parent: parentClass });

  Klass.commandName = name;

  CommandBase.commands[name] = Klass;

  return Klass;
}

async function getContext() {

}

async function executeCommand(command) {
  var context = await getContext();

  try {
    var result = await command.call(context, context.Application);
    process.exit(result);
  } catch (error) {
    console.error('Error: ', error);
    process.exit(1);
  }
}

module.exports = {
  CommandBase,
  defineCommand,
  getContext,
  executeCommand,
};
