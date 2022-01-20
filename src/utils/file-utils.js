const Path        = require('path');
const FileSystem  = require('fs');

function walkDir(rootPath, _options, _callback, _allFiles, _depth) {
  var depth       = _depth || 0;
  var allFiles    = _allFiles || [];
  var callback    = (typeof _options === 'function') ? _options : _callback;
  var options     = (typeof _options !== 'function' && _options) ? _options : {};
  var filterFunc  = options.filter;
  var fileNames   = FileSystem.readdirSync(rootPath);

  for (var i = 0, il = fileNames.length; i < il; i++) {
    var fileName      = fileNames[i];
    var fullFileName  = Path.join(rootPath, fileName);
    var stats         = FileSystem.statSync(fullFileName);

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
