# 📱 AURA – Mobil Uygulama Dönüşüm Planı
# Strateji: React Native (Expo) – Senaryo A (Sadece Mobil)

---

## GENEL MİMARİ

```
Backend (Vercel – DEĞİŞMEZ)     Frontend (YENİ PROJE)
┌─────────────────────────┐      ┌─────────────────────────┐
│ Express + MongoDB        │ ◄──► │ React Native (Expo)     │
│ Cloudinary + Gemini AI   │      │ iOS + Android           │
│ /api/wardrobe            │      │ App Store + Play Store  │
│ /api/generate-outfit     │      └─────────────────────────┘
│ /api/outfits             │
└─────────────────────────┘
```

Backend'de sadece CORS güncellemesi gerekiyor (2 satır).

---

## AŞAMA 0 – BACKEND HAZIRLIĞI (30 dakika)

### Adım 0.1 – server.ts CORS Güncelleme

`server.ts` dosyasında `allowedOrigins` dizisini bul ve Expo URL'lerini ekle:

```typescript
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.APP_URL,
      'https://samethabali.github.io',
      // YENİ SATIRLAR:
      'https://your-expo-app.expo.app',
    ]
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      // YENİ SATIRLAR:
      'http://localhost:8081',
      'exp://localhost:8081',
    ];
```

**Not:** React Native'deki fetch() çağrıları Origin header'ı göndermeyebilir,
bu durumda CORS zaten sorun çıkarmaz. Ama geliştirme ortamında güvenli olması için ekle.

### Adım 0.2 – API_URL Sabitini Belirle

Mobil uygulamada tüm API çağrıları tam URL kullanacak.
Vercel'deki deploy URL'ini not al: `https://your-project.vercel.app`

---

## AŞAMA 1 – YENİ EXPO PROJESİ KURULUMU (1 gün)

### Adım 1.1 – Expo CLI Kur

```bash
npm install -g expo-cli eas-cli
```

### Adım 1.2 – Yeni Proje Oluştur

```bash
# Desktop'ta yeni klasör (zhl2'nin yanına)
cd C:\Users\samethabali\Desktop
npx create-expo-app aura-mobile --template expo-template-blank-typescript
cd aura-mobile
```

### Adım 1.3 – Gerekli Paketleri Kur

```bash
# Navigasyon
npx expo install @react-navigation/native
npx expo install @react-navigation/bottom-tabs
npx expo install @react-navigation/stack
npx expo install react-native-screens react-native-safe-area-context

# Görsel & Kamera
npx expo install expo-image-picker
npx expo install expo-image

# Depolama (localStorage yerine)
npx expo install @react-native-async-storage/async-storage

# Bildirimler
npx expo install expo-notifications

# Animasyonlar (Framer Motion yerine)
npx expo install react-native-reanimated

# İkonlar (lucide-react yerine)
npm install @expo/vector-icons

# Diğer
npx expo install expo-status-bar
npx expo install expo-splash-screen
npx expo install expo-font
```

### Adım 1.4 – Proje Klasör Yapısını Oluştur

```
aura-mobile/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx        ← Alt navigasyon bar
│   │   ├── index.tsx          ← Koleksiyon ekranı
│   │   ├── outfits.tsx        ← Kombinlerim ekranı
│   │   ├── planner.tsx        ← AI Stylist ekranı
│   │   └── stats.tsx          ← İstatistikler ekranı
│   ├── modals/
│   │   ├── add-item.tsx       ← Kıyafet ekleme modal
│   │   └── item-detail.tsx    ← Kıyafet detay modal
│   └── _layout.tsx            ← Root layout
├── components/
│   ├── wardrobe/
│   │   ├── WardrobeGrid.tsx
│   │   ├── WardrobeGridItem.tsx
│   │   └── ItemDetailModal.tsx
│   ├── outfits/
│   │   ├── OutfitCard.tsx
│   │   └── OutfitPlanner.tsx
│   ├── ui/
│   │   ├── NotificationToast.tsx
│   │   └── ConfirmModal.tsx
│   └── ErrorBoundary.tsx
├── contexts/               ← zhl2'den kopyalanır (az değişim)
│   ├── NotificationContext.tsx
│   └── WardrobeContext.tsx
├── hooks/                  ← zhl2'den kopyalanır (az değişim)
│   ├── useOutfitGeneration.ts
│   ├── usePersonalContext.ts
│   ├── useSelectionMode.ts
│   └── useTheme.ts
├── services/               ← zhl2'den kopyalanır
│   └── stylistService.ts
├── constants/              ← zhl2'den kopyalanır
│   └── wardrobe.ts
├── types.ts                ← zhl2'den BİREBİR kopyalanır
└── config/
    └── api.ts              ← API URL sabiti
```

---

## AŞAMA 2 – TAŞINAN DOSYALAR (1 gün)

### Adım 2.1 – Birebir Kopyalanan Dosyalar

Bu dosyaları zhl2'den aura-mobile'a kopyala, DEĞİŞİKLİK YAPMA:

```
zhl2/src/types.ts              → aura-mobile/types.ts
zhl2/src/constants/wardrobe.ts → aura-mobile/constants/wardrobe.ts
```

### Adım 2.2 – API Config Oluştur

```typescript
// aura-mobile/config/api.ts
export const API_BASE_URL = __DEV__
  ? 'http://192.168.x.x:3000'    // Geliştirmede: kendi bilgisayarının IP'si
  : 'https://your-project.vercel.app'; // Production: Vercel URL
```

**Önemli:** `192.168.x.x` yerine kendi bilgisayarının WiFi IP adresini yaz.
Windows'ta bulmak için: `ipconfig` komutunu çalıştır, IPv4 adresini al.

### Adım 2.3 – Services Klasörünü Taşı

```typescript
// aura-mobile/services/stylistService.ts
// zhl2'deki ile aynı, sadece API URL'ini değiştir:

import { API_BASE_URL } from '../config/api';

// Eski: fetch('/api/generate-outfit', ...)
// Yeni:
fetch(`${API_BASE_URL}/api/generate-outfit`, ...)
```

### Adım 2.4 – WardrobeContext Taşıma

```typescript
// aura-mobile/contexts/WardrobeContext.tsx
// zhl2'deki ile neredeyse aynı, sadece şunları değiştir:

import { API_BASE_URL } from '../config/api';

// Tüm fetch('/api/...') çağrılarını
// fetch(`${API_BASE_URL}/api/...`) yap
```

### Adım 2.5 – NotificationContext Taşıma

```typescript
// aura-mobile/contexts/NotificationContext.tsx
// zhl2'deki mantık aynı kalır.
// Fark: alert() ve browser API'leri React Native Modal ile değiştirilir.
// Toast bildirimleri için react-native'in Alert veya özel Modal kullan.
```

### Adım 2.6 – Hooks Taşıma

```typescript
// hooks/usePersonalContext.ts
// localStorage → AsyncStorage ile değiştir:

import AsyncStorage from '@react-native-async-storage/async-storage';

// Eski:
localStorage.setItem('aura_personal_context', val);
const saved = localStorage.getItem('aura_personal_context');

// Yeni:
await AsyncStorage.setItem('aura_personal_context', val);
const saved = await AsyncStorage.getItem('aura_personal_context');
```

```typescript
// hooks/useTheme.ts
// localStorage → AsyncStorage ile aynı değişikliği yap.
// useColorScheme() hook'u Appearance API ile entegre et.
```

---

## AŞAMA 3 – TEMEL DÖNÜŞÜM KURALLARI

### HTML → React Native Dönüşüm Tablosu

| Web (zhl2) | React Native | Örnek |
|---|---|---|
| `<div>` | `<View>` | Container |
| `<p>`, `<span>`, `<h1>` | `<Text>` | Tüm yazılar |
| `<img>` | `<Image>` | Resimler |
| `<button>` | `<TouchableOpacity>` | Butonlar |
| `<input>` | `<TextInput>` | Form alanları |
| `<textarea>` | `<TextInput multiline>` | Çok satırlı |
| `<ScrollView>` | `<ScrollView>` | Aynı! |
| `className="..."` | `style={styles.xxx}` | StyleSheet |
| `motion.div` | `Animated.View` | Animasyon |

### StyleSheet Örneği

```typescript
// Web (zhl2):
<div className="flex items-center bg-indigo-600 p-4 rounded-xl">

// React Native:
<View style={styles.container}>

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
  }
});
```

### İkonlar Dönüşümü

```typescript
// Web (zhl2): lucide-react
import { Sparkles, Plus } from 'lucide-react';
<Sparkles className="w-5 h-5" />

// React Native: @expo/vector-icons
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
<Ionicons name="sparkles" size={20} color="#4F46E5" />
```

---

## AŞAMA 4 – EKRAN GELİŞTİRME (2–3 hafta)

### Adım 4.1 – Root Layout (app/_layout.tsx)

```typescript
import { Stack } from 'expo-router';
import { WardrobeProvider } from '../contexts/WardrobeContext';
import { NotificationProvider } from '../contexts/NotificationContext';

export default function RootLayout() {
  return (
    <NotificationProvider>
      <WardrobeProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modals/add-item" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/item-detail" options={{ presentation: 'modal' }} />
        </Stack>
      </WardrobeProvider>
    </NotificationProvider>
  );
}
```

### Adım 4.2 – Alt Navigasyon (app/(tabs)/_layout.tsx)

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#4F46E5' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Koleksiyon',
          tabBarIcon: ({ color }) => <Ionicons name="shirt" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="outfits"
        options={{
          title: 'Kombinlerim',
          tabBarIcon: ({ color }) => <Ionicons name="layers" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'AI Stylist',
          tabBarIcon: ({ color }) => <Ionicons name="sparkles" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'İstatistikler',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

### Adım 4.3 – Koleksiyon Ekranı (app/(tabs)/index.tsx)

WardrobeGrid bileşenini FlatList ile yeniden yaz:

```typescript
import { FlatList, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useWardrobe } from '../../contexts/WardrobeContext';

export default function KoleksiyonScreen() {
  const { items, loading, fetchWardrobe, hasMore, page } = useWardrobe();

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/modals/item-detail?id=${item.id}`)}>
      <Image source={{ uri: item.imagePath }} style={styles.image} contentFit="cover" />
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.category}>{item.category}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        onEndReached={() => hasMore && fetchWardrobe(page + 1, true)}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
```

### Adım 4.4 – Kıyafet Ekleme (Native Kamera)

```typescript
// modals/add-item.tsx
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../config/api';

const takePhoto = async () => {
  // Kamera izni iste
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });

  if (!result.canceled) {
    await uploadImage(result.assets[0].uri);
  }
};

const pickFromGallery = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (!result.canceled) {
    await uploadImage(result.assets[0].uri);
  }
};

const uploadImage = async (uri: string) => {
  const formData = new FormData();
  formData.append('image', {
    uri,
    type: 'image/jpeg',
    name: 'wardrobe_item.jpg',
  } as any);

  const response = await fetch(`${API_BASE_URL}/api/wardrobe/upload`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const data = await response.json();
  // Başarılı → gardırobu yenile
};
```

### Adım 4.5 – AI Stylist Ekranı (app/(tabs)/planner.tsx)

OutfitPlanner bileşenini React Native'e dönüştür.
Framer Motion animasyonları → react-native-reanimated ile değiştir:

```typescript
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

// motion.div yerine:
const opacity = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

// Tetikle:
opacity.value = withTiming(1, { duration: 300 });

// Kullan:
<Animated.View style={animatedStyle}>...</Animated.View>
```

---

## AŞAMA 5 – TEST SÜRECİ (Paralel devam eder)

### Adım 5.1 – Expo Go ile Anlık Test

```bash
cd aura-mobile
npx expo start

# Terminal QR kod gösterir.
# Telefonuna App Store/Play Store'dan "Expo Go" indir.
# QR'ı Expo Go uygulamasıyla tara.
# Uygulama açılır. Kod değiştirince otomatik yenilenir.
```

### Adım 5.2 – Android Emülatör Kurulumu

1. Android Studio indir: https://developer.android.com/studio
2. Kur → "SDK Manager" → Android 14 SDK'yı seç → İndir
3. "AVD Manager" → "Create Virtual Device" → Pixel 8 → Android 14
4. Emülatörü başlat
5. Expo terminalinde `a` tuşuna bas → Emülatör açılır

### Adım 5.3 – Gerçek Cihaz Test (APK)

```bash
# Expo hesabı oluştur: expo.dev
npx eas login
npx eas build:configure

# Preview APK oluştur (bulutta ~10 dakika)
npx eas build --platform android --profile preview

# Link gelir → telefonda aç → indir → kur
```

---

## AŞAMA 6 – MAĞAZA YAYINI

### Adım 6.1 – Google Play Store (Android)

1. Google Play Console'da hesap aç: play.google.com/console ($25 tek seferlik)
2. Yeni uygulama oluştur → "AURA – Akıllı Gardırop"
3. Production APK/AAB oluştur:
   ```bash
   npx eas build --platform android --profile production
   ```
4. Build dosyasını Console'a yükle
5. Ekran görüntüleri ekle (telefon): en az 2 adet, 1080x1920 önerilen
6. Uygulama açıklaması yaz (Türkçe + İngilizce)
7. "İnceleme İçin Gönder" → 1–3 gün içinde yayına girer

### Adım 6.2 – Apple App Store (iOS)

1. Apple Developer Program'a üye ol: developer.apple.com ($99/yıl)
2. App Store Connect'te yeni uygulama oluştur
3. iOS build için Mac gerekir VEYA Expo'nun cloud build kullan:
   ```bash
   npx eas build --platform ios --profile production
   ```
4. TestFlight'a yükle → önce kendin test et
5. App Store'a gönder → 1–7 gün inceleme süreci

---

## DÖNÜŞÜM ÖZET TABLOSU

| Dosya / Modül | Durum | İşlem |
|---|---|---|
| `types.ts` | ✅ Hazır | Birebir kopyala |
| `constants/wardrobe.ts` | ✅ Hazır | Birebir kopyala |
| `services/stylistService.ts` | 🔧 Az değişim | Sadece URL düzelt |
| `contexts/WardrobeContext.tsx` | 🔧 Az değişim | fetch URL'leri düzelt |
| `contexts/NotificationContext.tsx` | 🔧 Orta değişim | Alert → Modal |
| `hooks/usePersonalContext.ts` | 🔧 Az değişim | localStorage → AsyncStorage |
| `hooks/useTheme.ts` | 🔧 Az değişim | localStorage → AsyncStorage |
| `hooks/useOutfitGeneration.ts` | 🔧 Az değişim | API URL düzelt |
| `hooks/useSelectionMode.ts` | ✅ Hazır | Birebir kopyala |
| `App.tsx` | ❌ Yeniden yaz | Expo Router layout |
| `components/wardrobe/*` | ❌ Yeniden yaz | RN bileşenleri |
| `components/outfits/*` | ❌ Yeniden yaz | RN bileşenleri |
| `components/stats/*` | ❌ Yeniden yaz | RN bileşenleri |
| `server.ts` (Backend) | ✅ Neredeyse hazır | Sadece CORS ekle |

---

## SÜRE TAHMİNİ

| Aşama | Süre |
|-------|------|
| Aşama 0: Backend CORS | 30 dakika |
| Aşama 1: Expo kurulum + paketler | 1 gün |
| Aşama 2: Dosya taşıma | 1 gün |
| Aşama 3: Root layout + navigasyon | 2 gün |
| Aşama 4: Koleksiyon ekranı | 3 gün |
| Aşama 4: Kombinler ekranı | 2 gün |
| Aşama 4: AI Stylist ekranı | 3 gün |
| Aşama 4: Kıyafet ekleme (kamera) | 1 gün |
| Aşama 4: İstatistikler ekranı | 1 gün |
| Aşama 5: Test & bug fix | 3 gün |
| Aşama 6: Mağaza yayını | 5–10 gün |
| **TOPLAM** | **~4–6 hafta** |

---

## NOTLAR

- Backend'de `.env` dosyasındaki tüm secret'lar aynen kalır.
- Vercel deployment değişmez, sadece CORS satırları eklenir.
- iOS test için Mac gerekli DEĞIL — Expo EAS Build bulutta derler.
- Android emülatörü Windows'ta çalışır, iOS simülatörü sadece Mac'te.
- `expo-image` paketi, web'deki `<img>` gibi lazy loading ve caching yapar.
- `react-native-reanimated` Framer Motion'ın tüm özelliklerini karşılar.
