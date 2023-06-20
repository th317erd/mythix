import Path         from 'path';
import Nife         from 'nife';
import { Logger }   from '../../logger.js';

const {
  defineCommand,
  getCommandFiles,
  getInternalCommandsPath,
} = require('../cli-utils.js');

function loadGeneratorCommands(application, operationName) {
  const generatorFilterFunc = (fullFileName, fileName, stats) => {
    if (stats.isDirectory())
      return true;

    if ((/[^_][\w-]+-generator\.\w+$/).test(fileName))
      return true;

    return false;
  };

  let applicationOptions = application.getOptions();
  let generatorFiles = [].concat(
    getCommandFiles(
      getInternalCommandsPath(),
      generatorFilterFunc,
    ),
    (Nife.isEmpty(applicationOptions.commandsPath)) ? getCommandFiles(
      getInternalCommandsPath(),
      generatorFilterFunc,
    ) : null,
  ).filter(Boolean);

  generatorFiles = Nife.uniq(generatorFiles);

  let commands = {};

  for (let i = 0, il = generatorFiles.length; i < il; i++) {
    let fullFileName  = generatorFiles[i];
    let fileName      = Path.basename(fullFileName);
    let commandName   = fileName.replace(/^([\w-]+)-generator\.\w+$/, '$1');
    let commandArgs   = {};
    let Klass;

    try {
      Klass = require(fullFileName);
      if (Klass.__esModule)
        Klass = Klass['default'];

      if (typeof Klass.commandArguments === 'function') {
        commandArgs = Klass.commandArguments(application, operationName);

        if (commandArgs && commandArgs.help)
          commandArgs.help['@see'] = `See: 'mythix-cli generate ${commandName} --help' for more help`;
      }
    } catch (error) {
      if (operationName === 'help')
        console.error(`Error while attempting to load generator "${fullFileName}": `, error);

      continue;
    }

    commands[commandName.toLocaleLowerCase()] = {
      CommandKlass: Klass,
      ...commandArgs,
    };
  }

  return commands;
}

export const Generate = defineCommand('generate', ({ Parent }) => {
  return class GenerateCommand extends Parent {
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
      let generatorCommands = loadGeneratorCommands(application, operationName);

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
  };
});
