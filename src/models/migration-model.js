'use strict';

const { Types }         = require('mythix-orm');
const { registerModel } = require('./model-utils');
const { Model }         = require('./model');

const ID_STRING_MAX_SIZE = 15;

class Migration extends Model {
  static fields = {
    id: {
      type:         Types.STRING(ID_STRING_MAX_SIZE),
      allowNull:    false,
      primaryKey:   true,
      index:        true,
    },
    createdAt: {
      type:         Types.DATETIME,
      defaultValue: Types.DATETIME.Default.NOW,
      allowNull:    false,
      index:        true,
    },
    updatedAt: {
      type:         Types.DATETIME,
      defaultValue: Types.DATETIME.Default.NOW.UPDATE,
      allowNull:    false,
      index:        true,
    },
  };
}

const modelRegisterFactory = registerModel(Migration);
modelRegisterFactory.MigrationModel = Migration;

module.exports = modelRegisterFactory;
