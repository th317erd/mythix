const ConfigUtils = require('./config-utils');
const FileUtils   = require('./file-utils');
const MiscUtils   = require('./misc-utils');

module.exports = Object.assign(module.exports,
  ConfigUtils,
  FileUtils,
  MiscUtils,
);
