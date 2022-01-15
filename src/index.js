const ApplicationScope  = require('./application');
const ModelScope        = require('./models');

module.exports = Object.assign(module.exports,
  ApplicationScope,
  ModelScope,
);
