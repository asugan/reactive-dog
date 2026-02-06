import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import PocketBase, { AuthModel } from 'pocketbase';
import EventSource from 'react-native-sse';

const pocketbaseUrl = process.env.EXPO_PUBLIC_POCKETBASE_URL!;

export const pb = new PocketBase(pocketbaseUrl);

if (typeof global.EventSource === 'undefined') {
  global.EventSource = EventSource as unknown as typeof global.EventSource;
}

WebBrowser.maybeCompleteAuthSession();

let initializePromise: Promise<void> | null = null;

export const initializePocketBase = async () => {
  if (!initializePromise) {
    initializePromise = (async () => {
      const authData = await AsyncStorage.getItem('pb_auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          if (parsed.token && parsed.model) {
            pb.authStore.save(parsed.token, parsed.model);
          }
        } catch (e) {
          console.error('Failed to parse auth data', e);
          await AsyncStorage.removeItem('pb_auth');
        }
      }

      pb.authStore.onChange((token, model) => {
        if (token) {
          AsyncStorage.setItem('pb_auth', JSON.stringify({ token, model }));
        } else {
          AsyncStorage.removeItem('pb_auth');
        }
      }, true);
    })();
  }

  await initializePromise;
};

export const loginWithEmail = async (email: string, password: string) => {
  return await pb.collection('users').authWithPassword(email, password);
};

export const loginWithOAuth = async (provider: string) => {
  return await pb.collection('users').authWithOAuth2({
    provider,
    urlCallback: async (authUrl) => {
      await WebBrowser.openAuthSessionAsync(
        authUrl.toString(),
        `${pocketbaseUrl}/api/oauth2-redirect`
      );
    },
  });
};

export const signUpWithEmail = async (email: string, password: string, passwordConfirm: string, userData?: Record<string, unknown>) => {
  return await pb.collection('users').create({
    email,
    password,
    passwordConfirm,
    ...userData,
  });
};

export const logout = () => {
  pb.authStore.clear();
};

export const getCurrentUser = () => {
  return pb.authStore.model as AuthModel | null;
};

export const isAuthenticated = () => {
  return pb.authStore.isValid;
};

export const subscribeToAuthChanges = (callback: (model: AuthModel | null) => void) => {
  return pb.authStore.onChange(() => {
    callback(pb.authStore.model);
  });
};
