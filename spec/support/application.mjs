import { createTestApplication }  from '../../lib/utils/test-utils.js';
import { Application }            from '../../lib/application.js';

class _TestApplicationShim extends Application {
  getRoutes() {
    return [];
  }
}

const TestApplication = createTestApplication(_TestApplicationShim);

async function newTestApplication() {
  let app = new TestApplication({
    environment:  'test',
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

export {
  newTestApplication,
  TestApplication,
  SHA512_REGEXP,
  UUID_REGEXP,
};
