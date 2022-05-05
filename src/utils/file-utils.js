'use strict';

const Path        = require('path');
const FileSystem  = require('fs');

function walkDir(rootPath, _options, _callback, _allFiles, _depth) {
  let depth       = _depth || 0;
  let allFiles    = _allFiles || [];
  let callback    = (typeof _options === 'function') ? _options : _callback;
  let options     = (typeof _options !== 'function' && _options) ? _options : {};
  let filterFunc  = options.filter;
  let fileNames   = FileSystem.readdirSync(rootPath);

  for (let i = 0, il = fileNames.length; i < il; i++) {
    let fileName      = fileNames[i];
    let fullFileName  = Path.join(rootPath, fileName);
    let stats         = FileSystem.statSync(fullFileName);

    if (typeof filterFunc === 'function' && !filterFunc(fullFileName, fileName, stats, rootPath, depth))
      continue;
    else if (filterFunc instanceof RegExp && !filterFunc.match(fullFileName))
      continue;


    if (stats.isDirectory()) {
      walkDir(fullFileName, options, callback, allFiles, depth + 1);
    } else if (stats.isFile()) {
      if (typeof callback === 'function')
        callback(fullFileName, fileName, rootPath, depth, stats);

      allFiles.push(fullFileName);
    }
  }

  return allFiles;
}

function fileNameWithoutExtension(fileName) {
  return fileName.replace(/\.[^.]*$/, '');
}

module.exports = {
  walkDir,
  fileNameWithoutExtension,
};
