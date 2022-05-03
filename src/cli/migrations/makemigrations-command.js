'use strict';

const Path              = require('path');
const FileSystem        = require('fs');
const { defineCommand } = require('../cli-utils');
const MigrationUtils    = require('./migration-utils');

module.exports = defineCommand('makemigrations', ({ Parent }) => {
  return class MakeMigrationsCommand extends Parent {
    static description      = 'Create migration for current model schema';

    static nodeArguments    = [ '--inspect-brk' ];

    static commandArguments = `
      [-p,-preview:boolean(Preview what the generated migration would look like without migrating anything)]
      [-n,-name:string(Specify a name for your migration)]
      [-c,-comment:string(Specify a comment for your migration)]
    `;

    getRevisionNumber() {
      let date = new Date();
      return date.toISOString().replace(/\.[^.]+$/, '').replace(/\D/g, '');
    }

    convertDBTypeToLocalType(dialect, type) {
      if (typeof type !== 'string')
        return type;

      switch (dialect) {
        case 'postgres':
        case 'db2':
          return type.replace(/CHARACTER\s+VARYING/, 'VARCHAR').replace(/TINYINT\s*\(\s*1\s*\)/, 'BOOLEAN');
        case 'mssql':
          return type.replace(/NVARCHAR/, 'VARCHAR').replace(/TINYINT\s*\(\s*1\s*\)/, 'BIT');
        case 'ibmi':
          return type.replace(/TINYINT\s*\(\s*1\s*\)/, 'SMALLINT');
      }
    }

    convertDBTypesToLocalTypes(dialect, attributes) {
      if (attributes == null)
        return attributes;

      let keys              = Object.keys(attributes);
      let mappedAttributes  = {};

      for (let i = 0, il = keys.length; i < il; i++) {
        let key   = keys[i];
        let value = attributes[key];

        if (typeof value === 'string') {
          mappedAttributes[key] = this.convertDBTypeToLocalType(dialect, value);
        } else {
          mappedAttributes[key] = Object.assign({}, value, {
            type: this.convertDBTypeToLocalType(dialect, value.type),
          });
        }
      }

      return mappedAttributes;
    }

    async getDBSchema(connection, models) {
      let queryInterface  = connection.getQueryInterface();
      let promises        = [];
      let modelNames      = Object.keys(models);
      let options         = {};
      let dbSchema        = {};

      for (let i = 0, il = modelNames.length; i < il; i++) {
        let modelName = modelNames[i];
        let Model     = models[modelName];
        let tableName = Model.getTableName(options);

        promises.push(Promise.allSettled([
          queryInterface.describeTable(tableName, options),
          queryInterface.getForeignKeyReferencesForTable(tableName, options),
          queryInterface.showIndex(tableName, options),
          queryInterface.queryGenerator.attributesToSQL(Model.tableAttributes, options),
        ]));
      }

      let results = await Promise.allSettled(promises);

      results = results.map((result) => {
        if (result.status === 'rejected')
          return null;

        return result.value.map((subResult) => {
          if (subResult.status === 'rejected')
            return null;

          return subResult.value;
        });
      });

      for (let i = 0, il = modelNames.length; i < il; i++) {
        let modelName     = modelNames[i];
        let Model         = models[modelName];
        let tableName     = Model.getTableName(options);
        let schemaResult  = results[i];

        dbSchema[modelName] = {
          dbAttributes:     this.convertDBTypesToLocalTypes(connection.getDialect(), schemaResult[0]),
          dbForeignKeys:    schemaResult[1],
          dbIndexes:        schemaResult[2],
          dbTypes:          this.convertDBTypesToLocalTypes(connection.getDialect(), queryInterface.queryGenerator.attributesToSQL(schemaResult[0], options)),
          modelTypes:       schemaResult[3],
          tableAttributes:  Model.tableAttributes,
          rawAttributes:    Model.fieldRawAttributesMap,
          modelName,
          Model,
          tableName,
        };
      }

      return dbSchema;
    }

    calculateModelSchemaDifferences(connection, schemaInfo, options) {
      let rawAttributes = schemaInfo.rawAttributes;
      let dbAttributes  = schemaInfo.dbAttributes;
      let fieldNames    = Object.keys(rawAttributes);
      let diff          = {
        tables: {
          add:    {},
        },
        columns: {
          add:    {},
          remove: {},
          alter:  {},
        },
        indexes: {
          add:    {},
          remove: {},
          alter:  {},
        },
        forignKeys: {
          add:    {},
          remove: {},
          alter:  {},
        },
      };

      if (dbAttributes == null) {
        // entire table doesn't exist
        diff.tables.add[schemaInfo.tableName] = schemaInfo.Model;
        return diff;
      }

      for (let i = 0, il = fieldNames.length; i < il; i++) {
        let fieldName = fieldNames[i];
        let modelAttribute  = rawAttributes[fieldName];
        let dbAttribute     = dbAttributes[fieldName];

        if (dbAttribute == null) {
          // add column
          diff.columns.add[fieldName] = modelAttribute;
        } else {
          // alter column
        }
      }

      // check for removed columns
      let dbFieldNames  = Object.keys(dbAttributes);
      for (let i = 0, il = fieldNames.length; i < il; i++) {
        let dbFieldName = dbFieldNames[i];
        let modelAttribute  = rawAttributes[dbFieldName];
        let dbAttribute     = dbAttributes[dbFieldName];

        if (modelAttribute == null) {
          // remove column
          diff.columns.remove[dbFieldName] = dbAttribute;
        }
      }

      debugger;

      return diff;
    }

    calculateDBSchemaDifferences(connection, models, dbSchema, options) {
      let modelNames  = Object.keys(models);
      let schemaDiff  = {};

      for (let i = 0, il = modelNames.length; i < il; i++) {
        let modelName = modelNames[i];
        let Model     = models[modelName];
        let tableName = Model.getTableName(options);
        let diff      = this.calculateModelSchemaDifferences(connection, dbSchema[modelName], options);
      }
    }

    async execute(args) {
      let options             = {};
      let application         = this.getApplication();
      let applicationOptions  = application.getOptions();
      let migrationsPath      = applicationOptions.migrationsPath;
      let connection          = application.getDBConnection();
      let models              = application.getModels();
      let migrationName       = args.name || 'noname';
      let dbSchema            = await this.getDBSchema(connection, models);
      let schemaDiff          = this.calculateDBSchemaDifferences(connection, models, dbSchema, options);

      // write migration to file
      // let info = MigrationUtils.writeMigration(
      //   currentState.revision,
      //   migration,
      //   migrationsPath,
      //   migrationName,
      //   (args.comment) ? args.comment : '',
      // );

      // console.log(`New migration to revision ${currentState.revision} has been saved to file '${info.filename}'`);
    }
  };
});
