import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Alert } from 'react-native';

const INDEX_KEY = '@uofk_file_cache_index';
const CACHE_DIR = FileSystem.documentDirectory + 'uofk_files/';

type CacheIndex = Record<string, { localUri: string; name: string; savedAt: number }>;

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

    // 2) لو مش موجود، حاول التحميل (محتاج نت)
    if (!localUri) {
      try {
        localUri = await downloadAndCacheFile(fileId, remoteUrl, fileName);
      } catch (e) {
        // فشل التحميل → جرب فتح الرابط مباشرة كحل أخير
        const canOpen = await Linking.canOpenURL(remoteUrl);
        if (canOpen) {
          await Linking.openURL(remoteUrl);
          return;
        }
        throw e;
      }
    }

    // 3) افتح الملف المحلي
    const canOpen = await Linking.canOpenURL(localUri);
    if (canOpen) {
      await Linking.openURL(localUri);
    } else {
      // بعض الأجهزة مابتدعمش file:// مباشرة
      // نفتح الرابط الأونلاين كبديل
      const canOpenRemote = await Linking.canOpenURL(remoteUrl);
      if (canOpenRemote) {
        await Linking.openURL(remoteUrl);
      } else {
        Alert.alert(
          isArabic ? 'خطأ' : 'Error',
          isArabic ? 'لا يمكن فتح هذا الملف على الجهاز' : 'Cannot open this file on device'
        );
      }
    }
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
