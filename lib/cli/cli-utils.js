import Path         from 'path';
import FileSystem   from 'fs';
import Nife         from 'nife';
import { Logger }   from '../logger.js';

import {
  walkDir,
  fileNameWithoutExtension,
} from '../utils/file-utils.js';

import {
  CMDed,
  showHelp,
} from 'cmded';

export class CommandBase {
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

  getConnection(connection) {
    let application = this.getApplication();
    return application.getConnection(connection);
  }

  // Deprecated
  getDBConnection(connection) {
    return this.getConnection(connection);
  }

  spawnCommand(command, args, options) {
    import { spawn } from 'child_process';

    return new Promise((resolve, reject) => {
      try {
        let childProcess = spawn(
          command,
          args,
          Object.assign({ shell: true }, options || {}, {
            env: Object.assign({}, process.env, (options || {}).env || {}),
          }),
        );

        let output = [];
        let errors = [];

        childProcess.stdout.on('data', (data) => {
          output.push(data);
        });

        childProcess.stderr.on('data', (data) => {
          errors.push(data);
        });

        childProcess.on('error', (error) => {
          if (options && options.ignoreExitCode) {
            resolve({
              stdout: Buffer.concat(output).toString('utf8'),
              stderr: Buffer.concat(errors).toString('utf8'),
              code:   0,
              error,
            });

            return;
          }

          reject({
            stdout: Buffer.concat(output).toString('utf8'),
            stderr: Buffer.concat(errors).toString('utf8'),
            code:   1,
            error,
          });
        });

        childProcess.on('close', (code) => {
          if (code !== 0) {
            let error = Buffer.concat(errors).toString('utf8');

            reject({
              stdout: Buffer.concat(output).toString('utf8'),
              stderr: error,
              error:  error,
              code,
            });
          } else {
            resolve({
              stdout: Buffer.concat(output).toString('utf8'),
              stderr: Buffer.concat(errors).toString('utf8'),
              error:  null,
              code,
            });
          }
        });
      } catch (error) {
        reject({
          stdout: '',
          stderr: '',
          code:   1,
          error,
        });
      }
    });
  }

  getCommandFiles(filterFunc) {
    let application         = this.getApplication();
    let applicationOptions  = application.getOptions();
    let internalCommands    = getCommandFiles(getInternalCommandsPath(), filterFunc);
    let externalCommands    = [];

    if (Nife.isNotEmpty(applicationOptions.commandsPath))
      externalCommands = getCommandFiles(applicationOptions.commandsPath, filterFunc);

    return [].concat(internalCommands, externalCommands);
  }
}

let loadingAllCommandsInProgress = false;

export function defineCommand(_commandName, definer, _parent) {
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
    let helpShown = false;

    const customShowHelp = (subHelp) => {
      if (helpShown)
        return;

      helpShown = true;

      showHelp(subHelp);
    };

    const getArgumentsContext = async (application) => {
      // eslint-disable-next-line new-cap
      return await CMDed(async (context) => {
        let { $, Types, store, scope } = context;

        // Parse these even though they are no longer needed
        // so that we ensure they are "consumed".
        $('--config', Types.STRING({
          format: Path.resolve,
        })) || store({ config: (Nife.isNotEmpty(process.env.MYTHIX_CONFIG_PATH)) ? Path.resolve(process.env.MYTHIX_CONFIG_PATH) : Path.join(process.env.PWD, '.mythix-config') });

        $('--runtime', Types.STRING());

        $('-e', Types.STRING(), { name: 'environment' });
        $('--env', Types.STRING(), { name: 'environment' });

        if (!application)
          return true;

        store('executing', true);
        store('mythixApplication', application);

        // Consume the command name
        $(commandName, ({ fetch, showHelp }) => {
          if (fetch('help', false))
            showHelp(commandName);

          return true;
        });

        let runner = null;
        if (typeof Klass.commandArguments === 'function') {
          let result = ((await Klass.commandArguments(application, 'runner')) || {});
          runner = result.runner;
        }

        return await scope(commandName, async (context) => {
          if (typeof runner === 'function')
            return await runner(context);

          return true;
        });
      }, {
        helpArgPattern: null,
        showHelp:       customShowHelp,
      });
    };

    let commandContext = await getArgumentsContext();
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
        applicationConfig = Nife.extend(true, { cli: true, httpServer: false, autoReload: false, logger: { level: Logger.LEVEL_WARN }, runTasks: false }, applicationConfig);

      if (!applicationConfig)
        applicationConfig = { cli: true, httpServer: false, autoReload: false, logger: { level: Logger.LEVEL_WARN }, runTasks: false };

      let doStartApplication = (applicationConfig.autoStart !== false);

      delete applicationConfig.autoStart;

      application = await createApplication(Application, Object.assign({ exitOnShutdown: 1 }, applicationConfig), false);

      let environment = commandContext.environment;
      if (Nife.isEmpty(environment))
        environment = application.getConfigValue('environment', 'development');

      application.setConfig({ environment: environment });

      if (doStartApplication)
        await application.start();

      commandContext = await getArgumentsContext(application);

      let commandOptions  = commandContext[commandName] || {};
      let commandInstance = new Klass(application, commandOptions);

      const doExecuteCommand = async () => {
        return await commandInstance.execute.call(commandInstance, commandOptions, commandContext);
      };

      let dbConnection = (typeof application.getConnection === 'function') ? application.getConnection() : undefined;
      let result;

      if (dbConnection && typeof dbConnection.createContext === 'function')
        result = await dbConnection.createContext(doExecuteCommand, dbConnection, dbConnection);
      else
        result = await doExecuteCommand();

      await application.stop(result || 0);
    } catch (error) {
      console.log(`Error while executing command "${commandName}"`, error);

      if (application)
        await application.stop(1);
    }
  };

  CommandBase.commands[commandName] = Klass;

  return Klass;
}

export async function createApplication(ApplicationClass, opts) {
  let application = new ApplicationClass(Object.assign({ cli: true }, opts || {}));

  if (Nife.isNotEmpty(opts))
    application.setOptions(Object.assign(opts || {}));

  return application;
}

export function loadCommand(name) {
  let fullPath      = require.resolve(name);
  let CommandKlass  = require(fullPath);

  if (CommandKlass && typeof CommandKlass !== 'function' && typeof CommandKlass.default === 'function')
    CommandKlass = CommandKlass.default;

  CommandKlass.path = fullPath;

  return CommandKlass;
}

export function getCommandFiles(commandsPath, filterFunc) {
  try {
    if (!commandsPath)
      return [];

    return walkDir(commandsPath, {
      filter: (fullFileName, fileName, stats) => {
        if (typeof filterFunc === 'function')
          return filterFunc(fullFileName, fileName, stats);

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
}

export function getInternalCommandsPath() {
  return Path.resolve(__dirname);
}

export function loadCommands(applicationCommandsPath, skip) {
  if (loadingAllCommandsInProgress)
    return;

  loadingAllCommandsInProgress = true;

  let mythixCommandFiles      = getCommandFiles(getInternalCommandsPath());
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

export function loadMythixConfig(_mythixConfigPath, _appRootPath) {
  let mythixConfigPath = _mythixConfigPath;
  let configPath       = mythixConfigPath;

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
      if (mythixConfig.__esModule)
        mythixConfig = mythixConfig['default'];

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
  import { spawn }  from 'child_process';

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
        if (options && options.ignoreExitCode) {
          resolve(0);
          return;
        }

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

export async function executeCommand(_config, appOptions, commandContext, CommandKlass, argv) {
  let command = commandContext.command;

  try {
    let config            = _config || {};
    let configPath        = commandContext.config;
    let commandPath       = CommandKlass.path;
    let commandsPath      = appOptions.commandsPath;
    let runtime           = commandContext.runtime || config.runtime || process.env.MYTHIX_RUNTIME || 'node';
    let runtimeArguments  = ((CommandKlass.runtimeArguments || {})[runtime]) || [];
    let args              = runtimeArguments.concat([ Path.resolve(__dirname, 'command-executor.js') ], argv);

    let code = await spawnCommand(
      args,
      {
        env: {
          NODE_ENV:                     commandContext.environment || process.env.NODE_ENV,
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
