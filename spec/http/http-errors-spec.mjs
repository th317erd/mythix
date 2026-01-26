/* eslint-disable no-magic-numbers */

import {
  HTTPBaseError,
  HTTPNotFoundError,
  HTTPBadRequestError,
  HTTPBadContentTypeError,
  HTTPUnauthorizedError,
  HTTPForbiddenError,
  HTTPInternalServerError,
} from '../../lib/http/http-errors.mjs';

describe('HTTPErrors', () => {
  describe('HTTPBaseError', () => {
    it('extends Error', () => {
      const error = new HTTPBaseError(null, 'test');
      expect(error instanceof Error).toBe(true);
    });

    it('sets route property', () => {
      const route = { path: '/test' };
      const error = new HTTPBaseError(route, 'test');
      expect(error.route).toBe(route);
    });

    it('sets message property', () => {
      const error = new HTTPBaseError(null, 'custom message');
      expect(error.message).toBe('custom message');
    });

    it('defaults status code to 500', () => {
      const error = new HTTPBaseError(null, 'test');
      expect(error.statusCode).toBe(500);
    });

    it('allows custom status code', () => {
      const error = new HTTPBaseError(null, 'test', 418);
      expect(error.statusCode).toBe(418);
    });

    it('uses default message when none provided', () => {
      const error = new HTTPBaseError(null, null, 404);
      expect(error.message).toBe('Not Found');
    });

    it('initializes empty headers object', () => {
      const error = new HTTPBaseError(null, 'test');
      expect(error.headers).toEqual({});
    });

    it('getMessage returns message', () => {
      const error = new HTTPBaseError(null, 'custom message');
      expect(error.getMessage()).toBe('custom message');
    });
  });

  describe('HTTPNotFoundError', () => {
    it('extends HTTPBaseError', () => {
      const error = new HTTPNotFoundError(null, 'test');
      expect(error instanceof HTTPBaseError).toBe(true);
    });

    it('has status code 404', () => {
      const error = new HTTPNotFoundError(null, 'test');
      expect(error.statusCode).toBe(404);
    });

    it('uses default message when none provided', () => {
      const error = new HTTPNotFoundError(null);
      expect(error.message).toBe('Not Found');
    });

    it('accepts custom message', () => {
      const error = new HTTPNotFoundError(null, 'Resource not found');
      expect(error.message).toBe('Resource not found');
    });

    it('stores route', () => {
      const route = { path: '/users/123' };
      const error = new HTTPNotFoundError(route, 'User not found');
      expect(error.route).toBe(route);
    });
  });

  describe('HTTPBadRequestError', () => {
    it('extends HTTPBaseError', () => {
      const error = new HTTPBadRequestError(null, 'test');
      expect(error instanceof HTTPBaseError).toBe(true);
    });

    it('has status code 400', () => {
      const error = new HTTPBadRequestError(null, 'test');
      expect(error.statusCode).toBe(400);
    });

    it('uses default message when none provided', () => {
      const error = new HTTPBadRequestError(null);
      expect(error.message).toBe('Bad Request');
    });

    it('accepts custom message', () => {
      const error = new HTTPBadRequestError(null, 'Invalid input');
      expect(error.message).toBe('Invalid input');
    });
  });

  describe('HTTPBadContentTypeError', () => {
    it('extends HTTPBaseError', () => {
      const error = new HTTPBadContentTypeError(null, 'test');
      expect(error instanceof HTTPBaseError).toBe(true);
    });

    it('has status code 400', () => {
      const error = new HTTPBadContentTypeError(null, 'test');
      expect(error.statusCode).toBe(400);
    });

    it('getMessage returns message when no route', () => {
      const error = new HTTPBadContentTypeError(null, 'Bad content type');
      expect(error.getMessage()).toBe('Bad content type');
    });

    it('getMessage includes accepted content types from route (string)', () => {
      const route = { contentType: 'application/json' };
      const error = new HTTPBadContentTypeError(route, 'Invalid');
      expect(error.getMessage()).toBe("Invalid: Accepted Content-Types are [ 'application/json' ]");
    });

    it('getMessage includes accepted content types from route (array)', () => {
      const route = { contentType: ['application/json', 'text/xml'] };
      const error = new HTTPBadContentTypeError(route, 'Invalid');
      expect(error.getMessage()).toBe("Invalid: Accepted Content-Types are [ 'application/json', 'text/xml' ]");
    });

    it('getMessage handles RegExp content types', () => {
      const route = { contentType: /application\/.*json/ };
      const error = new HTTPBadContentTypeError(route, 'Invalid');
      expect(error.getMessage()).toContain('RegExp[');
    });

    it('getMessage handles mixed content types', () => {
      const route = { contentType: ['application/json', /text\/.*/] };
      const error = new HTTPBadContentTypeError(route, 'Invalid');
      const message = error.getMessage();
      expect(message).toContain("'application/json'");
      expect(message).toContain('RegExp[');
    });

    it('getMessage without custom message shows default with accepted types', () => {
      const route = { contentType: 'application/json' };
      const error = new HTTPBadContentTypeError(route);
      // When no message provided, this.message is the default status message "Bad Request"
      expect(error.getMessage()).toBe("Bad Request: Accepted Content-Types are [ 'application/json' ]");
    });

    it('getMessage filters out non-string/non-RegExp content types', () => {
      const route = { contentType: ['application/json', null, 123, 'text/xml'] };
      const error = new HTTPBadContentTypeError(route, 'Invalid');
      expect(error.getMessage()).toBe("Invalid: Accepted Content-Types are [ 'application/json', 'text/xml' ]");
    });
  });

  describe('HTTPUnauthorizedError', () => {
    it('extends HTTPBaseError', () => {
      const error = new HTTPUnauthorizedError(null, 'test');
      expect(error instanceof HTTPBaseError).toBe(true);
    });

    it('has status code 401', () => {
      const error = new HTTPUnauthorizedError(null, 'test');
      expect(error.statusCode).toBe(401);
    });

    it('uses default message when none provided', () => {
      const error = new HTTPUnauthorizedError(null);
      expect(error.message).toBe('Unauthorized');
    });

    it('accepts custom message', () => {
      const error = new HTTPUnauthorizedError(null, 'Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('HTTPForbiddenError', () => {
    it('extends HTTPBaseError', () => {
      const error = new HTTPForbiddenError(null, 'test');
      expect(error instanceof HTTPBaseError).toBe(true);
    });

    it('has status code 403', () => {
      const error = new HTTPForbiddenError(null, 'test');
      expect(error.statusCode).toBe(403);
    });

    it('uses default message when none provided', () => {
      const error = new HTTPForbiddenError(null);
      expect(error.message).toBe('Forbidden');
    });

    it('accepts custom message', () => {
      const error = new HTTPForbiddenError(null, 'Access denied');
      expect(error.message).toBe('Access denied');
    });
  });

  describe('HTTPInternalServerError', () => {
    it('extends HTTPBaseError', () => {
      const error = new HTTPInternalServerError(null, 'test');
      expect(error instanceof HTTPBaseError).toBe(true);
    });

    it('has status code 500', () => {
      const error = new HTTPInternalServerError(null, 'test');
      expect(error.statusCode).toBe(500);
    });

    it('uses default message when none provided', () => {
      const error = new HTTPInternalServerError(null);
      expect(error.message).toBe('Internal Server Error');
    });

    it('accepts custom message', () => {
      const error = new HTTPInternalServerError(null, 'Database connection failed');
      expect(error.message).toBe('Database connection failed');
    });
  });

  describe('Error inheritance chain', () => {
    it('all errors are instances of Error', () => {
      expect(new HTTPNotFoundError(null) instanceof Error).toBe(true);
      expect(new HTTPBadRequestError(null) instanceof Error).toBe(true);
      expect(new HTTPBadContentTypeError(null) instanceof Error).toBe(true);
      expect(new HTTPUnauthorizedError(null) instanceof Error).toBe(true);
      expect(new HTTPForbiddenError(null) instanceof Error).toBe(true);
      expect(new HTTPInternalServerError(null) instanceof Error).toBe(true);
    });

    it('all errors are instances of HTTPBaseError', () => {
      expect(new HTTPNotFoundError(null) instanceof HTTPBaseError).toBe(true);
      expect(new HTTPBadRequestError(null) instanceof HTTPBaseError).toBe(true);
      expect(new HTTPBadContentTypeError(null) instanceof HTTPBaseError).toBe(true);
      expect(new HTTPUnauthorizedError(null) instanceof HTTPBaseError).toBe(true);
      expect(new HTTPForbiddenError(null) instanceof HTTPBaseError).toBe(true);
      expect(new HTTPInternalServerError(null) instanceof HTTPBaseError).toBe(true);
    });

    it('errors can be caught as HTTPBaseError', () => {
      let caught = null;
      try {
        throw new HTTPNotFoundError(null, 'test');
      } catch (error) {
        if (error instanceof HTTPBaseError) {
          caught = error;
        }
      }
      expect(caught).not.toBeNull();
      expect(caught.statusCode).toBe(404);
    });
  });

  describe('Error headers', () => {
    it('headers can be modified', () => {
      const error = new HTTPUnauthorizedError(null, 'test');
      error.headers['WWW-Authenticate'] = 'Bearer';
      expect(error.headers['WWW-Authenticate']).toBe('Bearer');
    });

    it('headers are unique per instance', () => {
      const error1 = new HTTPNotFoundError(null);
      const error2 = new HTTPNotFoundError(null);
      error1.headers['X-Custom'] = 'value1';
      expect(error2.headers['X-Custom']).toBeUndefined();
    });
  });
});
