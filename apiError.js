class ApiError extends Error {
  constructor(statusCode, message, detail = '') {
    super(message);
    this.statusCode = statusCode;
    this.detail = detail;
    this.name = 'ApiError';
  }
}

module.exports = ApiError;
