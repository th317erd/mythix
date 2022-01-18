const ControllerBaseScope   = require('./controller-base');
const ControllerUtilsScope  = require('./controller-utils');

module.exports = Object.assign(module.exports,
  ControllerBaseScope,
  ControllerUtilsScope,
);
