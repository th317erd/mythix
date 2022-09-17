/* eslint-disable key-spacing */

'use strict';

const Path              = require('path');
const FileSystem        = require('fs');
const Nife              = require('nife');
const { Utils }         = require('mythix-orm');
const { CommandBase }   = require('../cli-utils');

class ValidationError extends Error {}

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

class GenerateMigrationCommand extends CommandBase {
  static commandArguments() {
    return {
      help:   {
        '@usage': 'mythix-cli generate migration {operation} {operation args} [options]',
        '@title': 'Generate a migration file',
        '@examples':  [
          'mythix-cli generate migration add model User',
          'mythix-cli generate migration rename model User AdminUser',
          'mythix-cli generate migration remove model User',
          'mythix-cli generate migration add field User:age',
          'mythix-cli generate migration rename field User:age yearsLived',
          'mythix-cli generate migration remove field User:age',
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
          /[\w-]+/,
          ({ store }, parsedResult) => {
            store({ operation: parsedResult.value });
            return true;
          },
          { formatParsedResult: (result) => ({ value: result[0] }) },
        );

        if (!result)
          return false;

        result = $(
          /[\w-]+/,
          ({ store }, parsedResult) => {
            store({ entity: parsedResult.value });
            return true;
          },
          { formatParsedResult: (result) => ({ value: result[0] }) },
        );

        if (!result && fetch('operation') !== 'blank')
          return false;

        if (fetch('operation') === 'blank' && Nife.isEmpty(fetch('name'))) {
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
      args.entity,
      ...args.remaining,
    ];

    return `${args.version}-${this.formatMigrationName(name.join('-'))}.js`;
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

      console.log(`Would write content:\n${content}`);

      // FileSystem.writeFileSync(migrationWritePath, migrationSource, 'utf8');

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

  operationAddModels(args) {
    if (Nife.isEmpty(args.remaining))
      throw new ValidationError('No model name(s) provided. Try this instead: \n\nmythix-cli generate migration add models \'{model name}\' ...');

    let application       = this.getApplication();
    let connection        = application.getDBConnection();
    let queryGenerator    = connection.getQueryGenerator();
    let statements        = [];
    let reverseStatements = [];

    let modelNames = Utils.sortModelNamesByCreationOrder(connection, Nife.uniq(args.remaining));
    for (let i = 0, il = modelNames.length; i < il; i++) {
      let modelName = modelNames[i];
      let Model     = connection.getModel(modelName);

      let createTable = queryGenerator.generateCreateTableStatement(Model);
      statements.push(`    // Create ${modelName} table\n    await connection.query(\`\n${this.tabIn(createTable, 3)}\`,\n      { logger: console },\n    );`);

      let dropTable = queryGenerator.generateDropTableStatement(Model, { cascade: true });
      reverseStatements.push(`    // Drop ${modelName} table\n    await connection.query(\n      \`${dropTable.trim()}\`,\n      { logger: console },\n    );`);
    }

    return generateMigration(
      args.version,
      statements.join('\n\n'),
      reverseStatements.reverse().join('\n\n'),
    );
  }

  operationAddModel(args) {
    return this.operationAddModels(args);
  }
}

module.exports = GenerateMigrationCommand;
