import { View, ActivityIndicator, StyleSheet } from 'react-native';

// ملاحظة: منطق التوجيه (redirect) بالكامل موجود في app/_layout.tsx (RootLayoutNav).
// لا تضيفوا router.replace هنا مرة أخرى - وجود منطقين للتوجيه في نفس الوقت
// كان بيسبب تعارض/كراش عند تحميل التطبيق.
export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#D4AF37" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#002147',
  },
});
