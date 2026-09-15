// A malformed request body (bad JSON syntax) is a client mistake, not a
// server failure. Routes that do a bare `await req.json()` inside a generic
// try/catch that returns 500 for anything end up telling the caller "we
// broke" when actually "you sent us garbage" is the true story, and the
// generic message hides what actually needs fixing. This lets each route
// tell the two apart with one extra check in its existing catch block.
export class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON in request body");
    this.name = "InvalidJsonError";
  }
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new InvalidJsonError();
  }
}
