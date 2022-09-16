'use strict';

/* global process */

const Nife              = require('nife');
const Path              = require('path');
const OS                = require('os');
const FileSystem        = require('fs');
const micromatch        = require('micromatch');
const { defineCommand } = require('./cli-utils');
const { Logger }        = require('../logger');
const { walkDir }       = require('../utils/file-utils');

module.exports = defineCommand('deploy', ({ Parent }) => {
  return class DeployCommand extends Parent {
    static applicationConfig = { database: false, logger: { level: Logger.LEVEL_ERROR } };

    static commandArguments() {
      return {
        help: {
          '@usage':     'mythix-cli deploy {target}',
          '@title':     'Deploy your application to the specified target',
          '--dry-run':  'Show what would be deployed without actually deploying',
        },
        runner: ({ $, Types }) => {
          $('--dry-run', Types.BOOLEAN());

          return $(
            /[\w-]+/,
            ({ store }, parsedResult) => {
              store({ target: parsedResult.value });
              return true;
            },
            {
              formatParsedResult: (result) => {
                return {
                  value: result[0],
                };
              },
            },
          );
        },
      };
    }

    async spawnCommand(dryRun, command, args, options) {
      if (dryRun) {
        console.log(`    (would run)$ ${command} ${args.join(' ')}`);
        return 0;
      } else {
        console.log(`    (running)$ ${command} ${args.join(' ')}`);
      }

      return await super.spawnCommand(command, args, options);
    }

    mkdirSync(dryRun, path) {
      if (!dryRun) {
        console.log(`    (running)$ mkdir -p ${path}`);
        FileSystem.mkdirSync(path, { recursive: true });
      } else {
        console.log(`    (would run)$ mkdir -p ${path}`);
      }
    }

    getRevisionNumber() {
      let date = new Date();
      return date.toISOString().replace(/\.[^.]+$/, '').replace(/\D/g, '');
    }

    collectFilesToDeploy(config) {
      const filterFunc = (context) => {
        const matchesAnyPattern = (patterns) => {
          for (let i = 0, il = patterns.length; i < il; i++) {
            let pattern = patterns[i];
            let result;

            if (typeof pattern === 'function')
              result = pattern(context);
            else if (pattern instanceof RegExp)
              result = pattern.test(relativeFileName);
            else if (Nife.instanceOf(pattern, 'string'))
              result = micromatch.isMatch(relativeFileName, pattern);

            if (result)
              return true;
          }

          return false;
        };

        let {
          relativeFileName,
        } = context;

        let shouldIncludeFile = true;

        // First check gitignore patterns
        // if that was requested
        if (useGitIgnore && matchesAnyPattern(useGitIgnore))
          shouldIncludeFile = false;

        if (Nife.isNotEmpty(include))
          shouldIncludeFile = matchesAnyPattern(include);

        if (Nife.isNotEmpty(exclude) && matchesAnyPattern(exclude))
          shouldIncludeFile = false;

        return shouldIncludeFile;
      };

      let {
        git,
        rootPath,
        include,
        exclude,
      } = config;

      let useGitIgnore = (git || {}).useGitIgnore;

      if (Nife.isEmpty(include)) {
        include = [
          'app/**',
          'package.json',
        ];
      }

      if (Nife.isEmpty(exclude)) {
        exclude = [
          '**/node_modules/**',
          '.git',
        ];
      }

      return walkDir(rootPath, {
        filter: (fullFileName, fileName, stats) => {
          let relativeFileName = fullFileName.substring(rootPath.length).replace(/^[/\\]/, '');

          return filterFunc({
            relativeFileName,
            fullFileName,
            fileName,
            stats,
          });
        },
      });
    }

    async getRepositoryURL(remoteName) {
      let result = await this.spawnCommand(false, 'git', [ 'remote', '-v' ]);
      result = result.stdout.split(/\r\n|\n|\r/g).filter((line) => {
        return (/\(fetch\)$/).test(line);
      }).map((line) => {
        let parts = line.trim().split(/\s+/);

        return {
          remoteName: parts[0],
          url:        parts[1],
        };
      });

      if (result.length === 0) {
        throw new Error('Unable to locate your repository URL. Please specify a "git: { repository: "{url}" }" in your deployment config.');
      } else if (result.length === 1) {
        return result[0].url;
      } else {
        let remotes = Nife.toLookup('remoteName', result);
        let remote  = remotes[remoteName];
        let url     = (remote && remote.url);

        if (Nife.isEmpty(url))
          throw new Error('Unable to locate your repository URL. You have multiple remotes setup in your git configuration. Please specify a "git: { remoteName: "{name}" }", or the repository directly ("git: { repository: "{url}" }") in your deployment config.');

        return url;
      }
    }

    async cloneProject(dryRun, deployConfig) {
      let {
        git,
        tempLocation,
        rootPath,
      } = deployConfig;

      let {
        branch,
        repository,
      } = (git || {});

      rootPath = rootPath.replace(/[/\\]+$/, '');

      let targetPath = Path.join(tempLocation, 'project');

      if (true) {
        let copyCommand;

        if (process.platform === 'win32') {
          copyCommand = {
            command:  'xcopy',
            args:     [
              rootPath,
              `${targetPath}${Path.sep}`,
              '/H',
              '/E',
              '/Y',
              '/K',
              '/I',
            ],
          };
        } else {
          copyCommand = {
            command:  'cp',
            args:     [
              '-a',
              rootPath,
              targetPath,
            ],
          };
        }

        await this.spawnCommand(dryRun, copyCommand.command, copyCommand.args);
      } else {

      }
    }

    async cleanup(dryRun, deployConfig) {
      let { tempLocation } = deployConfig;
      let removeCommand;

      tempLocation = tempLocation.replace(/[/\\]+$/, '');

      if (process.platform === 'win32') {
        removeCommand = {
          command:  'rmdir',
          args:     [
            tempLocation,
            '/Q',
            '/S',
          ],
        };
      } else {
        removeCommand = {
          command:  'rm',
          args:     [
            '-fr',
            tempLocation,
          ],
        };
      }

      await this.spawnCommand(dryRun, removeCommand.command, removeCommand.args);
    }

    async execute(args) {
      let application   = this.getApplication();
      let appName       = application.getApplicationName() || 'mythix';
      let configPath;
      let deployConfig;

      try {
        configPath = require.resolve(Path.resolve(process.cwd(), '.mythix-deploy'));
        deployConfig = require(configPath);
        if (deployConfig.__esModule)
          deployConfig = deployConfig['default'];

        if (!Object.prototype.hasOwnProperty.call(deployConfig, args.target)) {
          console.error(`The specified deploy target "${args.target}" doesn't exist in the deploy config "${configPath}"`);
          return 1;
        }

        deployConfig = deployConfig[args.target];

        if (Nife.isEmpty(deployConfig.targets)) {
          console.error('"targets" is required. "targets" in deployment configuration is empty.');
          return 1;
        }

        deployConfig.version = this.getRevisionNumber();

        if (!deployConfig.tempLocation)
          deployConfig.tempLocation = Path.join(OS.tmpdir(), 'mythix-cli', appName, deployConfig.version);

        if (!deployConfig.rootPath)
          deployConfig.rootPath = Path.dirname(configPath);

        let git = deployConfig.git || {};
        if (git.useGitIgnore) {
          let gitIgnorePath = Path.resolve(deployConfig.rootPath, '.gitignore');
          try {
            let useGitIgnore = FileSystem.readFileSync(gitIgnorePath, 'utf8');

            useGitIgnore = useGitIgnore.split(/(\r\n|\r|\n)+/g).filter((line) => {
              if ((/^\s*$/).test(line))
                return false;

              if ((/^\s*#/).test(line))
                return false;

              return line.trim();
            });

            git.useGitIgnore = useGitIgnore;
          } catch (error) {
            if (error.code === 'ENOENT') {
              console.error(`"git: { useGitIgnore: true }" was set in the deploy configuration, but unable to find "${gitIgnorePath}"`);
              return 1;
            }

            console.error(error);
            return 1;
          }
        }
      } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
          if (!configPath)
            configPath = Path.resolve(process.cwd(), '.mythix-deploy.js');

          console.error(`Unable to find deployment config "${configPath}"`);
          return 1;
        }

        console.error(error);
        return 1;
      }

      let filesToDeploy = this.collectFilesToDeploy(deployConfig);
      if (Nife.isEmpty(filesToDeploy)) {
        console.error('Nothing to deploy');
        return 1;
      }

      let dryRun = args.dryRun;
      let {
        git,
        tempLocation,
      } = deployConfig;

      let {
        branch,
        remoteName,
        repository,
      } = (git || {});

      if (dryRun) {
        console.log('------------ DRY RUN ------------');
        console.log(`----- Deploy ${deployConfig.version} -----`);
        console.log('');
        console.log(`  Application name: ${appName}`);
        console.log('');
        console.log(`  Temporary file location: ${deployConfig.tempLocation}`);
        console.log('');
        console.log(`  Project file location: ${deployConfig.rootPath}`);
        console.log('');
        console.log('  Targets:');

        let targets = deployConfig.targets;
        for (let i = 0, il = targets.length; i < il; i++) {
          let target = targets[i];
          console.log(`    -> ${target}`);
        }

        console.log('');
        console.log('  Files:');

        for (let i = 0, il = filesToDeploy.length; i < il; i++) {
          let fileName          = filesToDeploy[i];
          let relativeFileName  = fileName.substring(deployConfig.rootPath.length).replace(/^[/\\]+/, '');

          console.log(`    -> ./${relativeFileName}`);
        }

        if (Nife.isEmpty(branch)) {
          console.log('');
          console.log('  !!!WARNING!!! "branch" is not set in your deploy configuration. The current file structure will be deployed "as-is". It is highly recommended that you set a "branch" in your deploy configuration.');
        }

        console.log('');

        console.log('  Command log:');
      }

      try {
        this.mkdirSync(dryRun, tempLocation);
        this.mkdirSync(dryRun, Path.join(tempLocation, deployConfig.version));

        if (Nife.isNotEmpty(branch) && Nife.isEmpty(repository)) {
          repository = await this.getRepositoryURL(remoteName);
          if (git)
            git.repository = repository;
        }

        await this.cloneProject(dryRun, deployConfig);
      } catch (error) {
        console.error(error);
        return 1;
      } finally {
        try {
          await this.cleanup(dryRun, deployConfig);
        } catch (error) {
          console.error('Error while attempting to clean up after operation: ', error);
        }
      }
    }
  };
});
