/* eslint-disable no-magic-numbers */

import { wrapConfig } from '../../lib/utils/config-utils.mjs';

describe('ConfigUtils', () => {
  describe('wrapConfig', () => {
    it('returns object with CONFIG and ENV', () => {
      const config = { key: 'value' };
      const wrapped = wrapConfig(config);
      expect(wrapped.CONFIG).toBe(config);
      expect(typeof wrapped.ENV).toBe('function');
    });

    it('ENV is bound to CONFIG', () => {
      const config = { myKey: 'myValue' };
      const { ENV } = wrapConfig(config);
      expect(ENV('myKey')).toBe('myValue');
    });
  });

  describe('ENV', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      // Restore original env
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      }
      for (const [key, value] of Object.entries(originalEnv)) {
        process.env[key] = value;
      }
    });

    it('returns value from CONFIG', () => {
      const { ENV } = wrapConfig({ database: 'postgres' });
      expect(ENV('database')).toBe('postgres');
    });

    it('returns nested value from CONFIG', () => {
      const { ENV } = wrapConfig({ db: { host: 'localhost' } });
      expect(ENV('db.host')).toBe('localhost');
    });

    it('returns defaultValue when key not found', () => {
      const { ENV } = wrapConfig({});
      expect(ENV('missing', 'default')).toBe('default');
    });

    it('returns undefined when key not found and no default', () => {
      const { ENV } = wrapConfig({});
      expect(ENV('missing')).toBeUndefined();
    });

    it('falls back to process.env when not in CONFIG', () => {
      process.env.TEST_CONFIG_VAR = 'from-env';
      const { ENV } = wrapConfig({});
      expect(ENV('TEST_CONFIG_VAR')).toBe('from-env');
    });

    it('prefers CONFIG over process.env', () => {
      process.env.TEST_CONFIG_VAR = 'from-env';
      const { ENV } = wrapConfig({ TEST_CONFIG_VAR: 'from-config' });
      expect(ENV('TEST_CONFIG_VAR')).toBe('from-config');
    });

    it('returns defaultValue when not in CONFIG or process.env', () => {
      const { ENV } = wrapConfig({});
      expect(ENV('NONEXISTENT_VAR', 'fallback')).toBe('fallback');
    });

    it('handles numeric values', () => {
      const { ENV } = wrapConfig({ port: 3000 });
      expect(ENV('port')).toBe(3000);
    });

    it('handles boolean values', () => {
      const { ENV } = wrapConfig({ debug: true });
      expect(ENV('debug')).toBe(true);
    });

    it('handles null values (returns null, not default)', () => {
      const { ENV } = wrapConfig({ nullable: null });
      expect(ENV('nullable', 'default')).toBe(null);
    });
  });

  describe('getConfigKey (template expansion in keys)', () => {
    // Note: Template expansion happens on the KEY being looked up, not values

    it('expands single template variable in key', () => {
      const { ENV } = wrapConfig({
        prefix: 'database',
        database_host: 'localhost',
      });
      // {prefix}_host expands to database_host, which has value 'localhost'
      expect(ENV('{prefix}_host')).toBe('localhost');
    });

    it('expands multiple template variables in key', () => {
      const { ENV } = wrapConfig({
        env: 'prod',
        service: 'api',
        prod_api_url: 'https://api.example.com',
      });
      expect(ENV('{env}_{service}_url')).toBe('https://api.example.com');
    });

    it('handles numeric values in key templates', () => {
      const { ENV } = wrapConfig({
        version: 2,
        config_v2: 'version 2 config',
      });
      expect(ENV('config_v{version}')).toBe('version 2 config');
    });

    it('handles boolean values in key templates', () => {
      const { ENV } = wrapConfig({
        flag: true,
        setting_true: 'enabled setting',
      });
      expect(ENV('setting_{flag}')).toBe('enabled setting');
    });

    it('throws for object values in key templates', () => {
      const { ENV } = wrapConfig({
        obj: { nested: 'value' },
      });
      expect(() => ENV('key_{obj}')).toThrowError(TypeError);
    });

    it('throws for array values in key templates', () => {
      const { ENV } = wrapConfig({
        arr: [1, 2, 3],
      });
      expect(() => ENV('key_{arr}')).toThrowError(TypeError);
    });

    it('throws for function values in key templates', () => {
      const { ENV } = wrapConfig({
        fn: () => 'test',
      });
      expect(() => ENV('key_{fn}')).toThrowError(TypeError);
    });

    it('returns undefined for missing template key (TypeError in key string)', () => {
      const { ENV } = wrapConfig({});
      // When template var doesn't exist, TypeError is returned as string in key
      // This results in looking up a key like "[object Error]" which doesn't exist
      const result = ENV('{nonexistent}', 'default');
      expect(result).toBe('default');
    });

    it('leaves non-template keys unchanged', () => {
      const { ENV } = wrapConfig({ plain_key: 'value' });
      expect(ENV('plain_key')).toBe('value');
    });

    it('handles empty braces (not a template)', () => {
      const { ENV } = wrapConfig({ 'key{}name': 'value' });
      expect(ENV('key{}name')).toBe('value');
    });

    it('expands template in key for process.env lookup', () => {
      process.env.MYAPP_API_KEY = 'secret123';
      const { ENV } = wrapConfig({
        appName: 'MYAPP',
      });
      expect(ENV('{appName}_API_KEY')).toBe('secret123');
    });

    it('supports nested key access with templates', () => {
      const { ENV } = wrapConfig({
        env: 'production',
        production: { database: 'prod-db' },
      });
      expect(ENV('{env}.database')).toBe('prod-db');
    });
  });

  describe('edge cases', () => {
    it('handles empty CONFIG', () => {
      const { ENV, CONFIG } = wrapConfig({});
      expect(CONFIG).toEqual({});
      expect(ENV('anything')).toBeUndefined();
    });

    it('handles deeply nested CONFIG', () => {
      const { ENV } = wrapConfig({
        a: { b: { c: { d: 'deep' } } },
      });
      expect(ENV('a.b.c.d')).toBe('deep');
    });

    it('handles array index access', () => {
      const { ENV } = wrapConfig({
        items: ['first', 'second', 'third'],
      });
      expect(ENV('items.0')).toBe('first');
      expect(ENV('items.1')).toBe('second');
    });

    it('multiple wrapConfig calls are independent', () => {
      const wrap1 = wrapConfig({ key: 'value1' });
      const wrap2 = wrapConfig({ key: 'value2' });
      expect(wrap1.ENV('key')).toBe('value1');
      expect(wrap2.ENV('key')).toBe('value2');
    });

    it('CONFIG reference is not cloned', () => {
      const config = { mutable: 'original' };
      const { ENV } = wrapConfig(config);
      config.mutable = 'changed';
      expect(ENV('mutable')).toBe('changed');
    });
  });
});
