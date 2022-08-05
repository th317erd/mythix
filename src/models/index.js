'use strict';

const { Model }       = require('./model');
const { ModelModule } = require('./model-module');

const {
  defineModel,
} = require('./model-utils');

module.exports = {
  defineModel,
  Model,
  ModelModule,
};
