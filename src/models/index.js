'use strict';

const { Model }       = require('./model');
const { ModelModule } = require('./model-module');
const { defineModel } = require('./model-utils');
const MigrationModel = require('./migration-model');

module.exports = {
  defineModel,
  Model,
  ModelModule,
  MigrationModel,
};
