'use strict';

const jsDiff      = require('diff');
const colors      = require('colors/safe');
const Path        = require('path');
const FileSystem  = require('fs');

function showDiff(fileName, c1, c2) {
  jsDiff.createPatch(fileName, c1 || '', c2 || '').replace(/.*/g, function(m) {
    if (!m)
      return;

    let c = m.charAt(0);
    let out = m;

    if (c === '-')
      console.log(colors.red(out));
    else if (c === '+')
      console.log(colors.green(out));
    else
      console.log(out);
  });
}

function serialize(value) {
  if (value == null)
    return ('' + value);

  if (typeof value === 'boolean' || value instanceof Boolean)
    return ('' + value);

  if (typeof value === 'number' || value instanceof Number)
    return ('' + value);

  if (typeof value === 'bigint')
    return `BigInt(${value})`;

  if (typeof value === 'string' || value instanceof String)
    return `"${value.replace(/"/g, '\\"')}"`;

  return JSON.stringify(value, undefined, 2);
}

function _matchesSnapshot(path, snapshotName, value) {
  let fullPath        = Path.join(path, `${snapshotName}.snapshot`);
  let serializedValue = serialize(value);

  if (!FileSystem.existsSync(fullPath))
    FileSystem.writeFileSync(fullPath, serializedValue, 'utf8');

  let storedValue = FileSystem.readFileSync(fullPath, 'utf8');

  if (storedValue !== serializedValue) {
    showDiff(fullPath, storedValue, serializedValue);
    return false;
  }

  return true;
}

module.exports = {
  _matchesSnapshot,
};
