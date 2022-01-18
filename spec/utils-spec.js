const Utils = require('../src/utils');

describe('file-utils', function() {
  describe('fileNameWithoutExtension', function() {
    it('should be able to remove the extension from a file name', function() {
      expect(Utils.fileNameWithoutExtension('test.txt')).toEqual('test');
      expect(Utils.fileNameWithoutExtension('test.txt.bin')).toEqual('test.txt');
    });
  });
});

describe('misc-utils', function() {
  describe('coerceValue', function() {
    it('should be able to coerce to boolean (without type)', function() {
      expect(Utils.coerceValue(undefined)).toBe(undefined);
      expect(Utils.coerceValue(null)).toBe(null);
      expect(Utils.coerceValue(true)).toBe(true);
      expect(Utils.coerceValue(false)).toBe(false);
      expect(Utils.coerceValue('True')).toBe(true);
      expect(Utils.coerceValue('true')).toBe(true);
      expect(Utils.coerceValue('"TRUE"')).toBe(true);
      expect(Utils.coerceValue('"true"')).toBe(true);
      expect(Utils.coerceValue("'true'")).toBe(true);
      expect(Utils.coerceValue('false')).toBe(false);
      expect(Utils.coerceValue('False')).toBe(false);
      expect(Utils.coerceValue('"false"')).toBe(false);
      expect(Utils.coerceValue('"FALSE"')).toBe(false);
      expect(Utils.coerceValue("'false'")).toBe(false);
    });

    it('should be able to coerce to boolean (with type)', function() {
      expect(Utils.coerceValue(undefined, 'boolean')).toBe(false);
      expect(Utils.coerceValue(null, 'boolean')).toBe(false);
      expect(Utils.coerceValue(true, 'boolean')).toBe(true);
      expect(Utils.coerceValue(false, 'boolean')).toBe(false);
      expect(Utils.coerceValue(0, 'boolean')).toBe(false);
      expect(Utils.coerceValue(1, 'boolean')).toBe(true);
      expect(Utils.coerceValue(-1, 'boolean')).toBe(true);
      expect(Utils.coerceValue(NaN, 'boolean')).toBe(false);
      expect(Utils.coerceValue(Infinity, 'boolean')).toBe(true);
      expect(Utils.coerceValue(BigInt(0), 'boolean')).toBe(false);
      expect(Utils.coerceValue(BigInt(1), 'boolean')).toBe(true);
      expect(Utils.coerceValue(BigInt(-1), 'boolean')).toBe(true);
      expect(Utils.coerceValue('True', 'boolean')).toBe(true);
      expect(Utils.coerceValue('true', 'boolean')).toBe(true);
      expect(Utils.coerceValue('"TRUE"', 'boolean')).toBe(true);
      expect(Utils.coerceValue('"true"', 'boolean')).toBe(true);
      expect(Utils.coerceValue("'true'", 'boolean')).toBe(true);
      expect(Utils.coerceValue('false', 'boolean')).toBe(false);
      expect(Utils.coerceValue('False', 'boolean')).toBe(false);
      expect(Utils.coerceValue('"false"', 'boolean')).toBe(false);
      expect(Utils.coerceValue('"FALSE"', 'boolean')).toBe(false);
      expect(Utils.coerceValue("'false'", 'boolean')).toBe(false);
    });

    it('should be able to coerce to number (without type)', function() {
      expect(Utils.coerceValue(undefined)).toBe(undefined);
      expect(Utils.coerceValue(null)).toBe(null);
      expect(Utils.coerceValue(0)).toBe(0);
      expect(Utils.coerceValue(10)).toBe(10);
      expect(Utils.coerceValue('0')).toBe(0);
      expect(Utils.coerceValue('5')).toBe(5);
      expect(Utils.coerceValue('15.5')).toBe(15.5);
      expect(Utils.coerceValue("'15.5'")).toBe('15.5');
      expect(Utils.coerceValue('"10.52:234"')).toBe('10.52:234');
    });

    it('should be able to coerce to number (with type)', function() {
      expect(Utils.coerceValue(undefined, 'integer')).toBe(0);
      expect(Utils.coerceValue(null, 'integer')).toBe(0);
      expect(Utils.coerceValue(0, 'integer')).toBe(0);
      expect(Utils.coerceValue(10, 'integer')).toBe(10);
      expect(Utils.coerceValue(10.4, 'integer')).toBe(10);
      expect(Utils.coerceValue(10.6, 'integer')).toBe(11);
      expect(Utils.coerceValue('0', 'integer')).toBe(0);
      expect(Utils.coerceValue('5', 'integer')).toBe(5);
      expect(Utils.coerceValue('15.5', 'integer')).toBe(16);
      expect(Utils.coerceValue("'15.4'", 'integer')).toBe(15);
      expect(Utils.coerceValue('"10.52:234"', 'integer')).toBe(11);

      expect(Utils.coerceValue('10.4', 'number')).toBe(10.4);
      expect(Utils.coerceValue('10.6', 'number')).toBe(10.6);
      expect(Utils.coerceValue('"10.6"', 'number')).toBe(10.6);
      expect(Utils.coerceValue("'10.6'", 'number')).toBe(10.6);
      expect(Utils.coerceValue("'10.6:234.3'", 'number')).toBe(10.6);
      expect(Utils.coerceValue("1e-7", 'number')).toEqual(1/10000000);

      expect(Utils.coerceValue('0', 'bigint')).toEqual(BigInt(0));
      expect(Utils.coerceValue('1', 'bigint')).toEqual(BigInt(1));
      expect(Utils.coerceValue('1.1', 'bigint')).toEqual(BigInt(1));
      expect(Utils.coerceValue('1.5', 'bigint')).toEqual(BigInt(2));
      expect(Utils.coerceValue('"1.5"', 'bigint')).toEqual(BigInt(2));
      expect(Utils.coerceValue('"1.5:5.6"', 'bigint')).toEqual(BigInt(2));
    });

    it('should be able to coerce to string (without type)', function() {
      var func = () => {};
      var array = [];
      var obj = {};

      expect(Utils.coerceValue(undefined)).toBe(undefined);
      expect(Utils.coerceValue(null)).toBe(null);
      expect(Utils.coerceValue(true)).toBe(true);
      expect(Utils.coerceValue(false)).toBe(false);
      expect(Utils.coerceValue(10)).toBe(10);
      expect(Utils.coerceValue(func)).toBe(func);
      expect(Utils.coerceValue(array)).toBe(array);
      expect(Utils.coerceValue(obj)).toBe(obj);
      expect(Utils.coerceValue('derp')).toBe('derp');
      expect(Utils.coerceValue('"hello"')).toBe("hello");
      expect(Utils.coerceValue('""hello""')).toBe('"hello"');
    });

    it('should be able to coerce to string (with type)', function() {
      expect(Utils.coerceValue(undefined, 'string')).toBe('');
      expect(Utils.coerceValue(null, 'string')).toBe('');
      expect(Utils.coerceValue(() => {}, 'string')).toBe('');
      expect(Utils.coerceValue([], 'string')).toBe('');
      expect(Utils.coerceValue({}, 'string')).toBe('');
      expect(Utils.coerceValue(true, 'string')).toBe('true');
      expect(Utils.coerceValue(false, 'string')).toBe('false');
      expect(Utils.coerceValue(10, 'string')).toBe('10');
      expect(Utils.coerceValue(BigInt(10), 'string')).toBe('10');
      expect(Utils.coerceValue('derp', 'string')).toBe('derp');
      expect(Utils.coerceValue('"hello"', 'string')).toBe("hello");
      expect(Utils.coerceValue('""hello""', 'string')).toBe('"hello"');
    });
  });
});
