'use strict';

const defineModel = require('./model-utils');

const ID_STRING_MAX_SIZE = 15;

module.exports = defineModel('Migration', ({ Parent, Types }) => {
  return class Migration extends Parent {
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
  };
});
