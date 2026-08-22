import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

const INDEX_KEY = '@uofk_file_cache_index';
const CACHE_DIR = FileSystem.documentDirectory + 'uofk_files/';

type CacheIndex = Record<string, { localUri: string; name: string; savedAt: number }>;

// نوع الملف (MIME) عشان نقدر نقول لنظام التشغيل يفتحه بأي قارئ افتراضي مثبت
const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
};

function getMimeType(fileName: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

async function getIndex(): Promise<CacheIndex> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveIndex(index: CacheIndex) {
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn('Failed to save file cache index', e);
  }
}

/** هل الملف موجود محلياً؟ */
export async function getLocalFileUri(fileId: string): Promise<string | null> {
  const index = await getIndex();
  const entry = index[fileId];
  if (!entry?.localUri) return null;

  const info = await FileSystem.getInfoAsync(entry.localUri);
  if (info.exists) return entry.localUri;

  // الملف اتمسح من الجهاز، نشيله من الفهرس
  delete index[fileId];
  await saveIndex(index);
  return null;
}

/**
 * يحمل الملف من الإنترنت ويحفظه محلياً.
 * لو موجود أصلاً بيرجع المسار المحلي على طول.
 */
export async function downloadAndCacheFile(
  fileId: string,
  remoteUrl: string,
  fileName: string
): Promise<string> {
  // لو موجود محلياً
  const existing = await getLocalFileUri(fileId);
  if (existing) return existing;

  await ensureDir();

  // نحدد امتداد الملف
  const ext = (fileName.split('.').pop() || 'bin').toLowerCase();
  const localUri = `${CACHE_DIR}${fileId}.${ext}`;

  const result = await FileSystem.downloadAsync(remoteUrl, localUri);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed with status ${result.status}`);
  }

  const index = await getIndex();
  index[fileId] = {
    localUri: result.uri,
    name: fileName,
    savedAt: Date.now(),
  };
  await saveIndex(index);

  return result.uri;
}

/**
 * يفتح ملف محلي بقارئ المستندات الافتراضي بتاع الجهاز:
 * - أندرويد: بيحوّل المسار لـ content:// (عبر FileProvider) ويبعت Intent.ACTION_VIEW
 *   عشان يفتح مباشرة في التطبيق المثبت لنوع الملف ده (قارئ PDF، الصور، إلخ)
 * - iOS: بيفتح شيت المشاركة/المعاينة بتاع النظام (مفيش طريقة تانية في تطبيقات Expo
 *   المُدارة تفتح مباشرة "بقارئ افتراضي" زي أندرويد، فده أقرب سلوك متاح)
 */
async function openWithNativeViewer(localUri: string, fileName: string, isArabic: boolean) {
  const mimeType = getMimeType(fileName);

  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(localUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: mimeType,
    });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(localUri, { mimeType, dialogTitle: fileName });
  } else {
    Alert.alert(
      isArabic ? 'خطأ' : 'Error',
      isArabic ? 'لا يمكن فتح هذا الملف على الجهاز' : 'Cannot open this file on device'
    );
  }
}

/**
 * يفتح الملف:
 * - لو موجود محلياً → يفتحه من الجهاز (أوفلاين)
 * - لو مش موجود وفيه نت → يحمله بعدين يفتحه
 * - لو مفيش نت ومش موجود محلياً → رسالة خطأ
 */
export async function openFileOfflineAware(
  fileId: string,
  remoteUrl: string,
  fileName: string,
  isArabic: boolean
): Promise<void> {
  try {
    // 1) جرب المحلي أولاً
    let localUri = await getLocalFileUri(fileId);

    // 2) لو مش موجود، حمّله (محتاج نت)
    if (!localUri) {
      localUri = await downloadAndCacheFile(fileId, remoteUrl, fileName);
    }

    // 3) افتحه بقارئ المستندات الافتراضي بتاع الجهاز
    await openWithNativeViewer(localUri, fileName, isArabic);
  } catch (e: any) {
    Alert.alert(
      isArabic ? 'خطأ' : 'Error',
      isArabic
        ? 'فشل فتح الملف. تأكد من الاتصال بالإنترنت أول مرة لتحميله.'
        : 'Failed to open file. Connect to internet once to download it.'
    );
  }
}

/** هل الملف متخزن أوفلاين؟ */
export async function isFileCached(fileId: string): Promise<boolean> {
  const uri = await getLocalFileUri(fileId);
  return !!uri;
}
