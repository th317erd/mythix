function statusCodeToMessage(statusCode) {
  var codes = {
    200: 'OK',
    204: 'No Content',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    413: 'Request Entity Too Large',
    500: 'Internal Server Error',
    501: 'Not Implemented',
  };

  var code = codes[statusCode];

  return code || 'Unknown';
}

module.exports = {
  statusCodeToMessage,
};
