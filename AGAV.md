# Agav project instructions — Goan Craving customer website and seller dashboard

## Project role
This repository owns the customer-facing Goan Craving website and seller/restaurant experience. It is part of a four-repository food-delivery ecosystem with separate order-management, delivery-agent, and admin dashboards.

## Non-negotiable safety rules
- Begin every task with a read-only audit of the relevant routes, controllers, models, views, middleware, configuration, and tests.
- Preserve working signup, login, Google OAuth, email OTP, password reset, sessions, cart behavior, Cloudinary uploads, and existing integrations unless the task explicitly requires a change.
- Never print, read unnecessarily, copy, commit, or expose secrets from .env files. Use .env.example for variable names only.
- Never change production credentials, OAuth callback configuration, payment secrets, database contents, or Render settings.
- Do not make destructive schema changes or delete user/order data. Use backward-compatible migrations.
- Work on a feature branch. Never push directly to main, force-push, or merge a pull request.
- Ask before changing authentication, payment flows, database migrations, or externally visible behavior.
- Do not claim a feature is complete until tests and relevant end-to-end checks pass.

## Architecture rules
- Follow the repository's existing Node.js, Express-style, EJS, JavaScript, CSS, MongoDB, and Socket.IO patterns where present; do not introduce a new framework without justification.
- Treat the backend as authoritative for prices, totals, inventory, payment state, and order creation.
- Use a stable orderId across all four repositories. Never generate a second unrelated order ID when synchronizing.
- Persist a complete order snapshot: customer, restaurant, items, quantities, prices, payment state, delivery address, postal code, and available coordinates.
- Keep customer profile addresses and order-time delivery-address snapshots distinct. Updating a saved profile address must not silently rewrite an existing order's delivery address.
- Publish order events reliably after database persistence; use idempotency and retry-safe event handling.
- Customer tracking must expose only customer-safe statuses, never internal employee notes or another customer's data.
- Enforce ownership checks for customer and seller records on every relevant endpoint.

## Goan Craving roadmap
1. Audit and improve product discovery, product details, cart, checkout, payment integration, saved addresses, customer profile, order history, and customer tracking.
2. Complete seller registration, restaurant/location settings, menu and availability management, seller order workflow, and seller analytics.
3. Integrate order creation with the Order Management repository using documented authenticated APIs and shared order identifiers.
4. Add customer-safe tracking updates driven by employee-approved status changes.
5. Preserve existing support and notification behavior while integrating future support workflows.

## Required workflow for each task
1. Explain the current behavior and identify the exact files involved.
2. Write a scoped implementation plan and acceptance criteria.
3. Make the smallest compatible change.
4. Add/update tests for success, validation, authorization, and failure cases.
5. Run available tests, lint/type checks, and inspect git diff.
6. Summarize changed files, test results, risks, and follow-up work.
7. Leave changes on the current feature branch for human review; do not merge or deploy.
