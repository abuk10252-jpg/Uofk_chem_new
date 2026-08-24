import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';

interface AnimatedPressableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * زرار بيتحول بلمسة بسيطة (scale) لما تدوس عليه - ترانزيشن خفيف مش مبالغ فيه.
 * استخدمه بدل TouchableOpacity في أي زرار رئيسي عايز يحس المستخدم إنه فعليًا داس عليه.
 */
export default function AnimatedPressable({ style, children, onPressIn, onPressOut, ...rest }: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn(e: any) {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    onPressIn?.(e);
  }

  function handlePressOut(e: any) {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
    onPressOut?.(e);
  }

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
