# API

Base URL: http://localhost:3001/api. JSON request/response bodies. Errors: `{"error":"message"}`. All endpoints are available without sign-in in this local workspace. Browser mutations require JSON and the configured Origin. Login and account-management endpoints have been removed.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /health | Database connectivity |
| GET / POST | /products | List / create product |
| PUT | /products/:id | Edit product metadata; stock is changed only by movements |
| GET | /barcodes/:barcode | Exact barcode lookup; 404 if unknown |
| GET / POST | /suppliers | List / create supplier |
| PUT | /suppliers/:id | Edit supplier |
| GET / POST | /movements | Most recent 100 / create stock change |
| PUT / DELETE | /movements/:id | Correct / delete movement and reconcile stock |
| PUT / DELETE | /orders/:id | Change quantity / delete order; received orders reconcile their receipt and stock |
| DELETE | /products/:id | Delete a zero-stock product without movements or orders |
| DELETE | /suppliers/:id | Delete an unreferenced supplier |
| GET | /alerts | Refresh and list low-stock alerts |
| POST | /jobs/alerts | Manually refresh alerts |
| GET | /recommendations | All products with demand/reorder metrics |
| GET | /forecast?product_id=1 | 28-day history and 14-day forecast |
| GET / POST | /orders | List / create internal purchase order |
| POST | /orders/:id/receive | Receive entire order exactly once |

## Example payloads

POST /suppliers:
```json
{"name":"Local Wholesale","email":"orders@example.com","phone":"02 5550 0200","lead_days":5}
```

POST /products (PUT uses the same required fields):
```json
{"sku":"COF-02","barcode":"930000000005","name":"Decaf Coffee","category":"Pantry","supplier_id":1,"cost":12.5,"price":24,"min_stock":10}
```

POST /movements:
```json
{"product_id":1,"kind":"receipt","quantity":20,"note":"Opening inventory"}
```

Kind is sale, receipt or adjustment. Sale quantities are positive in requests and stored negative. Adjustments accept signed nonzero integers. Stock-changing requests are transactional. A retry of a movement creates another movement; no request idempotency key is implemented. If a request times out, inspect recent movements before resubmitting.

POST /orders:
```json
{"product_id":1,"quantity":40}
```

The receive body can specify a partial quantity. Order creation is manual and can create multiple open orders; recommendations subtract all open order quantities. Receive is protected against double receiving.

Validation errors return 400, missing product/barcode 404, duplicate identifiers/insufficient stock/order already received 409. Product deletion requires zero stock and no linked movements or orders. Supplier deletion requires removing product and order references. Corrections that would make stock negative return 409. Received-order receipts must be corrected through their order. PUT /movements/:id accepts the same body as POST /movements; PUT /orders/:id accepts {"quantity":40}. Stock lists are not paginated in this starter.

## Workspace endpoints

- POST /orders with {product_id,supplier_id,quantity,expected_date}; PUT /orders/:id accepts any of those fields.
- POST /orders/:id/receive with optional {quantity}; omitting quantity receives the outstanding balance. GET /orders/:id/receipts lists deliveries. PUT /orders/:id/receipts/:receiptId with {quantity} corrects a delivery; zero reverses it.
- POST /stocktakes with {note,items:[{product_id,expected_stock,counted}]}; all counts save atomically.
- GET /reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD; up to 367 inclusive calendar days.
- GET /history?offset=0&entity=products; 50 changes per page plus hasMore. Entity filter is optional.
- POST /products/import with {products:[product metadata]}; match on SKU, up to 1,000 records, no stock changes.
- GET /export/movements returns the full ledger for CSV export.

Purchase order quantity edits change the total ordered, not quantities already delivered. Correct deliveries through their receipt endpoint. Deleting an order reverses all deliveries atomically if stock permits. Movement unit costs are captured for new entries; missing legacy costs remain explicitly unknown in reports.

## Ask AI

- GET /ai/status returns configured/model/setup without exposing credentials.
- POST /ai/chat with {message,history:[{role:"user"|"assistant",content}]} returns {answer,actions,tables,sources,generated_at}. History is optional and limited to 12 messages. Requires OPENAI_API_KEY on the backend.
- POST /ai/actions/:id/confirm applies a server-stored proposal once, transactionally.
- POST /ai/actions/:id/cancel cancels a pending proposal.

AI stock/order proposals expire after 15 minutes. Confirmation rejects stale product balances, missing records, expired/cancelled proposals, and negative stock. Reporting uses the same sales calculation as /reports/sales. See ASK_AI.md for supported tools and limits.
