import Nife from 'nife';
const {
  CommandBase,
  loadCommands,
} = require('./cli-utils.js');

(async function() {
  let commandName = process.env['MYTHIX_EXECUTE_COMMAND'];
  if (Nife.isEmpty(commandName))
    return;

  // First load all commands
  let mythixCommandPath             = process.env['MYTHIX_COMMAND_PATH'];
  let mythixApplicationCommandsPath = process.env['MYTHIX_APPLICATION_COMMANDS'];
  if (mythixCommandPath && mythixApplicationCommandsPath)
    loadCommands(mythixApplicationCommandsPath);

  let Klass = CommandBase.commands[commandName];
  if (!Klass || typeof Klass.execute !== 'function')
    return;

  try {
    await Klass.execute();
  } catch (error) {
    console.error(error);
  }
})();
