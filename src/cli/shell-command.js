'use strict';

const Nife              = require('nife');
const OS                = require('os');
const Path              = require('path');
const REPL              = require('repl');
const UUIDV4            = require('uuid').v4;
const { Sequelize }     = require('sequelize');
const { defineCommand } = require('./cli-utils');
const {
  HTTPInterface,
  HTTPUtils,
} = require('../utils');

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

    execute() {
      return new Promise((resolve) => {
        let application   = this.getApplication();
        let environment   = application.getConfigValue('environment', 'development');
        let appName       = application.getApplicationName();
        let httpInterface = new HTTPInterface();

        const interactiveShell = REPL.start({
          prompt: `${appName} (${environment}) > `,
        });

        interactiveShell.on('exit', () => {
          resolve(0);
        });

        interactiveShell.setupHistory(Path.join(OS.homedir(), `.${appName}-${environment}-history`), () => {});

        interactiveShell.context.UUIDV4 = UUIDV4;
        interactiveShell.context.Sequelize = Sequelize;
        interactiveShell.context.connection = (typeof application.getDBConnection === 'function') ? application.getDBConnection() : null;
        interactiveShell.context.application = application;
        interactiveShell.context.Nife = Nife;

        interactiveShell.context.HTTP = {
          'getDefaultURL':      httpInterface.getDefaultURL.bind(httpInterface),
          'setDefaultURL':      httpInterface.setDefaultURL.bind(httpInterface),
          'getDefaultHeader':   httpInterface.getDefaultHeader.bind(httpInterface),
          'getDefaultHeaders':  httpInterface.getDefaultHeaders.bind(httpInterface),
          'setDefaultHeader':   httpInterface.setDefaultHeader.bind(httpInterface),
          'setDefaultHeaders':  httpInterface.setDefaultHeaders.bind(httpInterface),
          'request':            httpInterface.request.bind(httpInterface),
          'get':                httpInterface.getRequest.bind(httpInterface),
          'post':               httpInterface.postRequest.bind(httpInterface),
          'put':                httpInterface.putRequest.bind(httpInterface),
          'delete':             httpInterface.deleteRequest.bind(httpInterface),
          'head':               httpInterface.headRequest.bind(httpInterface),
          'options':            httpInterface.optionsRequest.bind(httpInterface),
          'dataToQueryString':  HTTPUtils.dataToQueryString,
        };

        if (typeof application.getModels === 'function')
          Object.assign(interactiveShell.context, application.getModels());

        this.onStart(interactiveShell);
      });
    }

    onStart() {}
  };
});
