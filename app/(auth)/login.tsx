import { View, Text, StyleSheet, TextInput, Button, TouchableOpacity, Platform } from 'react-native';
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { loginWithEmail, loginWithOAuth, type OAuthProvider } from '../../lib/pocketbase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signInWithEmail() {
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      router.replace('/(tabs)');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      alert(message);
    }
    setLoading(false);
  }

  async function signInWithOAuth(provider: OAuthProvider) {
    const providerLabel = provider === 'google' ? 'Google' : 'Apple';

    setLoading(true);
    try {
      await loginWithOAuth(provider);
      router.replace('/(tabs)');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `${providerLabel} login failed`;
      alert(message);
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title={loading ? 'Loading...' : 'Sign In'}
        onPress={signInWithEmail}
        disabled={loading}
      />

      <View style={styles.socialSection}>
        <TouchableOpacity
          style={[styles.socialButton, loading && styles.socialButtonDisabled]}
          onPress={() => signInWithOAuth('google')}
          disabled={loading}
        >
          <Text style={styles.socialButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' ? (
          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton, loading && styles.socialButtonDisabled]}
            onPress={() => signInWithOAuth('apple')}
            disabled={loading}
          >
            <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continue with Apple</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      
      <View style={styles.footer}>
        <Text>Don&apos;t have an account? </Text>
        <Link href="/signup" asChild>
          <TouchableOpacity>
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  socialSection: {
    marginTop: 12,
  },
  socialButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  appleButton: {
    marginTop: 10,
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  appleButtonText: {
    color: '#fff',
  },
  link: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
});
