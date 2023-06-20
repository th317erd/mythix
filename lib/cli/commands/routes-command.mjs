import { Logger }       from '../../logger.mjs';
import { CommandBase }  from '../command-base.mjs';

export class RoutesCommand extends CommandBase {
  static getCommandName() {
    return 'routes';
  }

  static applicationConfig = { database: false, logger: { level: Logger.LEVEL_ERROR } };

  static commandArguments() {
    return {
      help: {
        '@usage': 'mythix-cli routes',
        '@title': 'List application routes',
      },
    };
  }

  execute() {
    let application = this.getApplication();
    let routes      = application._getRoutes();
    let whitespace  = '        ';

    console.log(`${application.getApplicationName()} routes:`);

    routes.walkRoutes(({ endpoint }) => {
      let methods = endpoint.methods || [];
      let flags   = [
        (endpoint.isDynamic) ? 'dynamic' : '',
        (endpoint.cors) ? 'COR' : '',
      ].filter(Boolean).join(', ');

      for (let i = 0, il = methods.length; i < il; i++) {
        let method = methods[i];
        console.log(`  ${method}${whitespace.substring(0, whitespace.length - method.length)}/${endpoint.path} -> [${endpoint.controller}]${(flags) ? ` (${flags})` : ''}`);
      }
    });
  }
}
