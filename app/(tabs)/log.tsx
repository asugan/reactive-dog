import { View, Text, StyleSheet } from 'react-native';

export default function LogScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Log</Text>
      <Text>Log a trigger reaction here</Text>
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
