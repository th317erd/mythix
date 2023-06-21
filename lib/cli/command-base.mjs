import { spawn } from 'child_process';

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
