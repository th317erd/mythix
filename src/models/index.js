'use strict';

const { Model }       = require('./model');
const { ModelModule } = require('./model-module');
const { MigrationModel } = require('./migration-model');
const {
  defineModel,
  registerModel,
} = require('./model-utils');

module.exports = {
  defineModel,
  registerModel,
  Model,
  ModelModule,
  MigrationModel,
};
