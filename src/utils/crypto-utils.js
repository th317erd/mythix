const { createHash, randomFillSync } = require('crypto');

function randomBytes(length) {
  var buffer = Buffer.alloc(length);
  randomFillSync(buffer);

  return buffer;
}

function SHA256(data) {
  var hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

function SHA512(data) {
  var hash = createHash('sha512');
  hash.update(data);
  return hash.digest('hex');
}

function randomHash(type = 'sha256', length = 128) {
  var bytes = randomBytes(length);
  var hash  = createHash(type);

  hash.update(bytes);

  return hash.digest('hex');
}

module.exports = {
  randomBytes,
  randomHash,
  SHA256,
  SHA512,
};
