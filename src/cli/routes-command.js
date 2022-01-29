const { defineCommand } = require('./cli-utils');
const { Logger }        = require('../logger');

module.exports = defineCommand('routes', ({ Parent }) => {
  return class RoutesCommand extends Parent {
    static description        = 'List application routes';
    static applicationConfig  = { logger: { level: Logger.ERROR } };

    execute(args) {
      const whitespaceOfLength = (len) => {
        if (len < 0)
          return '';

        var parts = new Array(len);
        for (var i = 0, il = parts.length; i < il; i++)
          parts[i] = ' ';

        return parts.join('');
      };

      const stringToLength = (str, len) => {
        return `${str}${whitespaceOfLength(len - str.length)}`
      };

      var application = this.getApplication();
      var routes      = application.buildRoutes(null, application.getRoutes());

      routes.forEach((route) => {
        var methods = route.methods;
        if (!methods === '*')
          methods = [ '{ANY}' ];

        methods.forEach((method) => {
          console.log(`${stringToLength(method, 8)}${route.path} -> ${route.controller}`);
        });
      });
    }
  };
});
