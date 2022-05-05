'use strict';

const { defineModel } = require('./model-utils');

const ID_STRING_MAX_SIZE = 15;

module.exports = defineModel('Migration', ({ Parent, Type }) => {
  return class Migration extends Parent {
    static fields = {
      id: {
        type:         Type.STRING(ID_STRING_MAX_SIZE),
        allowNull:    false,
        primaryKey:   true,
        index:        true,
      },
    };
  };
});
