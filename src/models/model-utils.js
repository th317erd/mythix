const Nife        = require('nife');
const Inflection  = require('inflection');
const { Model }   = require('./model');

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
  hasMany:        relationHelper('hasMany'),
  belongsToMany:  relationHelper('belongsToMany'),
};

function preciseNow() {
  var janFirst2022      = 1640995200000;
  var now               = Date.now() - janFirst2022;
  var highResolutionNow = Nife.now();
  var diff              = Math.floor(highResolutionNow);

  return Math.floor((now + (highResolutionNow - diff)) * 1000);
}

function defineModel(modelName, definer, _parent) {
  function compileModelFields(Klass, DataTypes, application, connection) {
    const createAutoIncrementor = () => {
      return () => preciseNow();
    };

    var fields      = Klass.fields;
    var fieldNames  = Object.keys(fields);
    var isSQLIte    = !!('' + Nife.get(connection, 'options.dialect')).match(/sqlite/);

    for (var i = 0, il = fieldNames.length; i < il; i++) {
      var fieldName = fieldNames[i];
      var field     = fields[fieldName];

      if (!field.field) {
        var columnName = Nife.camelCaseToSnakeCase(fieldName);
        field.field = columnName;
      }

      // If using SQLite, which doesn't support autoincrement
      // on anything except the primary key, then create our
      // own auto-incrementor for this field
      if (field.autoIncrement && isSQLIte && !field.primaryKey) {
        application.getLogger().warn(`!Warning!: Using an auto-increment field in SQLite on a non-primary-key column "${field.field}"! Be aware that this functionality is now emulated using high resolution timestamps. This won't work unless the column is a BIGINT. You may run into serious problems with this emulation!`)
        field.defaultValue = createAutoIncrementor();
      }

      if (field.type === DataTypes.BIGINT) {
        if (!field.get) {
          field.get = function(name) {
            var value = this.getDataValue(name);
            if (value == null)
              return null;

            return BigInt(value);
          };
        }

        if (!field.set) {
          field.set = function(_value, name) {
            var value = _value;
            if (value == null)
              value = null;
            else
              value = BigInt(value);

            return this.setDataValue(name, value);
          }
        }
      }
    }

    return fields;
  }

  function cleanModelFields(Klass, connection) {
    var finalFields = {};
    var fields      = Klass.fields;
    var fieldNames  = Object.keys(fields);
    var isSQLIte    = !!('' + Nife.get(connection, 'options.dialect')).match(/sqlite/);

    for (var i = 0, il = fieldNames.length; i < il; i++) {
      var fieldName = fieldNames[i];
      var field     = fields[fieldName];
      var newField  = Nife.extend(Nife.extend.FILTER, (key) => {
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

  return function({ application, Sequelize, connection }) {
    var definerArgs = {
      Parent:   (_parent) ? _parent : Model,
      Type:     Sequelize.DataTypes,
      Relation: RELATION_HELPERS,
      Sequelize,
      connection,
      modelName,
      application,
    };

    var Klass = definer(definerArgs);

    Klass.name = modelName;

    if (typeof Klass.onModelClassCreate === 'function')
      Klass = Klass.onModelClassCreate(Klass, definerArgs);

    var pluralName = (Klass.pluralName) ? Klass.pluralName : Inflection.pluralize(modelName);
    if (Klass.pluralName !== pluralName)
      Klass.pluralName = pluralName;

    Klass.fields = compileModelFields(Klass, Sequelize.DataTypes, application, connection);

    var indexes = generateIndexes(Klass);

    Klass.fields = cleanModelFields(Klass, connection);

    var applicationOptions = application.getOptions();
    var tableName;

    tableName = (`${Nife.get(applicationOptions, 'database.tablePrefix', '')}${Nife.camelCaseToSnakeCase(pluralName)}`).toLowerCase();

    Klass.init(Klass.fields, {
      underscored:      true,
      freezeTableName:  true,
      sequelize:        connection,
      tableName,
      modelName,
      indexes,
    });

    Klass.getApplication = () => application;
    Klass.getLogger = () => application.getLogger();

    Klass.getPrimaryKeyField      = getModelPrimaryKeyField.bind(this, Klass);
    Klass.getPrimaryKeyFieldName  = () => (getModelPrimaryKeyField(Klass).field);

    if (typeof Klass.onModelClassFinalized === 'function')
      Klass = Klass.onModelClassFinalized(Klass, definerArgs);

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
