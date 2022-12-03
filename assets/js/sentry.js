import * as Sentry from "@sentry/browser";
import { Integrations } from "@sentry/tracing";

Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [new Integrations.BrowserTracing()],
    release: `simpleimage@${SI_VERSION}`,
    environment: NODE_ENV,

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
});
