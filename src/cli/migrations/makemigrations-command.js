'use strict';

const Path              = require('path');
const FileSystem        = require('fs');
const { defineCommand } = require('../cli-utils');
const MigrationUtils    = require('./migration-utils');

module.exports = defineCommand('makemigrations', ({ Parent }) => {
  return class MakeMigrationsCommand extends Parent {
    static description      = 'Create migration for current model schema';

    static commandArguments = `
      [-p,-preview:boolean(Preview what the generated migration would look like without migrating anything)]
      [-n,-name:string(Specify a name for your migration)]
      [-c,-comment:string(Specify a comment for your migration)]
    `;

    getRevisionNumber() {
      let date = new Date();
      return date.toISOString().replace(/\.[^.]+$/, '').replace(/\D/g, '');
    }

    execute(args) {
      let application         = this.getApplication();
      let applicationOptions  = application.getOptions();
      let migrationsPath      = applicationOptions.migrationsPath;

      // current state
      let currentState = {
        tables:   {},
        revision: this.getRevisionNumber(),
      };

      // load last state
      let previousState = {
        tables:   {},
        version:  0,
      };

      let hasMigrations = true;

      // try {
      //   previousState = JSON.parse(FileSystem.readFileSync(Path.join(migrationsPath, '_current.json')));
      // } catch (e) {
      //   hasMigrations = false;
      // }

      let dbConnection = application.getDBConnection();
      let models       = dbConnection.models;

      currentState.tables = MigrationUtils.reverseModels(dbConnection, models);

      let upActions   = MigrationUtils.sortActions(MigrationUtils.parseDifference(previousState.tables, currentState.tables));
      let downActions = MigrationUtils.sortActions(MigrationUtils.parseDifference(currentState.tables, previousState.tables), true);
      let migration   = MigrationUtils.getMigration(upActions, downActions);

      if (migration.commandsUp.length === 0) {
        console.log('No changes found');
        return;
      }

      // log migration actions
      migration.consoleOut.forEach((out) => {
        console.log(`[Actions] ${out}`);
      });

      if (args.preview) {
        console.log('Migration result:');
        console.log(`[ \n${migration.commandsUp.join(', \n')} \n];\n`);
        return;
      }

      // backup _current file
      // if (FileSystem.existsSync(Path.join(migrationsPath, '_current.json'))) {
      //   FileSystem.writeFileSync(
      //     Path.join(migrationsPath, '_current_bak.json'),
      //     FileSystem.readFileSync(Path.join(migrationsPath, '_current.json'))
      //   );
      // }

      // save current state
      currentState.version = previousState.version + 1;
      FileSystem.writeFileSync(Path.join(migrationsPath, '_current.json'), JSON.stringify(currentState, null, 2));

      let migrationName = args.name;
      if (!migrationName)
        migrationName = (hasMigrations) ? 'noname' : 'initial';

      // write migration to file
      let info = MigrationUtils.writeMigration(
        currentState.revision,
        migration,
        migrationsPath,
        migrationName,
        (args.comment) ? args.comment : '',
      );

      console.log(`New migration to revision ${currentState.revision} has been saved to file '${info.filename}'`);
    }
  };
});
