const Path              = require("path");
const { defineCommand } = require('../cli-utils');
const MigrationUtils    = require('./migration-utils');
const { walkDir }       = require('../../utils/file-utils');

module.exports = defineCommand('migrate', ({ Parent }) => {
  return class MigrateCommand extends Parent {
    static description      = 'Run all migrations that have not yet been ran';
    static commandArguments = `
      [-r,-revision:string(Start operation at revision specified. For rollbacks, this specifies the revision to stop at [inclusive])]
      [-rollback:boolean(Reverse migration order, rolling back each migration from latest to specified revision)=false(Default is false)]
      [-transaction:boolean(Use a DB transaction for migrations)=false(Default is false)]
    `;

    getMigrationFiles(migrationsPath) {
      try {
        var files = walkDir(migrationsPath, {
          filter: (fullFileName, fileName, stats) => {
            if (fileName.match(/^_/) && stats.isDirectory())
              return false;

            if (stats.isFile() && !fileName.match(/^\d{14}.*\.js$/))
              return false;

            return true;
          }
        });

        return files.sort();
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`No migrations found at ${migrationsPath}. Aborting...`);
          return [];
        }

        throw error;
      }
    }

    getMigrationFilesFromRevision(migrationFiles, _revision) {
      var revision = ('' + _revision);

      var index = migrationFiles.findIndex((fullFileName) => {
        var fileName = Path.basename(fullFileName);

        if (fileName.substring(0, 14) === revision)
          return true;

        return false;
      });

      if (index < 0)
        throw new Error(`Error, migration revision ${revision} not found. Aborting...`);

      return migrationFiles.slice(index);
    }

    // TODO: Needs better tracking against DB
    execute(args) {
      const nextMigration = (doneCallback, _index) => {
        var index = _index || 0;
        if (index >= migrationFiles.length)
          return doneCallback();

        var migrationFileName = migrationFiles[index];
        console.log(`Running migration ${migrationFileName}...`);

        MigrationUtils.executeMigration(queryInterface, migrationFileName, useTransaction, 0, rollback).then(
          () => nextMigration(doneCallback, index + 1),
          (error) => {
            console.error(`Error while running migration ${migrationFileName}: `, error);
            doneCallback(error);
          }
        );
      };

      var application         = this.getApplication();
      var applicationOptions  = application.getOptions();
      var migrationsPath      = applicationOptions.migrationsPath;
      var migrationFiles      = this.getMigrationFiles(migrationsPath);
      var useTransaction      = (args['transaction']) ? true : false;
      var rollback            = args.rollback;

      console.log('USING TRANSACTION: ', useTransaction, args['transaction']);

      if (args.revision)
        migrationFiles = this.getMigrationFilesFromRevision(migrationFiles, args.revision);

      if (args.rollback)
        migrationFiles = migrationFiles.reverse();

      var dbConnection    = application.getDBConnection();
      var queryInterface  = dbConnection.getQueryInterface();

      return new Promise((resolve, reject) => {
        nextMigration((error) => {
          if (error)
            return reject(error);

          resolve();
        });
      });
    }
  };
});
