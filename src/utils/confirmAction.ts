import { Alert, Platform } from 'react-native';

interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * دالة موحّدة لعرض تأكيد (Confirm/Cancel) تشتغل صح على الويب والموبايل مع بعض.
 * على الويب: Alert.alert بأزرار متعددة مش بيتنفذ صح (المتصفح مابيعرفش يعرضه)،
 * فبنستخدم window.confirm بدالها. على الموبايل بنسيب Alert.alert العادي زي ما هو.
 */
export function confirmAction({
  title,
  message,
  confirmText,
  cancelText,
  destructive = false,
  onConfirm,
}: ConfirmActionOptions) {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n${message}`);
    if (confirmed) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}
