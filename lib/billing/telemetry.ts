type BillingPayload = Record<string, unknown>;
type BillingLogLevel = 'info' | 'warn' | 'error';

type BillingTelemetryReporter = (input: {
  event: string;
  level: BillingLogLevel;
  payload?: BillingPayload;
  error?: {
    message: string;
    stack?: string;
  };
}) => void;

const logPrefix = '[billing]';
let telemetryReporter: BillingTelemetryReporter | null = null;

const normalizeError = (value: unknown) => {
  if (value instanceof Error) {
    return {
      message: value.message,
      stack: value.stack,
    };
  }

  return {
    message: String(value),
  };
};

const report = (params: {
  event: string;
  level: BillingLogLevel;
  payload?: BillingPayload;
  error?: {
    message: string;
    stack?: string;
  };
}) => {
  if (!telemetryReporter) {
    return;
  }

  telemetryReporter(params);
};

export const setBillingTelemetryReporter = (reporter: BillingTelemetryReporter | null) => {
  telemetryReporter = reporter;
};

export const logBillingInfo = (event: string, payload?: BillingPayload) => {
  if (payload) {
    console.info(`${logPrefix} ${event}`, payload);
    report({
      event,
      level: 'info',
      payload,
    });
    return;
  }

  console.info(`${logPrefix} ${event}`);
  report({
    event,
    level: 'info',
  });
};

export const logBillingWarning = (event: string, payload?: BillingPayload) => {
  if (payload) {
    console.warn(`${logPrefix} ${event}`, payload);
    report({
      event,
      level: 'warn',
      payload,
    });
    return;
  }

  console.warn(`${logPrefix} ${event}`);
  report({
    event,
    level: 'warn',
  });
};

export const logBillingError = (event: string, error: unknown, payload?: BillingPayload) => {
  const normalizedError = normalizeError(error);

  if (payload) {
    console.error(`${logPrefix} ${event}`, payload, error);
    report({
      event,
      level: 'error',
      payload,
      error: normalizedError,
    });
    return;
  }

  console.error(`${logPrefix} ${event}`, error);
  report({
    event,
    level: 'error',
    error: normalizedError,
  });
};
