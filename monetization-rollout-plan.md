# Monetization Rollout Plan

## Goal

Shift monetization from a single premium feature (PDF export) to a recurring value loop built around weekly coaching insights, long-range analytics, and guided behavior improvements.

## Packaging

- Free: logging, walks, base progress, and core charts
- Premium: weekly coach summary, deeper trend interpretation, full report export, and advanced planning value
- Metered freemium: 2 premium weekly insight previews per month

## Live Product Changes

1. Paywall refreshed with outcome-led copy and stronger annual plan anchoring.
2. Progress tab now includes a premium weekly coach summary card.
3. Non-premium users can unlock two weekly insight previews per month before hard lock.
4. Settings tab now shows preview meter usage and win-back style premium CTAs.
5. Subscription state supports trial classification in addition to active/inactive/unknown.

## Tracking Schema (PostHog / billing telemetry)

### Paywall Funnel

- `paywall_viewed`
  - `source`
  - `packageCount`
  - `isMobilePlatform`

- `paywall_plan_selected`
  - `packageId`
  - `packageType`
  - `price`

- `paywall_purchase_completed`
  - `packageId`
  - `unlocked`

- `paywall_purchase_cancelled`
  - `packageId`

- `paywall_purchase_failed`
  - `packageId`

- `paywall_dismissed`
  - `source`
  - `hadPackages`

### Metered Insight Funnel

- `insight_preview_shown`
  - `source`
  - `remaining`

- `insight_preview_unlocked`
  - `source`
  - `weekKey`
  - `consumed`
  - `remaining`

- `insight_preview_limit_reached`
  - `source`
  - `weekKey`

- `insight_preview_unlock_failed`
  - `source`
  - `weekKey`

### Settings CTA Funnel

- `settings_paywall_opened`
  - `source`
  - `subscriptionStatus`
  - `insightPreviewRemaining`

## 8-Week Execution Checklist

1. Week 1: baseline dashboard and funnel quality checks.
2. Week 2: paywall copy and pricing presentation experiments.
3. Week 3-4: optimize weekly coach summary unlock flow and meter messaging.
4. Week 5: win-back and trial lifecycle messaging from settings and paywall.
5. Week 6-8: run and keep best A/B variants.

## Core KPI Targets

- Paywall view -> plan select conversion
- Plan select -> paid conversion
- Trial -> paid conversion
- First 45-day paid churn
- Annual plan mix among paid conversions
- Free vs paid D30 retention
