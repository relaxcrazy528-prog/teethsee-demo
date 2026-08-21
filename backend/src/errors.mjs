export class ApiError extends Error {
  constructor(status, code, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = options.retryAfter;
  }
}

export function assert(condition, status, code, message) {
  if (!condition) throw new ApiError(status, code, message);
}
