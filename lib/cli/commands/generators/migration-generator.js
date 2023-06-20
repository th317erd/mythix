/* eslint-disable key-spacing */

import Path             from 'node:path';
import FileSystem       from 'node:fs';
import Nife             from 'nife';
import { Utils }        from 'mythix-orm';
import { CommandBase }  from '../../command-base.js';

class ValidationError extends Error {}

function generateMigration(migrationID, upCode, downCode) {
  let template =
`
const MIGRATION_ID = '${migrationID}';

export default {
  MIGRATION_ID,
  up: async function(connection, application) {
${upCode || ''}
  },
  down: async function(connection, application) {
${downCode || ''}
  },
};
`;

  return template;
}

export class GenerateMigrationCommand extends CommandBase {
  static getGeneratorName() {
    return 'migration';
  }

  static commandArguments() {
    return {
      help:   {
        '@usage': 'mythix-cli generate migration {operation} {operation args} [options]',
        '@title': 'Generate a migration file',
        '@examples':  [
          'mythix-cli generate migration add blank --name "my migration"',
          'mythix-cli generate migration add model User',
          'mythix-cli generate migration rename model User AdminUser',
          'mythix-cli generate migration drop model User',
          'mythix-cli generate migration add field User:age',
          'mythix-cli generate migration rename field User:age yearsLived',
          'mythix-cli generate migration drop field User:age',
        ],
        '-n={name} | -n {name} | --name={name} | --name {name}': 'Specify the name of the generated migration file',
        '-o={path} | -o {path} | --output={path} | --output {path}': 'Specify the name of the generated migration file',
      },
      runner: ({ $, Types, fetch, store }) => {
        const pathFormatter = (value) => Path.resolve(value);

        let application         = fetch('mythixApplication');
        let applicationOptions  = application.getOptions();

        $('--name', Types.STRING(), { name: 'name' })
          || $('-n', Types.STRING(), { name: 'name' });

        $('--output', Types.STRING(), { name: 'outputPath', format: pathFormatter })
          || $('-o', Types.STRING(), { name: 'outputPath', format: pathFormatter })
          || store('outputPath', Path.resolve(applicationOptions.migrationsPath));

        let result = $(
          /^(add|rename|drop)$/i,
          ({ store }, parsedResult) => {
            store({ operation: parsedResult.value.toLowerCase() });
            return true;
          },
          { formatParsedResult: (result) => ({ value: result[0] }) },
        );

        if (!result)
          return false;

        result = $(
          /^(models?|fields?|blank)$/i,
          ({ store }, parsedResult) => {
            let entity = parsedResult.value.toLowerCase();
            if (entity === 'models')
              entity = 'model';

            if (entity === 'fields')
              entity = 'field';

            store({ entity });
            return true;
          },
          { formatParsedResult: (result) => ({ value: result[0] }) },
        );

        if (!result)
          return false;

        if (fetch('entity') === 'blank' && Nife.isEmpty(fetch('name'))) {
          console.log('Error: Blank templates require a name. Use the "--name {name}" argument to specify a name.\n');
          return false;
        }

        return true;
      },
    };
  }

  getRevisionNumber() {
    let date = new Date();
    return date.toISOString().replace(/\.[^.]+$/, '').replace(/\D/g, '');
  }

  formatMigrationName(name) {
    return name
      .replace(/\.\w+$/, '')
      .replace(/[^a-zA-Z0-9-]+/g, '-')
      .replace(/^[^a-zA-Z0-9]+/, '')
      .replace(/[^a-zA-Z0-9]+$/, '')
      .toLowerCase();
  }

  getOrGenerateMigrationName(args) {
    if (Nife.isNotEmpty(args.name))
      return `${args.version}-${this.formatMigrationName(args.name)}.js`;

    let name = [
      args.operation,
      (args.remaining.length > 1) ? `${args.entity}s` : args.entity,
      ...args.remaining,
    ];

    return `${args.version}-${this.formatMigrationName(name.join('-'))}.js`;
  }

  generateMigration(migrationID, upCode, downCode) {
    return generateMigration(migrationID, upCode, downCode);
  }

  async execute(args, fullArgs) {
    args.version = this.getRevisionNumber();
    args.remaining = fullArgs._remaining;

    // Ensure the output path exists
    try {
      let stats = FileSystem.statSync(args.outputPath);
      if (!stats.isDirectory())
        throw new Error(`The path specified is a file, not a directory: "${args.outputPath}"`);
    } catch (error) {
      if (error.code === 'ENOENT')
        FileSystem.mkdirSync(args.outputPath, { recursive: true });
      else
        throw error;
    }

    // Generate the migration name
    let migrationName = this.getOrGenerateMigrationName(args);
    let methodName    = `operation${Nife.capitalize(args.operation)}${(args.entity) ? Nife.capitalize(args.entity) : ''}`;
    if (typeof this[methodName] !== 'function') {
      console.error(`Error: unknown operation or entity specified: "${args.operation}${(args.entity) ? `:${args.entity}` : ''}"`);
      return 1;
    }

    try {
      let content   = await this[methodName](args);
      let finalPath = Path.join(args.outputPath, migrationName);

      //console.log(`Would write content:\n${content}`);
      FileSystem.writeFileSync(finalPath, content, 'utf8');

      console.log(`New migration to revision ${args.version} has been written to file "${finalPath}"`);
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error(error.message + '\n');
        return 1;
      }

      throw error;
    }
  }

  tabIn(str, amount = 1) {
    let parts = new Array(amount);
    for (let i = 0; i < amount; i++)
      parts.push('  ');

    let ws = parts.join('');
    return str.trim().replace(/^/gm, ws);
  }

  operationAddBlank(args) {
    return this.generateMigration(
      args.version,
    );
  }

  addOrDropModels(args, reverseOperation) {
    if (Nife.isEmpty(args.remaining))
      throw new ValidationError('No model name(s) provided. Try this instead: \n\nmythix-cli generate migration add models \'{model name}\' ...');

    let application       = this.getApplication();
    let connection        = application.getConnection();
    let queryGenerator    = connection.getQueryGenerator();
    let statements        = [];
    let reverseStatements = [];

    let modelNames = Utils.sortModelNamesByCreationOrder(connection, Nife.uniq(args.remaining));
    for (let i = 0, il = modelNames.length; i < il; i++) {
      let modelName = modelNames[i];
      let Model     = connection.getModel(modelName);

      // Create table
      let createTable = queryGenerator.generateCreateTableStatement(Model, { ifNotExists: true });
      statements.push(`    // Create "${Model.getTableName()}" table\n    await connection.query(\`\n${this.tabIn(createTable, 3)}\`,\n      { logger: console },\n    );`);

      // Create indexes and constraints
      let trailingStatements = Nife.toArray(queryGenerator.generateCreateTableStatementOuterTail(Model)).filter(Boolean);
      if (Nife.isNotEmpty(trailingStatements)) {
        for (let i = 0, il = trailingStatements.length; i < il; i++) {
          let trailingStatement = trailingStatements[i];
          statements.push(`    await connection.query(\n      \`${trailingStatement}\`,\n      { logger: console },\n    );`);
        }
      }

      let dropTable = queryGenerator.generateDropTableStatement(Model, { cascade: true });
      reverseStatements.push(`    // Drop "${Model.getTableName()}" table\n    await connection.query(\n      \`${dropTable.trim()}\`,\n      { logger: console },\n    );`);
    }

    if (reverseOperation) {
      return this.generateMigration(
        args.version,
        reverseStatements.reverse().join('\n\n'),
        statements.join('\n\n'),
      );
    } else {
      return this.generateMigration(
        args.version,
        statements.join('\n\n'),
        reverseStatements.reverse().join('\n\n'),
      );
    }
  }

  addOrDropFields(args, reverseOperation) {
    if (Nife.isEmpty(args.remaining))
      throw new ValidationError('No field name(s) provided. Try this instead: \n\nmythix-cli generate migration add fields \'{model name}:{field name}\' ...');

    let application       = this.getApplication();
    let connection        = application.getConnection();
    let queryGenerator    = connection.getQueryGenerator();
    let statements        = [];
    let reverseStatements = [];

    let fields = args.remaining.map((fieldName) => {
      let field = connection.getField(fieldName);
      if (!field)
        throw new ValidationError(`Unable to find requested field: "${fieldName}"`);

      return field;
    });

    for (let i = 0, il = fields.length; i < il; i++) {
      let field = fields[i];
      let Model = field.Model;

      // Create column
      let createColumn = queryGenerator.generateAddColumnStatement(field, { ifNotExists: true });
      statements.push(`    // Add "${Model.getTableName()}"."${field.columnName}" column\n    await connection.query(\n      \`${createColumn}\`,\n      { logger: console },\n    );`);

      let createIndexes = queryGenerator.generateColumnIndexes(Model, field, { ifNotExists: true });
      for (let j = 0, jl = createIndexes.length; j < jl; j++) {
        let createIndexStatement = createIndexes[j];
        statements.push(`    await connection.query(\n      \`${createIndexStatement.trim()}\`,\n      { logger: console },\n    );`);
      }

      // Drop column
      let dropColumn = queryGenerator.generateDropColumnStatement(field, { cascade: true, ifExists: true });
      reverseStatements.push(`    // Drop "${Model.getTableName()}"."${field.columnName}" column\n    await connection.query(\n      \`${dropColumn.trim()}\`,\n      { logger: console },\n    );`);
    }

    if (reverseOperation) {
      return this.generateMigration(
        args.version,
        reverseStatements.reverse().join('\n\n'),
        statements.join('\n\n'),
      );
    } else {
      return this.generateMigration(
        args.version,
        statements.join('\n\n'),
        reverseStatements.reverse().join('\n\n'),
      );
    }
  }

  operationAddModel(args) {
    return this.addOrDropModels(args, false);
  }

  operationDropModel(args) {
    return this.addOrDropModels(args, true);
  }

  operationAddField(args) {
    return this.addOrDropFields(args, false);
  }

  operationDropField(args) {
    return this.addOrDropFields(args, true);
  }
}
