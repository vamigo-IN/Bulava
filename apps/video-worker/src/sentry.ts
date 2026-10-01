import * as Sentry from '@sentry/node';

/**
 * Nothing personal leaves the video worker. Sentry 11 collects headers, bodies, query
 * strings, local variables in stack frames and bound query values by default,
 * and any of them can hold guest details or tokens.
 */
const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies NonNullable<Sentry.NodeOptions['dataCollection']>;

/** Error monitoring, only when SENTRY_DSN is set. */
export function initSentry(serverName: string): void {
  if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, serverName, dataCollection: DATA_COLLECTION });
}
