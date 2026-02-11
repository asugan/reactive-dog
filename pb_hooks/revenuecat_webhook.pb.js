/* global $app, $apis, $os, Record, routerAdd, BadRequestError, UnauthorizedError, InternalServerError */

const WEBHOOK_TOKEN = ($os.getenv("RC_WEBHOOK_TOKEN") || "").trim();

const SUPPORTED_EVENTS = {
  INITIAL_PURCHASE: true,
  RENEWAL: true,
  CANCELLATION: true,
  EXPIRATION: true,
};

routerAdd("POST", "/api/billing/revenuecat/webhook", (e) => {
  if (!WEBHOOK_TOKEN) {
    throw new InternalServerError("RC_WEBHOOK_TOKEN is not configured");
  }

  const authHeader = (e.request.header.get("Authorization") || "").trim();
  if (authHeader !== `Bearer ${WEBHOOK_TOKEN}`) {
    throw new UnauthorizedError("Invalid webhook token");
  }

  const payload = e.requestInfo().body || {};
  const event = payload.event || payload;

  const eventType = toString(event.type || "").toUpperCase();
  const appUserId = toString(event.app_user_id || "");
  const eventId = toString(event.id || `${eventType}:${appUserId}:${toString(event.event_timestamp_ms || Date.now())}`);

  if (!eventType) {
    throw new BadRequestError("Missing event type");
  }

  const billingEvents = $app.findCollectionByNameOrId("billing_webhook_events");
  const userProfiles = $app.findCollectionByNameOrId("user_profiles");

  const duplicate = findWebhookEventByEventId(eventId);
  if (duplicate) {
    return e.json(200, { ok: true, duplicate: true });
  }

  const eventRecord = new Record(billingEvents);
  eventRecord.set("event_type", eventType);
  eventRecord.set("event_id", eventId);
  eventRecord.set("app_user_id", appUserId);
  eventRecord.set("payload", payload);
  eventRecord.set("processed", false);
  $app.save(eventRecord);

  try {
    if (!SUPPORTED_EVENTS[eventType]) {
      markEventProcessed(eventRecord, `ignored:${eventType}`);
      return e.json(200, { ok: true, ignored: true });
    }

    const profile = findOrCreateProfileByAppUserId(userProfiles, appUserId);
    if (!profile) {
      throw new BadRequestError("Unable to map app_user_id to user profile");
    }

    applySubscriptionTransition(profile, eventType, event, appUserId);

    profile.set("revenuecat_last_event", eventType);
    profile.set("revenuecat_last_event_at", isoFromMs(event.event_timestamp_ms));
    $app.save(profile);

    eventRecord.set("user", profile.get("user"));
    markEventProcessed(eventRecord, null);

    return e.json(200, { ok: true, processed: true, eventType });
  } catch (err) {
    eventRecord.set("processing_error", toString(err));
    eventRecord.set("processed", false);
    $app.save(eventRecord);
    throw err;
  }
}, $apis.bodyLimit(1024 * 1024 * 2));

function findWebhookEventByEventId(eventId) {
  if (!eventId) {
    return null;
  }

  try {
    return $app.findFirstRecordByData("billing_webhook_events", "event_id", eventId);
  } catch (_) {
    return null;
  }
}

function markEventProcessed(eventRecord, processingError) {
  eventRecord.set("processed", !processingError);
  eventRecord.set("processed_at", new Date().toISOString());
  eventRecord.set("processing_error", processingError || "");
  $app.save(eventRecord);
}

function findOrCreateProfileByAppUserId(userProfilesCollection, appUserId) {
  if (!appUserId) {
    return null;
  }

  try {
    return $app.findFirstRecordByFilter(
      "user_profiles",
      "user = {:uid}",
      { uid: appUserId }
    );
  } catch (_) {}

  try {
    return $app.findFirstRecordByFilter(
      "user_profiles",
      "revenuecat_app_user_id = {:appUserId}",
      { appUserId }
    );
  } catch (_) {}

  try {
    const user = $app.findRecordById("users", appUserId);
    const profile = new Record(userProfilesCollection);
    profile.set("user", user.id);
    profile.set("subscription_tier", "free");
    profile.set("subscription_source", "revenuecat");
    profile.set("revenuecat_app_user_id", appUserId);
    $app.save(profile);
    return profile;
  } catch (_) {
    return null;
  }
}

function applySubscriptionTransition(profile, eventType, event, appUserId) {
  const expirationIso = isoFromMs(event.expiration_at_ms);

  profile.set("revenuecat_app_user_id", appUserId);
  profile.set("subscription_source", "revenuecat");

  if (eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL") {
    profile.set("subscription_tier", "premium");
    profile.set("subscription_expires_at", expirationIso);
    return;
  }

  if (eventType === "CANCELLATION") {
    profile.set("subscription_tier", "premium");
    profile.set("subscription_expires_at", expirationIso);
    return;
  }

  if (eventType === "EXPIRATION") {
    profile.set("subscription_tier", "free");
    profile.set("subscription_expires_at", "");
  }
}

function isoFromMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return "";
  }

  return new Date(n).toISOString();
}
