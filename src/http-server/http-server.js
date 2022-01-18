const FileSystem  = require('fs');
const HTTP        = require('http');
const HTTPS       = require('https');
const Express     = require('express');

class HTTPServer {
  constructor(application, _opts) {
    var opts = Object.assign({
      host:   'localhost',
      port:   '8000',
      https:  false,
    });

    Object.defineProperties(this, {
      'application': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        application,
      },
      'server': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        null,
      },
      'options': {
        writable:     false,
        enumberable:  false,
        configurable: true,
        value:        opts,
      },
      'routes': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
    });
  }

  getApplication() {
    return this.application;
  }

  getLogger() {
    var application = this.getApplication();
    return application.getLogger();
  }

  getOptions() {
    return this.options;
  }

  getHTTPSCredentials(options) {
    var keyContent = options.key;
    if (!keyContent && options.keyPath)
      keyContent = FileSystem.readFileSync(options.keyPath, 'latin1');

    var certContent = options.cert;
    if (!certContent && options.certPath)
      certContent = FileSystem.readFileSync(options.certPath, 'latin1');

    return {
      key:  keyContent,
      cert: certContent,
    };
  }

  setRoutes(routes) {
    this.routes = routes;
  }

  async start() {
    var options = this.getOptions();
    var app     = Express();
    var server;

    if (options.https) {
      var credentials = await this.getHTTPSCredentials(options.https);
      server = HTTPS.createServer(credentials, app);
    } else {
      server = HTTP.createServer(app);
    }

    server.listen(options.port);

    this.server = server;

    return server;
  }

  async stop() {
    var server = this.server;
    if (!server)
      return;

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error)
            return reject(error);

          resolve();
        });
      });
    } catch (error) {
      this.getLogger().error('Error stopping HTTP server: ', error);
    }
  }
}

module.exports = {
  HTTPServer,
};
