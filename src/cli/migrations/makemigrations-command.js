const Path              = require("path");
const FileSystem        = require("fs");
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
      var date = new Date();
      return date.toISOString().replace(/\.[^.]+$/, '').replace(/\D/g, '');
    }

    execute(args) {
      var application         = this.getApplication();
      var applicationOptions  = application.getOptions();
      var migrationsPath      = applicationOptions.migrationsPath;

      // current state
      var currentState = {
        tables:   {},
        revision: this.getRevisionNumber(),
      };

      // load last state
      var previousState = {
        tables:   {},
        version:  0,
      };

      var hasMigrations = true;

      // try {
      //   previousState = JSON.parse(FileSystem.readFileSync(Path.join(migrationsPath, '_current.json')));
      // } catch (e) {
      //   hasMigrations = false;
      // }

      var dbConnection = application.getDBConnection();
      var models       = dbConnection.models;

      currentState.tables = MigrationUtils.reverseModels(dbConnection, models);

      var upActions   = MigrationUtils.sortActions(MigrationUtils.parseDifference(previousState.tables, currentState.tables));
      var downActions = MigrationUtils.sortActions(MigrationUtils.parseDifference(currentState.tables, previousState.tables), true);
      var migration   = MigrationUtils.getMigration(upActions, downActions);

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
        console.log(`[ \n${migration.commandsUp.join(", \n")} \n];\n`);
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

      // write migration to file
      var info = MigrationUtils.writeMigration(
        currentState.revision,
        migration,
        migrationsPath,
        (args.name) ? args.name : (hasMigrations) ? 'noname' : 'initial',
        (args.comment) ? args.comment : '',
      );

      console.log(`New migration to revision ${currentState.revision} has been saved to file '${info.filename}'`);
    }
  };
});
