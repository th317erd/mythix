'use strict';

const Nife            = require('nife');
const { BaseModule }  = require('../modules/base-module');
const { HTTPServer }  = require('./index');

class HTTPServerModule extends BaseModule {
  static shouldUse(options) {
    if (options.httpServer === false)
      return false;

    return true;
  }

  static getName() {
    return 'HTTPServerModule';
  }

  constructor(application) {
    super(application);

    Object.defineProperties(this, {
      'server': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
      'httpServerConfig': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
    });

    // Inject methods into the application
    Object.defineProperties(application, {
      'getHTTPServer': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        this.getHTTPServer.bind(this),
      },
      'getHTTPServerConfig': {
        writable:     true,
        enumberable:  false,
        configurable: true,
        value:        this.getHTTPServerConfig.bind(this),
      },
    });
  }

  getHTTPServer() {
    return this.server;
  }

  getHTTPServerConfig() {
    return this.httpServerConfig;
  }

  async createHTTPServer(httpServerConfig) {
    let server = new HTTPServer(this.getApplication(), httpServerConfig);
    await server.start();

    return server;
  }

  async start(options) {
    if (options.httpServer === false)
      return;

    let httpServerConfig = this.getConfigValue('httpServer.{environment}');
    if (!httpServerConfig)
      httpServerConfig = this.getConfigValue('httpServer');

    httpServerConfig = Nife.extend(true, {}, httpServerConfig || {}, options.httpServer || {});
    if (Nife.isEmpty(httpServerConfig)) {
      this.getLogger().error(`Error: httpServer options for "${this.getConfigValue('environment')}" not defined`);
      return;
    }

    this.server = await this.createHTTPServer(httpServerConfig);

    this.httpServerConfig = httpServerConfig;
    this.getApplication().setOptions({ httpServer: httpServerConfig });
  }

  async stop() {
    if (!this.server)
      return;

    this.getLogger().info('Stopping HTTP server...');
    await this.server.stop();
    this.getLogger().info('HTTP server stopped successfully!');
  }
}

module.exports = {
  HTTPServerModule,
};