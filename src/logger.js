const Path        = require('path');
const FileSystem  = require('fs');

const LEVEL_ERROR   = 1;
const LEVEL_LOG     = 2;
const LEVEL_WARN    = 3;
const LEVEL_INFO    = 4;
const LEVEL_DEBUG   = 5;

function errorStackToString(rootPath, error) {
  return ('\n -> ' + error.stack.split(/\n+/).slice(1).map((part) => `${part.replace(/^\s+at\s+/, '')}\n`).join(' -> ')).trimEnd();
}

function writeToWriterObject(writer, type, _output) {
  let method = writer[type];
  let output = _output;

  if (this._customWriter || typeof method !== 'function') {
    method = writer.write;
    output = `${output}\n`;
  }

  if (typeof method === 'function')
    method.call(writer, output);
}

function logToWriter(type, ..._args) {
  let args = (_args.map((_arg) => {
    let arg = _arg;

    if (arg instanceof Error) {
      let formattedStack = (typeof this._errorStackFormatter === 'function')
        ? this._errorStackFormatter.call(this, this._rootPath, arg)
        : errorStackToString.call(this, this._rootPath, arg);

      arg = `${arg.name}: ${arg.message}: ${formattedStack}`;
    } else if (arg && typeof arg.valueOf() === 'function')
      arg = arg.valueOf();


    if (arg === true)
      return 'true';
    else if (arg === false)
      return 'false';
    else if (typeof arg === 'number')
      return ('' + arg);
    else if (typeof arg === 'string')
      return arg;

    try {
      arg = JSON.stringify(arg);
    } catch (error) {
      if (error.message = 'Converting circular structure to JSON')
        return '<circular>';

      return `<LOGGER_ERROR: ${error.message}>`;
    }

    return arg;
  }));

  let formatter = this._formatter;
  let writer    = this._writer;
  let content   = args.join(' ');
  let output    = `${type.charAt(0).toUpperCase()}, [${(new Date()).toISOString()} #${this._pid}] -- : ${(typeof formatter === 'function') ? formatter(content) : content}`;

  writeToWriterObject.call(this, (!writer) ? console : writer, type, output);
}

class Logger {
  constructor(_opts) {
    let opts = Object.assign({
      level:                LEVEL_INFO,
      writer:               null,
      rootPath:             process.cwd(),
      errorStackFormatter:  null,
    }, _opts || {}, {
      pid:      process.pid,
    });

    // If string, assume file path
    let customWriter = false;
    if (typeof opts.writer === 'string') {
      opts.writer = FileSystem.createWriteStream(opts.writer, {
        flags:      'a',
        encoding:   'utf8',
        emitClose:  true,
      });

      customWriter = true;
    }

    Object.defineProperties(this, {
      '_level': {
        writable:     true,
        enumerable:   false,
        configurable: false,
        value:        opts.level,
      },
      '_writer': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        opts.writer,
      },
      '_customWriter': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        customWriter,
      },
      '_pid': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        opts.pid,
      },
      '_formatter': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        opts.formatter,
      },
      '_rootPath': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        opts.rootPath,
      },
      '_errorStackFormatter': {
        writable:     false,
        enumerable:   false,
        configurable: false,
        value:        opts.errorStackFormatter,
      },
    });
  }

  setLevel(level) {
    this._level = level;
  }

  clone(extraOpts) {
    return new this.constructor(Object.assign({
      level:                this._level,
      writer:               this._writer,
      pid:                  this._pid,
      formatter:            this._formatter,
      rootPath:             this._rootPath,
      errorStackFormatter:  this._errorStackFormatter,
    }, extraOpts || {}));
  }

  isErrorLevel() {
    return (this._level >= LEVEL_ERROR);
  }

  isLogLevel() {
    return (this._level >= LEVEL_LOG);
  }

  isWarningLevel() {
    return (this._level >= LEVEL_WARN);
  }

  isInfoLevel() {
    return (this._level >= LEVEL_INFO);
  }

  isDebugLevel() {
    return (this._level >= LEVEL_DEBUG);
  }

  error(...args) {
    if (this.isErrorLevel())
      logToWriter.call(this, 'error', ...args);
  }

  warn(...args) {
    if (this.isWarningLevel())
      logToWriter.call(this, 'warn', ...args);
  }

  info(...args) {
    if (this.isInfoLevel())
      logToWriter.call(this, 'info', ...args);
  }

  debug(...args) {
    if (this.isDebugLevel())
      logToWriter.call(this, 'debug', ...args);
  }

  log(...args) {
    if (this.isLogLevel())
      logToWriter.call(this, 'log', ...args);
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (this._customWriter) {
        this._writer.end((err) => {
          if (err)
            return reject(err);

          resolve();
        });
      } else
        resolve();

    });
  }
}

Object.assign(Logger, {
  ERROR:  LEVEL_ERROR,
  LOG:    LEVEL_LOG,
  WARN:   LEVEL_WARN,
  INFO:   LEVEL_INFO,
  DEBUG:  LEVEL_DEBUG,
});

module.exports = {
  Logger,
};
