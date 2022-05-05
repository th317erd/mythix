'use strict';

const Path              = require('path');
const FileSystem        = require('fs');
const { defineCommand } = require('../cli-utils');

function generateMigration(migrationID, upCode, downCode) {
  let template =
`
const MIGRATION_ID = '${migrationID}';

module.exports = {
  MIGRATION_ID,
  up: async function(connection) {
${upCode}
  },
  down: async function(connection) {
${downCode}
  },
};
`;

  return template;
}

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

    async getDBSchema(connection) {
      let queryInterface  = connection.getQueryInterface();
      let promises        = [];
      let options         = {};
      let dbSchema        = [];

      connection.modelManager.forEachModel((Model) => {
        let modelName = Model.customName || Model.name;
        let tableName = Model.getTableName(options);

        dbSchema.push({
          Model,
          modelName,
          tableName,
        });

        promises.push(Promise.allSettled([
          queryInterface.describeTable(tableName, options),
          queryInterface.getForeignKeyReferencesForTable(tableName, options),
          queryInterface.showIndex(tableName, options),
          queryInterface.queryGenerator.attributesToSQL(Model.tableAttributes, options),
        ]));
      });

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

      for (let i = 0, il = dbSchema.length; i < il; i++) {
        let schema        = dbSchema[i];
        let Model         = schema.Model;
        let schemaResult  = results[i];

        dbSchema[i] = Object.assign({
          dbAttributes:     this.convertDBTypesToLocalTypes(connection.getDialect(), schemaResult[0]),
          dbForeignKeys:    schemaResult[1],
          dbIndexes:        schemaResult[2],
          dbTypes:          this.convertDBTypesToLocalTypes(connection.getDialect(), queryInterface.queryGenerator.attributesToSQL(schemaResult[0], options)),
          modelTypes:       schemaResult[3],
          tableAttributes:  Model.tableAttributes,
          rawAttributes:    Model.fieldRawAttributesMap,
        }, schema);
      }

      return dbSchema;
    }

    calculateModelSchemaDifferences(connection, schemaInfo, options) {
      let tableAttributes       = schemaInfo.tableAttributes;
      let dbAttributes          = schemaInfo.dbAttributes;
      let fieldNames            = Object.keys(tableAttributes);
      let schemaChanged         = false;
      let Model                 = schemaInfo.Model;
      let fieldRawAttributesMap = Model.fieldRawAttributesMap;
      let rawAttributeMapKeys   = Object.keys(fieldRawAttributesMap);

      const fieldNameToDBColumnName = (fieldName) => {
        for (let i = 0, il = rawAttributeMapKeys.length; i < il; i++) {
          var columnName  = rawAttributeMapKeys[i];
          var field       = fieldRawAttributesMap[columnName];

          if (field.fieldName === fieldName)
            return columnName;
        }

        return null;
      };

      let diff = {
        tables: {
          add:    [],
        },
        columns: {
          add:    [],
          remove: [],
          alter:  [],
        },
        indexes: {
          add:    [],
          remove: [],
          alter:  [],
        },
        forignKeys: {
          add:    [],
          remove: [],
          alter:  [],
        },
      };

      if (dbAttributes == null) {
        // entire table doesn't exist
        diff.tables.add.push(Model);
        return diff;
      }

      for (let i = 0, il = fieldNames.length; i < il; i++) {
        let fieldName         = fieldNames[i];
        let columnName        = fieldNameToDBColumnName(fieldName);
        let columnDefinition  = tableAttributes[fieldName];
        let dbAttribute       = dbAttributes[columnName];

        if (dbAttribute == null) {
          schemaChanged = true;

          // add column
          diff.columns.add.push({ Model, columnDefinition, fieldName, columnName });
        } else {
          // schemaChanged = true;
          // alter column
        }
      }

      // check for removed columns
      // let dbFieldNames  = Object.keys(dbAttributes);
      // for (let i = 0, il = fieldNames.length; i < il; i++) {
      //   let dbFieldName     = dbFieldNames[i];
      //   let modelAttribute  = rawAttributes[dbFieldName];
      //   let dbAttribute     = dbAttributes[dbFieldName];

      //   if (modelAttribute == null) {
      //     schemaChanged = true;
      //     // remove column
      //     diff.columns.remove.push({ columnDefinition: modelAttribute, columnName: fieldName });
      //   }
      // }

      if (schemaChanged === false)
        return null;

      return diff;
    }

    calculateDBSchemaDifferences(connection, dbSchema, options) {
      let schemaDiff = [];
      let schemaChanged = false;

      for (let i = 0, il = dbSchema.length; i < il; i++) {
        let schema  = dbSchema[i];
        let diff    = this.calculateModelSchemaDifferences(connection, schema, options);

        if (diff == null)
          continue;

        schemaChanged = true;

        schemaDiff.push({
          schema,
          diff,
        });
      }

      if (schemaChanged === false)
        return null;

      return schemaDiff;
    }

    async execute(args) {
      let options             = {};
      let application         = this.getApplication();
      let applicationOptions  = application.getOptions();
      let connection          = application.getDBConnection();
      let dbSchema            = await this.getDBSchema(connection);
      let schemaDiff          = this.calculateDBSchemaDifferences(connection, dbSchema, options);

      if (schemaDiff == null) {
        console.log('No changes to schema detected. Aborting.');
        return;
      }

      let migrationsPath      = applicationOptions.migrationsPath;
      let migrationName       = args.name || 'noname';
      let migrationID         = this.getRevisionNumber();
      let migrationWritePath  = Path.join(migrationsPath, `${migrationID}-${migrationName}.js`);
      let migrationSource     = await this.generateMigrationFromDiff(connection, schemaDiff, migrationID);

      FileSystem.writeFileSync(migrationWritePath, migrationSource, 'utf8');

      console.log(`New migration to revision ${migrationID} has been written to file '${migrationWritePath}'`);
    }

    async _hijackConnection(dbConnection, callback) {
      let DialectQueryClass = dbConnection.dialect.Query;

      try {
        let sqlQueries = [];

        dbConnection.dialect.Query = class Query extends dbConnection.dialect.Query {
          constructor(connection, ...args) {
            let originalQuery = connection.query;

            connection.query = function(..._queryArgs) {
              let queryArgs     = _queryArgs.slice();
              let sql           = queryArgs[0];

              // eslint-disable-next-line no-magic-numbers
              let callbackIndex = (queryArgs.length === 3) ? 2 : 1;
              let cb            = queryArgs[callbackIndex];

              if (sql.match(/^\s*SELECT/)) {
                return originalQuery.apply(this, queryArgs);
              } else {
                sqlQueries.push(sql);
                cb(null, { rows: [] });
              }
            };

            super(connection, ...args);
          }
        };

        let result = await callback(dbConnection);

        return {
          queries: sqlQueries,
          result,
        };
      } finally {
        dbConnection.dialect.Query = DialectQueryClass;
      }
    }

    async generateMigrationFromDiff(connection, schemaDiff, migrationID) {
      const sanitizeString = (str) => {
        return str.replace(/'/g, '\\\'');
      };

      const createTable = async (Model) => {
        return await this._hijackConnection(connection, async () => {
          let attributes  = Model.tableAttributes;
          let options     = Model.options;
          let tableName   = Model.getTableName();

          return await queryInterface.createTable(tableName, attributes, options, Model);
        });
      };

      const addColumn = async (Model, columnDefinition, columnName) => {
        return await this._hijackConnection(connection, async () => {
          let options     = Model.options;
          let tableName   = Model.getTableName();

          return await queryInterface.addColumn(tableName, columnName, columnDefinition, options);
        });
      };

      const checkCreateTables = async (tablesToCreate) => {
        if (!tablesToCreate || tablesToCreate.length === 0)
          return;

        // Right now we only ever have one table to create for a given model
        let Model     = tablesToCreate[0];
        let tableName = Model.getTableName();
        let result    = await createTable(Model);

        result.queries.forEach((sql) => {
          upCodeParts.push(`    await connection.query('${sanitizeString(sql)}');\n`);
          downCodeParts.push(`    await connection.query('DROP TABLE IF EXISTS ${sanitizeString(queryInterface.quoteIdentifier(tableName))};');\n`);
        });
      };

      const checkAddColumns = async (columnsToAdd) => {
        if (!columnsToAdd || columnsToAdd.length === 0)
          return;

        let promises = [];
        for (let i = 0, il = columnsToAdd.length; i < il; i++) {
          let columnToAdd = columnsToAdd[i];
          if (columnToAdd == null)
            continue;

          let { Model, columnDefinition, columnName } = columnToAdd;
          promises.push(addColumn(Model, columnDefinition, columnName));
        }

        let results = await Promise.allSettled(promises);
        results = results.map((result) => {
          if (result.status === 'rejected')
            throw result.reason;

          return result.value;
        });

        for (let i = 0, il = results.length; i < il; i++) {
          let columnToAdd = columnsToAdd[i];
          if (columnToAdd == null)
            continue;

          let { columnName }  = columnToAdd;
          let result          = results[i];

          result.queries.forEach((sql) => {
            upCodeParts.push(`    await connection.query('${sanitizeString(sql)}');\n`);
            downCodeParts.push(`    await connection.query('DROP COLUMN IF EXISTS ${sanitizeString(queryInterface.quoteIdentifier(columnName))};');\n`);
          });
        }
      };

      let queryInterface  = connection.getQueryInterface();
      let upCodeParts     = [];
      let downCodeParts   = [];

      for (let i = 0, il = schemaDiff.length; i < il; i++) {
        let thisDiff  = schemaDiff[i];
        let diff      = thisDiff.diff;

        if (diff == null)
          continue;

        await checkCreateTables(diff.tables.add);
        await checkAddColumns(diff.columns.add);
      }

      let template = generateMigration(migrationID, upCodeParts.join('').trimEnd(), downCodeParts.reverse().join('').trimEnd());
      return template;
    }
  };
});
