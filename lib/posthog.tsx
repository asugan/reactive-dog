import { useEffect, type PropsWithChildren, type ReactElement } from 'react';
import { PostHogProvider as NativePostHogProvider, usePostHog } from 'posthog-react-native';
import { setBillingTelemetryReporter } from './billing/telemetry';

const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

export const posthog = {
  apiKey: posthogApiKey,
  host: posthogHost,
};

const BillingTelemetryBridge = () => {
  const posthogClient = usePostHog();

  useEffect(() => {
    if (!posthogClient) {
      setBillingTelemetryReporter(null);
      return;
    }

    setBillingTelemetryReporter(({ event, level, payload, error }) => {
      const properties: Record<string, string | number | boolean | null> = {
        level,
      };

      if (payload) {
        Object.entries(payload).forEach(([key, value]) => {
          if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            properties[key] = value;
            return;
          }

          properties[key] = JSON.stringify(value);
        });
      }

      if (error?.message) {
        properties.error_message = error.message;
      }

      if (error?.stack) {
        properties.error_stack = error.stack;
      }

      posthogClient.capture(`billing_${event}`, properties);
    });

    return () => {
      setBillingTelemetryReporter(null);
    };
  }, [posthogClient]);

  return null;
};

export const PostHogProvider = ({ children }: PropsWithChildren): ReactElement => {
  if (!posthogApiKey) {
    return <>{children}</>;
  }

  return (
    <NativePostHogProvider
      apiKey={posthogApiKey}
      options={{
        host: posthogHost,
      }}
    >
      <BillingTelemetryBridge />
      {children}
    </NativePostHogProvider>
  );
};
