'use strict';

const Nife              = require('nife');
const { defineCommand } = require('./cli-utils');

module.exports = defineCommand('serve', ({ Parent }) => {
  return class ServeCommand extends Parent {
    static description      = 'Start application and HTTP server';

    static commandArguments = '[--host:string(Specify hostname or IP to listen on)] [--port:integer(Specify port to listen on)]';

    static applicationConfig = () => ({ autoStart: false, exitOnShutdown: 0 });

    execute(args) {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        try {
          let application = this.getApplication();
          let config = {};

          if (Nife.isNotEmpty(args.host))
            config.host = args.host;

          if (Nife.isNotEmpty(args.port))
            config.port = args.port;

          if (Nife.isNotEmpty(config))
            application.setConfig({ httpServer: config });

          application.on('exit', resolve);

          await application.start();
        } catch (error) {
          reject(error);
        }
      });
    }
  };
});
