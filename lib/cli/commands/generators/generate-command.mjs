import Nife             from 'nife';
import { CommandBase }  from '../../command-base.mjs';
import { Logger }       from '../../../logger.mjs';

import { GenerateMigrationCommand } from './migration-generator.mjs';

function prepareGeneratorCommands(commands, application, operationName) {
  return Nife.iterate(commands, ({ index, key, value, context }) => {
    const Klass = value;

    let commandName = key;
    if (index === key) {
      if (typeof Klass.getGeneratorName === 'function')
        commandName = Klass.getGeneratorName();
      else
        commandName = Klass.name;
    }

    let commandArgs = {};
    if (typeof Klass.commandArguments === 'function') {
      commandArgs = Klass.commandArguments(application, operationName);

      if (commandArgs && commandArgs.help)
        commandArgs.help['@see'] = `See: 'mythix-cli generate ${commandName} --help' for more help`;
    }

    context[commandName.toLocaleLowerCase()] = {
      CommandKlass: Klass,
      ...commandArgs,
    };
  }, {});
}

export class GenerateCommand extends CommandBase {
  static getCommandName() {
    return 'generate';
  }

  static getGeneratorCommands() {
    return {
      migration: GenerateMigrationCommand,
    };
  }

  static applicationConfig = () => {
    return {
      httpServer: false,
      autoReload: false,
      runTasks:   false,
      logger:     {
        level: Logger.LEVEL_ERROR,
      },
    };
  };

  static commandArguments(application, operationName) {
    let generatorCommands = prepareGeneratorCommands(this.getGeneratorCommands(), application, operationName);

    let help = {
      '@usage': 'mythix-cli generate {generator}',
      '@title': 'Generate new content using the specified generator',
    };

    Nife.iterate(generatorCommands, ({ value, key }) => {
      if (value.help)
        help[key] = value.help;
    });

    return {
      help:   help,
      runner: ({ $, fetch, showHelp, scope, store }) => {
        let subCommandResult = $(
          /[\w-]+/,
          ({ store }, parsedResult) => {
            store({ generateSubCommand: parsedResult.value.toLowerCase() });
            return true;
          },
          { formatParsedResult: (result) => ({ value: result[0] }) },
        );

        if (!subCommandResult)
          return false;

        let subCommandName  = fetch('generateSubCommand');
        let command         = generatorCommands[subCommandName];

        if (!command) {
          console.error(`Error: unknown generator "${subCommandName}"\n`);
          return false;
        }

        let subCommandRunnerResult = true;
        if (command.runner)
          subCommandRunnerResult = scope(subCommandName, command.runner);

        if (!subCommandRunnerResult || fetch('help', false)) {
          showHelp(null, help[subCommandName] || help);
          return false;
        }

        store('generatorCommands', generatorCommands);

        return true;
      },
    };
  }

  async execute(args, fullArgs) {
    let application       = this.getApplication();
    let subCommandName    = args.generateSubCommand;
    let generatorCommands = args.generatorCommands;
    let command           = generatorCommands[subCommandName];

    let commandInstance = new command.CommandKlass(application, this.getOptions());
    return await commandInstance.execute.call(commandInstance, args[subCommandName], fullArgs);
  }
}
