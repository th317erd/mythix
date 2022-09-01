'use strict';

const { defineCommand } = require('./cli-utils');
const Logger            = require('../logger');
const { buildRoutes }   = require('../controllers/controller-utils');

const TAB_SIZE = 8;

module.exports = defineCommand('routes', ({ Parent }) => {
  return class RoutesCommand extends Parent {
    static description        = 'List application routes';

    static applicationConfig  = { database: false, logger: { level: Logger.LEVEL_ERROR } };

    buildRoutes(httpServer, routes) {
      let application       = this.getApplication();
      let customParserTypes = application.getCustomRouteParserTypes(httpServer, routes);

      return buildRoutes(routes, customParserTypes);
    }

    execute() {
      const whitespaceOfLength = (len) => {
        if (len < 0)
          return '';

        let parts = new Array(len);
        for (let i = 0, il = parts.length; i < il; i++)
          parts[i] = ' ';

        return parts.join('');
      };

      const stringToLength = (str, len) => {
        return `${str}${whitespaceOfLength(len - str.length)}`;
      };

      let application = this.getApplication();
      let routes      = this.buildRoutes(null, application.getRoutes());

      routes.forEach((route) => {
        let methods = route.methods;
        if (!methods === '*')
          methods = [ '{ANY}' ];

        methods.forEach((method) => {
          console.log(`${stringToLength(method, TAB_SIZE)}${route.path} -> ${route.controller}`);
        });
      });
    }
  };
});
