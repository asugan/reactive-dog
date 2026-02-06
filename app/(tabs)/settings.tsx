import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Card } from 'react-native-paper';
import { getCurrentUser, logout } from '../../lib/pocketbase';

export default function SettingsScreen() {
  const user = getCurrentUser();

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Signed in as</Text>
            <Text style={styles.value}>{user?.email ?? 'Unknown user'}</Text>
          </Card.Content>
        </Card>

        <Button mode="contained" buttonColor="#DC2626" onPress={handleLogout}>
          Log out
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F7FB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
});
