export class ExportPlatformError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ExportPlatformError";
    this.code = code;
  }
}

export function fail(code: string, message: string): never {
  throw new ExportPlatformError(code, message);
}
