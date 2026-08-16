import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getFirebaseAuth } from '../firebase';

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.API_URL ||
  ""
).replace(/\/$/, "");

if (!BASE_URL) {
  console.warn("⚠️ WARNING: API_URL is missing");
}

async function getFreshToken(): Promise<string | null> {
  try {
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken(true);
      await AsyncStorage.setItem("token", token);
      return token;
    }
  } catch (e) {
    console.warn("Firebase getIdToken failed, falling back to stored token:", e);
  }
  try {
    return await AsyncStorage.getItem("token");
  } catch (e) {
    console.warn("AsyncStorage getItem failed:", e);
    return null;
  }
}

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected || !netInfo.isInternetReachable) {
    throw new Error('لا يوجد اتصال بالإنترنت');
  }

  const token = await getFreshToken();
  if (!token) {
    throw new Error('تعذر الحصول على جلسة تسجيل الدخول - سجل خروج وادخل تاني');
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.headers) {
    const optHeaders = options.headers as Record<string, string>;
    Object.keys(optHeaders).forEach(key => {
      headers[key] = optHeaders[key];
    });
  }

  headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (fetchError: any) {
    clearTimeout(timeoutId);
    if (fetchError?.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال - جرب تاني (ممكن السيرفر كان نايم، استنى شوية وحاول تاني)');
    }
    throw new Error(`فشل الاتصال بالسيرفر: ${fetchError?.message || fetchError}`);
  }
  clearTimeout(timeoutId);

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    console.warn(`API Error ${response.status} on ${endpoint}:`, text);
    let serverMsg = text;
    try {
      const parsed = JSON.parse(text);
      serverMsg = parsed.error || parsed.message || text;
    } catch {}
    throw new Error(`[${response.status}] ${serverMsg || 'Request failed'}`);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiGet(endpoint: string) {
  return apiCall(endpoint, { method: 'GET' });
}

export async function apiPost(endpoint: string, body: any) {
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiPut(endpoint: string, body: any) {
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function apiDelete(endpoint: string) {
  return apiCall(endpoint, { method: 'DELETE' });
}

export async function uploadFile(
  endpoint: string,
  formData: FormData
): Promise<any> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected || !netInfo.isInternetReachable) {
    throw new Error('لا يوجد اتصال بالإنترنت');
  }

  const token = await getFreshToken();
  if (!token) {
    throw new Error('تعذر الحصول على جلسة تسجيل الدخول - سجل خروج وادخل تاني');
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

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
      throw new Error('انتهت مهلة الرفع - الملف كبير جداً أو الإنترنت بطيء');
    }
    throw new Error(`فشل الاتصال بالسيرفر: ${fetchError?.message || fetchError}`);
  }
  clearTimeout(timeoutId);

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    let serverMsg = text;
    try {
      const parsed = JSON.parse(text);
      serverMsg = parsed.error || parsed.message || text;
    } catch {}
    throw new Error(`[${response.status}] ${serverMsg || 'Upload failed'}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
