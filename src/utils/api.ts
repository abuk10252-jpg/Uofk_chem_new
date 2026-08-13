import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { auth } from '../firebase';

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.API_URL ||
  ""
).replace(/\/$/, "");

if (!BASE_URL) {
  console.warn("⚠️ WARNING: API_URL is missing");
}

/**
 * الحصول على توكن صالح
 */
async function getFreshToken(): Promise<string | null> {
  try {
    if (auth.currentUser) {
      // force: true يجدد التوكن لو انتهت صلاحيته
      const token = await auth.currentUser.getIdToken(true);
      await AsyncStorage.setItem("token", token);
      return token;
    }
  } catch (e) {
    console.warn("Firebase getIdToken failed, falling back to stored token:", e);
  }

  // fallback للـ AsyncStorage
  try {
    return await AsyncStorage.getItem("token");
  } catch (e) {
    console.warn("AsyncStorage getItem failed:", e);
    return null;
  }
}

/**
 * دالة عامة لجميع API calls
 */
export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  try {
    // التحقق من الإنترنت بشكل أدق
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      console.warn("No internet connection");
      return { offline: true };
    }

    const token = await getFreshToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // دمج الهيدرز بشكل آمن
    if (options.headers) {
      const optHeaders = options.headers as Record<string, string>;
      Object.keys(optHeaders).forEach(key => {
        headers[key] = optHeaders[key];
      });
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    let response: Response;

    try {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // التحقق لو الخطأ بسبب timeout
      if (fetchError?.name === 'AbortError') {
        console.warn(`Request timeout on ${endpoint}`);
        return { timeout: true };
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`API Error ${response.status} on ${endpoint}:`, text);
      return null;
    }

    try {
      return await response.json();
    } catch {
      // لو الرد مو JSON رجع null
      return null;
    }

  } catch (error: any) {
    console.warn(`API Call Error on ${endpoint}:`, error?.message || error);
    return null;
  }
}

/**
 * GET
 */
export async function apiGet(endpoint: string) {
  return apiCall(endpoint, { method: 'GET' });
}

/**
 * POST
 */
export async function apiPost(endpoint: string, body: any) {
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT
 */
export async function apiPut(endpoint: string, body: any) {
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE
 */
export async function apiDelete(endpoint: string) {
  return apiCall(endpoint, { method: 'DELETE' });
}

/**
 * رفع ملف (multipart/form-data)
 */
export async function uploadFile(
  endpoint: string,
  formData: FormData
): Promise<any> {
  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      return { offline: true };
    }

    const token = await getFreshToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000); // زيادة timeout لرفع الملفات

    let response: Response;

    try {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError?.name === 'AbortError') {
        throw new Error('Upload timeout - الملف كبير جداً أو الإنترنت بطيء');
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Upload failed with status ${response.status}`);
    }

    return await response.json();

  } catch (error: any) {
    console.warn(`Upload Error on ${endpoint}:`, error?.message || error);
    throw error;
  }
}
