import * as FileUtils from './file-utils.js';

describe('file-utils', function() {
  describe('fileNameWithoutExtension', function() {
    it('should be able to remove the extension from a file name', function() {
      expect(FileUtils.fileNameWithoutExtension('test.txt')).toEqual('test');
      expect(FileUtils.fileNameWithoutExtension('test.txt.bin')).toEqual('test.txt');
    });
  });
});
