const Nife              = require('nife');
const OS                = require('os');
const Path              = require('path');
const REPL              = require('repl');
const UUIDV4            = require('uuid').v4;
const { Sequelize }     = require('sequelize');
const { defineCommand } = require('./cli-utils');
const http              = require('http');
const { URL }           = require('url');
const { HTTPUtils }     = require('../utils');

module.exports = defineCommand('shell', ({ Parent }) => {
  return class ShellCommand extends Parent {
    static description    = 'Drop into an application shell to execute commands directly';
    static nodeArguments  = [ '--experimental-repl-await', '--experimental-top-level-await' ];

    constructor(...args) {
      super(...args);

      Object.defineProperties(this, {
        'defaultHeaders': {
          writable:     true,
          enumberable:  false,
          configurable: true,
          value:        {},
        },
        'defaultURL': {
          writable:     true,
          enumberable:  false,
          configurable: true,
          value:        null,
        },
      });
    }

    execute(args) {
      return new Promise((resolve, reject) => {
        var application = this.getApplication();
        var environment = application.getConfigValue('environment', 'development');
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
        interactiveShell.context.Nife = Nife;

        interactiveShell.context.HTTP = {
          'getDefaultURL':      HTTPUtils.getDefaultURL,
          'setDefaultURL':      HTTPUtils.setDefaultURL,
          'getDefaultHeader':   HTTPUtils.getDefaultHeader,
          'getDefaultHeaders':  HTTPUtils.getDefaultHeaders,
          'setDefaultHeader':   HTTPUtils.setDefaultHeader,
          'setDefaultHeaders':  HTTPUtils.setDefaultHeaders,
          'request':            HTTPUtils['request'],
          'get':                HTTPUtils['get'],
          'post':               HTTPUtils['post'],
          'put':                HTTPUtils['put'],
          'delete':             HTTPUtils['delete'],
          'head':               HTTPUtils['head'],
          'options':            HTTPUtils['options'],
        };

        Object.assign(interactiveShell.context, application.getModels());

        this.onStart(interactiveShell);
      });
    }

    onStart() {}
  };
});
