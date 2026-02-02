import { Stack } from 'expo-router';

export default function WalkLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="active" />
      <Stack.Screen name="summary" />
    </Stack>
  );
}
