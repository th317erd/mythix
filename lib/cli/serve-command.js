import Nife               from 'nife';
import { defineCommand }  from './cli-utils.js';

export const Serve = defineCommand('serve', ({ Parent }) => {
  return class ServeCommand extends Parent {
    static applicationConfig = () => ({ autoStart: false, exitOnShutdown: 0 });

    static commandArguments() {
      return {
        help: {
          /* eslint-disable key-spacing */
          '@usage': 'mythix-cli serve [options]',
          '@title': 'Start application and HTTP server',
          '--host={hostname or IP} | --host {hostname or IP}': 'Specify hostname or IP to listen on.',
          '--port={port number} | --port {port number}': 'Specify port to listen on.',
        },
        runner: ({ $, Types }) => {
          $('--host', Types.STRING());
          $('--port', Types.INTEGER({
            validate: (value) => {
              // eslint-disable-next-line no-magic-numbers
              if (value < 0 || value > 65535) {
                console.error('Invalid "--port" specified... must be in the range 0-65535');
                return false;
              }

              return true;
            },
          }));

          return true;
        },
      };
    }

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
