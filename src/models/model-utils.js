'use strict';

const { Types } = require('mythix-orm');
const { Model: ModelBase } = require('./model');

function _setupModel(modelName, _Model, { application, connection }) {
  let Model       = _Model;
  let tableName   = Model.getTableName();
  let tablePrefix = application.getDBTablePrefix();

  if (tablePrefix)
    tableName = `${tablePrefix}${tableName}`.replace(/_+/g, '_');

  Model.getTableName  = () => tableName;
  Model.getModelName  = () => modelName;
  Model.getApplication = () => application;
  Model.getLogger = () => application.getLogger();
  Model._getConnection = (_connection) => {
    if (_connection)
      return _connection;

    return connection;
  };

  return { [modelName]: Model };
}

function registerModel(Model) {
  return function({ application, connection }) {
    return _setupModel(Model.getModelName(), Model, { application, connection });
  };
}

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

    return _setupModel(modelName, Model, { application, connection });
  };
}

module.exports = { defineModel, registerModel };
