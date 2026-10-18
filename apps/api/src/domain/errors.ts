export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fields?: Array<{ path: string; code: string }>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    fields?: Array<{ path: string; code: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}
