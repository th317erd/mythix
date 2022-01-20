const Nife              = require('nife');
const { defineCommand } = require('./cli-utils');

module.exports = defineCommand('serve', ({ Parent }) => {
  return class ServeCommand extends Parent {
    static applicationConfig = () => ({ autoStart: false, exitOnShutdown: 0 });
    static commandArgumments = '<--host:string> <--port:integer>';

    execute(args) {
      return new Promise((resolve, reject) => {
        var application = this.getApplication();

        var config = {};

        if (Nife.isNotEmpty(args.host))
          config.host = args.host;

        if (Nife.isNotEmpty(args.port))
          config.port = args.port;

        if (Nife.isNotEmpty(config))
          application.setConfig({ httpServer: config });

        application.on('exit', resolve);

        application.start();
      });
    }
  };
});
