import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiCall, apiPost, BASE_URL } from '../../src/utils/api';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getFirebaseAuth } from '../../src/firebase';

interface Member {
  id: string;
  name: string;
  photo?: string;
  role: string;
}

// بروفايل القناة - زي بروفايل قروب الواتساب: الصورة + قائمة الأعضاء
export default function AdminChatInfoScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isArabic = user?.language === 'ar';

  const [photoUrl, setPhotoUrl] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiCall('/admin/chat/info');
      setPhotoUrl(data?.photo_url || '');
      setMembers(data?.members || []);
    } catch (e) {
      console.warn('فشل تحميل معلومات القناة:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleChangePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        isArabic ? 'محتاجين إذن' : 'Permission needed',
        isArabic ? 'محتاجين إذن الوصول للمعرض عشان تغيّر صورة القناة' : 'We need gallery access to change the channel photo'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();

      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        name: 'channel_photo.jpg',
        type: 'image/jpeg',
      } as any);

      const res = await fetch(`${BASE_URL}/admin/chat/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data?.photo_url) setPhotoUrl(data.photo_url);
    } catch (e) {
      console.warn('فشل تغيير صورة القناة:', e);
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل رفع الصورة' : 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }

  function renderMember({ item }: { item: Member }) {
    return (
      <View style={styles.memberRow}>
        <View style={styles.memberAvatar}>
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.memberAvatarImg} />
          ) : (
            <Ionicons name="person" size={18} color={Colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberRole}>
            {item.role === 'super_admin'
              ? (isArabic ? 'سوبر أدمن' : 'Super Admin')
              : (isArabic ? 'أدمن' : 'Admin')}
          </Text>
        </View>
        {item.id === user?.uid && (
          <Text style={styles.youLabel}>{isArabic ? 'انت' : 'You'}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isArabic ? 'معلومات القناة' : 'Channel Info'}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={item => item.id}
          renderItem={renderMember}
          ListHeaderComponent={
            <View style={styles.photoSection}>
              <TouchableOpacity onPress={handleChangePhoto} disabled={uploading} style={styles.photoWrap}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#FFF" />
                  )}
                </View>
              </TouchableOpacity>
              <Text style={styles.channelName}>{isArabic ? 'قناة الأدمنز' : 'Admin Channel'}</Text>
              <Text style={styles.changePhotoHint}>
                {isArabic ? 'دوس على الصورة عشان تغيّرها' : 'Tap the photo to change it'}
              </Text>
              <Text style={styles.membersHeader}>
                {isArabic ? `الأعضاء · ${members.length}` : `Members · ${members.length}`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
    backgroundColor: Colors.primary,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  photoSection: { alignItems: 'center', paddingVertical: 24 },
  photoWrap: { position: 'relative' },
  photo: { width: 110, height: 110, borderRadius: 55 },
  photoPlaceholder: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  channelName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 14 },
  changePhotoHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  membersHeader: {
    alignSelf: 'flex-start', fontSize: 13, fontWeight: '700',
    color: Colors.textSecondary, marginTop: 24, marginHorizontal: 16,
  },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  memberAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  memberName: { fontSize: 14.5, fontWeight: '600', color: Colors.textPrimary },
  memberRole: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  youLabel: { fontSize: 12, color: Colors.accent, fontWeight: '700' },
});
