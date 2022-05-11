'use strict';

const Path              = require('path');
const FileSystem        = require('fs');
const prompts           = require('prompts');
const Nife              = require('nife');
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

    // static nodeArguments    = [ '--inspect-brk' ];

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
      let models          = [];
      let dbTableSchema   = {};

      // First, fetch all tables from DB, and all info for these tables
      let allDBTables = await queryInterface.showAllTables(options);
      for (let i = 0, il = allDBTables.length; i < il; i++) {
        let dbTableName = allDBTables[i];

        promises.push(Promise.allSettled([
          queryInterface.describeTable(dbTableName, options),
          queryInterface.getForeignKeyReferencesForTable(dbTableName, options),
          queryInterface.showIndex(dbTableName, options),
        ]));
      }

      // Now wait on the results from the DB
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

      // Compile all table schemas into an object, keyed by table name
      for (let i = 0, il = results.length; i < il; i++) {
        let dbTableName = allDBTables[i];
        let result      = results[i];

        dbTableSchema[dbTableName] = {
          attributes:   this.convertDBTypesToLocalTypes(connection.getDialect(), result[0]),
          foreignKeys:  result[1],
          indexes:      result[2],
          types:        this.convertDBTypesToLocalTypes(connection.getDialect(), queryInterface.queryGenerator.attributesToSQL(result[0], options)),
        };
      }

      // Now build all model information
      connection.modelManager.forEachModel((Model) => {
        let modelName = Model.customName || Model.name;
        let tableName = Model.getTableName(options);

        models.push({
          modelTypes:       queryInterface.queryGenerator.attributesToSQL(Model.tableAttributes, options),
          tableAttributes:  Model.tableAttributes,
          rawAttributes:    Model.fieldRawAttributesMap,
          Model,
          modelName,
          tableName,
        });
      });

      return { allDBTables, dbTableSchema, models };
    }

    async calculateModelSchemaDifferences(connection, modelSchema, dbSchema, options) {
      const isColumnAltered = (fieldName, columnName, column, dbColumn) => {
        const nullish = (_value, toString) => {
          let value = (_value == null) ? null : _value;
          return (toString && value != null) ? ('' + value) : value;
        };

        if (columnName !== (column.field || fieldName))
          return true;

        if (column.autoIncrement !== true && Nife.get(column, 'defaultValue.key') === undefined && !Nife.instanceOf(column.defaultValue, 'function', 'object', 'array') && nullish(column.defaultValue, true) !== nullish(dbColumn.defaultValue, true))
          return true;

        if (nullish(column.comment) !== nullish(dbColumn.comment))
          return true;

        if (nullish(column.allowNull) !== nullish(dbColumn.allowNull))
          return true;

        if (column.type.toString() !== dbColumn.type)
          return true;

        return false;
      };

      debugger;

      let tableAttributes       = modelSchema.tableAttributes;
      let Model                 = modelSchema.Model;
      let tableName             = Model.getTableName();
      let fieldRawAttributesMap = Model.fieldRawAttributesMap;
      let rawAttributeMapKeys   = Object.keys(fieldRawAttributesMap);
      let dbTableInfo           = dbSchema.dbTableSchema[tableName];
      let dbAttributes          = (dbTableInfo) ? dbTableInfo.attributes : null;
      let fieldNames            = Object.keys(tableAttributes);
      let schemaChanged         = false;

      const fieldNameToDBColumnName = (fieldName) => {
        for (let i = 0, il = rawAttributeMapKeys.length; i < il; i++) {
          let columnName  = rawAttributeMapKeys[i];
          let field       = fieldRawAttributesMap[columnName];

          if (field.fieldName === fieldName)
            return columnName;
        }

        return null;
      };

      const isNewModel = (dbSchema, tableName) => {
        let allDBTables = dbSchema.allDBTables;
        if (allDBTables.length === 0)
          return true;

        if (allDBTables.indexOf(tableName) >= 0)
          return false;

        let found   = [];
        let models  = dbSchema.models;

        for (let i = 0, il = models.length; i < il; i++) {
          let { Model }     = models[i];
          let thisTableName = Model.getTableName();

          if (allDBTables.indexOf(thisTableName) >= 0)
            found.push(thisTableName);
        }

        if (found.length === allDBTables.length)
          return true;

        return null;
      };

      const isNewColumn = (dbAttributes, columnName) => {
        if (dbAttributes == null)
          return true;

        let dbColumnNames = Object.keys(dbAttributes);
        if (dbColumnNames.indexOf(columnName) >= 0)
          return false;

        let fieldNames  = Object.keys(fieldRawAttributesMap);
        let found       = [];

        for (let i = 0, il = fieldNames.length; i < il; i++) {
          let fieldName       = fieldNames[i];
          let modelAttribute  = fieldRawAttributesMap[fieldName];
          let columnName      = modelAttribute.field || fieldName;

          if (dbColumnNames.indexOf(columnName) >= 0)
            found.push(columnName);
        }

        if (found.length === dbColumnNames.length)
          return true;

        return null;
      };

      let diff = {
        tables: {
          add:    [],
          alter:  [],
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
        if (isNewModel(dbSchema, tableName) == null) {
          const response = await prompts([
            {
              type:     'select',
              name:     'operation',
              message:  `Ambiguity detected with table "${tableName}". Are you renaming this table, or adding a new table?`,
              choices:  [
                { title: 'Adding a new table', description: 'You are adding a new table', value: 'adding' },
                { title: 'Renaming a table', description: 'You are renaming an existing table', value: 'renaming' },
              ],
            },
            {
              type:     (prev) => {
                return (prev === 'renaming') ? 'text' : null;
              },
              name:     'oldTableName',
              message:  'What is the current name (in the database) of the table you are renaming?',
              validate: (value) => {
                if (value.match(/^[^\S]*$/))
                  return 'Must specify a table name';

                if (!Object.prototype.hasOwnProperty.call(dbSchema.dbTableSchema, value))
                  return `No such table "${value}" found in the database`;

                return true;
              },
              format:   (value) => {
                return value.trim();
              },
            },
          ]);

          if (response.operation === 'renaming') {
            let oldTableName = response.oldTableName;
            let newTableName = tableName;

            dbTableInfo = dbSchema.dbTableSchema[oldTableName];
            dbAttributes = (dbTableInfo) ? dbTableInfo.attributes : null;

            // table rename
            schemaChanged = true;
            diff.tables.alter.push({ operation: 'rename', Model, oldTableName, newTableName });
          } else {
            // entire table doesn't exist
            diff.tables.add.push(Model);
            return diff;
          }
        } else {
          // entire table doesn't exist
          diff.tables.add.push(Model);
          return diff;
        }
      }

      // Check for differences in columns
      for (let i = 0, il = fieldNames.length; i < il; i++) {
        let fieldName           = fieldNames[i];
        let columnName          = fieldNameToDBColumnName(fieldName);
        let columnDefinition    = tableAttributes[fieldName];
        let dbColumnDefinition  = (dbAttributes) ? dbAttributes[columnName] : null;
        let columnIsNew         = isNewColumn(dbAttributes, columnName);

        if (dbColumnDefinition == null && columnIsNew == null) {
          const response = await prompts([
            {
              type:     'select',
              name:     'operation',
              message:  `Ambiguity detected with column "${columnName}". Are you renaming this column, or adding a new column?`,
              choices:  [
                { title: 'Adding a new column', description: 'You are adding a new column', value: 'adding' },
                { title: 'Renaming a column', description: 'You are renaming an existing column', value: 'renaming' },
              ],
            },
            {
              type:     (prev) => {
                return (prev === 'renaming') ? 'text' : null;
              },
              name:     'oldColumnName',
              message:  'What is the current name (in the database) of the column you are renaming?',
              validate: (value) => {
                if (value.match(/^[^\S]*$/))
                  return 'Must specify a column name';

                if (!Object.prototype.hasOwnProperty.call(dbAttributes, value))
                  return `No such column "${value}" found in the "${tableName}" table`;

                return true;
              },
              format:   (value) => {
                return value.trim();
              },
            },
          ]);

          if (response.operation === 'renaming') {
            let oldColumnName = response.oldColumnName;
            let newColumnName = columnName;

            // column rename
            dbColumnDefinition = (dbAttributes) ? dbAttributes[oldColumnName] : null;
            schemaChanged = true;
            diff.columns.alter.push({ operation: 'rename', Model, oldColumnName, newColumnName, dbColumnDefinition, columnDefinition });
          } else {
            schemaChanged = true;
            diff.columns.add.push({ Model, columnDefinition, dbColumnDefinition, fieldName, columnName, tableName });
            continue;
          }
        }

        if (columnIsNew) {
          // add column
          schemaChanged = true;
          diff.columns.add.push({ operation: 'add', Model, columnDefinition, dbColumnDefinition, fieldName, columnName, tableName });
        } else if (isColumnAltered(fieldName, columnName, columnDefinition, dbColumnDefinition)) {
          // alter column

          schemaChanged = true;
          diff.columns.alter.push({ operation: 'alter', Model, columnDefinition, dbColumnDefinition, fieldName, columnName, tableName });
        }
      }

      if (dbAttributes != null) {
        // check for removed columns
        let dbFieldNames = Object.keys(dbAttributes);
        for (let i = 0, il = dbFieldNames.length; i < il; i++) {
          let dbFieldName     = dbFieldNames[i];
          let modelAttribute  = fieldRawAttributesMap[dbFieldName];

          if (modelAttribute == null) {
            schemaChanged = true;
            // remove column
            diff.columns.remove.push({ operation: 'remove', Model, columnDefinition: dbAttributes[dbFieldName], columnName: dbFieldName });
          }
        }
      }

      if (schemaChanged === false)
        return null;

      return diff;
    }

    async calculateDBSchemaDifferences(connection, dbSchema, options) {
      let schemaDiff    = [];
      let schemaChanged = false;
      let models        = dbSchema.models;

      for (let i = 0, il = models.length; i < il; i++) {
        let modelSchema = models[i];
        let diff        = await this.calculateModelSchemaDifferences(connection, modelSchema, dbSchema, options);

        if (diff == null)
          continue;

        schemaChanged = true;

        schemaDiff.push({
          modelSchema,
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
      let schemaDiff          = await this.calculateDBSchemaDifferences(connection, dbSchema, options);

      if (schemaDiff == null) {
        console.log('No changes to schema detected. Aborting.');
        return;
      }

      let migrationName = args.name;
      if (Nife.isEmpty(migrationName)) {
        console.error('Migration "name" required. Please supply the migration name via the "--name" argument and try again.');
        return;
      }

      migrationName = migrationName.replace(/\W+/g, '-').toLowerCase();

      let migrationsPath      = applicationOptions.migrationsPath;
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

      const generateUpAndDownFromResults = (_results) => {
        var results = _results;

        for (let i = 0, il = results.length; i < il; i++) {
          let result = results[i];
          result.up.queries.forEach((sql) => {
            upCodeParts.push(`    await connection.query('${sanitizeString(sql)}');\n`);
          });
        }

        results = results.reverse();

        for (let i = 0, il = results.length; i < il; i++) {
          let result = results[i];
          result.down.queries.forEach((sql) => {
            downCodeParts.push(`    await connection.query('${sanitizeString(sql)}');\n`);
          });
        }
      };

      const createTable = async (Model) => {
        return await this._hijackConnection(connection, async () => {
          let attributes  = Model.tableAttributes;
          let options     = Model.options;
          let tableName   = Model.getTableName();

          return await queryInterface.createTable(tableName, attributes, options, Model);
        });
      };

      const renameTable = async (oldTableName, newTableName) => {
        return await this._hijackConnection(connection, async () => {
          return await queryInterface.renameTable(oldTableName, newTableName);
        });
      };

      const addColumn = async (Model, columnDefinition, columnName) => {
        return await this._hijackConnection(connection, async () => {
          let options     = Model.options;
          let tableName   = Model.getTableName();

          return await queryInterface.addColumn(tableName, columnName, columnDefinition, options);
        });
      };

      const removeColumn = async (Model, columnDefinition, columnName) => {
        return await this._hijackConnection(connection, async () => {
          let options     = Model.options;
          let tableName   = Model.getTableName();

          return await queryInterface.removeColumn(tableName, columnName, columnDefinition, options);
        });
      };

      const alterColumn = async (Model, columnDefinition, columnName) => {
        return await this._hijackConnection(connection, async () => {
          let options     = Model.options;
          let tableName   = Model.getTableName();

          return await queryInterface.changeColumn(tableName, columnName, columnDefinition, options);
        });
      };

      const renameColumn = async (Model, columnDefinition, oldColumnName, newColumnName) => {
        return await this._hijackConnection(connection, async () => {
          let options     = Model.options;
          let tableName   = Model.getTableName();

          let oldAssertTableHasColumn = queryInterface.assertTableHasColumn;
          try {
            // Tell Sequelize to shut up
            queryInterface.assertTableHasColumn = async () => ({ [oldColumnName]: columnDefinition });

            return await queryInterface.renameColumn(tableName, oldColumnName, newColumnName, options);
          } finally {
            queryInterface.assertTableHasColumn = oldAssertTableHasColumn;
          }
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

      const checkAlterTables = async (tablesToAlter) => {
        if (!tablesToAlter || tablesToAlter.length === 0)
          return;

        let results = [];
        for (let i = 0, il = tablesToAlter.length; i < il; i++) {
          let tableToAlter = tablesToAlter[i];
          if (tableToAlter == null)
            continue;

          if (tableToAlter.operation === 'rename') {
            let { oldTableName, newTableName } = tableToAlter;
            let result = {
              up:   await renameTable(oldTableName, newTableName),
              down: await renameTable(newTableName, oldTableName),
            };

            results.push(result);
          }
        }

        generateUpAndDownFromResults(results);
      };

      const checkAddColumns = async (columnsToAdd) => {
        if (!columnsToAdd || columnsToAdd.length === 0)
          return;

        let results = [];
        for (let i = 0, il = columnsToAdd.length; i < il; i++) {
          let columnToAdd = columnsToAdd[i];
          if (columnToAdd == null)
            continue;

          let { Model, columnDefinition, columnName } = columnToAdd;
          let result = await addColumn(Model, columnDefinition, columnName);

          results.push(result);
        }

        for (let i = 0, il = results.length; i < il; i++) {
          let columnToAdd = columnsToAdd[i];
          if (columnToAdd == null)
            continue;

          let { columnName, tableName } = columnToAdd;
          let result                    = results[i];

          result.queries.forEach((sql) => {
            upCodeParts.push(`    await connection.query('${sanitizeString(sql)}');\n`);
            downCodeParts.push(`    await connection.query('ALTER TABLE ${sanitizeString(queryInterface.quoteIdentifier(tableName))} DROP COLUMN IF EXISTS ${sanitizeString(queryInterface.quoteIdentifier(columnName))} CASCADE;');\n`);
          });
        }
      };

      const checkAlterColumns = async (columnsToAlter) => {
        if (!columnsToAlter || columnsToAlter.length === 0)
          return;

        let results = [];
        for (let i = 0, il = columnsToAlter.length; i < il; i++) {
          let columnToAlter = columnsToAlter[i];
          if (columnToAlter == null)
            continue;

          let {
            operation,
            Model,
            columnDefinition,
            columnName,
            dbColumnDefinition,
            oldColumnName,
            newColumnName,
          } = columnToAlter;

          if (operation === 'rename') {
            let result = {
              up:   await renameColumn(Model, dbColumnDefinition || columnDefinition, oldColumnName, newColumnName),
              down: await renameColumn(Model, dbColumnDefinition || columnDefinition, newColumnName, oldColumnName),
            };

            results.push(result);
          } else if (operation === 'alter') {
            let result = {
              up:   await alterColumn(Model, columnDefinition, columnName),
              down: await alterColumn(Model, dbColumnDefinition, columnName),
            };

            results.push(result);
          }
        }

        generateUpAndDownFromResults(results);
      };

      const checkRemoveColumns = async (columnsToRemove) => {
        if (!columnsToRemove || columnsToRemove.length === 0)
          return;

        let results = [];
        for (let i = 0, il = columnsToRemove.length; i < il; i++) {
          let columnToAdd = columnsToRemove[i];
          if (columnToAdd == null)
            continue;

          let { Model, columnDefinition, columnName } = columnToAdd;
          let result = {
            up:   await removeColumn(Model, columnDefinition, columnName),
            down: await addColumn(Model, columnDefinition, columnName),
          };

          results.push(result);
        }

        generateUpAndDownFromResults(results);
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
        await checkAlterTables(diff.tables.alter);
        await checkAddColumns(diff.columns.add);
        await checkAlterColumns(diff.columns.alter);
        await checkRemoveColumns(diff.columns.remove);
      }

      let template = generateMigration(migrationID, upCodeParts.join('').trimEnd(), downCodeParts.reverse().join('').trimEnd());
      return template;
    }
  };
});
