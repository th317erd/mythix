'use strict';

/* global __dirname */

const { createTestApplication } = require('../../src/utils/test-utils');
const { Application }           = require('../../src/application');

class _TestApplicationShim extends Application {
  getRoutes() {
    return [];
  }
}

const TestApplication = createTestApplication(_TestApplicationShim);

async function newTestApplication() {
  let app = new TestApplication({
    environment:  'test',
    rootPath:     __dirname,
    logger:       {
      level: 0,
    },
  });

  await app.start();

  app.setConfig({
    application: {
      test: {
        domain: 'test.mythix.io',
      },
    },
    salt:         ('' + Math.random()),
  });

  app.setDefaultHeaders({
    'Content-Type': 'application/json',
  });

  return app;
}

const UUID_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA512_REGEXP = /[a-f0-9]{64}/;

module.exports = {
  newTestApplication,
  TestApplication,
  SHA512_REGEXP,
  UUID_REGEXP,
};
