'use strict';

/* global describe, it, beforeAll, expect, __dirname */

const { generateClientAPIInterface }  = require('../../src/controllers/generate-client-api-interface');
const { newTestApplication }          = require('../support/application');
const { _matchesSnapshot }            = require('../support/snapshots');

const matchesSnapshot = _matchesSnapshot.bind(this, __dirname);

function getRoutes() {
  return {
    'api': {
      'v1': {
        'auth': {
          'authenticate': [
            {
              'methods':    [ 'GET' ],
              'controller': 'AuthController.authenticate',
            },
            {
              'name':       'login',
              'methods':    [ 'POST' ],
              'accept':     [ 'application/json' ],
              'controller': 'AuthController.authenticate',
            },
          ],
          'sendMagicLink': [
            {
              'name':       'sendMagicLink',
              'methods':    [ 'POST' ],
              'accept':     [ 'application/json' ],
              'controller': 'AuthController.sendMagicLink',
            },
          ],
          'registerUser': [
            {
              'name':       'registerUser',
              'methods':    [ 'POST' ],
              'accept':     [ 'application/json' ],
              'controller': 'AuthController.registerUser',
            },
          ],
        },
        'user': {
          '/<userID:string>': [
            {
              'name':       'getUser',
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'UserController.show',
            },
            {
              'name':       'updateUser',
              'methods':    [ 'POST', 'PATCH' ],
              'accept':     [ 'application/json' ],
              'controller': 'UserController.update',
            },
          ],
          '/search':    {
            'name':       'searchUsers',
            'methods':    [ 'POST' ],
            'accept':     [ 'application/json' ],
            'controller': 'UserController.list',
          },
          '/': [
            {
              'name':       'getUsers',
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'UserController.list',
            },
          ],
        },
        'organization': {
          '/<organizationID:string>': [
            {
              'name':       'getOrganization',
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.show',
            },
            {
              'name':       'updateOrganization',
              'methods':    [ 'POST', 'PATCH' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.update',
            },
          ],
          '/<organizationID:string>/inviteUser': [
            {
              'name':       'inviteUserToOrganization',
              'methods':    [ 'POST' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.inviteUser',
            },
          ],
          '/search':    {
            'name':       'searchOrganizations',
            'methods':    [ 'POST' ],
            'accept':     [ 'application/json' ],
            'controller': 'OrganizationController.list',
          },
          '/': [
            {
              'name':       'getOrganizations',
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.list',
            },
            {
              'name':       'createOrganization',
              'methods':    [ 'PUT' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.create',
            },
          ],
        },
      },
    },
  };
}

describe('generateClientAPIInterface', () => {
  let app;

  beforeAll(async () => {
    try {
      app = await newTestApplication();
      app.getRoutes = getRoutes.bind(app);
    } catch (error) {
      console.error('Error in beforeAll: ', error);
    }
  });

  it('should be able to generate an interface using route definitions', () => {
    let result = generateClientAPIInterface(app);
    expect(matchesSnapshot('generateClientAPIInterface01', result)).toBe(true);
  });

  it('should be able to generate an interface for node', () => {
    let result = generateClientAPIInterface(app, { environment: 'node' });
    expect(matchesSnapshot('generateClientAPIInterface02', result)).toBe(true);
  });

  it('should be able to generate an interface for the browser', () => {
    let result = generateClientAPIInterface(app, { environment: 'browser' });
    expect(matchesSnapshot('generateClientAPIInterface03', result)).toBe(true);
  });

  it('should be able to export a global', () => {
    let result = generateClientAPIInterface(app, { globalName: 'API' });
    expect(matchesSnapshot('generateClientAPIInterface04', result)).toBe(true);
  });

  it('should be able to specify a domain', () => {
    let result = generateClientAPIInterface(app, { domain: 'http://localhost:8080' });
    expect(matchesSnapshot('generateClientAPIInterface05', result)).toBe(true);
  });
});
