'use strict';

const { defineCommand } = require('./cli-utils');
const { Logger }        = require('../logger');

const TAB_SIZE = 8;

module.exports = defineCommand('routes', ({ Parent }) => {
  return class RoutesCommand extends Parent {
    static description        = 'List application routes';

    static applicationConfig  = { logger: { level: Logger.ERROR } };

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
      let routes      = application.buildRoutes(null, application.getRoutes());

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
