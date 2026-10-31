# Goan Craving Web Push rollout plan

## Current architecture
- MongoDB Notification documents are the in-app source of truth.
- Express exposes authenticated push subscription endpoints.
- The existing `web-push` service sends VAPID-authenticated messages to each saved device subscription.
- A root-scoped service worker displays push notifications and opens the linked order page.
- Customers explicitly opt in from the Notifications page; permission is not requested automatically.

## Production setup
1. Generate a VAPID key pair using `npx web-push generate-vapid-keys`.
2. Set server-only environment variables: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a monitored `mailto:` address or HTTPS origin).
3. Keep the private key out of Git, browser bundles, logs and client responses. Only the public key is returned by `GET /push/public-key`.
4. Serve the site over HTTPS. Service workers and the Push API require a secure context (localhost is the development exception).
5. Test Chrome on Android and desktop Chromium/Firefox. On iOS/iPadOS, web push requires a supported OS version and the website added to the Home Screen; the user must opt in from that installed web app.

## Event flow
1. An order/payment/refund event is validated by the backend.
2. The backend creates a MongoDB notification for the customer.
3. Category preferences are checked.
4. The push service sends a small payload to every active subscription for that user.
5. The service worker displays the notification; clicking it opens the order detail page.
6. Expired subscriptions (push provider HTTP 404/410) are removed. Push failure must never roll back an order action.

## Next milestones
- Emit order-status notifications for seller/admin transitions (confirmed, preparing, out for delivery, delivered, cancelled).
- Emit payment updates only from verified payment-provider webhooks, not from browser redirects.
- Emit refund state changes only after an authorized admin/payment-provider update.
- Add idempotency keys so retries cannot create duplicate notifications.
- Move high-volume delivery to a durable queue with retry/backoff and dead-letter monitoring.
- Add delivery metrics for sent, expired, rejected and retried push messages.

## User experience and security
- Never ask for notification permission on first page load. Explain the benefit and request it only after a direct user click.
- Keep in-app notifications usable if push is unsupported, denied, offline or unconfigured.
- Respect per-category preferences and avoid promotional noise.
- Treat push endpoints as secrets; restrict subscription management to the authenticated owner and protect state-changing routes against CSRF.
- Test multiple devices, unsubscribe, denied permission, expired endpoints, notification click routing and cross-account access.
