# RevenueCat Uygulama Checklist

Bu checklist, `revenuecat-yol-haritasi.md` dokumanini uygulama adimlarina cevirir.

## Faz 0 - Hazirlik

- [ ] Abonelik paketleri net: aylik/yillik/trial
- [ ] Entitlement adi net: `premium`
- [ ] Paywall'a dusen ozellikler netlestirildi
- [ ] Restore/refund/cancel davranislari dokumante edildi

## Faz 1 - Store ve RevenueCat Kurulumu

- [ ] App Store Connect urunleri olusturuldu
- [ ] Google Play urunleri olusturuldu
- [ ] RevenueCat project ve app'ler olusturuldu
- [ ] Products + Offerings (en az `default`) olusturuldu
- [ ] iOS/Android sandbox test hesaplari hazirlandi

## Faz 2 - Uygulama Entegrasyonu (Temel)

- [x] `react-native-purchases` bagimliligi eklendi
- [x] `.env.example` RevenueCat degiskenleri eklendi
- [x] RevenueCat servis katmani eklendi (`lib/billing/revenuecat.ts`)
- [x] App acilisinda RevenueCat init eklendi
- [x] PocketBase auth <-> RevenueCat user eslesmesi eklendi

## Faz 3 - UI ve Akis

- [x] Settings ekranina abonelik durumu alani eklendi
- [x] Restore purchases aksiyonu eklendi
- [x] Paywall ekrani olusturuldu
- [x] Feature-gate mekanizmasi eklendi (Community + Progress PDF export)

## Faz 4 - Analytics ve Deney Takibi

- [ ] `paywall_view` eventi eklendi
- [ ] `purchase_start` eventi eklendi
- [ ] `purchase_success` eventi eklendi
- [ ] `purchase_error` eventi eklendi
- [ ] `restore_success` eventi eklendi

## Faz 5 - Mobil-Only Premium Kontrol

- [x] Client tarafinda RevenueCat entitlement kontrol helper'i eklendi
- [x] Premium gate kontrolu sadece RevenueCat SDK sonucuna baglandi
- [x] PocketBase webhook/fallback bagimliligi kaldirildi

## Faz 6 - QA ve Release

- [ ] Login/logout akislari test edildi
- [ ] Reinstall + restore akislari test edildi
- [ ] Subscription expiry senaryosu test edildi
- [ ] EAS internal build smoke test gecti
- [ ] Store metadata ve terms metinleri tamamlandi
- [ ] Rollout plani (%10 -> %50 -> %100) hazirlandi

## Bu Sprintte Hedeflenen Minimum Kapsam

- [x] Faz 2'nin tamamlanmasi
- [x] Faz 3'te settings + restore akisi
- [ ] Faz 6'da temel smoke test
