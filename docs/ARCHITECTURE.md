# Architecture and calculation rules

The two sibling applications follow FreedomLend's structural separation, with Express replacing NestJS and SQL/pg replacing Prisma. The frontend talks only to the API; PostgreSQL credentials stay in the backend.

## Data

Suppliers have contact details and lead time. Products have unique SKU/barcode, supplier, cost, price, current stock and minimum threshold. Movements form the stock ledger; sales snapshot selling price. Purchase orders capture supplier at order creation. Alerts hold one active row per product. There are no customer details or multi-store features.

## Stock consistency

A sale/receipt/adjustment locks the product row using SELECT FOR UPDATE, checks resulting stock and commits the stock balance and ledger entry together. Receiving locks the order, atomically increments stock and creates a receipt in the same transaction. A second receive fails. Database constraints reject negative stock and duplicate identifiers. Metadata edits cannot overwrite stock. All user input is validated with Zod and SQL uses bound parameters.

## Forecast and reorder model

- Daily demand = units sold over the last 28 calendar days (including today and zero-sale days) / 28.
- Reorder point = max(minimum stock, ceil(daily demand × supplier lead days)).
- Inventory position = stock + quantity on open orders.
- Target = max(minimum stock, ceil(daily demand × (lead days + 14))).
- When position <= reorder point, recommended units = max(0, target − position); otherwise zero.
- Days of cover = stock / daily demand; null when demand is zero.
- Forecast = the same daily demand for each of the next 14 days.

Minimum stock acts as a minimum target, not additive safety stock. New products without sales use this minimum. The model does not adjust for stockouts, promotions, seasonality, returns or differing product ages. Database calendar boundaries determine forecast dates; configure the PostgreSQL timezone consistently for your deployment. The chart's date labels are plain YYYY-MM-DD strings.

## Automation

node-cron runs in the API process. Alert refresh uses a transaction-scoped advisory lock to prevent overlapping refresh writes. Alerts use the configured static minimum threshold; reorder recommendations additionally consider lead-time demand. No automatic purchase or outbound supplier message occurs.

## Extension points

Split app.ts into product, supplier, movement and purchasing modules as scope grows. Introduce reviewed SQL migrations for schema evolution. Add authenticated users and role checks before remote deployment. For multiple stores add store-scoped balances and authorization, not just a store selector. For hardware camera scanning add a supported barcode decoder with permission handling. For production jobs consider a separate worker/EventBridge trigger with authenticated invocation. Add PO line items, partial receiving, cancellation and cost snapshots when purchasing requirements expand.

## Primary references

- Express async error handling: https://expressjs.com/en/5x/guide/error-handling/
- Vite setup/build: https://vite.dev/guide/
- PostgreSQL row locking: https://www.postgresql.org/docs/current/sql-select.html
