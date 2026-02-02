import { View, Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
// TODO: PostHog - import { usePostHog } from 'posthog-react-native';

export default function Dashboard() {
  // TODO: PostHog - const posthog = usePostHog();

  useEffect(() => {
    // TODO: PostHog - posthog?.capture('dashboard_viewed');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text>Welcome to Reactive Dog!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});
