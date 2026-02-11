# RevenueCat Entegrasyon Yol Haritasi

Bu dokuman, `reactive-dog` (Expo + React Native + PocketBase) projesine RevenueCat abonelik altyapisini guvenli, olculebilir ve release'e hazir sekilde eklemek icin asamali bir plan sunar.

## Ust Duzey Plan (2 Sprint)

- Sprint 1: Teknik entegrasyon + temel satin alma akisi
- Sprint 2: Paywall optimizasyonu + analytics + production hardening

## 1) Urun ve Is Kurallari Netlestirme (0.5 gun)

- Abonelik modelini kesinlestir: aylik/yillik, trial var mi, free tier limitleri neler.
- Entitlement isimlerini belirle (ornek: `premium`, `pro_features`).
- Hangi ekran/ozelliklerin paywall altina girecegini netlestir.
- Restore/refund/cancel durumlarinda uygulamanin beklenen davranisini yazili hale getir.

## 2) Store + RevenueCat Panel Hazirligi (1 gun)

- App Store Connect ve Google Play Console'da urunleri olustur (stabil product id).
- RevenueCat'te project + app'ler (iOS/Android) + products + offerings kur.
- Test kullanicilarini hazirla (StoreKit tester / Play license tester).
- Offerings stratejisini tanimla (`default`, kampanya icin `promo` vb).

## 3) Uygulama SDK Entegrasyonu (1-1.5 gun)

- `react-native-purchases` paketini ekle.
- Not: Expo managed akista test icin **Dev Client / EAS build** gerekir (Expo Go ile degil).
- `app.json` ve gerekli native konfigurasyonlari RevenueCat gereksinimlerine gore guncelle.
- App acilisinda RevenueCat `configure` et.
- Login/logout akislarinda RevenueCat `logIn` / `logOut` kullan.
- PocketBase `user.id` ile RevenueCat `appUserID` esitligini uygula (cross-device access icin kritik).
- API key yonetimini `.env` + EAS secrets ile yap (`EXPO_PUBLIC_...`).

## 4) Satin Alma Domain Katmani (1 gun)

- Tek bir billing servis katmani olustur (onerilen: `lib/billing/revenuecat.ts`).
- Ana fonksiyonlar:
  - `getOfferings`
  - `purchasePackage`
  - `restorePurchases`
  - `getCustomerInfo`
- Entitlement helper ekle: `hasPremiumAccess(customerInfo)`.
- Network/hata durumlari icin graceful fallback ve anlasilir hata mesajlari ekle.

## 5) UI Entegrasyonu (1-1.5 gun)

- Settings ekranina abonelik karti ekle (plan, yenileme tarihi, yonet/restore).
- Feature gate component ile premium olmayan kullaniciyi paywall'a yonlendir.
- Paywall ekraninda teklifler RevenueCat offering'den canli cekilsin.
- Ilk surumde basit ve olculebilir akisa odaklan; A/B optimizasyonu sonraki iterasyona kalabilir.

## 6) Sunucu Tarafi Dogrulama ve Senkronizasyon (Opsiyonel ama onerilir, 1 gun)

- RevenueCat webhook event'lerini PocketBase backend'e dusur:
  - `INITIAL_PURCHASE`
  - `RENEWAL`
  - `CANCELLATION`
  - `EXPIRATION`
- PocketBase user profile tarafinda entitlement cache alani tut (hiz + offline faydasi).
- Client acilisinda RevenueCat'ten dogrulama yap; server cache'i eventual consistency icin kullan.

## 7) Olcumleme ve Deney Takibi (0.5 gun)

- PostHog event'leri:
  - `paywall_view`
  - `purchase_start`
  - `purchase_success`
  - `restore_success`
  - `purchase_error`
- Funnel KPI takip et: paywall goruntuleme -> satin alma baslatma -> satin alma basari.
- Cohort bazli retention ve premium conversion dashboard'u olustur.

## 8) QA, Release ve Operasyon (1 gun)

- Test matrix:
  - Yeni kullanici
  - Mevcut kullanici
  - Logout/login
  - Reinstall
  - Restore
  - Subscription expiry
- Sandbox testlerine ek olarak internal EAS build ile smoke test yap.
- Store review notlari ve subscription terms metinlerini tamamla.
- Rollout stratejisi uygula: %10 -> %50 -> %100, metrikleri yakindan izle.

## Bu Repo Icin Kritik Teknik Notlar

- Proje Expo (`app.json`, `eas.json`) kullaniyor; RevenueCat testleri `eas build --profile development` ile yapilmali.
- Kimlik eslestirmesi icin mevcut `lib/pocketbase.ts` login/logout akisina RevenueCat baglantisi eklenmeli.
- `.env.example` dosyasina RevenueCat env degiskenleri eklenmeli.

## Onerilen Bir Sonraki Adim

- Bu yol haritasini dosya-bazli bir implementasyon planina donusturmek (hangi dosyada ne degisecek, hangi sirayla yapilacak).
