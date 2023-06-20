import { CryptoUtils } from './index.js';

describe('crypto-utils', function() {
  describe('MD5', function() {
    it('should be able to hash input', function() {
      expect(CryptoUtils.MD5('test')).toEqual('098f6bcd4621d373cade4e832627b4f6');
      expect(CryptoUtils.MD5('')).toEqual('d41d8cd98f00b204e9800998ecf8427e');
    });
  });

  describe('SHA256', function() {
    it('should be able to hash input', function() {
      expect(CryptoUtils.SHA256('test')).toEqual('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
      expect(CryptoUtils.SHA256('')).toEqual('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  describe('SHA512', function() {
    it('should be able to hash input', function() {
      expect(CryptoUtils.SHA512('test')).toEqual('ee26b0dd4af7e749aa1a8ee3c10ae9923f618980772e473f8819a5d4940e0db27ac185f8a0e1d5f84f88bc887fd67b143732c304cc5fa9ad8e6f57f50028a8ff');
      expect(CryptoUtils.SHA512('')).toEqual('cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e');
    });
  });
});
