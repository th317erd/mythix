'use strict';

const Nife                  = require('nife');
const { Types }             = require('mythix-orm');
const { Model: ModelBase }  = require('./model');

function defineModel(modelName, definer, _parent) {
  return function({ application, connection }) {
    let definerArgs = {
      Parent:   (_parent) ? _parent : ModelBase,
      Types,
      connection,
      modelName,
      application,
    };

    let Model = definer(definerArgs);

    if (typeof Model.onModelClassCreate === 'function')
      Model = Model.onModelClassCreate(Model, definerArgs);

    let tableName   = Model.getTableName();
    let tablePrefix = application.getDBTablePrefix();

    if (tablePrefix)
      tableName = (`${tablePrefix}${tableName}`);

    Model.getTableName = () => tableName;
    Model.getApplication = () => application;
    Model.getLogger = () => application.getLogger();
    Model._getConnection = () => connection;

    if (typeof Model.onModelClassFinalized === 'function')
      Model = Model.onModelClassFinalized(Model, definerArgs);

    return { [modelName]: Model };
  };
}

module.exports = {
  defineModel,
};
