'use strict';

const Path              = require('path');
const Nife              = require('nife');
const { defineCommand } = require('../cli-utils');
const { walkDir }       = require('../../utils/file-utils');

const TIMESTAMP_LENGTH        = 14;
const MILLISECONDS_PER_SECOND = 1000.0;

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
        let files = walkDir(migrationsPath, {
          filter: (fullFileName, fileName, stats) => {
            if (fileName.match(/^_/) && stats.isDirectory())
              return false;

            if (stats.isFile() && !fileName.match(/^\d{14}.*\.js$/))
              return false;

            return true;
          },
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

    getMigrationFilesFromRevision(migrationFiles, _revision, isRollback) {
      let revision = ('' + _revision);

      let index = migrationFiles.findIndex((fullFileName) => {
        let fileName = Path.basename(fullFileName);

        if (fileName.substring(0, TIMESTAMP_LENGTH) === revision)
          return true;

        return false;
      });

      if (index < 0)
        throw new Error(`Error, migration revision ${revision} not found. Aborting...`);

      return migrationFiles.slice((isRollback) ? index : index + 1);
    }

    async executeMigration(dbConnection, migrationFileName, useTransaction, rollback) {
      let migration = require(migrationFileName);
      let startTime = Nife.now();

      if (rollback) {
        await migration.down(dbConnection);
        await this.removeMigrationFromDB(migration.MIGRATION_ID);

        let seconds = ((Nife.now() - startTime) / MILLISECONDS_PER_SECOND).toFixed(2);
        console.log(`Rolled back migration ${migrationFileName} successfully in ${seconds} seconds`);
      } else {
        await migration.up(dbConnection);
        await this.storeSuccessfulMigrationToDB(migration.MIGRATION_ID);

        let seconds = ((Nife.now() - startTime) / MILLISECONDS_PER_SECOND).toFixed(2);
        console.log(`Migration ${migrationFileName} completed successfully in ${seconds} seconds`);
      }
    }

    async storeSuccessfulMigrationToDB(migrationID) {
      let MigrationModel = this.getApplication().getModel('Migration');

      await MigrationModel.create({ id: ('' + migrationID) });
    }

    async removeMigrationFromDB(migrationID) {
      try {
        let MigrationModel = this.getApplication().getModel('Migration');

        await MigrationModel.destroy({
          where: MigrationModel.prepareWhereStatement({ id: ('' + migrationID) }),
          limit: 1,
        });
      } catch (error) {
        return;
      }
    }

    async fetchLastMigrationIDFromDB() {
      try {
        let MigrationModel = this.getApplication().getModel('Migration');

        let lastMigrationModel = await MigrationModel.first(null, {
          order: [ [ 'id', 'DESC' ] ],
          limit: 1,
        });

        if (lastMigrationModel == null)
          return null;

        return lastMigrationModel.id;
      } catch (error) {
        return null;
      }
    }

    async execute(args) {
      const nextMigration = (doneCallback, _index) => {
        let index = _index || 0;
        if (index >= migrationFiles.length)
          return doneCallback();

        let migrationFileName = migrationFiles[index];

        if (rollback)
          console.log(`Undoing migration ${migrationFileName}...`);
        else
          console.log(`Running migration ${migrationFileName}...`);

        this.executeMigration(dbConnection, migrationFileName, useTransaction, rollback).then(
          () => nextMigration(doneCallback, index + 1),
          (error) => {
            console.error(`Error while running migration ${migrationFileName}: `, error);
            doneCallback(error);
          },
        );
      };

      let application         = this.getApplication();
      let applicationOptions  = application.getOptions();
      let dbConnection        = application.getDBConnection();
      let migrationsPath      = applicationOptions.migrationsPath;
      let migrationFiles      = this.getMigrationFiles(migrationsPath);
      let useTransaction      = args.transaction;
      let rollback            = args.rollback;
      let migrationID         = args.revision;

      if (!migrationID)
        migrationID = await this.fetchLastMigrationIDFromDB(dbConnection);

      if (migrationID)
        migrationFiles = this.getMigrationFilesFromRevision(migrationFiles, migrationID, rollback);

      if (args.rollback)
        migrationFiles = migrationFiles.reverse();

      if (migrationFiles.length === 0) {
        console.log('Nothing to migrate');
        return;
      }

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
