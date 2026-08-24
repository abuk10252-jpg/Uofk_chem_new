export const LightColors = {
  // الألوان الأساسية
  primary: '#002147',
  secondary: '#FFFFFF',
  accent: '#D4AF37',

  // الخلفيات
  background: '#F9FAFB',
  surface: '#FFFFFF',

  // النصوص
  textPrimary: '#0A0A0A',
  textSecondary: '#4B5563',

  // الحدود
  border: '#E5E7EB',

  // الحالات
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  card: '#FFFFFF',
  text: '#0A0A0A',

  // ألوان إضافية للتطبيق
  overlay: 'rgba(0,0,0,0.5)',
  primaryLight: 'rgba(0,33,71,0.1)',
  accentLight: 'rgba(212,175,55,0.1)',
  successLight: 'rgba(16,185,129,0.1)',
  errorLight: 'rgba(239,68,68,0.1)',
  warningLight: 'rgba(245,158,11,0.1)',
};

// نفس المفاتيح بالظبط بس بألوان الوضع الليلي - عشان أي كود شغال بـ Colors.xxx
// يفضل شغال زي ما هو من غير أي تعديل في الشاشات نفسها
export const DarkColors = {
  primary: '#0A2E5C',
  secondary: '#1C1C1E',
  accent: '#E8C468',

  background: '#0D0D0F',
  surface: '#1A1A1D',

  textPrimary: '#F2F2F2',
  textSecondary: '#9CA3AF',

  border: '#2E2E32',

  success: '#22C55E',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',

  card: '#1A1A1D',
  text: '#F2F2F2',

  overlay: 'rgba(0,0,0,0.7)',
  primaryLight: 'rgba(10,46,92,0.25)',
  accentLight: 'rgba(232,196,104,0.15)',
  successLight: 'rgba(34,197,94,0.15)',
  errorLight: 'rgba(248,113,113,0.15)',
  warningLight: 'rgba(251,191,36,0.15)',
};

// أوبجكت واحد بيتغير محتواه بس (مش بيتغير المرجع نفسه) لما نبدل الثيم -
// عشان كل الشاشات اللي عاملة import { Colors } تفضل شغالة زي ما هي بالظبط
// من غير ما نلمسها، وتاخد الألوان الجديدة أول ما الثيم يتبدل ويعمل remount كامل
export const Colors: typeof LightColors = { ...LightColors };

export function applyTheme(theme: 'light' | 'dark') {
  Object.assign(Colors, theme === 'dark' ? DarkColors : LightColors);
}
