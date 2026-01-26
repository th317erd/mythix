/* eslint-disable no-magic-numbers */

import * as HTTPUtils from '../../lib/utils/http-utils.mjs';

describe('HTTPUtils', () => {
  describe('dataToQueryString', () => {
    it('returns empty string for null/undefined', () => {
      expect(HTTPUtils.dataToQueryString(null)).toBe('');
      expect(HTTPUtils.dataToQueryString(undefined)).toBe('');
    });

    it('returns empty string for empty object', () => {
      expect(HTTPUtils.dataToQueryString({})).toBe('');
    });

    it('converts simple key-value pairs', () => {
      const result = HTTPUtils.dataToQueryString({ name: 'test', value: '123' });
      expect(result).toBe('?name=test&value=123');
    });

    it('encodes special characters', () => {
      const result = HTTPUtils.dataToQueryString({ name: 'hello world', value: 'a&b=c' });
      expect(result).toBe('?name=hello%20world&value=a%26b%3Dc');
    });

    it('handles arrays', () => {
      const result = HTTPUtils.dataToQueryString({ items: ['a', 'b', 'c'] });
      expect(result).toBe('?items%5B%5D=a&items%5B%5D=b&items%5B%5D=c');
    });

    it('handles nested objects', () => {
      const result = HTTPUtils.dataToQueryString({ user: { name: 'test', age: 25 } });
      expect(result).toContain('user%5Bname%5D=test');
      expect(result).toContain('user%5Bage%5D=25');
    });

    it('handles nested arrays', () => {
      const result = HTTPUtils.dataToQueryString({ matrix: [['a', 'b'], ['c', 'd']] });
      expect(result).toContain('matrix%5B%5D%5B%5D=a');
      expect(result).toContain('matrix%5B%5D%5B%5D=b');
    });

    it('handles mixed nested structures', () => {
      const result = HTTPUtils.dataToQueryString({
        users: [
          { name: 'alice' },
          { name: 'bob' },
        ],
      });
      expect(result).toContain('users%5B%5D%5Bname%5D=alice');
      expect(result).toContain('users%5B%5D%5Bname%5D=bob');
    });

    it('skips empty values', () => {
      const result = HTTPUtils.dataToQueryString({ name: 'test', empty: '', nullVal: null });
      expect(result).toBe('?name=test');
    });

    it('supports custom initial character', () => {
      const result = HTTPUtils.dataToQueryString({ name: 'test' }, null, '&');
      expect(result).toBe('&name=test');
    });

    it('supports initial character as function', () => {
      const result = HTTPUtils.dataToQueryString({ name: 'test' }, null, () => '#');
      expect(result).toBe('#name=test');
    });

    it('supports empty initial character', () => {
      const result = HTTPUtils.dataToQueryString({ name: 'test' }, null, '');
      expect(result).toBe('name=test');
    });

    it('supports name formatter function', () => {
      const formatter = (name) => name.toUpperCase();
      const result = HTTPUtils.dataToQueryString({ name: 'test' }, formatter);
      expect(result).toBe('?NAME=test');
    });

    it('skips keys when name formatter returns falsy', () => {
      const formatter = (name) => name === 'skip' ? null : name;
      const result = HTTPUtils.dataToQueryString({ keep: 'yes', skip: 'no' }, formatter);
      expect(result).toBe('?keep=yes');
    });

    it('handles valueOf objects', () => {
      const obj = {
        custom: {
          valueOf() {
            return 'custom-value';
          },
        },
      };
      const result = HTTPUtils.dataToQueryString(obj);
      expect(result).toBe('?custom=custom-value');
    });

    it('handles numbers', () => {
      const result = HTTPUtils.dataToQueryString({ count: 42, price: 19.99 });
      expect(result).toBe('?count=42&price=19.99');
    });

    it('handles booleans', () => {
      const result = HTTPUtils.dataToQueryString({ active: true, disabled: false });
      expect(result).toBe('?active=true&disabled=false');
    });
  });

  describe('statusCodeToMessage', () => {
    it('returns correct message for 200', () => {
      expect(HTTPUtils.statusCodeToMessage(200)).toBe('OK');
    });

    it('returns correct message for 204', () => {
      expect(HTTPUtils.statusCodeToMessage(204)).toBe('No Content');
    });

    it('returns correct message for 304', () => {
      expect(HTTPUtils.statusCodeToMessage(304)).toBe('Not Modified');
    });

    it('returns correct message for 400', () => {
      expect(HTTPUtils.statusCodeToMessage(400)).toBe('Bad Request');
    });

    it('returns correct message for 401', () => {
      expect(HTTPUtils.statusCodeToMessage(401)).toBe('Unauthorized');
    });

    it('returns correct message for 403', () => {
      expect(HTTPUtils.statusCodeToMessage(403)).toBe('Forbidden');
    });

    it('returns correct message for 404', () => {
      expect(HTTPUtils.statusCodeToMessage(404)).toBe('Not Found');
    });

    it('returns correct message for 409', () => {
      expect(HTTPUtils.statusCodeToMessage(409)).toBe('Conflict');
    });

    it('returns correct message for 413', () => {
      expect(HTTPUtils.statusCodeToMessage(413)).toBe('Request Entity Too Large');
    });

    it('returns correct message for 500', () => {
      expect(HTTPUtils.statusCodeToMessage(500)).toBe('Internal Server Error');
    });

    it('returns correct message for 501', () => {
      expect(HTTPUtils.statusCodeToMessage(501)).toBe('Not Implemented');
    });

    it('returns Unknown for unrecognized codes', () => {
      expect(HTTPUtils.statusCodeToMessage(999)).toBe('Unknown');
      expect(HTTPUtils.statusCodeToMessage(418)).toBe('Unknown');
    });
  });
});
