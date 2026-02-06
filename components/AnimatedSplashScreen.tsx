import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

type AnimatedSplashScreenProps = {
  start: boolean;
  onComplete: () => void;
};

export function AnimatedSplashScreen({ start, onComplete }: AnimatedSplashScreenProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!start) {
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) {
        onComplete();
      }
    });

    return () => animation.stop();
  }, [onComplete, progress, start]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <View style={styles.logoMask}>
            <Image source={require('../assets/foreground.png')} style={styles.logoImage} resizeMode="cover" />
          </View>
        </View>
      </View>

      <View style={styles.loadingBarContainer}>
        <Animated.View
          style={[
            styles.loadingBarFill,
            {
              transform: [
                {
                  scaleX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ],
              ...Platform.select({
                android: {
                  transformOrigin: 'left',
                },
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#D3DFF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
    }),
  },
  logoMask: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: '#D3DFF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.5 }],
  },
  loadingBarContainer: {
    position: 'absolute',
    bottom: 80,
    width: 180,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
});
