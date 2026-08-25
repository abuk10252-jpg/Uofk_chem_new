UofK Chem - إصلاح الإشعارات (التطبيق)
=====================================
- NotificationContext يحفظ push_token في Firestore مباشرة + عبر API
- API موحّد على: https://server-3xn9.onrender.com/api
- لازم eas build جديد بعد الاستبدال
- في EAS Environment variables ضع:
  EXPO_PUBLIC_API_URL=https://server-3xn9.onrender.com/api

بعد التثبيت: افتح التطبيق → وافق على الإشعارات → تأكد من ظهور push_token في Firestore users
