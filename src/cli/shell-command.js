const OS                = require('os');
const Path              = require('path');
const REPL              = require('repl');
const UUIDV4            = require('uuid').v4;
const { Sequelize }     = require('sequelize');
const { defineCommand } = require('./cli-utils');

module.exports = defineCommand('shell', ({ Parent }) => {
  return class ShellCommand extends Parent {
    static nodeArguments = [ '--experimental-repl-await', '--experimental-top-level-await' ];

    execute(args) {
      return new Promise((resolve, reject) => {
        var application = this.getApplication();
        var environment = application.getConfigValue('ENVIRONMENT', 'development');
        var appName     = application.getApplicationName();

        const interactiveShell = REPL.start({
          prompt: `${appName} (${environment}) > `,
        });

        interactiveShell.on('exit', () => {
          resolve(0);
        });

        interactiveShell.setupHistory(Path.join(OS.homedir(), `.${appName}-${environment}-history`), (error, server) => {});

        interactiveShell.context.UUIDV4 = UUIDV4;
        interactiveShell.context.Sequelize = Sequelize;
        interactiveShell.context.connection = application.getDBConnection();
        interactiveShell.context.application = application;

        Object.assign(interactiveShell.context, application.getModels());
      });
    }
  };
});
