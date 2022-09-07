'use strict';

/* global process, __dirname */

const Path        = require('path');
const FileSystem  = require('fs');
const Nife        = require('nife');
const { Logger }  = require('../logger');

const {
  walkDir,
  fileNameWithoutExtension,
} = require('../utils/file-utils');

const { CMDed } = require('cmded');

class CommandBase {
  constructor(application, options) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        application,
      },
      'options': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        options,
      },
    });
  }

  getOptions() {
    return this.options;
  }

  getApplication() {
    return this.application;
  }

  getLogger() {
    let app = this.getApplication();
    return app.getLogger();
  }

  getDBConnection() {
    let application = this.getApplication();
    return application.getDBConnection();
  }
}

let loadingAllCommandsInProgress = false;

function defineCommand(_commandName, definer, _parent) {
  if (!CommandBase.commands) {
    Object.defineProperties(CommandBase, {
      'commands': {
        writable:     false,
        enumerable:   false,
        configurable: true,
        value:        {},
      },
    });
  }

  let commandName = _commandName.toLowerCase();
  let parent      = _parent;

  let doExecuteCommand    = process.env['MYTHIX_EXECUTE_COMMAND'];
  let executeImmediately  = false;

  // Is this command script being executed directly?
  // If so, make certain to load all commands.
  // This is required, so that commands that inherit
  // from other commands will continue to work.
  if (doExecuteCommand === commandName && !loadingAllCommandsInProgress) {
    executeImmediately = true;

    let mythixCommandPath             = process.env['MYTHIX_COMMAND_PATH'];
    let mythixApplicationCommandsPath = process.env['MYTHIX_APPLICATION_COMMANDS'];
    if (mythixCommandPath && mythixApplicationCommandsPath)
      loadCommands(mythixApplicationCommandsPath, [ mythixCommandPath ]);
  }

  if (Nife.instanceOf(parent, 'string')) {
    if (!CommandBase.commands[parent])
      throw new Error(`Can not find parent class for command "${commandName}": No such parent class "${parent}" found`);

    parent = CommandBase.commands[parent];
  }

  let parentClass = parent || CommandBase;

  let Klass = definer({
    Parent: parentClass,
    commandName,
  });

  if (typeof Klass.prototype.execute !== 'function')
    throw new Error(`Error while defining command ${commandName}: "execute" method is required`);

  Klass.commandName = commandName;

  // Executor method. This gets invoked in a separate node process
  // The command script is executed directly via node when the
  // command is invoked via the CLI. The process starts at
  // "executeCommand" below, which spawns a node process that
  // targets this command script.
  Klass.execute = async function() {
    // eslint-disable-next-line new-cap
    let commandContext = CMDed((context) => {
      let { $, Types, store, scope } = context;

      // Parse these even though they are no longer needed
      // so that we ensure they are "consumed".
      $('--config', Types.STRING({
        format: Path.resolve,
      })) || store({ config: (Nife.isNotEmpty(process.env.MYTHIX_CONFIG_PATH)) ? Path.resolve(process.env.MYTHIX_CONFIG_PATH) : Path.join(process.env.PWD, '.mythix-config.js') });

      $('--runtime', Types.STRING());

      $('-e', Types.STRING(), { name: 'environment' });
      $('--env', Types.STRING(), { name: 'environment' });

      let runner = null;

      if (typeof Klass.commandArguments === 'function') {
        let result = (Klass.commandArguments() || {});
        runner = result.runner;
      }

      return scope(commandName, (context) => {
        if (typeof runner === 'function')
          return runner(context);

        return true;
      });
    });

    if (!commandContext)
      return;

    let application;

    try {
      let PWD               = process.env['PWD'];
      let mythixConfigPath  = commandContext.config || process.env['MYTHIX_CONFIG_PATH'];

      if (Nife.isEmpty(mythixConfigPath))
        mythixConfigPath = PWD;

      let config            = loadMythixConfig(mythixConfigPath);
      let Application       = config.getApplicationClass(config);
      let applicationConfig = Klass.applicationConfig;

      if (typeof applicationConfig === 'function')
        applicationConfig = applicationConfig(config, Application);
      else if (applicationConfig)
        applicationConfig = Nife.extend(true, { httpServer: false, autoReload: false, logger: { level: Logger.LEVEL_WARN }, runTasks: false }, applicationConfig);

      if (!applicationConfig)
        applicationConfig = { httpServer: false, autoReload: false, logger: { level: Logger.LEVEL_WARN }, runTasks: false };

      let doStartApplication = (applicationConfig.autoStart !== false);

      delete applicationConfig.autoStart;

      application = await createApplication(Application, Object.assign({ exitOnShutdown: 1 }, applicationConfig), false);

      let environment = commandContext.environment;
      if (Nife.isEmpty(environment))
        environment = application.getConfigValue('environment', 'development');

      application.setConfig({ environment: environment });

      if (doStartApplication)
        await application.start();

      let commandOptions  = commandContext[commandName] || {};
      let commandInstance = new Klass(application, commandOptions);
      let result          = await commandInstance.execute.call(commandInstance, commandOptions);

      await application.stop(result || 0);
    } catch (error) {
      console.log(`Error while executing command "${commandName}"`, error);

      if (application)
        await application.stop(1);
    }
  };

  CommandBase.commands[commandName] = Klass;

  // If this command file was loaded directly, and it was requested
  // that we execute it, then do so right now
  if (executeImmediately) {
    Klass.execute().then(() => {}, (error) => {
      console.log(error);
    });
  }

  return Klass;
}

async function createApplication(Application, opts) {
  let application = new Application(Object.assign({ cli: true }, opts || {}));

  if (Nife.isNotEmpty(opts))
    application.setOptions(Object.assign(opts || {}));

  return application;
}

function loadCommand(name) {
  let fullPath      = require.resolve(name);
  let CommandKlass  = require(fullPath);

  CommandKlass.path = fullPath;

  return CommandKlass;
}

function loadCommands(applicationCommandsPath, skip) {
  const getCommandFiles = (commandsPath) => {
    try {
      return walkDir(commandsPath, {
        filter: (fullFileName, fileName, stats) => {
          if (fileName.match(/^_/))
            return false;

          if (stats.isFile() && !fileNameWithoutExtension(fileName).match(/-command$/))
            return false;

          return true;
        },
      });
    } catch (error) {
      if (error.code === 'ENOENT')
        return [];

      console.error(error);
      throw error;
    }
  };

  if (loadingAllCommandsInProgress)
    return;

  loadingAllCommandsInProgress = true;

  let mythixCommandFiles      = getCommandFiles(Path.resolve(__dirname));
  let applicationCommandFiles = getCommandFiles(applicationCommandsPath);
  let allCommandFiles         = [].concat(mythixCommandFiles, applicationCommandFiles);

  allCommandFiles.forEach((commandPath) => {
    if (skip && skip.indexOf(commandPath) >= 0)
      return;


    loadCommand(commandPath);
  });

  loadingAllCommandsInProgress = false;

  return CommandBase.commands;
}

function resolveConfig(config) {
  let keys = Object.keys(config);
  for (let i = 0, il = keys.length; i < il; i++) {
    let key   = keys[i];
    let value = config[key];

    if (key.match(/Path/) && typeof value === 'function')
      value = value(config);

    config[key] = value;
  }

  return config;
}

function loadMythixConfig(_mythixConfigPath, _appRootPath) {
  let mythixConfigPath = _mythixConfigPath;
  let configPath        = mythixConfigPath;

  try {
    let stats = FileSystem.statSync(mythixConfigPath);
    if (stats.isDirectory())
      configPath = Path.resolve(mythixConfigPath, '.mythix-config');
    else if (stats.isFile(mythixConfigPath))
      mythixConfigPath = Path.dirname(mythixConfigPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (!mythixConfigPath.match(/[/\\]$/))
        mythixConfigPath = Path.dirname(mythixConfigPath);
    } else {
      throw error;
    }
  }

  let appRootPath = (_appRootPath) ? Path.resolve(_appRootPath) : Path.resolve(mythixConfigPath, 'app');

  let defaultConfig = {
    runtime:              process.env.MYTHIX_RUNTIME || 'node',
    runtimeArgs:          (process.env.MYTHIX_RUNTIME_ARGS || '').split(/\s+/g).filter(Boolean),
    applicationPath:      (config) => Path.resolve(config.appRootPath, 'application'),
    getApplicationClass:  (config) => {
      let Application = require(config.applicationPath);
      if (Application && typeof Application !== 'function' && typeof Application.Application === 'function')
        Application = Application.Application;

      return Application;
    },
    configPath,
    appRootPath,
  };

  try {
    if (FileSystem.existsSync(configPath)) {
      let mythixConfig = require(configPath);
      if (!mythixConfig.appRootPath)
        mythixConfig.appRootPath = appRootPath;

      mythixConfig.configPath = configPath;

      return resolveConfig(Object.assign({}, defaultConfig, mythixConfig));
    }
  } catch (error) {
    if (error.code !== 'ENOENT')
      throw error;
  }

  return resolveConfig(defaultConfig);
}

function spawnCommand(args, options, _config) {
  const config    = _config || {};
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    try {
      let childProcess = spawn(
        config.runtime || 'node',
        (config.runtimeArgs || []).concat(args).filter(Boolean),
        Object.assign({}, options || {}, {
          env:    Object.assign({}, process.env, (options || {}).env || {}),
          stdio:  'inherit',
        }),
      );

      childProcess.on('error', (error) => {
        reject(error);
      });

      childProcess.on('close', (code) => {
        resolve(code);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function executeCommand(_config, appOptions, commandContext, CommandKlass, argv) {
  let command = commandContext.command;

  try {
    let config            = _config || {};
    let configPath        = commandContext.config;
    let commandPath       = CommandKlass.path;
    let commandsPath      = appOptions.commandsPath;
    let runtime           = commandContext.runtime || config.runtime || process.env.MYTHIX_RUNTIME || 'node';
    let runtimeArguments  = ((CommandKlass.runtimeArguments || {})[runtime]) || [];
    let args              = runtimeArguments.concat([ commandPath ], argv);

    let code = await spawnCommand(
      args,
      {
        env: {
          NODE_ENV:                     commandContext.environment || '',
          MYTHIX_RUNTIME:               runtime,
          MYTHIX_CONFIG_PATH:           configPath,
          MYTHIX_COMMAND_PATH:          commandPath,
          MYTHIX_APPLICATION_COMMANDS:  commandsPath,
          MYTHIX_EXECUTE_COMMAND:       command,
        },
      },
      {
        ...config,
        ...commandContext,
      },
    );

    process.exit(code);
  } catch (error) {
    console.error(`Error while running command "${command}": `, error);
    process.exit(1);
  }
}

module.exports = {
  CommandBase,
  loadMythixConfig,
  loadCommand,
  loadCommands,
  defineCommand,
  createApplication,
  executeCommand,
};
