'use strict';

const Nife        = require('nife');
const Inflection  = require('inflection');
const { Model }   = require('./model');

const MILLISECONDS_PER_SECOND = 1000;

function relationHelper(modelName, type) {
  return function(target, _options) {
    const getName = () => {
      if (options.name)
        return options.name;

      if (type.match(/many/i))
        return Inflection.pluralize(target.toLowerCase());
      else
        return target.toLowerCase();
    };

    // const getFieldName = () => {
    //   if (options.field)
    //     return options.field;

    //   if (type.match(/many/i))
    //     return Inflection.pluralize(target.toLowerCase());
    //   else
    //     return target.toLowerCase();
    // };

    let options               = _options || {};
    let defaultOnDeleteAction = 'RESTRICT';
    if (options.allowNull)
      defaultOnDeleteAction = 'SET NULL';

    return Object.assign({}, options, {
      type,
      target,
      onDelete:   options.onDelete || defaultOnDeleteAction,
      onUpdate:   options.onUpdate || options.onDelete || defaultOnDeleteAction,
      field:      options.field,
      name:       getName(),
      allowNull:  (Object.prototype.hasOwnProperty.call(options, 'allowNull')) ? options.allowNull : false,
    });
  };
}

const RELATION_HELPERS = [
  'hasOne',
  'belongsTo',
  'hasMany',
  'belongsToMany',
];

function getRelationHelpers(modelName) {
  let obj = {};

  for (let i = 0, il = RELATION_HELPERS.length; i < il; i++) {
    let type = RELATION_HELPERS[i];
    obj[type] = relationHelper(modelName, type);
  }

  return obj;
}

function preciseNow() {
  let janFirst2022      = 1640995200000;
  let now               = Date.now() - janFirst2022;
  let highResolutionNow = Nife.now();
  let diff              = Math.floor(highResolutionNow);

  return Math.floor((now + (highResolutionNow - diff)) * MILLISECONDS_PER_SECOND);
}

function defineModel(modelName, definer, _parent) {
  function compileModelFields(Klass, DataTypes, application, connection) {
    const createAutoIncrementor = () => {
      return () => preciseNow();
    };

    let fields      = Klass.fields;
    let fieldNames  = Object.keys(fields);
    let isSQLIte    = !!('' + Nife.get(connection, 'options.dialect')).match(/sqlite/);

    for (let i = 0, il = fieldNames.length; i < il; i++) {
      let fieldName = fieldNames[i];
      let field     = fields[fieldName];

      if (!field.field) {
        let columnName = Nife.camelCaseToSnakeCase(fieldName);
        field.field = columnName;
      }

      if (!Object.prototype.hasOwnProperty.call(field, 'allowNull'))
        field.allowNull = (field.primaryKey) ? false : true;

      // If using SQLite, which doesn't support autoincrement
      // on anything except the primary key, then create our
      // own auto-incrementor for this field
      if (field.autoIncrement && isSQLIte && !field.primaryKey) {
        application.getLogger().warn(`!Warning!: Using an auto-increment field in SQLite on a non-primary-key column "${field.field}"! Be aware that this functionality is now emulated using high resolution timestamps. This won't work unless the column is a BIGINT. You may run into serious problems with this emulation!`);
        field.defaultValue = createAutoIncrementor();
      }

      if (field.type === DataTypes.BIGINT) {
        if (!field.get) {
          field.get = function(name) {
            let value = this.getDataValue(name);
            if (value == null)
              return null;

            return BigInt(value);
          };
        }

        if (!field.set) {
          field.set = function(_value, name) {
            let value = _value;
            if (value == null)
              value = null;
            else
              value = BigInt(value);

            return this.setDataValue(name, value);
          };
        }
      }
    }

    return fields;
  }

  function cleanModelFields(Klass, connection) {
    let finalFields = {};
    let fields      = Klass.fields;
    let fieldNames  = Object.keys(fields);
    let isSQLIte    = !!('' + Nife.get(connection, 'options.dialect')).match(/sqlite/);

    for (let i = 0, il = fieldNames.length; i < il; i++) {
      let fieldName = fieldNames[i];
      let field     = fields[fieldName];
      let newField  = Nife.extend(Nife.extend.FILTER, (key) => {
        if (key.match(/^(index)$/))
          return false;

        // Strip "autoIncrement" if this is not the primary key
        // and we are using sqlite for our dialect
        if (key === 'autoIncrement' && isSQLIte && !field.primaryKey)
          return false;

        return true;
      }, {}, field);

      finalFields[fieldName] = newField;
    }

    return finalFields;
  }

  function generateIndexes(Klass) {
    let finalIndexes  = [];
    let fields        = Klass.fields;
    let fieldNames    = Object.keys(fields);

    for (let i = 0, il = fieldNames.length; i < il; i++) {
      let fieldName = fieldNames[i];
      let field     = fields[fieldName];

      if (field.index) {
        if (field.index === 'unique') {
          finalIndexes.push({
            unique: true,
            fields: [ field.field ],
          });
        } else {
          finalIndexes.push({
            unique: false,
            fields: [ field.field ],
          });
        }
      }
    }

    finalIndexes = finalIndexes.concat(Klass.indexes || [], [
      {
        unique: false,
        fields: [ 'created_at' ],
      },
      {
        unique: false,
        fields: [ 'updated_at' ],
      },
    ]);

    return finalIndexes;
  }

  return function({ application, Sequelize, connection }) {
    let definerArgs = {
      Parent:   (_parent) ? _parent : Model,
      Type:     Sequelize.DataTypes,
      Relation: getRelationHelpers(modelName),
      Sequelize,
      connection,
      modelName,
      application,
    };

    let Klass = definer(definerArgs);

    Klass.customName = modelName;

    if (typeof Klass.onModelClassCreate === 'function')
      Klass = Klass.onModelClassCreate(Klass, definerArgs);

    let pluralName = (Klass.pluralName) ? Klass.pluralName : Inflection.pluralize(modelName);
    if (Klass.pluralName !== pluralName)
      Klass.pluralName = pluralName;

    Klass.fields = compileModelFields(Klass, Sequelize.DataTypes, application, connection);

    let indexes = generateIndexes(Klass);

    Klass.fields = cleanModelFields(Klass, connection);

    let applicationOptions = application.getOptions();
    let tableName = Klass.tableName;

    if (!tableName)
      tableName = (`${Nife.get(applicationOptions, 'database.tablePrefix', '')}${Nife.camelCaseToSnakeCase(pluralName)}`).toLowerCase();

    Klass.init(Klass.fields, {
      underscored:      true,
      freezeTableName:  true,
      sequelize:        connection,
      tableName,
      modelName,
      indexes,
      name:            {
        singular: modelName.toLowerCase(),
        plural:   Inflection.pluralize(modelName.toLowerCase()),
      },
    });

    Klass.getApplication = () => application;
    Klass.getLogger = () => application.getLogger();
    Klass.getModelName = (function() {
      return modelName;
    }).bind(Klass);

    Klass.prototype.getModelName = function() {
      return modelName;
    };

    Klass.getPrimaryKeyField      = getModelPrimaryKeyField.bind(this, Klass);
    Klass.getPrimaryKeyFieldName  = () => (getModelPrimaryKeyField(Klass).field);

    if (typeof Klass.onModelClassFinalized === 'function')
      Klass = Klass.onModelClassFinalized(Klass, definerArgs);

    return { [modelName]: Klass };
  };
}

function getModelPrimaryKeyField(Klass) {
  let fields      = Klass.fields;
  let fieldNames  = Object.keys(fields);

  for (let i = 0, il = fieldNames.length; i < il; i++) {
    let fieldName = fieldNames[i];
    let field     = fields[fieldName];

    if (field.primaryKey)
      return field;
  }
}

function buildModelRelations(models) {
  let modelNames = Object.keys(models);
  for (let i = 0, il = modelNames.length; i < il; i++) {
    let modelName = modelNames[i];
    let model     = models[modelName];
    let relations = model.relations;

    if (!relations)
      continue;

    for (let j = 0, jl = relations.length; j < jl; j++) {
      let relation        = relations[j];
      let type            = relation.type;
      let fieldName       = Nife.camelCaseToSnakeCase(relation.field);
      let targetModelName = relation.target;
      let targetModel     = models[targetModelName];
      let belongsType     = !!type.match(/^belongs/);

      if (!targetModel)
        throw new Error(`${modelName} relation error: target model ${targetModelName} not found`);

      let primaryKeyField;

      if (belongsType) {
        primaryKeyField = getModelPrimaryKeyField(targetModel);

        if (!primaryKeyField)
          throw new Error(`${modelName} relation error: primary key for model ${targetModelName} not found`);

        let pkFieldName = primaryKeyField.field;
        if (pkFieldName === 'id')
          pkFieldName = 'ID';

        if (!fieldName)
          fieldName = `${Nife.camelCaseToSnakeCase(targetModelName)}${Nife.snakeCaseToCamelCase(pkFieldName, true)}`;
      } else {
        primaryKeyField = getModelPrimaryKeyField(model);

        if (!primaryKeyField)
          throw new Error(`${modelName} relation error: primary key for model ${modelName} not found`);

        let pkFieldName = primaryKeyField.field;
        if (pkFieldName === 'id')
          pkFieldName = 'ID';

        if (!fieldName)
          fieldName = `${Nife.camelCaseToSnakeCase(modelName)}${Nife.snakeCaseToCamelCase(pkFieldName, true)}`;
      }

      let pkFieldCopy = Nife.extend(Nife.extend.FILTER, (key) => !key.match(/^(field|primaryKey)$/), {}, primaryKeyField);

      // Build relation options for sequelize
      let options = Object.assign({}, relation, {
        onDelete:   relation.onDelete,
        onUpdate:   relation.onUpdate,
        allowNull:  (relation.allowNull == null) ? true : relation.allowNull,
        field:      Nife.camelCaseToSnakeCase(fieldName),
        foreignKey: Object.assign(pkFieldCopy, { name: fieldName, as: relation.name, field: Nife.camelCaseToSnakeCase(fieldName) }),
      });

      // Set relation on model
      // console.log(`Creating model relation (${modelName} -> ${targetModelName}): `, type, options);
      model[type](targetModel, options);
    }
  }
}

module.exports = {
  defineModel,
  getModelPrimaryKeyField,
  buildModelRelations,
};
