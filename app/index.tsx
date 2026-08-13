import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

export default function Index() {
  // بتبدأ كبيرة (1.6x) وبتصغر لحجمها الطبيعي في الوسط، مع ظهور تدريجي
  const scale = useRef(new Animated.Value(1.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { opacity, transform: [{ scale }] },
        ]}
      >
        <Text style={styles.title}>UofK Chem</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>Designed by Academic Office 23.5</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#002147',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: '#D4AF37',
    marginVertical: 14,
  },
  subtitle: {
    fontSize: 13,
    color: '#D4AF37',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
