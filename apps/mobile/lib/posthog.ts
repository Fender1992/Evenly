/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import PostHog from 'posthog-react-native';

let posthogInitialized = false;

export const initPostHog = async () => {
  const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const POSTHOG_ENABLED = process.env.EXPO_PUBLIC_POSTHOG_ENABLED === 'true';

  if (!POSTHOG_ENABLED || !POSTHOG_API_KEY) {
    console.log('[PostHog] Analytics disabled or API key missing');
    return null;
  }

  try {
    if (!posthogInitialized) {
      await PostHog.init(POSTHOG_API_KEY, {
        host: 'https://app.posthog.com',
      });
      posthogInitialized = true;
    }
    console.log('[PostHog] Initialized successfully');
    return PostHog;
  } catch (error) {
    console.error('[PostHog] Initialization failed:', error);
    return null;
  }
};

export const getPostHog = () => (posthogInitialized ? PostHog : null);
