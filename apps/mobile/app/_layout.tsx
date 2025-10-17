/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { initPostHog } from '@mobile/lib/posthog';
import { useAuth } from '../hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10000,
    },
  },
});

// Initialize Sentry if DSN is provided
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enableInExpoDevelopment: false,
    debug: __DEV__,
  });
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to sign-in if not authenticated
      router.replace('/(auth)/sign-in');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(app)/home');
    }
  }, [user, loading, segments]);

  return <Slot />;
}

function RootLayout() {
  useEffect(() => {
    // Initialize PostHog if enabled
    const POSTHOG_ENABLED = process.env.EXPO_PUBLIC_POSTHOG_ENABLED === 'true';
    if (POSTHOG_ENABLED) {
      void initPostHog().catch((error) => {
        console.error('[PostHog] Initialization failed', error);
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
