# Tamamen Local Migration Plani (PocketBase ve Login kaldirma)

## 1) Hedef

Bu planin amaci uygulamayi tamamen local odakli hale getirmek:

- Zorunlu login ve signup akisini kaldirmak
- PocketBase bagimliligini tamamen kaldirmak
- Community modulu ve backend bagimli sosyal ozellikleri kaldirmak
- Core degeri korumak: tetik kaydi, yuruyus, ilerleme analitigi, onboarding

Bu dokuman urun + teknik + teslim plani olarak kullanilabilir.

---

## 2) Urun Kararlari (Kesin)

1. Uygulama **hesapsiz** calisacak.
2. Tum veriler **cihazda local DB** icinde tutulacak.
3. **Community tab tamamen kalkacak**.
4. Onboarding tamamlaninca app dogrudan ana ekranlara gececek.
5. Login/logout/sessions/account guvenlik metinleri kaldirilacak.

---

## 3) Kapsam

### In Scope

- Auth ekranlarini kaldirma
- Root route guard'i auth yerine local onboarding kontrolune cevirme
- PocketBase client ve tum `pb.collection(...)` kullanimlarini local repository katmanina tasima
- Community feature + tab kaldirma
- Settings ekranini local veri yonetimi odakli hale getirme
- Paket bagimliliklarini sadeleştirme

### Out of Scope (simdilik)

- Cihazlar arasi sync
- Cloud backup
- Multi-user account modeli
- Uzak moderasyon/admin panelleri

---

## 4) UX Etkisi ve Yeni Deneyim

### Kazanimlar

- Ilk acilista friction cok azalir (kayit/login yok)
- Offline kullanim guclenir
- Kisisel veri algisi guclenir (veri cihazda)

### Kayiplar

- Cihaz degisikligi/reinstall durumunda veri kaybi riski
- Community/sosyal motivasyon katmani kalkar

### UX Onerileri

- Ilk acilis: "Start without account" degil, direkt onboarding
- Settings icine:
  - "Export local data" (JSON/CSV)
  - "Import local data"
  - "Delete all local data"
- Community tab yerine daha anlamli bir sekme:
  - Secenek A: "Insights"
  - Secenek B: "Resources"
  - Secenek C: 5 tab yerine 4 tab (Home, Walk, Log, Progress, Settings)

Bu migration icin en temiz secenek: **Community tabi tamamen kaldirip tab sayisini azaltmak**.

---

## 5) Teknik Mimari (Yeni)

## 5.1 Veri Katmani

Local DB tercihi: **SQLite (expo-sqlite)**

Neden:

- Mevcut veri modeli iliskisel
- Filtre/siralama/sayim ihtiyaci var
- Trigger map + progress sorgulari icin uygun

Repository katmani eklenmeli:

- `lib/data/repositories/dogProfileRepo.ts`
- `lib/data/repositories/triggerLogRepo.ts`
- `lib/data/repositories/walkRepo.ts`
- `lib/data/repositories/settingsRepo.ts`

UI katmani repository cagirir, DB detayini bilmez.

## 5.2 Kimlik Modeli

Auth user id yerine local owner id:

- App ilk acilista UUID uretir ve `AsyncStorage` veya `settings` tablosuna kaydeder
- Eski `owner_id` alanlari local id ile doldurulur

## 5.3 Premium/RevenueCat

Mevcut `syncRevenueCatUser(model?.id)` auth id bagimli.

Yeni yapi:

- RevenueCat `appUserID` olarak local UUID kullan
- Login/logout tetiklerini kaldir
- Premium kontrolu aynen kalabilir (device-level)

---

## 6) Veri Modeli Donusumu

PocketBase collections -> Local tables

- `dog_profiles` -> `dog_profiles`
- `trigger_logs` -> `trigger_logs`
- `walks` -> `walks`
- `user_profiles` -> kaldirilabilir veya `app_settings` ile birlestirilebilir
- `community_posts` -> **kaldir**
- `community_owner_locations` -> **kaldir**
- `expert_qa_sessions` -> **kaldir**
- `expert_qa_rsvps` -> **kaldir**

Onerilen ek tablolar:

- `app_settings` (onboarding_complete, local_owner_id, vb)
- `migration_meta` (schema_version)

---

## 7) Dosya Bazli Etki Analizi

### A) Tamamen kaldirilacak veya rota disi kalacak

- `app/(auth)/login.tsx`
- `app/(auth)/signup.tsx`
- `app/(auth)/_layout.tsx`
- `app/(tabs)/community.tsx`

### B) Buyuk refactor gerektiren dosyalar

- `lib/pocketbase.ts` (sil veya local data bootstrap dosyasina donustur)
- `app/_layout.tsx` (auth guard kaldir, onboarding/local profile guard yap)
- `app/(tabs)/index.tsx`
- `app/(tabs)/log.tsx`
- `app/(tabs)/progress.tsx`
- `app/walk/index.tsx`
- `app/walk/active.tsx`
- `app/walk/summary.tsx`
- `app/onboarding/dog-profile.tsx`
- `app/onboarding/technique.tsx`
- `app/(tabs)/settings.tsx`

### C) Tab konfigurasyonu

- `app/(tabs)/_layout.tsx` icinden community tab kaldirilacak

### D) Monetization baglantilari

- `lib/billing/revenuecat.ts`
- `lib/billing/access.ts`
- `components/PremiumGate.tsx` (community kaldirilacagi icin sadece kalan premium alanlarda kullan)

---

## 8) Fazli Uygulama Plani

## Faz 1 - Altyapi Hazirligi

- [ ] `expo-sqlite` entegrasyonu
- [ ] DB init + migration runner
- [ ] Repository katmani iskeleti
- [ ] `app_settings` tablosu ve local owner id uretimi

Teslim ciktisi:

- App acilisinda DB hazir, local id mevcut

## Faz 2 - Auth ve Routing Temizligi

- [ ] Auth rotalarini devre disi birak/kaldir
- [ ] `app/_layout.tsx` auth kontrolunu kaldir
- [ ] Onboarding tamamlanma kontrolunu localden yap

Teslim ciktisi:

- Uygulama login istemeden acilir

## Faz 3 - Core Ozelliklerin Local'e Tasinmasi

- [ ] Onboarding create/update islemleri local DB
- [ ] Dashboard sorgulari local DB
- [ ] Quick log create/list local DB
- [ ] Walk create/update local DB
- [ ] Progress chart/map/report sorgulari local DB

Teslim ciktisi:

- Home, Log, Walk, Progress ekranlari PocketBase olmadan calisir

## Faz 4 - Community Kaldirma

- [ ] Community tab/route kaldir
- [ ] Community ile ilgili tipler, helperlar, metinler temizle
- [ ] README/spec dokumanlarini guncelle

Teslim ciktisi:

- Uygulama tamamen kisisel local takip urunu olarak netlesir

## Faz 5 - Settings ve Veri Yonetimi

- [ ] Account/Security kartlarini local veri kartlarina cevir
- [ ] Export JSON
- [ ] Import JSON
- [ ] "Delete all local data" + dogrulama dialogu

Teslim ciktisi:

- Kullanici kendi verisini yonetebilir

## Faz 6 - Bagimlilik ve Cleanup

- [ ] `pocketbase` paketini sil
- [ ] `expo-auth-session` ve `expo-web-browser` gereksiz ise sil
- [ ] Kullanilmayan kod/import temizligi
- [ ] Lint ve runtime smoke test

Teslim ciktisi:

- Sade, tamamen local kod tabani

---

## 9) Test Plani

### Fonksiyonel

- Ilk acilis -> onboarding -> dog profile -> ana ekran
- Trigger log ekle/listede gor
- Walk baslat/durdur/summary kaydet
- Progress ekrani chart/map verileri dogru gosteriyor mu
- App yeniden acilinca veriler korunuyor mu

### Negatif senaryolar

- DB init fail olursa fallback mesaji
- Bozuk import dosyasi
- Veri silme sonrasi onboarding'e geri donus

### Regresyon

- Paywall/premium kontrolu app crash uretmiyor mu
- Tab navigation akisi stabil mi

---

## 10) Riskler ve Azaltma

1. **Risk:** Veri kaybi algisi
   - **Mitigation:** Export/import ozelliklerini MVP'de dahil et

2. **Risk:** Refactor sirasinda ekran kirilmasi
   - **Mitigation:** Repository katmanina adim adim gecis, ekran bazli smoke test

3. **Risk:** RevenueCat kimlik degisimi
   - **Mitigation:** Local owner UUID sabit tutulur, reinstall senaryosu not edilir

---

## 11) Tahmini Efor

- Faz 1-2: 1-2 gun
- Faz 3: 3-5 gun
- Faz 4-5: 2-3 gun
- Faz 6 + QA: 1-2 gun

Toplam: **yaklasik 7-12 is gunu**

---

## 12) Definition of Done

- App login/signup olmadan calisiyor
- PocketBase package ve runtime bagimliligi yok
- Community tamamen kaldirilmis
- Core flowlar local DB uzerinden stabil
- Settings icinde local veri yonetimi var
- Dokumantasyon guncel

---

## 13) Hemen Sonraki Uygulama Adimi

Ilk implementation sprintinde su sirayi oneriyorum:

1. DB + repository bootstrap
2. root layout auth guard temizligi
3. onboarding + log ekrani local gecis
4. walk + progress local gecis
5. community kaldirma ve tab cleanup

Bu siralama ile uygulama erken asamada tekrar calisir hale gelir ve risk kontrollu ilerler.
