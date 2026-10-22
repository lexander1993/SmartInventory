# Validation

## Known-cost report samples

Report summaries and tables show Known cost and Known-cost profit. Ten additional sample products were added through a transactional, repeat-safe seed with unit-cost snapshots and balanced receipt/sale ledgers. Isolated tests verify repeat-safe seeding, preservation of existing records, report totals, and agreement with the ten added demo products. The configured database report endpoint returned ten sample product rows.

Checks performed on this source:

- Backend TypeScript compilation passed.
- Frontend strict TypeScript check and Vite production build passed.
- Four unit cases check reorder thresholds, open-order subtraction, zero demand and sufficient stock.
- API integration smoke checks exercise supplier/product creation, exact barcode lookup, stock receipt and sale, overselling rejection, invalid sale quantities, alert creation/clearance, SQL forecast history/horizon, reorder recommendations, order receiving, duplicate-receive rejection and movement ledger counts.

Run `npm test` from the root to reproduce unit and integration checks. Integration tests use an isolated in-memory PGlite PostgreSQL engine and mocked HTTP request/response objects. They do not connect to or modify your configured PostgreSQL database. No Docker daemon or PostgreSQL server was available in the generation environment, so real PostgreSQL driver/network behavior, cross-connection concurrency, Docker startup, physical barcode hardware and browser interaction still need local verification. The Vite build emits a bundle-size advisory for Recharts; the build succeeds.

## Workspace improvements verification

- Backend and frontend TypeScript builds and Vite production bundling pass. Vite continues to report the existing large-bundle advisory.
- Forecast, CSV, legacy upgrade, stock corrections, and expanded workspace integration suites pass against fresh in-memory PGlite databases.
- Coverage includes partial deliveries, outstanding-order calculations, over-receipt prevention, linked receipt corrections, historical sale cost snapshots, stocktake conflict rollback, atomic CSV imports, audit actors and redaction, authentication, role checks, session invalidation.
- Browser verification against a disposable in-memory API covered sign-in, order creation, expected-date editing, a 4-of-10 partial delivery, stocktake saving, reports, and history. The screenshot is docs/purchasing-preview.png.
- Application database records were not used for tests. Restart the API to apply the upgrade and create the first administrator through the app.

## Login and Settings removal

The workspace now opens directly without authentication. Settings and account controls were removed, along with the auth API routes. API tests verify reads and writes without a session, removed auth routes return 404, and local-workspace changes retain an audit actor. Existing database records are preserved.

## Backup feature removal

Removed the backup download, API endpoint, restore command and utilities, and Docker backup script. CSV imports and exports remain available. API tests confirm the removed endpoint returns 404.

## Ask AI verification

Ask AI uses the Responses API with strict, validated function tools. In-memory tests mock the provider and cover tool results, reports, preparing without applying, confirmation idempotency, cancellation, expiry, stale stock, audit attribution, unsupported tools, and provider failures. No live API key is configured and no paid model calls were made. Live model behavior remains to be verified after configuration.

## Popup forms and API connection

Add/edit forms now use native modal dialogs for products, suppliers, stock movements, purchase orders, receiving, delivery corrections, and stocktakes. Disposable browser QA covered product and movement creation/editing, supplier dialogs, order creation/editing, partial receiving, receipt correction, and stocktake opening. Server errors appear in the active popup. API credentials were configured only in the backend environment; model access was verified, while live generation returned an upstream rate-limit response. Automated tests force a dummy key and mock provider responses.

## Labelled demo mode

Ask AI defaults to client-side sample scenarios with persistent demo labelling. Pure tests cover sample receipts/sales/adjustments/orders, no API calls, confirmation idempotency, cancellation, stale/expired proposals, sample-data reset and isolation, and consistent illustrative report totals. Browser checks verified a sample coffee receipt from 8 to 18 units and a follow-up stock query without applying a real inventory action. Live API usage is not required for demo mode.
