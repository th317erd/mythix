import Path         from 'node:path';
import FileSystem   from 'node:fs';
import { spawn }    from 'node:child_process';
import Nife         from 'nife';
import { Logger }   from '../logger.mjs';

import {
  CMDed,
  showHelp,
} from 'cmded';

import { fileURLToPath }  from 'node:url';
const __filename  = fileURLToPath(import.meta.url);
const __dirname   = Path.dirname(__filename);

// import { createRequire } from 'node:module';
// const require     = createRequire(import.meta.url);

export async function createApplication(ApplicationClass, opts) {
  return new ApplicationClass({
    ...(opts || {}),
    cli: true,
  });
}

export async function executeCommandByName(commandName) {
  let helpShown = false;
  let CommandClass;

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
      if (typeof CommandClass.commandArguments === 'function') {
        let result = ((await CommandClass.commandArguments(application, 'runner')) || {});
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

    let cliConfig   = await loadMythixConfig(mythixConfigPath);
    let Application = await cliConfig.getApplicationClass(cliConfig);
    let Commands    = Application.getCommandList();

    CommandClass = Commands[commandName];
    if (typeof CommandClass !== 'function') {
      customShowHelp();
      return;
    }

    let applicationConfig = CommandClass.applicationConfig;
    if (typeof applicationConfig === 'function')
      applicationConfig = applicationConfig(cliConfig, Application);
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
    commandContext.cliConfig = cliConfig;

    let commandOptions  = commandContext[commandName] || {};
    let commandInstance = new CommandClass(application, commandOptions);

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
}

function resolveJavascriptFileName(filePathWithoutExtension) {
  if (FileSystem.existsSync(filePathWithoutExtension)) {
    let stats = FileSystem.statSync(filePathWithoutExtension);
    if (stats.isDirectory())
      return resolveJavascriptFileName(`${filePathWithoutExtension}/index`);

    return filePathWithoutExtension;
  }

  let filePath = `${filePathWithoutExtension}.mjs`;
  if (FileSystem.existsSync(filePath))
    return filePath;

  filePath = `${filePathWithoutExtension}.cjs`;
  if (FileSystem.existsSync(filePath))
    return filePath;

  filePath = `${filePathWithoutExtension}.js`;
  if (FileSystem.existsSync(filePath))
    return filePath;
}

async function resolveConfig(config) {
  let keys = Object.keys(config);
  for (let i = 0, il = keys.length; i < il; i++) {
    let key   = keys[i];
    let value = config[key];

    if (key.match(/Path/) && typeof value === 'function')
      value = await value(config);

    config[key] = value;
  }

  return config;
}

export async function loadMythixConfig(_mythixConfigPath, _appRootPath) {
  let mythixConfigPath = _mythixConfigPath;
  let configPath       = mythixConfigPath;

  try {
    let stats = FileSystem.statSync(mythixConfigPath);
    if (stats.isDirectory())
      configPath = resolveJavascriptFileName(Path.resolve(mythixConfigPath, '.mythix-config'));
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
    applicationPath:      (config) => resolveJavascriptFileName(Path.resolve(config.appRootPath, 'application')),
    getApplicationClass:  async (config) => {
      let Application = await import(config.applicationPath);
      if (Application && typeof Application !== 'function' && typeof Application.Application === 'function')
        Application = Application.Application;

      return Application;
    },
    configPath,
    appRootPath,
  };

  try {
    if (FileSystem.existsSync(configPath)) {
      let mythixConfig = await import(configPath);
      if (mythixConfig.__esModule)
        mythixConfig = mythixConfig['default'];

      if (!mythixConfig.appRootPath)
        mythixConfig.appRootPath = appRootPath;

      mythixConfig.configPath = configPath;

      return await resolveConfig({
        ...defaultConfig,
        ...mythixConfig,
      });
    }
  } catch (error) {
    if (error.code !== 'ENOENT')
      throw error;
  }

  return await resolveConfig(defaultConfig);
}

function spawnCommand(args, options, _config) {
  const config = _config || {};

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
    let runtime           = commandContext.runtime || config.runtime || process.env.MYTHIX_RUNTIME || 'node';
    let runtimeArguments  = ((CommandKlass.runtimeArguments || {})[runtime]) || [];
    let args              = runtimeArguments.concat([ Path.resolve(__dirname, 'command-executor.mjs') ], argv);

    let code = await spawnCommand(
      args,
      {
        env: {
          NODE_ENV:                     commandContext.environment || process.env.NODE_ENV,
          MYTHIX_RUNTIME:               runtime,
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
