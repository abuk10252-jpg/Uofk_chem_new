// يحوّل رابط المشاركة القادم من نظام أندرويد إلى شاشة /shareintent
// بدونه الـ expo-router بيودّي المستخدم لصفحة "not found".
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/shareintent';
    }
    return path;
  } catch {
    return '/';
  }
}
