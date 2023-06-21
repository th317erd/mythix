import Nife from 'nife';
import { executeCommandByName } from './cli-utils.mjs';

(async function() {
  let commandName = process.env['MYTHIX_EXECUTE_COMMAND'];
  if (Nife.isEmpty(commandName))
    return;

  try {
    await executeCommandByName(commandName);
  } catch (error) {
    console.error(error);
  }
})();
