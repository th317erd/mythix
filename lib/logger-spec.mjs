/* eslint-disable no-magic-numbers */
/* global jasmine */

import { Logger } from './logger.mjs';

describe('Logger', () => {
  let fakeConsole;
  let consoleOutput;
  let logger;

  beforeAll(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2000, 0, 1, 12, 0, 0, 0));
  });

  beforeEach(() => {
    const createConsoleMethod = (name) => {
      return function(...args) {
        if (!consoleOutput[name])
          consoleOutput[name] = [];

        consoleOutput[name].push(args);
      };
    };

    consoleOutput = {};

    fakeConsole = {
      debug:  createConsoleMethod('debug'),
      error:  createConsoleMethod('error'),
      info:   createConsoleMethod('info'),
      log:    createConsoleMethod('log'),
      warn:   createConsoleMethod('warn'),
    };

    logger = new Logger({ writer: fakeConsole, pid: 777 });
  });

  it('works', () => {
    logger.error('Testing 123', true, 3.14, 'Hello World!', { test: 'stuff' }, [ 'wow', 1, 2, 3 ]);
    expect(consoleOutput.error[0]).toEqual([ 'E, [2000-01-01T19:00:00.000Z #777] -- : Testing 123 true 3.14 Hello World! {"test":"stuff"} ["wow",1,2,3]' ]);

    logger.log('Testing 123', true, 3.14, 'Hello World!', { test: 'stuff' }, [ 'wow', 1, 2, 3 ]);
    expect(consoleOutput.log[0]).toEqual([ 'L, [2000-01-01T19:00:00.000Z #777] -- : Testing 123 true 3.14 Hello World! {"test":"stuff"} ["wow",1,2,3]' ]);

    logger.warn('Testing 123', true, 3.14, 'Hello World!', { test: 'stuff' }, [ 'wow', 1, 2, 3 ]);
    expect(consoleOutput.warn[0]).toEqual([ 'W, [2000-01-01T19:00:00.000Z #777] -- : Testing 123 true 3.14 Hello World! {"test":"stuff"} ["wow",1,2,3]' ]);

    logger.info('Testing 123', true, 3.14, 'Hello World!', { test: 'stuff' }, [ 'wow', 1, 2, 3 ]);
    expect(consoleOutput.info[0]).toEqual([ 'I, [2000-01-01T19:00:00.000Z #777] -- : Testing 123 true 3.14 Hello World! {"test":"stuff"} ["wow",1,2,3]' ]);

    logger.debug('Testing 123', true, 3.14, 'Hello World!', { test: 'stuff' }, [ 'wow', 1, 2, 3 ]);
    expect(consoleOutput.debug[0]).toEqual([ 'D, [2000-01-01T19:00:00.000Z #777] -- : Testing 123 true 3.14 Hello World! {"test":"stuff"} ["wow",1,2,3]' ]);
  });

  it('can set a log level', () => {
    const writeAll = () => {
      consoleOutput = {};

      logger.error('test');
      logger.log('test');
      logger.warn('test');
      logger.info('test');
      logger.debug('test');
    };

    // Level 0 (no messages)
    logger.setLevel(0);
    writeAll();
    expect(consoleOutput.error).toBe(undefined);
    expect(consoleOutput.log).toBe(undefined);
    expect(consoleOutput.warn).toBe(undefined);
    expect(consoleOutput.info).toBe(undefined);
    expect(consoleOutput.debug).toBe(undefined);

    // Level 1 (only errors)
    logger.setLevel(Logger.LEVEL_ERROR);
    writeAll();
    expect(consoleOutput.error).toEqual([ [ 'E, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.log).toBe(undefined);
    expect(consoleOutput.warn).toBe(undefined);
    expect(consoleOutput.info).toBe(undefined);
    expect(consoleOutput.debug).toBe(undefined);

    // Level 2 (error, and log)
    logger.setLevel(Logger.LEVEL_LOG);
    writeAll();
    expect(consoleOutput.error).toEqual([ [ 'E, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.log).toEqual([ [ 'L, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.warn).toBe(undefined);
    expect(consoleOutput.info).toBe(undefined);
    expect(consoleOutput.debug).toBe(undefined);

    // Level 3 (error, log, and warn)
    logger.setLevel(Logger.LEVEL_WARN);
    writeAll();
    expect(consoleOutput.error).toEqual([ [ 'E, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.log).toEqual([ [ 'L, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.warn).toEqual([ [ 'W, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.info).toBe(undefined);
    expect(consoleOutput.debug).toBe(undefined);

    // Level 3 (error, log, warn, and info)
    logger.setLevel(Logger.LEVEL_INFO);
    writeAll();
    expect(consoleOutput.error).toEqual([ [ 'E, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.log).toEqual([ [ 'L, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.warn).toEqual([ [ 'W, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.info).toEqual([ [ 'I, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.debug).toBe(undefined);

    // Level 4 (error, log, warn, info, and debug)
    logger.setLevel(Logger.LEVEL_DEBUG);
    writeAll();
    expect(consoleOutput.error).toEqual([ [ 'E, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.log).toEqual([ [ 'L, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.warn).toEqual([ [ 'W, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.info).toEqual([ [ 'I, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
    expect(consoleOutput.debug).toEqual([ [ 'D, [2000-01-01T19:00:00.000Z #777] -- : test' ] ]);
  });
});
