'use strict';

/* global describe, it, beforeAll, expect */

const { generateClientAPIInterface }  = require('../../src/controllers/generate-client-api-interface');
const { newTestApplication }          = require('../support/application');

function getRoutes() {
  console.log('HERE!');

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
              'methods':    [ 'POST' ],
              'accept':     [ 'application/json' ],
              'controller': 'AuthController.authenticate',
            },
          ],
          'sendMagicLink': [
            {
              'methods':    [ 'POST' ],
              'accept':     [ 'application/json' ],
              'controller': 'AuthController.sendMagicLink',
            },
          ],
          'registerUser': [
            {
              'methods':    [ 'POST' ],
              'accept':     [ 'application/json' ],
              'controller': 'AuthController.registerUser',
            },
          ],
        },
        'user': {
          '/<userID:string>': [
            {
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'UserController.show',
            },
            {
              'methods':    [ 'POST', 'PATCH' ],
              'accept':     [ 'application/json' ],
              'controller': 'UserController.update',
            },
          ],
          '/search':    {
            'methods':    [ 'POST' ],
            'accept':     [ 'application/json' ],
            'controller': 'UserController.list',
          },
          '/': [
            {
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'UserController.list',
            },
          ],
        },
        'organization': {
          '/<organizationID:string>': [
            {
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.show',
            },
            {
              'methods':    [ 'POST', 'PATCH' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.update',
            },
          ],
          '/<organizationID:string>/inviteUser': [
            {
              'methods':    [ 'POST' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.inviteUser',
            },
          ],
          '/search':    {
            'methods':    [ 'POST' ],
            'accept':     [ 'application/json' ],
            'controller': 'OrganizationController.list',
          },
          '/': [
            {
              'methods':    [ 'GET' ],
              'accept':     [ 'application/json' ],
              'controller': 'OrganizationController.list',
            },
            {
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
    app = await newTestApplication();
    app.getRoutes = getRoutes.bind(app);
  });

  it('should be able to generate an interface using route definitions', () => {
    let result = generateClientAPIInterface(app);
    console.log(result);
  });
});
