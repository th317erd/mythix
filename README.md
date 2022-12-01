# mythix

Mythix is a NodeJS web-app framework. It is configured to have sane defaults so that you need not worry about configuration. However, it was designed such that any part of the default application can be overloaded to provide custom functionality for any components of the framework.

## Heads UP!

Though mythix is currently quite useful, it is still in "beta" phase, and is missing some useful functionality. Don't let this deter you, just be aware that it is still heavily under development. Help via PRs is always welcome!

## Install

To create a new empty mythix project:

```bash
$ npx mythix-cli init my_project_name
```

Or to install directly as a dependency:

```bash
$ npm i --save mythix
```

## Application file structure

```
projectRoot/ ->
|-- app/
|---- commands/       (custom mythix-cli commands for your project)
|---- config/         (configuration for your web app)
|---- controllers/    (controller classes)
|---- middleware/     (custom middleware)
|---- migrations/     (migrations for your DB)
|---- models/         (all model definitions)
|---- seeders/        (database seeders)
|---- tasks/          (reoccuring/cron-type tasks)
|---- application.js  (application class definition)
|---- index.js        (entry point for your application)
|---- routes.js       (route definitions for your web-app)
| .mythix-config.js   (custom mythix RC)
| package.json
```

## Creating the application

To create your own `mythix` application, you simply need to inherit from `Mythix.Application`:

Example:

```javascript
const Path                = require('path');
const Mythix              = require('mythix');
const getRoutes           = require('./routes');
const { authMiddleware }  = require('./middleware');

class Application extends Mythix.Application {
  static APP_NAME = 'my_app_name';

  constructor(_opts) {
    var opts = Object.assign({
      rootPath: Path.resolve(__dirname),
      httpServer: {
        middleware: [
          authMiddleware,
        ],
      },
    }, _opts || {});

    super(opts);
  }

  getRoutes(...args) {
    return getRoutes.apply(this, args);
  }
}

module.exports = {
  Application,
};
```

## Starting your server

All you need to do to start serving up content is to run the following command:

```bash
$ mythix-cli serve
```

Or, you can simply invoke your own entry point:

```bash
$ node app/index.js
```

Your `index.js` simply needs to create an instance of your `Application` and call `appInstance.start()` to start your server.

## Application configuration

Application configuration is defined as Javascript files under `./app/config`. To get configuration values, you use the `application.getConfigValue` method. The `getConfigValue` method accepts three arguments, only the first is recommended (if no arguments are passed to this method, then the entire application configuration is returned as an object).

The first argument is a full dot-notation path string to the configuration value you wish to fetch. For example: `application.getConfigValue('logger.level')`.

The second argument is a "default value". If `getConfigValue` doesn't find the key that you are looking for in the configuration, or if the value of the key it found is `undefined`, then it will return the default value specified instead.

The final and third argument is the "type" of data you expect it to return. For example, you could specify `integer`, and it would coerce the found value into an integer before returning it to you. Possible types are `string`, `integer`, `number`, `boolean`, and `bigint`.

`getConfigValue` can also accept template parameters for the key path. For example, you could do `application.getConfigValue('database.{environment}.host')`, which would be equivilent to:

```javascript
var environment = application.getConfigValue('environment');
var result = application.getConfigValue(`database.${environment}.host`);
```

## Creating controllers

Creating new controllers is easy. All it requires is that you create a new file in the `./app/controllers` directory, and make sure you give the controller file name a `-controller.js` suffix (i.e. `my-controller.js`). When `mythix` detects this file pattern in the `./app/controllers` directory it will load your new controller automatically (you don't even need to restart the web-server if it is currently running).

*NOTE: The current version of mythix won't auto-reload your routes, so you still need to restart your application to load newly defined routes*.

Once you have your new controller file created, you simply need to define your controller with a `defineController` call from `mythix` imports.

For example, a simple demo controller can be created by creating a new controller file named `./app/controllers/hello-world-controller.js` and placing the following contents in this file:

```javascript
const { defineController } = require('mythix');

module.exports = defineController('HelloWorld', ({ Parent }) => {
  return class HelloWorldController extends Parent {
    async greet(params, query, body, models) {
      return 'Hello World!';
    }
  };
});
```

Now, all you need to do is add your new controller to the routes:

Simply modify `./app/routes.js` to have the following content:

```
module.exports = function getRoutes() {
  return {
    'api': {
      'v1': {
        'greet': [
          {
            'methods':    [ 'GET' ],
            'controller': 'HelloWorld.greet',
          },
        ],
      },
    },
  };
};
```

That is it! Now you can goto `http://localhost:8001/api/v1/greet` and you will see `Hello world!` in your browser.

## Defining routes

Routes are defined using a simple object structure. The method `getRoutes` is called on your application to get these routes. Routes can contain "captures" to capture path information that will be passed onto your controller. The syntax for these "captures" is simple: `<param:type>`, for example: `<id:integer>`. Params can also specify default values: `<enabled:boolean=true>`. Or, params can be optional: `<id?:integer>`.

*Note: If an optional param immediately follows a forward slash, i.e. `/somepath/<id?>` then the preceeding forward slash is also optional. So the previous example would match on `/somepath` and `/somepath/234`.*

Params types are:

* `string`
* `integer`
* `number`
* `boolean`
* `bigint`

If no type is specified, then `mythix` will "guess" the type as best as it is able.

Example 1:

```javascript
module.exports = function getRoutes() {
  return {
    'api': {
      'v1': {
        // CRUD routes for "users"
        'users': [
          // If there is a param of "/id", then capture
          // it and pass it to the controller
          '/<id:integer>': [
            {
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'User.show',
            },
            {
              'methods':    [ 'PUT' ],
              'accept':     [ 'application/json' ],
              'controller': 'User.update',
            },
            {
              'methods':    [ 'DELETE' ],
              'accept':     [ 'application/json' ],
              'controller': 'User.delete',
            },
          ],
          {
            'methods':    [ 'GET' ],
            'accept':     [ 'application/json' ],
            'controller': 'User.index',
          },
          {
            'methods':    [ 'POST' ],
            'accept':     [ 'application/json' ],
            'controller': 'User.create',
          },
        ],
      },
    },
  };
};
```

Example 2:

You can also be more direct:

```javascript
module.exports = function getRoutes() {
  return {
    // The '?' makes this param optional
    // either /api/v1/users
    // or /api/v1/users/234
    // will work
    'api/v1/users/<id?:integer>': [
        {
          'methods':        [ 'GET' ],
          'accept':         [ 'application/json' ],
          'requireParams':  [ 'id' ],
          'controller':     'User.show',
        },
        {
          'methods':    [ 'PUT' ],
          'accept':     [ 'application/json' ],
          'controller': 'User.update',
        },
        {
          'methods':    [ 'DELETE' ],
          'accept':     [ 'application/json' ],
          'controller': 'User.delete',
        },
        {
          'methods':    [ 'GET' ],
          'accept':     [ 'application/json' ],
          'controller': 'User.index',
        },
        {
          'methods':    [ 'POST' ],
          'accept':     [ 'application/json' ],
          'controller': 'User.create',
        },
      },
    },
  };
};
```

## Defining models

`mythix` uses [sequelize](https://www.npmjs.com/package/sequelize) under the hood for its ORM. Defining models in `mythix` is nearly identical to how they are defined in [sequelize](https://www.npmjs.com/package/sequelize), with a few bits of syntatic sugar mixed in.

First, you need to start by defining your models with the `Mythix.defineModel` method. This method needs the name of your model as its first argument, a `definer` method that will return your model class, and optionally a parent model to inherit from.

Model definition files need to be placed in `./app/models`, and need to have a `-model.js` suffix to be auto-loaded by `mythix`.

*NOTE: Model files are auto-reloaded by mythix while it is running... so if you change your model (something other than the schema), then your model will automatically be reloaded without needing to restart the web-server. Schema changes will obviously require that you create and run migrations, so the web-server must be stopped and restarted if you modify a model's fields.*

Example:

```javascript
const { defineModel } = require('mythix');

module.exports = defineModel('Product', ({ Parent, Type, Relation }) => {
  return class Product extends Parent {
    // Define the model fields, using Sequelize syntax (mostly)
    static fields = {
      id: {
        type:         Type.UUID,
        defaultValue: Type.UUIDV4,
        primaryKey:   true,
      },
      name: {
        type:         Type.STRING(32),
        allowNull:    false,
        // "index" is not sequelize syntax... this is mythix sugar
        // for a simple way to define that we want to index this column
        index:        true,
      },
      price: {
        type:         Type.FLOAT,
        allowNull:    false,
        index:        true,
      },
    };

    // Define model relations
    static relations = [
      Relation.belongsTo('Order', { allowNull: false, onDelete: 'RESTRICT', name: 'order' }),
    ];

    // Optionally define model methods
    // ...
  };
});
```

## Defining commands

The `mythix-cli` can load commands from `mythix`, as well as custom commands you define. For example, if you create a command named `deploy`, then that command can be ran like so: `mythix-cli deploy`. Commands can inherit from other commands in `mythix`, including commands built directly into `mythix`.

A `static commandArguments` method is used to define the `help` for your command, and to define a `Runner` to gather arguments for your command. This `Runner` is a [CMDed](https://www.npmjs.com/package/cmded) `Runner`, so please refer to the [CMDed](https://www.npmjs.com/package/cmded) documentation for how to properly create a `Runner` for your command.

You can optionally define a `static runtimeArguments` object, defining an array of strings arguments for each `runtime`. A `runtime` would be something like `node`, `ts-node`, or `babel-node`.

There is also the static property `static applicationConfig` which can be an object specifying the options for your `Application` class, or, if this is a method, should return the options for your `Application` class. If this is a method, then the options it returns are the *only* options that will be passed to your `Application` class upon instantiation. If this is an object, then the `mythix-cli` will deliberately merge other options in (such as `{ httpServer: false, runTasks: false, autoReload: false }`), as most commands don't want an HTTP server, tasks, or auto-reloading running.

Any file placed in `./app/commands/` with a `-command.js` suffix will be loaded automatically as a command.

Example:

```javascript
const { defineCommand } = require('mythix');

module.exports = defineCommand('deploy', ({ Parent }) => {
  return class DeployCommand extends Parent {
    static runtimeArguments = {
      'node': [ '--inspect' ],
    };

    static commandArguments() {
      return {
        // CMDed help
        help: {
          '@usage': 'mythix-cli deploy [options]',
          '@title': 'Deploy the application to the specified target servers',
          '-t={target} | -t {target} | --target={target} | --target {target}': 'Target server to deploy to',
        },
        // CMDed runner
        runner: ({ $, store, Types }) => {
          $('--target', Types.STRING(), { name: 'target' })
            || $('-t', Types.STRING(), { name: 'target' })
            || store({ target: 'production' }); // Default value

          return true;
        },
      };
    }

    async execute(args) {
      // args contains all your command line arguments parsed
      // here you would write the code to deploy your application
    }
  };
});
```

This command can now be run as follows:

```bash
$ mythix-cli deploy --target ssh://host/path/
```

## Migrations

Unfortunately the migration commands in `mythix` are currently barely functional. The best you can do is create an "initial" migration from your model definitions. This means that (aside from creating custom migrations), you are left with nothing to do but drop your database, and re-create it every time model schemas change. I hope to have these scripts smarter and fixed in the near future. For now, you can create an "initial" migration by running the following command:

```bash
$ mythix-cli makemigrations --name initial
```

This will create a migration in the `./app/migrations` folder to setup the initial schema of your database.

If model schemas change, then you will need to drop and re-create your database, delete all the files in `./app/migrations`, and run `mythix-cli makemigrations --name initial` again to re-create your database schema.

**To run migrations**: Simply invoke the following command:

```bash
$ mythix-cli migrate
```

*Note: If you would like to help improve the migration sitation in `mythix`, please feel free to submit a PR!*

## Middleware

`mythix` uses [express](https://www.npmjs.com/package/express) under the hood. So Express middleware can be used drop-in style. Or, you can create your own custom middleware using Express middleware patterns.

`mythix` only has one middleware that it ships with, called `conditional` in `Mythix.Middleware.conditional`. This simple middleware allows you to conditionally allow a request to proceed, or conditionally use per-endpoint middleware, depending on if it has the correct `Content-Type`, target controller, URL pattern, or HTTP method verb.

To use middleware, you simply need to define a `middlware` property key on the `httpServer` options when instantiating a `Mythix.Application`. This `middleware` key needs to be an array of instantiated middlewares.

Example:
```javascript
class Application extends Mythix.Application {
  constructor(_opts) {
    var opts = Object.assign({}, {
      httpServer: {
        middleware: [
          myCustomMiddleware,
          someOtherMiddleware,
        ],
      },
    }, _opts || {});

    super(opts);
  }
}
```

## Tasks

Tasks are cron-like tasks that run at a given frequency, delay, or scheduled time. They can be defined using the `Mythix.defineTask` method, and should be placed inside `./app/tasks`, in files with names that have a `-task.js` suffix.

Like most `mythix` classes, you can call `this.getApplication()` to get the application instance, `this.getLogger()` to get the tasks logger, `this.getModel(name)` or `this.getModels()` to get application models, and `this.getConnection()` to get the database connection for the running application.

Example task:

`./app/tasks/custom-task.js`
```javascript
const {
  defineTask,
  TaskBase,
} = require('mythix');

module.exports = defineTask('CustomTask', ({ application, Parent, time, Sequelize }) => {
  const workerCount = application.getConfigValue('tasks.CustomTask.workers', 1, 'integer');

  return class CustomTask extends Parent {
    // Number of workers this task should have
    static workers    = workerCount;

    // Run every day
    static frequency  = time.days(1);

    // Don't start running until 30 minutes has passed
    // This can be useful to "interlace" your tasks,
    // so they don't all fire at once.
    static startDelay = time.minutes(30);

    // If 'keepAlive` is not true, then the task class
    // instance will be destroyed and recreated on each
    // invocation of the task.
    static keepAlive  = true;

    // Set 'enabled = false' to disable this task from
    // running.
    static enabled    = true;

    // Execute is called every time the task
    // is scheduled to run
    async execute() {
      // ... do some task
    }

    // Optionally, you can define your own "shouldRun" method
    // you could use this, for example, to have your task
    // run at a scheduled time.
    // 'lastTime', 'currentTime', and 'diff' are in seconds
    // 'taskIndex' is the index of this worker
    // If this returns 'true', then the task will be ran
    // otherwise, it won't be ran until this method returns true.
    // This method is called every second.
    static shouldRun(TaskClass, taskIndex, lastTime, currentTime, diff) {
      if (meetsScheduledTime())
        return true;

      // We don't pass TaskClass here because it is bound to the method
      return TaskBase.shouldRun(taskIndex, lastTime, currentTime, diff);
    }
  };
});
```

## Mythix RC

This is the `mythix` RC file. The primary purpose of this file is to let the `mythix-cli` know how to fetch and instantiate your `Application` class. By default, `mythix-cli` will expect the application class to be exported from `./app/application.js`. If not found there, it will panic, unless you tell it how to load your mythix application.

`{projectRoot}/.mythix-config.js` is the location searched for to load your `mythix` RC. You can also specify a `--mythixConfig` argument to any invocation of `mythix-cli` to tell `mythix-cli` where to load this configuration file.

There is only one required method that needs to be exported from `.mythix-config.js`, and it is named `getApplicationClass`. This method is expected to return your own custom `Application` class that extends from `Mythix.application`. This is all you ever really need in the mythix RC.

However, if you want to control how your application gets instantiated, you can also optionally define and export an `async createApplication` method that will create your application. This method SHOULD NOT start your application, but simply instantiate it. This method receives two arguments: `Application`, and `options`. `Application` is the application class itself, and `options` are any options that should be passed to your `Application.constructor`.

When the `mythix-cli` is invoked, it will always pass a `{ cli: true }` option to your Application class. You can use this to know if your application is running in "CLI mode".

## mythix-cli

A little bit should be mentioned about how the `mythix-cli` command works. When it is invoked, the first thing it does is search for your `Application` class. When it finds it, it will then create an instance of your application to fetch all your application defined paths. Once it has the paths you specified for your application, it will then load all commands it finds (both internal 'mythix' commands, and any custom commands you have defined).

When a command is invoked, the `mythix-cli` will deliberately launch a new process using the specified `runtime` (default is `node`) to execute the command specified. This is so that each command can specify its own custom `runtimeArguments` (if desired).

Because of the way this works, your application will be instantiated twice:

* Once, and first, to load your application configuration (specifically your defined paths). This part of the process will *not* start your application, but simply instantiate it.
* Second, your application will be instantiated again in the new spawned `runtime` (default `node`) process, and this time your application will also be started. Once your application has been successfully instantiated and started, then the command will run.

Most commands by default will start your application with the options `{ httpServer: false, autoReload: false, runTasks: false }`. This informs your application NOT to start the web-server, NOT to start the task worker, and to NOT auto-reload files on change (which often isn't desired for many commands).

If a command specifies `static applicationConfig` as a method, then this method is expected to return ALL options for the application, and the default options that the CLI would normally set itself are bypassed. This allows a command to fully control the application, and its options. This is used for example by the `serve` command, which wants the HTTP server, auto-reloading, tasks, and all other parts of the application fully running.

## Customizing behavior

`mythix` was defined with decent default behavior that will work fine for most users. However, there will be times when you want different behavior. The `Application` class was deliberately designed to allow you to modify the behavior of `mythix`. Though I won't go into great detail here (check the source code for now, until I can write better documentation), you can overload how the HTTP server is created by adding a `createHTTPServer` method to your `Application` class. You can modify how database connections are created by overloading the `connectToDatabase` method. Etc...

There are many more things that can be customized as well (by overloading methods). Please refer to the `Application` class source code until I can write better documentation.

## API

### function **Mythix.defineController**(<br>`controllerName <string>`,<br>`definer <function>(context <object>)`,<br> `[ ParentControllerClassToInheritFrom <class> ]`<br>)

#### Description

Create a new controller class, giving your controller the name specified by the `controllerName` argument. The `definer` method will be invoked immediately upon the call to `Mythix.defineController`, and is expected to return a new controller class that inherits from `context.Parent`. `context.Parent` by default (if no `ParentControllerClassToInheritFrom` argument is specified) will be `Mythix.ControllerBase`.

#### Arguments

* **controllerName** *`<string>`* - Specify the name of your controller.
* **definer** *`function(context <object>)`* - Callback method that is used to create your controller class. This method is expected to return a new controller class.
  *  `context`:
      * **`Parent`** - The parent class your controller should inherit from. If no parent controller class was specified as the third argument `ParentControllerClassToInheritFrom`, then this defaults to `Mythix.ControllerBase`.
      * **`application`** - The `mythix` application instance of the currently running application.
      * **`server`** - The HTTP server instance of the currently running `mythix` application.
      * **`controllerName`** - The controller name, as defined by the `controllerName` argument.
* *(optional)* **ParentControllerClassToInheritFrom** *`<class extends Mythix.ControllerBase>`* - If specified, this this will be assigned to `context.Parent`, which your controller class should always extend from.

#### Return

The return value will be a controller class, inherited from `Mythix.ControllerBase`.

#### Example

```javascript
const { defineController } = require('mythix');

module.exports = defineController(
  'HelloWorld',
  ({ Parent, application }) => {

    // Here we can load configuration values if we want
    const someConfigValue = application.getConfigValue(
      // Path of config value to fetch
      'some.custome.config.value',
      // Defualt value to return instead (if not found)
      'defaultConfigValue',
      // Type of value being fetched.
      // The value will be coerced to this
      // if specified.
      'string',
    );

    return class HelloWorldController extends Parent {
      async greet(params, query, body, models) {
        return 'Hello World!';
      }
    };
  }
);
```

### function **Mythix.defineModel**(<br>`modelName <string>`,<br>`definer <function>(context <object>)`,<br> `[ ParentModelClassToInheritFrom <class> ]`<br>)

#### Description

Create a new model class, giving your model the name specified by the `modelName` argument. The `definer` method will be invoked immediately upon the call to `Mythix.defineModel`, and is expected to return a new model class that inherits from `context.Parent`. `context.Parent` by default (if no `ParentModelClassToInheritFrom` argument is specified) will be `Mythix.ModelBase`.

#### Static Class Properties

* static **pluralName** *`<string>`* - The plural name of of your model. If this is set, then `mythix` won't guess the plural name, and will use this as the model's plural name instead.

#### Arguments

* **modelName** *`<string>`* - Specify the name of your model.
* **definer** *`function(context <object>)`* - Callback method that is used to create your controller class. This method is expected to return a new controller class.
  *  `context`:
      * **`Parent`** - The parent class your model should inherit from. If no parent model class was specified as the third argument `ParentModelClassToInheritFrom`, then this defaults to `Mythix.ModelBase`.
      * **`application`** - The `mythix` application instance of the currently running application.
      * **`Type`** - A shortcut for `Sequelize.DataTypes`.
      * **`Relation`** - Relationship helpers. This is an object that contains the following methods: `hasOne`, `belongsTo`, `hasMany`, and `belongsToMany`. These methods closely mirror the association methods in `sequelize`.
      * **`Sequelize`** - `Sequelize` module that was loaded by `mythix`.
      * **`connection`** - The database connection used by the currently running `mythix` application. This is an instance of `sequelize`.
      * **`modelName`** - The same `modelName` string given to the call to `defineModel`.
* *(optional)* **ParentModelClassToInheritFrom** *`<class extends Mythix.ModelBase>`* - If specified, this this will be assigned to `context.Parent`, which your model class should always extend from.

#### Return

The return value will be a model class, inherited from `Mythix.ModelBase`.

#### Example

```javascript
const { defineModel } = require('mythix');

module.exports = defineModel('Product', ({ Parent, Type, Relation }) => {
  return class Product extends Parent {
    // Define the model fields, using Sequelize syntax (mostly)
    static fields = {
      id: {
        type:         Type.UUID,
        defaultValue: Type.UUIDV4,
        primaryKey:   true,
      },
      name: {
        type:         Type.STRING(32),
        allowNull:    false,
        // "index" is not sequelize syntax... this is mythix sugar
        // for a simple way to define that we want to index this column
        index:        true,
      },
      price: {
        type:         Type.FLOAT,
        allowNull:    false,
        index:        true,
      },
    };

    // Define model relations
    static relations = [
      Relation.belongsTo('Order', { allowNull: false, onDelete: 'RESTRICT', name: 'order' }),
    ];

    // Optionally define model methods
    // ...
  };
});
```

### function **Mythix.defineCommand**(<br>`commandName <string>`,<br>`definer <function>(context <object>)`,<br> `[ ParentCommandClassNameToInheritFrom <string> ]`<br>)

#### Description

Create a new command class, giving your command the name specified by the `commandName` argument (all lower-case). The `definer` method will be invoked immediately upon the call to `Mythix.defineCommand`, and is expected to return a new controller class that inherits from `context.Parent`. `context.Parent` by default (if no `ParentCommandClassNameToInheritFrom` argument is specified) will be `Mythix.CommandBase`.

#### Static Class Properties

* static **description** *`<string>`* - The description to give to this command. If this is not provided, then your command's "help" will not be shown when you run `mythix-cli --help`.
* static **runtimeArguments** *`{ [key: string]: <Array[<string>]> }`* - An object containing runtime name keys, where each key value is an array of string arguments to use as command line arguments when invoking your command with the specified runtime. These are NOT your command's arguments, but rather the arguments to give to the specified runtime. For example, for the default `node` runtime, this might look something like `{ node: [ '--inspect' ] }`.
* static **commandArguments** *`<string>`* - A string containing your command arguments, their descriptions, their types, and their default values. [simple-yargs](https://www.npmjs.com/package/simple-yargs) is used to parse these command argument strings, so refer to its documentation for how to define your command arguments.
* static **applicationConfig** *`<object> | <function>`* - Define the options passed to your `Application.constructor`. If this is a simple object, then the `mythix-cli` will inject some default options that make sense for most commands. If this is a function, then it should return an options object. When this is a function, the `mythix-cli` will not inject any arguments, but instead will pass your options directly to `Application.constructor` without modification.

#### Arguments

* **commandName** *`<string>`* - Specify the name of your command (must be all lower-case).
* **definer** *`function(context <object>)`* - Callback method that is used to create your command class. This method is expected to return a new command class.
  *  `context`:
      * **`Parent`** - The parent class your controller should inherit from. If no parent controller class was specified as the third argument `ParentCommandClassNameToInheritFrom`, then this defaults to `Mythix.CommandBase`.
      * **`commandName`** - The command name, as defined by the `commandName` argument (lower-cased).
* *(optional)* **ParentCommandClassNameToInheritFrom** *`<string>`* - If specified, this this will be the name of the class assigned to `context.Parent`, which your command class should always extend from.<br><br>*Note: This is a string that is a command NAME. This is required, because the command class you want to inherit from is dynamically loaded at start, so the name of a command is used to inherit from instead of a class directly.*

#### Return

The return value will be a command class, inherited from `Mythix.CommandBase`.

#### Example

```javascript
const { defineCommand } = require('mythix');

module.exports = defineCommand('deploy', ({ Parent }) => {
  return class DeployCommand extends Parent {
    static definition = 'Deploy application to servers';
    static commandArguments = '<-target:string(Target server to deploy to)';

    async execute(args) {
      // args contains all your command line arguments parsed
      // here you would write the code to deploy your application
    }
  };
});
```

### function **Mythix.defineTask**(<br>`taskName <string>`,<br>`definer <function>(context <object>)`,<br> `[ ParentTaskClassToInheritFrom <class> ]`<br>)

#### Description

Create a new task class, giving your task the name specified by the `taskName` argument. The `definer` method will be invoked immediately upon the call to `Mythix.defineTask`, and is expected to return a new task class that inherits from `context.Parent`. `context.Parent` by default (if no `ParentTaskClassToInheritFrom` argument is specified) will be `Mythix.TaskBase`.

Tasks are cron-like, in that they are run every so-often. `mythix` will wait on any running tasks before it stops, and will call the `stop` method on all tasks when it is shutting down.

#### Static Class Properties

* static **enabled** *`<boolean>`* - If this is `false`, then your task will never run.
* static **frequency** *`<number>`* - The number of seconds of "frequency" to run this task. Specifying `1` for example would run your task ever one second.
* static **startDelay** *`<number>`* - The number of seconds of delay before first running this task. Specifying `10` for example would run your task ten seconds after the application starts. This can be useful to interlace tasks, so they don't all run at once.
* static **workers** *`<number>`* - The number of workers to run. For example, specifying a value of `4` would mean that your task would be running four instances at any given time.
* static **keepAlive** *`<boolean>`* - By default, tasks instances are destroyed and recreated upon every invocation of the task. If you specify `static keepAlive = true`, then your task instances will instead be held in memory and re-used upon every invocation. This can be useful if you need expensive operations that run the first time the task is created.

#### Arguments

* **taskName** *`<string>`* - Specify the name of your task.
* **definer** *`function(context <object>)`* - Callback method that is used to create your task class. This method is expected to return a new task class.
  *  `context`:
      * **`Parent`** - The parent class your task should inherit from. If no parent task class was specified as the third argument `ParentTaskClassToInheritFrom`, then this defaults to `Mythix.TaskBase`.
      * **`application`** - The `mythix` application instance of the currently running application.
      * **`Sequelize`** - `Sequelize` module that was loaded by `mythix`.
      * **`connection`** - The database connection used by the currently running `mythix` application. This is an instance of `sequelize`.
      * **`taskName`** - The same `taskName` string given to the call to `defineModel`.
      * **`dbConfig`** - The database config object, used to connect to the database with `Sequelize`.
      * **`time`** - This is an instance of the internal class `TimeHelpers`. It is a simple interface to allow easily defining time based on `days`, `hours`, `minutes`, and `seconds`. It is recommended that you use this for the static properties `frequency` and `startDelay`. i.e. `static frequency = time.days(1).hours(8).minutes(30)`.
* *(optional)* **ParentTaskClassToInheritFrom** *`<class extends Mythix.TaskBase>`* - If specified, this this will be assigned to `context.Parent`, which your task class should always extend from.

#### Return

The return value will be a task class, inherited from `Mythix.TaskBase`.

#### Example

```javascript
const { defineTask } = require('mythix');

module.exports = defineTask('CustomTask', ({ Parent, time }) => {
  return class CustomTask extends Parent {
    static workers    = 4;
    static frequency  = time.days(1);
    static startDelay = time.minutes(30);
    static keepAlive  = true;
    static enabled    = true;

    // Execute is called every time the task
    // is scheduled to run
    async execute() {
      // ... do some task
    }
  };
});
```

## TODO:

Continue writing documentation... Help would be appreciated!
