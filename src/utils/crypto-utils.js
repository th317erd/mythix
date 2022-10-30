'use strict';

/* global Buffer */

const { createHash, randomFillSync } = require('node:crypto');

const URL_SAFE_ENCODING_KEYS  = { '+': '-', '/': '_', '-': '+', '_': '/' };
const ENCRYPTION_ALGORITHM    = 'aes-256-ctr';

function toBase64(_data) {
  var data = _data;
  if (data instanceof Uint8Array)
    data = Buffer.from(data);

  if (!Buffer.isBuffer(data))
    data = Buffer.from(('' + _data), 'utf8');

  return data.toString('base64');
}

function convertBase64ToURLSafe(encodedData) {
  return encodedData.replace(/[+/]/g, (m) => {
    return URL_SAFE_ENCODING_KEYS[m];
  });
}

function convertBase64FromURLSafe(encodedData) {
  return encodedData.replace(/[_-]/g, (m) => {
    return URL_SAFE_ENCODING_KEYS[m];
  });
}

function toURLSafeBase64(data) {
  return convertBase64ToURLSafe(toBase64(data));
}

function fromURLSafeBase64(data, encoding) {
  var buffer = Buffer.from(convertBase64FromURLSafe(data), 'base64');
  return (encoding == null) ? buffer : buffer.toString(encoding);
}

function randomBytes(length) {
  let buffer = Buffer.alloc(length);
  randomFillSync(buffer);

  return buffer;
}

function MD5(data) {
  let hash = createHash('md5');
  hash.update(data);
  return hash.digest('hex');
}

function SHA256(data) {
  let hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

function SHA512(data) {
  let hash = createHash('sha512');
  hash.update(data);
  return hash.digest('hex');
}

function randomHash(type = 'sha256', length = 128) {
  let bytes = randomBytes(length);
  let hash  = createHash(type);

  hash.update(bytes);

  return hash.digest('hex');
}

function hashToken(token, salt) {
  if (!salt)
    throw new TypeError('Utils::hashToken: "salt" can not be empty');

  // eslint-disable-next-line new-cap
  return SHA512(`${salt}${token}`);
}

function getSaltProperties(salt) {
  let raw   = fromURLSafeBase64(salt, 'utf8');
  let props = JSON.parse(raw);
  return props;
}

function generateSalt() {
  let props = {
    // eslint-disable-next-line no-magic-numbers
    secretKey:  toURLSafeBase64(randomBytes(32)),
    iv:         toURLSafeBase64(randomBytes(16)),
  };

  return toURLSafeBase64(JSON.stringify(props));
}

// secretKey = 32 chars (base64)
// iv = 32 chars (base64)
function encrypt(value, salt) {
  const {
    secretKey,
    iv,
  } = getSaltProperties(salt);

  const cypher    = Crypto.createCipheriv(ENCRYPTION_ALGORITHM, fromURLSafeBase64(secretKey), fromURLSafeBase64(iv));
  const encrypted = Buffer.concat([cypher.update(value), cypher.final()]);

  return toURLSafeBase64(encrypted);
}

function decrypt(value, salt) {
  const {
    secretKey,
    iv,
  } = getSaltProperties(salt);

  const decipher  = Crypto.createDecipheriv(ENCRYPTION_ALGORITHM, fromURLSafeBase64(secretKey), fromURLSafeBase64(iv));
  const decrpyted = Buffer.concat([decipher.update(fromURLSafeBase64(value)), decipher.final()]);

  return decrpyted.toString('utf8');
}

module.exports = {
  toBase64,
  convertBase64ToURLSafe,
  convertBase64FromURLSafe,
  toURLSafeBase64,
  fromURLSafeBase64,
  getSaltProperties,
  generateSalt,
  encrypt,
  decrypt,
  hashToken,
  randomBytes,
  randomHash,
  MD5,
  SHA256,
  SHA512,
};
