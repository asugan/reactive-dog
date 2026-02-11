# RevenueCat Backend Sync (PocketBase)

Bu dokuman, Faz 5 icin backend senkronizasyonunu nasil kuracaginizi anlatir.

## Amac

- RevenueCat eventlerini backend tarafinda kaydetmek
- Kullanici premium durumunu (`user_profiles`) server-side cache olarak tutmak
- Client'ta RevenueCat gecici erisilemez oldugunda profile fallback ile premium gate'i korumak

## PocketBase Tarafinda Eklenenler

- `user_profiles` alanlari:
  - `subscription_expires_at` (date)
  - `subscription_source` (select: `none`, `revenuecat`, `manual`)
  - `revenuecat_app_user_id` (text)
  - `revenuecat_last_event` (text)
  - `revenuecat_last_event_at` (date)
- Yeni koleksiyon:
  - `billing_webhook_events` (admin-only, ham event payload ve islenme durumu)

## Event Mapping

RevenueCat event -> `user_profiles` guncellemesi:

- `INITIAL_PURCHASE`:
  - `subscription_tier = premium`
  - `subscription_source = revenuecat`
  - `subscription_expires_at = expiration_at_ms` (varsa)
- `RENEWAL`:
  - `subscription_tier = premium`
  - `subscription_expires_at = expiration_at_ms`
- `CANCELLATION`:
  - `subscription_tier = premium` (period sonuna kadar)
  - `subscription_expires_at = expiration_at_ms`
- `EXPIRATION`:
  - `subscription_tier = free`
  - `subscription_expires_at = null`

Her eventte su alanlar da guncellenmeli:

- `revenuecat_app_user_id = app_user_id`
- `revenuecat_last_event = event.type`
- `revenuecat_last_event_at = event.event_timestamp_ms`

## Onerilen Webhook Akisi

1. RevenueCat webhook endpoint'i gelen body'yi dogrular.
2. Ham payload `billing_webhook_events` koleksiyonuna yazilir (`processed = false`).
3. `app_user_id` -> PocketBase `users.id` eslesmesi yapilir.
4. Ilgili `user_profiles` kaydi event'e gore guncellenir.
5. Event kaydi `processed = true`, `processed_at` ile isaretlenir.
6. Hata olursa `processing_error` alanina yazilir.

## Bu Repoda Hazirlanan Webhook Handler

- Dosya: `pb_hooks/revenuecat_webhook.pb.js`
- Route: `POST /api/billing/revenuecat/webhook`
- Header dogrulamasi: `Authorization: Bearer <RC_WEBHOOK_TOKEN>`

Gerekli PocketBase environment variable:

- `RC_WEBHOOK_TOKEN`: RevenueCat webhook requestlerini dogrulamak icin paylasilan gizli deger

PocketBase tarafinda minimum test:

1. Hook dosyasini PocketBase instance'ina koy.
2. `RC_WEBHOOK_TOKEN` ile PocketBase'i yeniden baslat.
3. RevenueCat dashboard webhook URL'i bu route'a ver.
4. RevenueCat test event gonder ve `billing_webhook_events` + `user_profiles` guncellemelerini kontrol et.

## Client Tarafi (Bu repoda eklendi)

- `lib/billing/access.ts` icinde `hasPremiumAccessWithFallback()`:
  - Once RevenueCat customer info kontrol eder.
  - Basarisiz veya aktif entitlement yoksa `user_profiles.subscription_tier` fallback'i kullanir.

Bu sayede backend senkronizasyon tamamlandiginda, client anlik RevenueCat sorunu yasasa bile premium gate tutarli kalir.
