// TODO: PostHog - Uncomment when ready to use analytics
// import { usePostHog, PostHogProvider } from 'posthog-react-native';

// TODO: PostHog - Uncomment when ready
// export const posthog = {
//   apiKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
//   host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
// };

// TODO: PostHog - Uncomment when ready
// export { PostHogProvider };

// Placeholder exports to prevent import errors
export const posthog = null;
export const PostHogProvider = ({ children }: { children: React.ReactNode }) => children;
