import { spawn }   from 'child_process';
import { Utils }   from 'mythix-orm';

export class CommandBase {
  static getCommandName() {
    return this.name.toLowerCase().replace(/command$/i, '');
  }

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

  getCLIConfig() {
    return this.options.cliConfig || {};
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

  /// Capture the current AsyncLocalStorage context and return a function
  /// that will execute callbacks within that captured context.
  ///
  /// This is useful for preserving database context across event emitters,
  /// setTimeout, or other callbacks where context might otherwise be lost.
  ///
  /// Return: Function
  ///   A function that takes a callback and executes it in the captured context.
  captureContext() {
    return Utils.captureContext();
  }

  /// Wrap a callback function to preserve the current AsyncLocalStorage context.
  ///
  /// This is a convenience wrapper for use with event handlers and other callbacks
  /// where you want to ensure database context is preserved.
  ///
  /// Arguments:
  ///   callback: Function
  ///     The callback function to wrap.
  ///
  /// Return: Function
  ///   A wrapped version of the callback that will execute in the captured context.
  bindCallback(callback) {
    return Utils.bindCallback(callback);
  }

  spawnCommand(command, args, options) {
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
}
