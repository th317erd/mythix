import Nife from 'nife';

const MIME_TYPES = {
  '3g2':    'video/3gpp2',
  '3gp':    'video/3gpp',
  '7z':     'application/x-7z-compressed',
  'aac':    'audio/aac',
  'abw':    'application/x-abiword',
  'arc':    'application/x-freearc',
  'avi':    'video/avi',
  'avif':   'image/avif',
  'azw':    'application/vnd.amazon.ebook',
  'bin':    'application/octet-stream',
  'bmp':    'image/bmp',
  'bz':     'application/x-bzip',
  'bz2':    'application/x-bzip2',
  'cda':    'application/x-cdf',
  'csh':    'application/x-csh',
  'css':    'text/css',
  'csv':    'text/csv',
  'doc':    'application/msword',
  'docx':   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'eot':    'application/vnd.ms-fontobject',
  'epub':   'application/epub+zip',
  'gif':    'image/gif',
  'gz':     'application/gzip',
  'htm':    'text/html',
  'html':   'text/html',
  'ico':    'image/vnd.microsoft.icon',
  'ics':    'text/calendar',
  'jar':    'application/java-archive',
  'jpeg':   'image/jpeg',
  'jpg':    'image/jpeg',
  'js':	    'text/javascript',
  'json':   'application/json',
  'jsonld': 'application/ld+json',
  'mid':    'audio/midi',
  'mjs':    'text/javascript',
  'mp3':    'audio/mpeg3',
  'mp4':    'video/mp4',
  'mpeg':   'video/mpeg',
  'mpkg':   'application/vnd.apple.installer+xml',
  'odp':    'application/vnd.oasis.opendocument.presentation',
  'ods':    'application/vnd.oasis.opendocument.spreadsheet',
  'odt':    'application/vnd.oasis.opendocument.text',
  'oga':    'audio/ogg',
  'ogv':    'video/ogg',
  'ogx':    'application/ogg',
  'opus':   'audio/opus',
  'otf':    'font/otf',
  'pdf':    'application/pdf',
  'php':    'application/x-httpd-php',
  'png':    'image/png',
  'ppt':    'application/vnd.ms-powerpoint',
  'pptx':   'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'rar':    'application/vnd.rar',
  'rtf':    'application/rtf',
  'sh':     'application/x-sh',
  'svg':    'image/svg+xml',
  'swf':    'application/x-shockwave-flash',
  'tar':    'application/x-tar',
  'tif':    'image/tiff',
  'tiff':   'image/tiff',
  'ts':     'video/mp2t',
  'ttf':    'font/ttf',
  'txt':    'text/plain',
  'vsd':    'application/vnd.visio',
  'wav':    'audio/wav',
  'weba':   'audio/webm',
  'webm':   'video/webm',
  'webp':   'image/webp',
  'woff':   'font/woff',
  'woff2':  'font/woff2',
  'xhtml':  'application/xhtml+xml',
  'xls':    'application/vnd.ms-excel',
  'xlsx':   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xml':    'application/xml',
  'xul':    'application/vnd.mozilla.xul+xml',
  'zip':    'application/zip',
};

const MIME_EXTENSION_EXCEPTIONS = {
  'htm':  'html',
  'jpeg': 'jpg',
  'mjs':  'js',
  'tif':  'tiff',
};

export function getFilenameExtension(fileName) {
  if (Nife.isEmpty(fileName))
    return;

  return (!fileName.match(/\.[^./\\]+$/)) ? null : fileName.replace(/^.*?([^./]+)$/, '$1');
}

export function getMimeTypeFromFileExtension(extension) {
  let ext = ('' + extension).toLowerCase();
  return MIME_TYPES[ext];
}

export function getFileExtensionFromMimeType(_mimeType) {
  let mimeType    = ('' + _mimeType).toLowerCase();
  let extensions  = Object.keys(MIME_TYPES).sort();

  for (let i = 0, il = extensions.length; i < il; i++) {
    let extension = extensions[i];
    let value     = MIME_TYPES[extension];

    if (value === mimeType) {
      if (MIME_EXTENSION_EXCEPTIONS[extension])
        return MIME_EXTENSION_EXCEPTIONS[extension];

      return extension;
    }
  }
}

export function getMimeTypeFromFilename(fileName) {
  return getMimeTypeFromFileExtension(getFilenameExtension(fileName));
}
