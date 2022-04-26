'use strict';

const { Model } = require('./model');

const {
  defineModel,
  getModelPrimaryKeyField,
  buildModelRelations,
} = require('./model-utils');

module.exports = {
  Model,
  defineModel,
  getModelPrimaryKeyField,
  buildModelRelations,
};
