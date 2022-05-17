'use strict';

const BaseModule        = require('./base-module');
const DatabaseModule    = require('./database-module');
const FileWatcherModule = require('./file-watcher-module');

module.exports = Object.assign({},
  BaseModule,
  DatabaseModule,
  FileWatcherModule,
);
