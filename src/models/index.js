'use strict';

const { Model }       = require('./model');
const { ModelModule } = require('./model-module');

const {
  defineModel,
  getModelPrimaryKeyField,
  buildModelRelations,
} = require('./model-utils');

module.exports = {
  buildModelRelations,
  defineModel,
  getModelPrimaryKeyField,
  Model,
  ModelModule,
};
