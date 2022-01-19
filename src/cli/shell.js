const OS                = require('os');
const Path              = require('path');
const REPL              = require('repl');
const UUIDV4            = require('uuid').v4;
const { Sequelize }     = require('sequelize');
const { defineCommand } = require('./cli-utils');

module.exports = defineCommand('shell', ({ Parent, Option }) => {
  return class ShellCommand extends Parent {
    static nodeArguments = [ '--experimental-repl-await', '--experimental-top-level-await' ];

    async execute(Application, options) {
      try {
        var application = new Application({ cli: true });

        application.setOptions({
          httpServer: false,
          cli: true,
        });

        await application.start();

        var environment = application.getConfigValue('ENVIRONMENT', 'development');
        var appName     = application.getApplicationName();

        const interactiveShell = REPL.start({
          prompt: `${appName} (${environment}) > `,
        });

        interactiveShell.setupHistory(Path.join(OS.homedir(), `.${appName}-${environment}-history`), (error, server) => {});

        interactiveShell.context.UUIDV4 = UUIDV4;
        interactiveShell.context.Sequelize = Sequelize;
        interactiveShell.context.connection = application.getDBConnection();

        Object.assign(interactiveShell.context, application.getModels());
      } catch (error) {
        if (application)
          await application.stop();

        throw error;
      }
    }
  };
});
