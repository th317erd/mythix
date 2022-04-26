'use strict';

/* global describe, it, expect */

const Utils = require('../src/utils');

describe('file-utils', function() {
  describe('fileNameWithoutExtension', function() {
    it('should be able to remove the extension from a file name', function() {
      expect(Utils.fileNameWithoutExtension('test.txt')).toEqual('test');
      expect(Utils.fileNameWithoutExtension('test.txt.bin')).toEqual('test.txt');
    });
  });
});
