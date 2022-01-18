const HTTPServerScope = require('./http-server');
const HTTPUtilsScope  = require('./http-utils');
const HTTPErrors      = require('./http-errors');
const Middleware      = require('./middleware');

module.exports = Object.assign(module.exports,
  HTTPServerScope,
  HTTPUtilsScope,
  { HTTPErrors },
  { Middleware },
);
