export const LightColors = {
  primary: '#0B1F3A',
  secondary: '#FFFFFF',
  accent: '#C9A227',

  background: '#F4F6F9',
  surface: '#FFFFFF',

  textPrimary: '#0F172A',
  textSecondary: '#64748B',

  border: '#E2E8F0',

  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  card: '#FFFFFF',
  text: '#0F172A',

  overlay: 'rgba(15,23,42,0.45)',
  primaryLight: 'rgba(11,31,58,0.08)',
  accentLight: 'rgba(201,162,39,0.12)',
  successLight: 'rgba(16,185,129,0.12)',
  errorLight: 'rgba(239,68,68,0.12)',
  warningLight: 'rgba(245,158,11,0.12)',

  // WhatsApp-like chat
  chatBg: '#E8E2D6',
  bubbleIn: '#FFFFFF',
  bubbleOut: '#D9FDD3',
  chatHeader: '#0B1F3A',
};

export const DarkColors = {
  primary: '#1A3A66',
  secondary: '#121214',
  accent: '#E8C468',

  background: '#0B0B0D',
  surface: '#16161A',

  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',

  border: '#27272A',

  success: '#22C55E',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',

  card: '#16161A',
  text: '#F1F5F9',

  overlay: 'rgba(0,0,0,0.65)',
  primaryLight: 'rgba(26,58,102,0.3)',
  accentLight: 'rgba(232,196,104,0.15)',
  successLight: 'rgba(34,197,94,0.15)',
  errorLight: 'rgba(248,113,113,0.15)',
  warningLight: 'rgba(251,191,36,0.15)',

  chatBg: '#0B141A',
  bubbleIn: '#1F2C34',
  bubbleOut: '#005C4B',
  chatHeader: '#1F2C34',
};

export const Colors: typeof LightColors = { ...LightColors };

export function applyTheme(theme: 'light' | 'dark') {
  Object.assign(Colors, theme === 'dark' ? DarkColors : LightColors);
}
