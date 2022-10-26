'use strict';

/* global process */

const Nife              = require('nife');
const Path              = require('path');
const OS                = require('os');
const FileSystem        = require('fs');
const { URL }           = require('url');
const micromatch        = require('micromatch');
const { defineCommand } = require('./cli-utils');
const { Logger }        = require('../logger');
const { walkDir }       = require('../utils/file-utils');

const DEFAULT_SSH_PORT                = 22;
const LATEST_DEPLOY_VERSIONS_TO_KEEP  = 5;

module.exports = defineCommand('deploy', ({ Parent }) => {
  return class DeployCommand extends Parent {
    static applicationConfig = { database: false, logger: { level: Logger.LEVEL_ERROR } };

    static commandArguments() {
      return {
        help: {
          '@usage':       'mythix-cli deploy {target}',
          '@title':       'Deploy your application to the specified target',
          '--dry-run':    'Show what would be deployed without actually deploying',
          '--no-cleanup': 'File prep in the temporary file location will not be cleaned up after processing',
        },
        runner: ({ $, Types }) => {
          $('--dry-run', Types.BOOLEAN());
          $('--no-cleanup', Types.BOOLEAN());

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

    joinUnixPath(...args) {
      return args.join('/').replace(/\/{2,}/g, '/');
    }

    async spawnCommand(dryRun, command, args, options) {
      if (dryRun) {
        console.log(`    (would run)$ ${command} ${args.join(' ')}`);
        return 0;
      } else {
        console.log(`    (running)$ ${command} ${args.join(' ')}`);
      }

      try {
        return await super.spawnCommand(command, args, options);
      } catch (error) {
        if (error instanceof Error)
          throw error;

        throw new Error(error.error);
      }
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

    stripPostfixSlashFromPath(path) {
      return path.replace(/[/\\]+$/, '');
    }

    collectFilesToDeploy(rootPath, config) {
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

    async cleanup(dryRun, deployConfig) {
      let { tempLocation } = deployConfig;
      let removeCommand;

      tempLocation = this.stripPostfixSlashFromPath(tempLocation);

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

      await this.spawnCommand(false, removeCommand.command, removeCommand.args);
    }

    async cloneProject(deployConfig) {
      let {
        git,
        tempLocation,
        rootPath,
      } = deployConfig;

      let {
        branch,
        repository,
      } = (git || {});

      rootPath = this.stripPostfixSlashFromPath(rootPath);

      let targetPath = Path.join(tempLocation, 'project');

      if (!repository) {
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

        await this.spawnCommand(false, copyCommand.command, copyCommand.args);
      } else {
        let args = [
          'clone',
          repository,
        ];

        if (branch) {
          args.push('-b');
          args.push(branch);
        }

        args.push(targetPath);

        await this.spawnCommand(
          false,
          'git',
          args,
        );
      }
    }

    async postCloneProject() {

    }

    async copyFile(dryRun, sourceFilePath, targetFilePath) {
      let targetDir = Path.dirname(targetFilePath);
      if (!FileSystem.existsSync(targetDir))
        await this.mkdirSync(false, targetDir);

      console.log(`    (running)$ cp ${sourceFilePath} ${targetFilePath}`);
      FileSystem.copyFileSync(sourceFilePath, targetFilePath);
    }

    async copyProjectFilesToDeployFolder(deployConfig) {
      let {
        tempLocation,
        version,
        dryRun,
      } = deployConfig;

      let projectLocation       = Path.join(tempLocation, 'project');
      let deployFolderLocation  = Path.join(tempLocation, ('' + version));

      let filesToDeploy = this.collectFilesToDeploy(projectLocation, deployConfig);
      if (Nife.isEmpty(filesToDeploy)) {
        console.error('Nothing to deploy');
        return 1;
      }

      for (let i = 0, il = filesToDeploy.length; i < il; i++) {
        let sourcePath        = filesToDeploy[i];
        let relativeFilePath  = sourcePath.substring(projectLocation.length).replace(/^[/\\]+/, '');
        let targetPath        = Path.join(deployFolderLocation, relativeFilePath);

        await this.copyFile(dryRun, sourcePath, targetPath);
      }
    }

    async installModulesForApp(target, deployConfig) {
      let {
        tempLocation,
        version,
        installModulesCommand,
      } = deployConfig;

      let {
        remoteLocation,
      } = target;

      let deployLocation = Path.join(tempLocation, ('' + version));

      if (!installModulesCommand) {
        let yarnLockLocation = Path.join(deployLocation, 'yarn.lock');
        if (FileSystem.existsSync(yarnLockLocation))
          installModulesCommand = { command: 'bash', args: [ '--login', '-c', '"yarn --prod"' ] };
        else
          installModulesCommand = { command: 'bash', args: [ '--login', '-c', '"npm i --omit=dev"' ] };
      } else if (Nife.isEmpty(typeof installModulesCommand !== 'function' && Nife.isEmpty(installModulesCommand.command))) {
        throw new Error('You specified a "installModulesCommand" in your deploy config, but no "command" property found... you need to specify "installModulesCommand" as an object "{ installModulesCommand: { command: "npm", args: [ "i" ] } }", or as a function.');
      }

      if (typeof installModulesCommand === 'function') {
        await installModulesCommand(deployConfig);
      } else {
        await this.executeRemoteCommands(target, deployConfig, [
          { sudo: false, command: 'cd', args: [ `"${remoteLocation}"` ]},
          installModulesCommand,
        ]);
      }
    }

    // eslint-disable-next-line no-unused-vars
    async prepProjectPreDeploy(deployConfig) {
    }

    async archiveProject(deployConfig) {
      let {
        dryRun,
        tempLocation,
        version,
      } = deployConfig;

      let archiveLocation = deployConfig.archiveLocation = Path.join(tempLocation, `${version}.tar.gz`);

      await this.spawnCommand(
        dryRun,
        'tar',
        [
          '-czf',
          archiveLocation,
          `.${Path.sep}${version}`,
        ],
        {
          cwd: tempLocation,
          env: {
            pwd: tempLocation,
          },
        },
      );
    }

    getTargetInfo(target) {
      let {
        uri,
        ssh,
        scp,
        restartService,
      } = target;

      if (!ssh)
        ssh = { command: 'ssh' };

      if (!scp)
        scp = { command: 'scp' };

      if (Nife.isEmpty(ssh.command))
        ssh.command = 'ssh';

      if (Nife.isEmpty(scp.command))
        scp.command = 'scp';

      let port = target.port || uri.port;
      if (!port) {
        port = DEFAULT_SSH_PORT;
      } else {
        port = parseInt(port, 10);
        if (!isFinite(port))
          port = DEFAULT_SSH_PORT;
      }

      return {
        origin:   uri.origin,
        protocol: (uri.protocol || '').replace(/:+$/, ''),
        username: uri.username,
        password: uri.password,
        host:     uri.host,
        hostname: uri.hostname,
        pathname: uri.pathname,
        ...target,
        ssh,
        scp,
        restartService,
        port,
      };
    }

    substituteURLParams(target, value) {
      let substitutionMap = {
        TARGET_ORIGIN:      target.origin,
        TARGET_PROTOCOL:    target.protocol,
        TARGET_USERNAME:    target.username,
        TARGET_PASSWORD:    target.password,
        TARGET_HOST:        target.host,
        TARGET_HOSTNAME:    target.hostname,
        TARGET_PORT:        target.port,
        TARGET_PATHNAME:    this.stripPostfixSlashFromPath(target.pathname),
        TARGET_DEPLOY_PATH: target.remoteLocation,
      };

      let keys  = Object.keys(substitutionMap);
      let re    = new RegExp(`\\$\\{(${keys.join('|')})\\}`, 'g');

      return ('' + value).replace(re, (m, name) => {
        return substitutionMap[name];
      });
    }

    sudo(...args) {
      return (args.some((value) => (value === false))) ? '' : 'sudo ';
    }

    async executeRemoteCommands(target, deployConfig, commands, options) {
      let {
        dryRun,
      } = deployConfig;

      let {
        hostname,
        username,
        port,
        ssh,
      } = target;

      let {
        command,
        args,
      } = ssh;

      if (Nife.isEmpty(args)) {
        if (port !== DEFAULT_SSH_PORT)
          args = [ '-p', port ];
        else
          args = [];
      }

      let commandString = commands.map((command) => {
        if (Nife.isEmpty(command.args))
          return `${this.sudo(deployConfig)}${command.command}`;

        const escapeArgument = (arg) => {
          if (arg.indexOf('\'') < 0)
            return arg;

          return `'${this.substituteURLParams(target, arg).replace(/'/g, '\'')}'`;
        };

        return `${this.sudo(deployConfig, command.sudo)}${command.command} ${command.args.map(escapeArgument).join(' ')}`;
      }).join(' && ');

      if (options && Nife.isNotEmpty(options.sshArgs))
        args = args.concat(options.sshArgs);
      else
        args = args.concat([ '-t', '-q' ]);

      if (Nife.isNotEmpty(args))
        args = args.map((arg) => this.substituteURLParams(target, arg));

      return await this.spawnCommand(
        dryRun,
        command,
        args.concat([
          (Nife.isNotEmpty(username)) ? `'${username}@${hostname}'` : `'${hostname}'`,
          `'${commandString}'`,
        ]),
      );
    }

    async iterateDeployTargets(deployConfig, callback, options) {
      const invokeCallback = (_target, index) => {
        let target = this.getTargetInfo(_target);
        return callback({
          ...target,
          index,
          remoteLocation: this.joinUnixPath(decodeURIComponent(target.pathname), ('' + deployConfig.version)),
        }, deployConfig);
      };

      let targets         = deployConfig.targets;
      let parallelDeploy  = (options && typeof options.parallelDeploy === 'boolean') ? options.parallelDeploy : deployConfig.parallelDeploy;

      if (parallelDeploy !== false) {
        let promises = [];

        for (let i = 0, il = targets.length; i < il; i++) {
          let target = targets[i];
          promises.push(invokeCallback(target, i));
        }

        return await Promise.all(promises);
      } else {
        let results = [];

        for (let i = 0, il = targets.length; i < il; i++) {
          let target = targets[i];
          results.push(await invokeCallback(target, i));
        }

        return results;
      }
    }

    async allRemotesPreDeploy(deployConfig) {
      return await this.iterateDeployTargets(deployConfig, this.remotePreDeploy.bind(this));
    }

    async remotePreDeploy(target, deployConfig) {
      if (typeof target.preDeploy === 'function')
        return await target.preDeploy.call(this, target, deployConfig);

      await this.executeRemoteCommands(target, deployConfig, [
        { command: 'mkdir', args: [ '-p', this.joinUnixPath(decodeURIComponent(target.pathname), 'shared') ] },
      ]);
    }

    async allRemotesDeploy(deployConfig) {
      return await this.iterateDeployTargets(deployConfig, this.remoteDeploy.bind(this));
    }

    async copyFileToRemote(target, deployConfig, _filePath, options) {
      let filePath = _filePath;
      let fileName = Path.basename(filePath);

      let {
        dryRun,
        tempLocation,
      } = deployConfig;

      let {
        hostname,
        username,
        port,
        scp,
      } = target;

      let {
        command,
        args,
      } = scp;

      if (Nife.isEmpty(args)) {
        if (port !== DEFAULT_SSH_PORT)
          args = [ '-P', port ];
        else
          args = [];
      }

      if (!dryRun && options && typeof options.substituteContent === 'function') {
        let content = FileSystem.readFileSync(filePath, 'utf8');
        content = options.substituteContent.call(this, content);

        await this.mkdirSync(false, tempLocation);

        filePath = Path.join(tempLocation, fileName);
        FileSystem.writeFileSync(filePath, content, 'utf8');
      }

      await this.spawnCommand(
        dryRun,
        command,
        args.concat([
          `'${filePath}'`,
          (Nife.isNotEmpty(username)) ? `'${username}@${hostname}:/tmp/'` : `'${hostname}:/tmp/'`,
        ]),
      );

      return `/tmp/${fileName}`;
    }

    async copyArchiveToRemote(target, deployConfig) {
      let {
        archiveLocation,
      } = deployConfig;

      if (!deployConfig.archiveLocation)
        throw new Error('Unable to find the location of the archive to send to the remote server');

      let remoteArchiveLocation = await this.copyFileToRemote(target, deployConfig, archiveLocation);

      let archiveFileName = Path.basename(archiveLocation);
      let sourceLocation = remoteArchiveLocation;
      let targetLocation = `"${decodeURIComponent(target.pathname)}/"`;

      await this.executeRemoteCommands(target, deployConfig, [
        { command: 'cp', args: [ sourceLocation, targetLocation ] },
        { command: 'rm -f', args: [ `"/tmp/${archiveFileName}"` ] },
        { command: 'cd', args: [ targetLocation ], sudo: false },
        { command: 'tar', args: [ '-xf', `"./${archiveFileName}"` ] },
        { command: 'rm -f', args: [ `"./${archiveFileName}"` ] },
      ]);
    }

    async remoteDeploy(target, deployConfig) {
      if (typeof target.deploy === 'function')
        return await target.deploy.call(this, target, deployConfig);

      await this.copyArchiveToRemote(target, deployConfig);
    }

    async allRemotesPostDeploy(deployConfig) {
      return await this.iterateDeployTargets(deployConfig, this.remotePostDeploy.bind(this));
    }

    async remotePostDeploy(target, deployConfig) {
      if (typeof target.postDeploy === 'function')
        return await target.postDeploy.call(this, target, deployConfig);

      let {
        relativeConfigPath,
      } = deployConfig;

      if (relativeConfigPath) {
        let deployLocation    = this.joinUnixPath(decodeURIComponent(target.pathname), '' + deployConfig.version);
        let targetConfigPath  = this.joinUnixPath(decodeURIComponent(target.pathname), 'shared', 'config');
        let sourceConfigPath  = this.joinUnixPath(deployLocation, relativeConfigPath);
        let nodeModulesLink   = this.joinUnixPath(targetConfigPath, 'node_modules');

        // Ensure shared/config exists
        await this.executeRemoteCommands(target, deployConfig, [
          { command: 'test', args: [ '!', '-d', `"${targetConfigPath}"`, '&&', `${this.sudo(deployConfig)}cp -a "${sourceConfigPath}" "${targetConfigPath}"`, '|| true' ] },
        ]);

        // Ensure shared/config/node_modules symlink exists
        await this.executeRemoteCommands(target, deployConfig, [
          { command: 'test', args: [ '!', '-e', `"${nodeModulesLink}"`, '&&', `{ cd "${targetConfigPath}"; ${this.sudo(deployConfig)}ln -s "../../current/node_modules" "node_modules"; }`, '|| true' ] },
        ]);

        // Remove app/config and symlink to ../shared/app/config
        await this.executeRemoteCommands(target, deployConfig, [
          { command: 'rm', args: [ '-fr', `"${sourceConfigPath}"` ] },
          { command: 'ln', args: [ '-s', `"${targetConfigPath}"`, `"${sourceConfigPath}"` ] },
        ]);
      }

      await this.installModulesForApp(target, deployConfig);
    }

    async allRemotesFinalizeDeploy(deployConfig) {
      return await this.iterateDeployTargets(
        deployConfig,
        this.remoteFinalizeDeploy.bind(this),
        { parallelDeploy: false },
      );
    }

    async cleanupOldDeployVersions(target, deployConfig) {
      let deployLocation = decodeURIComponent(target.pathname);

      let result = await this.executeRemoteCommands(target, deployConfig, [
        { command: 'ls', args: [ '-1', `"${deployLocation}"`, '|', 'grep', '-P', '"\\d+"' ] },
      ]);

      let versions          = (result.stdout || '').split(/\n+/g).map((part) => part.trim()).filter(Boolean).sort();
      let versionsToRemove  = versions.slice(0, -LATEST_DEPLOY_VERSIONS_TO_KEEP);

      if (Nife.isNotEmpty(versionsToRemove)) {
        versionsToRemove = versionsToRemove.map((part) => `"${this.joinUnixPath(deployLocation, part)}"`);

        await this.executeRemoteCommands(target, deployConfig, [
          { command: 'rm', args: [ '-fr' ].concat(versionsToRemove) },
        ]);
      }
    }

    async remoteFinalizeDeploy(target, deployConfig) {
      if (typeof target.finalizeDeploy === 'function')
        return await target.finalizeDeploy.call(this, target, deployConfig);

      // Finally, upon success, swap the "current" symlink to
      // point to the new deploy
      let deployLocation      = this.joinUnixPath(decodeURIComponent(target.pathname), '' + deployConfig.version);
      let currentLinkLocation = this.joinUnixPath(decodeURIComponent(target.pathname), 'current');
      await this.executeRemoteCommands(target, deployConfig, [
        { command: 'rm', args: [ '-f', `"${currentLinkLocation}"` ] },
        { command: 'ln', args: [ '-s', `"${deployLocation}"`, `"${currentLinkLocation}"` ] },
      ]);

      if (target.index === 0) {
        let targetLocation = `"${decodeURIComponent(target.pathname)}/current"`;

        let serviceUser   = target.serviceUser || target.uri.username;
        let serviceGroup  = target.serviceGroup || serviceUser;

        await this.executeRemoteCommands(target, deployConfig, [
          { sudo: false, command: 'cd', args: [ targetLocation ] },
          { sudo: false, command: 'sudo', args: [ '-u', serviceUser, '-g', serviceGroup, `NODE_ENV=${deployConfig.target} mythix-cli migrate` ] },
        ]);
      }

      // Cleanup old deploy versions
      await this.cleanupOldDeployVersions(target, deployConfig);

      if (Nife.isNotEmpty(target.restartService)) {
        await this.executeRemoteCommands(target, deployConfig, [
          target.restartService,
        ]);
      } else {
        console.log(`    !!!NOTICE!!! "restartService" command is not defined on your deploy "targets[${target.index}]". Your service will not be automatically restarted. Please make sure to manually restart your application service on this remote target.`);
      }
    }

    async loadDeployConfig(args) {
      let application = this.getApplication();
      let appOptions  = application.getOptions();
      let appName     = application.getApplicationName() || 'mythix';
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
          console.error('"targets" is empty in your deploy config. "targets" is required, and must specify at least one remote target to deploy to.');
          return 1;
        }

        if (!Nife.instanceOf(deployConfig.targets, 'array')) {
          console.error('"targets" is not an array. "targets" in your deploy config must be an array of remote targets.');
          return 1;
        }

        deployConfig.target = args.target;

        deployConfig.targets = deployConfig.targets.filter(Boolean).map((target) => {
          if (Nife.instanceOf(target, 'string')) {
            return {
              rawURI: ('' + target),
              uri:    new URL('' + target),
            };
          }

          if (!Nife.instanceOf(target, 'object'))
            throw new Error(`Bad value detected in "targets" in deploy config: "${target}". All targets must either be a string (URI), or an object with a "uri" property.`);

          return {
            ...target,
            rawURI: ('' + target.uri),
            uri:    new URL('' + target.uri),
          };
        });

        deployConfig.targets.forEach((target, index) => {
          let { uri, rawURI } = target;
          if (Nife.isEmpty(uri.hostname))
            throw new Error(`Bad "uri" specified for "targets[${index}]": "${rawURI}". No "hostname" found.`);

          if (Nife.isEmpty(uri.pathname))
            throw new Error(`Bad "uri" specified for "targets[${index}]": "${rawURI}". No "pathname" found.`);
        });

        deployConfig.dryRun = args.dryRun;
        deployConfig.version = this.getRevisionNumber();

        if (!deployConfig.tempLocation)
          deployConfig.tempLocation = Path.join(OS.tmpdir(), 'mythix-cli', appName, deployConfig.version);

        if (!deployConfig.rootPath)
          deployConfig.rootPath = Path.dirname(configPath);

        if (appOptions.configPath)
          deployConfig.relativeConfigPath = appOptions.configPath.substring(deployConfig.rootPath.length).replace(/^[/\\.]+/, '').replace(/[/\\]+$/, '');

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

        return deployConfig;
      } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
          if (!configPath)
            configPath = Path.resolve(process.cwd(), '.mythix-deploy.js');

          throw new Error(`Unable to find deployment config "${configPath}"`);
        }

        throw error;
      }
    }

    log(str, ...args) {
      console.log(`    (log)! ${str}`, ...args);
    }

    async execute(args) {
      let application   = this.getApplication();
      let appName       = application.getApplicationName() || 'mythix';
      let deployConfig;

      try {
        deployConfig = await this.loadDeployConfig(args);
      } catch (error) {
        console.error(error.message);
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
        console.log('|-------------- DRY RUN --------------|');
        console.log('| 1. Temporary files will be created  |');
        console.log('| 2. Repository will be cloned        |');
        console.log('| 3. Files will be archived           |');
        console.log('| 4. Will verify SSH connections      |');
        console.log('| 5. Will *NOT* actually deploy app   |');
        console.log('| 6. Will *NOT* migrate database      |');
        console.log('|-------------------------------------|');
        console.log('');
      }

      console.log(`-------- Deploy ${deployConfig.version} --------`);
      console.log(`  Application name: ${appName}`);
      console.log(`  Application config location: ${(deployConfig.relativeConfigPath) ? `./${deployConfig.relativeConfigPath}` : '<none>'}`);
      console.log(`  Temporary file location: ${deployConfig.tempLocation}`);
      console.log(`  Project file location: ${deployConfig.rootPath}`);
      console.log('');
      console.log('  Targets:');

      let targets = deployConfig.targets;
      for (let i = 0, il = targets.length; i < il; i++) {
        let target = targets[i];
        console.log(`    -> ${target.uri}`);
      }

      if (Nife.isEmpty(branch)) {
        console.log('');
        console.log('  !!!WARNING!!! "branch" is not set in your deploy configuration. The current file structure will be deployed "as-is". It is highly recommended that you set a "branch" in your deploy configuration.');
      }

      console.log('');

      console.log('  Command log:');

      try {
        this.mkdirSync(false, tempLocation);
        this.mkdirSync(false, Path.join(tempLocation, deployConfig.version));

        if (Nife.isNotEmpty(branch) && Nife.isEmpty(repository)) {
          repository = await this.getRepositoryURL(remoteName);
          if (git)
            git.repository = repository;
        }

        await this.cloneProject(deployConfig);
        await this.postCloneProject(deployConfig);
        await this.copyProjectFilesToDeployFolder(deployConfig);
        await this.prepProjectPreDeploy(deployConfig);
        await this.archiveProject(deployConfig);
        await this.allRemotesPreDeploy(deployConfig);
        await this.allRemotesDeploy(deployConfig);
        await this.allRemotesPostDeploy(deployConfig);
        await this.allRemotesFinalizeDeploy(deployConfig);

        console.log(`Deployment of version "${deployConfig.version}" completed successfully!`);
      } catch (error) {
        console.error(error);
        return 1;
      } finally {
        if (!args.noCleanup) {
          try {
            await this.cleanup(dryRun, deployConfig);
          } catch (error) {
            console.error('Error while attempting to clean up after operation: ', error);
          }
        }
      }
    }
  };
});
