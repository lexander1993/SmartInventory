# Workspace upgrade and operation

## Extra sample report data

`npm --prefix inventory-api run db:seed` initializes an empty inventory with 14 cleaning products and costed sales. It skips an existing inventory. To deliberately delete all application records and reload these products, run `node --import tsx src/reset-cleaning.ts --replace-all` from `inventory-api`. The replacement runs in one transaction and retains schema and server configuration. Every sale records unit cost, populating Known cost and Known-cost profit. Ask AI demo uses matching cleaning-product names.

## Upgrade

Restart the backend and frontend. The backend now applies versioned, transactional migrations at startup; existing products, balances, suppliers, movements, and orders are preserved. Alternatively run `npm --prefix inventory-api run db:migrate` first.

The app opens directly to Overview. Login, account controls, and the Settings page have been removed. All local workspace actions are available without signing in. Changes are attributed to Local workspace in history; older actor names are preserved.

The API continues to bind to loopback. Browser mutations require JSON and reject an unexpected Origin. Set FRONTEND_URL to the exact frontend origin. Existing sales without historical cost snapshots remain explicitly unknown in profit reports. Change history begins when its migration is installed.

## Add and edit dialogs

Products, suppliers, stock movements, purchase orders, receiving deliveries, delivery corrections, and stocktakes use popup dialogs. Use the Add button or Edit action to open an entry form. Save applies the change and closes the dialog; validation or API errors keep the form open. Cancel, the close button, or Escape dismisses a dialog when no save is running. Recommendation quantities prefill the purchase-order popup for review before creation.

## Purchasing and stock counts

Reordering includes a full order form, an optional expected delivery date, and editable quantities beside recommendations. Each delivery records its own movement linked to the order. Recommendations include only outstanding units (`ordered - received`). Deliveries cannot exceed outstanding units. Edit an order's total and date through Edit; its total cannot fall below already received units. Product and supplier are fixed once any units have been received.

Use Deliveries to correct an individual receipt, setting it to zero to reverse it. This recalculates both stock and the order's outstanding units. Removing an order reverses all linked deliveries, provided stock will not become negative. Received-order movements are corrected through their order, rather than independently in Stock movements.

Stocktake accepts physical counts and a reason. Blank counts are skipped; zero is a valid count. If stock changes after you start counting a product, the entire save is rejected. Refresh, clear that count, and recount it. Each nonzero difference becomes an adjustment in the movement ledger.

## CSV

Inventory includes an import template, preview, inventory export, and full transaction export. Import accepts at most 1,000 rows and a 1.5 MB file in the UI. Required columns: `name,sku,barcode,category,cost,price,min_stock,supplier_id`. Leave `supplier_id` blank for unassigned; supplier IDs are shown on the Suppliers screen. Preserve SKU and barcode as text in spreadsheet editors to retain leading zeroes.

Imports match by SKU, update metadata, and preserve stock. An invalid row rolls back the whole batch. Duplicate identifiers are rejected. Use stock receipts or stocktake to load starting balances. CSV exports quote multiline fields and neutralize spreadsheet formula prefixes in text. The import preview shows the first five rows before you commit.

Reports export the selected date range, including units, sales revenue, known cost of goods, gross profit for units with known costs, and units without a cost snapshot. These reports exclude operating expenses and taxes. Report calendar dates follow the database session timezone; set `TZ=Australia/Sydney` consistently for the API environment.

## Verification

`npm run build` compiles both applications. `npm test` runs forecast and API integration checks against fresh in-memory PGlite databases, including partial deliveries, correction rollback, direct workspace access, profit snapshots, stale stocktakes, CSV import rollback. These tests do not connect to the configured application database.

For disposable browser QA, run `node --import tsx test/browser-preview.mjs` from inventory-api, and start Vite with `VITE_API_URL=http://localhost:3002/api` on port 5174. The preview opens directly to Overview. All its records disappear when it stops; it does not access the application database.
