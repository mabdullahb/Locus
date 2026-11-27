// One data-collection policy for every Sentry runtime (browser, Node, edge).
//
// Sentry v11 replaced sendDefaultPii with dataCollection, and leaving it
// unset now collects cookies, full request/response bodies, user info and
// database query data. For Locus that would send login session cookies,
// passwords (login, register, delete account) and provider API keys (saved
// through Settings) to Sentry. This is Sentry's documented v10-equivalent
// baseline, plus explicit denies for the headers Locus uses to carry secrets.
const SENSITIVE_HEADERS = [
  "forwarded",
  "-ip",
  "remote-",
  "via",
  "-user",
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-internal-secret",
  "x-webhook-secret",
];

export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: SENSITIVE_HEADERS },
    response: { deny: SENSITIVE_HEADERS },
  },
  httpBodies: [],
  urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user", "token", "key", "secret"] },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
};
