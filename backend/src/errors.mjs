export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function assert(condition, status, code, message) {
  if (!condition) throw new ApiError(status, code, message);
}
