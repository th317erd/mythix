const Path        = require('path');
const FileSystem  = require('fs');
const Nife        = require('nife');
const { Logger }  = require('../logger');

const {
  walkDir,
  fileNameWithoutExtension,
} = require('../utils/file-utils');

class CommandBase {
  constructor(application, argv) {
    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        application,
      },
      'argv': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        argv,
      },
    });
  }

  getApplication() {
    return this.application;
  }

  getLogger() {
    var app = this.getApplication();
    return app.getLogger();
  }
}

CommandBase.defaultArguments = `
[-e,-env:string(Environment to use)=$NODE_ENV|development(Default "development")]
[--mythixConfig:string(Path to .mythix-config.js)=$MYTHIX_CONFIG_PATH]
`;

function defineCommand(_name, definer, _parent) {
  if (!CommandBase.commands) {
    Object.defineProperties(CommandBase, {
      'commands': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        {},
      },
    });
  }

  var name        = _name.toLowerCase();
  var parentClass = _parent || CommandBase;

  var Klass = definer({
    Parent: parentClass,
  });

  Klass.commandName = name;
  if (!Klass.commandArguments)
    Klass.commandArguments = '';

  Klass.commandArguments = `${Klass.commandArguments} ${CommandBase.defaultArguments}`.trim();

  Klass.commandString = `${name} ${(Klass.commandArguments) ? Klass.commandArguments : ''}`.trim();

  Klass.execute = async function() {
    var yargsPath = process.env['MYTHIX_YARGS_PATH'];
    if (!yargsPath)
      yargsPath = Path.dirname(require.resolve('yargs'));

    var simpleYargsPath = process.env['MYTHIX_SIMPLE_YARGS_PATH'];
    if (!simpleYargsPath)
      simpleYargsPath = Path.dirname(require.resolve('simple-yargs', '..'));

    var yargs             = require(Path.resolve(yargsPath, 'yargs'));
    var { hideBin }       = require(Path.resolve(yargsPath, 'helpers'));
    const SimpleYargs     = require(simpleYargsPath);
    var argv              = hideBin(process.argv).concat('');
    var rootCommand       = yargs(argv);

    rootCommand = SimpleYargs.buildCommands(rootCommand, async function(command, args) {
      try {
        var PWD               = process.env['PWD'];
        var mythixConfigPath  = args.mythixConfig;

        if (Nife.isEmpty(mythixConfigPath))
          mythixConfigPath = process.env['MYTHIX_CONFIG_PATH'];

        if (Nife.isEmpty(mythixConfigPath))
          mythixConfigPath = PWD;

        var config            = loadMythixConfig(mythixConfigPath);
        var Application       = config.getApplicationClass(config);
        var applicationConfig = Klass.applicationConfig;

        if (typeof applicationConfig === 'function') {
          applicationConfig = applicationConfig(config, Application);
        } else if (applicationConfig) {
          applicationConfig = Nife.extend(true, { httpServer: false, autoReload: false, logger: { level: Logger.LEVEL_WARN } }, applicationConfig);
        }

        if (!applicationConfig)
          applicationConfig = { httpServer: false, autoReload: false, logger: { level: Logger.LEVEL_WARN } };

        var doStartApplication = (applicationConfig.autoStart !== false);

        delete applicationConfig.autoStart;

        var application = await createApplication(Application, Object.assign({ exitOnShutdown: 1 }, applicationConfig), false);

        var environment = args.env;
        if (Nife.isEmpty(environment))
          environment = application.getConfigValue('environment', 'development');

        application.setConfig({ environment: environment });

        if (doStartApplication)
          await application.start();

        var commandInstance = new Klass(application, args);
        var result          = await commandInstance.execute.call(commandInstance, args);

        await application.stop(result || 0);
      } catch (error) {
        if (application)
          await application.stop(1);

        console.error(`Error while executing command "${command}"`, error);
      }
    }, [ Klass.commandString ]);

    rootCommand.parse();
  };

  CommandBase.commands[name] = Klass;

  // If this command file was loaded directly, and it was requested
  // that we execute it, then do so right now
  var doExecuteCommand = process.env['MYTHIX_EXECUTE_COMMAND'];
  if (doExecuteCommand === name)
    Klass.execute().then(() => {}, (error) => { console.error(error); });

  return Klass;
}

async function createApplication(Application, opts) {
  var application = new Application(Object.assign({ cli: true }, opts || {}));

  if (Nife.isNotEmpty(opts))
    application.setOptions(Object.assign(opts || {}));

  return application;
}

function loadCommand(name) {
  var fullPath      = require.resolve(name);
  var CommandKlass  = require(fullPath);

  CommandKlass.path = fullPath;

  return CommandKlass;
}

function loadCommands(yargs, application) {
  const getCommandFiles = (commandsPath) => {
    try {
      return walkDir(commandsPath, {
        filter: (fullFileName, fileName, stats) => {
          if (fileName.match(/^_/))
            return false;

          if (!stats.isFile() && !fileNameWithoutExtension(fileName).match(/-command$/))
            return false;

          return true;
        }
      });
    } catch (error) {
      if (error.code === 'ENOENT')
        return [];

      console.error(error);
      throw error;
    }
  }

  var applicationOptions      = application.getOptions();
  var mythixCommandFiles      = getCommandFiles(Path.resolve(__dirname));
  var applicationCommandFiles = getCommandFiles(applicationOptions.commandsPath);

  ([].concat(mythixCommandFiles, applicationCommandFiles)).forEach((commandPath) => loadCommand(commandPath));

  return CommandBase.commands;
}

function resolveConfig(config) {
  var keys = Object.keys(config);
  for (var i = 0, il = keys.length; i < il; i++) {
    var key   = keys[i];
    var value = config[key];

    if (key.match(/Path/) && typeof value === 'function')
      value = value(config);

    config[key] = value;
  }

  return config;
}

function loadMythixConfig(_mythixConfigPath, _appRootPath) {
  var mythixConfigPath = _mythixConfigPath;
  var configPath        = mythixConfigPath;

  try {
    var stats = FileSystem.statSync(mythixConfigPath);
    if (stats.isDirectory())
      configPath = Path.resolve(mythixConfigPath, '.mythix-config.js')
    else if (stats.isFile(mythixConfigPath))
      mythixConfigPath = Path.dirname(mythixConfigPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (!mythixConfigPath.match(/[\/\\]$/))
        mythixConfigPath = Path.dirname(mythixConfigPath);
    } else {
      throw error;
    }
  }

  var appRootPath = (_appRootPath) ? Path.resolve(_appRootPath) : Path.resolve(mythixConfigPath, 'app');

  var defaultConfig = {
    applicationPath:      (config) => Path.resolve(config.appRootPath, 'application.js'),
    getApplicationClass:  (config) => {
      var Application = require(config.applicationPath);
      if (Application && typeof Application !== 'function' && typeof Application.Application === 'function')
        Application = Application.Application;

      return Application;
    },
    configPath,
    appRootPath,
  };

  try {
    if (FileSystem.existsSync(configPath)) {
      var mythixConfig = require(configPath);
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

function spawnCommand(args, options) {
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    try {
      var childProcess = spawn(
        'node',
        args,
        Object.assign({}, options || {}, {
          env:    Object.assign({}, process.env, (options || {}).env || {}),
          stdio:  'inherit',
        })
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

async function executeCommand(configPath, yargsPath, simpleYargsPath, argv, commandPath, command) {
  try {
    var Klass         = CommandBase.commands[command];
    var nodeArguments = Klass.nodeArguments || [];
    var args          = nodeArguments.concat([ commandPath ], argv);

    var code = await spawnCommand(
      args,
      {
        env: {
          MYTHIX_CONFIG_PATH:       configPath,
          MYTHIX_YARGS_PATH:        yargsPath,
          MYTHIX_SIMPLE_YARGS_PATH: simpleYargsPath,
          MYTHIX_EXECUTE_COMMAND:   command,
        }
      }
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
