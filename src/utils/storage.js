import AsyncStorage from "@react-native-async-storage/async-storage";

// تخزين أي بيانات
export async function saveItem(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage Save Error:", e);
  }
}

// قراءة أي بيانات
export async function getItem(key) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.warn("Storage Read Error:", e);
    return null;
  }
}

// حذف بيانات
export async function removeItem(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn("Storage Remove Error:", e);
  }
}

// حذف أكثر من مفتاح مع بعض
export async function removeItems(keys) {
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (e) {
    console.warn("Storage MultiRemove Error:", e);
  }
}

// مسح كل البيانات
export async function clearAll() {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.warn("Storage Clear Error:", e);
  }
}
