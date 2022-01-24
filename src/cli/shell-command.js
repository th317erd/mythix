const Nife              = require('nife');
const OS                = require('os');
const Path              = require('path');
const REPL              = require('repl');
const UUIDV4            = require('uuid').v4;
const { Sequelize }     = require('sequelize');
const { defineCommand } = require('./cli-utils');
const http              = require('http');
const { URL }           = require('url');

module.exports = defineCommand('shell', ({ Parent }) => {
  return class ShellCommand extends Parent {
    static description    = 'Drop into an application shell to execute commands directly';
    static nodeArguments  = [ '--experimental-repl-await', '--experimental-top-level-await' ];

    constructor(...args) {
      super(...args);

      Object.defineProperties(this, {
        'defaultHeaders': {
          writable:     true,
          enumberable:  false,
          configurable: true,
          value:        {},
        },
        'defaultURL': {
          writable:     true,
          enumberable:  false,
          configurable: true,
          value:        null,
        },
      });
    }

    execute(args) {
      return new Promise((resolve, reject) => {
        var application = this.getApplication();
        var environment = application.getConfigValue('environment', 'development');
        var appName     = application.getApplicationName();

        const interactiveShell = REPL.start({
          prompt: `${appName} (${environment}) > `,
        });

        interactiveShell.on('exit', () => {
          resolve(0);
        });

        interactiveShell.setupHistory(Path.join(OS.homedir(), `.${appName}-${environment}-history`), (error, server) => {});

        interactiveShell.context.UUIDV4 = UUIDV4;
        interactiveShell.context.Sequelize = Sequelize;
        interactiveShell.context.connection = application.getDBConnection();
        interactiveShell.context.application = application;
        interactiveShell.context.Nife = Nife;

        interactiveShell.context.HTTP = {
          'getDefaultURL':      this.getDefaultURL.bind(this),
          'setDefaultURL':      this.setDefaultURL.bind(this),
          'getDefaultHeader':   this.getDefaultHeader.bind(this),
          'getDefaultHeaders':  this.getDefaultHeaders.bind(this),
          'setDefaultHeader':   this.setDefaultHeader.bind(this),
          'setDefaultHeaders':  this.setDefaultHeaders.bind(this),
          'request':            this.anyRequest.bind(this),
          'get':                this.getRequest.bind(this),
          'post':               this.postRequest.bind(this),
          'put':                this.putRequest.bind(this),
          'delete':             this.deleteRequest.bind(this),
          'head':               this.headRequest.bind(this),
          'options':            this.optionsRequest.bind(this),
        };

        Object.assign(interactiveShell.context, application.getModels());

        this.onStart(interactiveShell);
      });
    }

    onStart() {}

    getDefaultURL() {
      return this.defaultURL;
    }

    setDefaultURL(url) {
      this.defaultURL = (url) ? url.replace(/\/+$/, '') : url;
      return this;
    }

    getDefaultHeader(headerName) {
      if (this.defaultHeaders)
        return;

      return this.defaultHeaders[headerName];
    }

    getDefaultHeaders() {
      return this.defaultHeaders;
    }

    setDefaultHeader(headerName, value) {
      if (!this.defaultHeaders)
        this.defaultHeaders = {};

      this.defaultHeaders[headerName] = value;

      return this;
    }

    setDefaultHeaders(headers) {
      if (!this.defaultHeaders)
        this.defaultHeaders = {};

      var keys = Object.keys(headers);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key   = keys[i];
        var value = headers[key];

        if (value == null)
          continue;

        this.defaultHeaders[key] = value;
      }

      return this;
    }

    makeRequest(requestOptions) {
      return new Promise((resolve, reject) => {
        if (Nife.isEmpty(requestOptions.url))
          reject('"url" key not found and is required');

        var method      = (requestOptions.method || 'GET').toUpperCase();
        var url         = new URL(requestOptions.url);
        var data        = (!method.match(/^(GET|HEAD)$/i) && requestOptions.data) ? requestOptions.data : undefined;
        var extraConfig = {};

        if (data) {
          if (Nife.get(requestOptions, 'headers.Content-Type').match(/application\/json/))
            data = JSON.stringify(data);

          extraConfig = {
            headers: {
              'Content-Length': Buffer.byteLength(data),
            },
          };
        }

        const options = Nife.extend(true, {
          protocol: url.protocol,
          hostname: url.hostname,
          port:     url.port,
          path:     `${url.pathname}${url.search}`,
          method,
          headers: Object.assign({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
          }, this.defaultHeaders || {}),
        }, requestOptions, extraConfig);

        delete options.data;

        console.log('REQUEST INFO: ', options);

        var request = http.request(options, (response) => {
          var data = Buffer.alloc(0);

          response.on('data', (chunk) => {
            data = Buffer.concat([ data, chunk ]);
          });

          response.on('error', (error) => {
            reject(error);
          });

          response.on('end', () => {
            response.rawBody = response.body = data;

            try {
              var contentType = response.headers['content-type'];
              if (contentType && contentType.match(/application\/json/))
                response.body = JSON.parse(data.toString('utf8'));
              else if (contentType && contentType.match(/text\/(plain|html)/))
                response.body = data.toString('utf8');
            } catch (error) {
              return reject(error);
            }

            resolve(response);
          });
        });

        request.on('error', (error) => {
          reject(error);
        });

        if (data) {
          console.log("SENDING DATA: ", data);

          request.write(data);
        }

        request.end();
      });
    }

    getRequestOptions(_url, _options, method) {
      var url     = _url;
      var options = _options;

      if (Nife.instanceOf(url, 'object')) {
        options = url;
        url     = options.url;
      }

      var finalOptions = Nife.extend({}, options || {}, { url });
      var defaultURL = this.defaultURL;

      if (defaultURL && finalOptions.url.charAt(0) === '/')
        finalOptions.url = defaultURL + finalOptions.url;

      if (method)
        finalOptions.method = method;

      return finalOptions;
    }

    async anyRequest(url, options) {
      return await this.makeRequest(this.getRequestOptions(url, options));
    }

    async getRequest(url, options) {
      return await this.makeRequest(this.getRequestOptions(url, options, 'GET'));
    }

    async postRequest(url, options) {
      return await this.makeRequest(this.getRequestOptions(url, options, 'POST'));
    }

    async putRequest(url, options) {
      return await this.makeRequest(this.getRequestOptions(url, options, 'PUT'));
    }

    async deleteRequest(url, options) {
      return await this.makeRequest(this.getRequestOptions(url, options, 'DELETE'));
    }

    async headRequest(url, options) {
      return await this.makeRequest(this.getRequestOptions(url, options, 'HEAD'));
    }

    async optionsRequest(url, options) {
      return await this.makeRequest(this.getRequestOptions(url, options, 'OPTIONS'));
    }
  };
});
