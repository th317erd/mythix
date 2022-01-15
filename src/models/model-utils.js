const Nife        = require('nife');
const { ENV }     = require('../config');
const Inflection  = require('inflection');
const { Model }   = require('model');

function relationHelper(type) {
  return function(target, _options) {
    const getName = () => {
      if (options.name)
        return options.name;

      if (type.match(/many/i))
        return Inflection.pluralize(target);
      else
        return target.toLowerCase();
    };

    var options               = _options || {};
    var defaultOnDeleteAction = 'RESTRICT';
    if (options.allowNull)
      defaultOnDeleteAction = 'SET NULL';

    return {
      type,
      target,
      onDelete:   options.onDelete || defaultOnDeleteAction,
      onUpdate:   options.onUpdate || options.onDelete || defaultOnDeleteAction,
      field:      options.field,
      name:       getName(),
      allowNull:  (options.hasOwnProperty('allowNull')) ? options.allowNull : false,
    };
  };
}

const RELATION_HELPERS = {
  hasOne:         relationHelper('hasOne'),
  belongsTo:      relationHelper('belongsTo'),
  hasMany:        relationHelper('belongsToMany'),
  belongsToMany:  relationHelper('belongsToMany'),
};

function defineModel(modelName, definer, _parent) {
  function compileModelFields(Klass) {
    var fields      = Klass.fields;
    var fieldNames  = Object.keys(fields);

    for (var i = 0, il = fieldNames.length; i < il; i++) {
      var fieldName = fieldNames[i];
      var field     = fields[fieldName];

      if (!field.field) {
        var columnName = Nife.camelCaseToSnakeCase(fieldName);
        field.field = columnName;
      }
    }

    return fields;
  }

  function cleanModelFields(Klass) {
    var finalFields = {};
    var fields      = Klass.fields;
    var fieldNames  = Object.keys(fields);

    for (var i = 0, il = fieldNames.length; i < il; i++) {
      var fieldName = fieldNames[i];
      var field     = fields[fieldName];
      var newField  = Nife.extend(Nife.extend.FILTER, (key) => !key.match(/^(index)$/), {}, field);

      finalFields[fieldName] = newField;
    }

    return finalFields;
  }

  function generateIndexes(Klass) {
    var finalIndexes  = [];
    var fields        = Klass.fields;
    var fieldNames    = Object.keys(fields);

    for (var i = 0, il = fieldNames.length; i < il; i++) {
      var fieldName = fieldNames[i];
      var field     = fields[fieldName];

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
      }
    ]);

    return finalIndexes;
  }

  return function({ app, Sequelize, connection }) {
    const Klass = definer({
      Parent:   (_parent) ? _parent : Model,
      Type:     Sequelize.DataTypes,
      Relation: RELATION_HELPERS,
      Sequelize,
      connection,
      modelName,
      app,
    });

    Klass.fields = compileModelFields(Klass);

    var indexes = generateIndexes(Klass);

    Klass.fields = cleanModelFields(Klass);

    var tableName = Inflection.pluralize(modelName);
    tableName = (`${ENV('DB_TABLE_PREFIX', '')}${Nife.camelCaseToSnakeCase(tableName)}`).toLowerCase();

    Klass.init(Klass.fields, {
      underscored:      true,
      freezeTableName:  true,
      sequelize:        connection,
      tableName,
      modelName,
      indexes,
    });

    return { [modelName]: Klass };
  };
}

function getModelPrimaryKeyField(Klass) {
  var fields      = Klass.fields;
  var fieldNames  = Object.keys(fields);

  for (var i = 0, il = fieldNames.length; i < il; i++) {
    var fieldName = fieldNames[i];
    var field     = fields[fieldName];

    if (field.primaryKey)
      return field;
  }
}

function buildModelRelations(models) {
  var modelNames = Object.keys(models);
  for (var i = 0, il = modelNames.length; i < il; i++) {
    var modelName = modelNames[i];
    var model     = models[modelName];
    var relations = model.relations;

    if (!relations)
      continue;

    for (var j = 0, jl = relations.length; j < jl; j++) {
      var relation        = relations[j];
      var type            = relation.type;
      var fieldName       = Nife.camelCaseToSnakeCase(relation.field);
      var targetModelName = relation.target;
      var targetModel     = models[targetModelName];

      if (!targetModel)
        throw new Error(`${modelName} relation error: target model ${targetModelName} not found`);

      var primaryKeyField;

      if (type.match(/^belongs/)) {
        primaryKeyField = getModelPrimaryKeyField(targetModel);

        if (!primaryKeyField)
          throw new Error(`${modelName} relation error: primary key for model ${targetModelName} not found`);

        if (!fieldName)
          fieldName = `${Nife.camelCaseToSnakeCase(targetModelName)}_${primaryKeyField.field}`;
      } else {
        primaryKeyField = getModelPrimaryKeyField(model);

        if (!primaryKeyField)
          throw new Error(`${modelName} relation error: primary key for model ${modelName} not found`);

        if (!fieldName)
          fieldName = `${Nife.camelCaseToSnakeCase(modelName)}_${primaryKeyField.field}`;
      }

      var pkFieldCopy = Nife.extend(Nife.extend.FILTER, (key) => !key.match(/^(field|primaryKey)$/), {}, primaryKeyField);

      // Build relation options for sequelize
      var options = {
        onDelete:   relation.onDelete,
        onUpdate:   relation.onUpdate,
        foreignKey: Object.assign(pkFieldCopy, { name: relation.name, field: fieldName }),
      };

      // Set relation on model
      model[type](targetModel, options);
    }
  }
}

module.exports = {
  defineModel,
  getModelPrimaryKeyField,
  buildModelRelations,
};
