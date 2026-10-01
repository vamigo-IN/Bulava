import * as Sentry from '@sentry/node';

/**
 * Nothing personal leaves the server. Sentry 11 collects all of this by default
 * (headers, cookies, bodies, query strings, local variables in stack frames,
 * bound query values), and any of it can hold guest details, tokens or
 * passwords. Errors and their stack traces are still reported.
 */
export const SENTRY_DATA_COLLECTION = {
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

/** Error monitoring. Only active when SENTRY_DSN is set; no personal data is sent. */
export function initSentry(service: string): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    serverName: service,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Never ship invitation tokens or cookies.
      if (event.request?.url) event.request.url = event.request.url.replace(/(\/public\/invitations\/)[^/?#]+/, '$1[REDACTED]');
      if (event.request?.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
      }
      return event;
    },
  });
}

export { Sentry };
