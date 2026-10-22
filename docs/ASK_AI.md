# Ask AI

Ask AI is available in the sidebar and starts in labelled Demo mode. Live AI uses live inventory data to answer questions, produce reports, and prepare stock movements and internal purchase orders. It does not require login and does not restore the removed Settings or backup features.

## Demo mode (no API credits required)

Demo mode runs entirely in the browser with built-in demo products, balances, orders, and fixed illustrative reports. It makes no OpenAI requests and never writes to the real inventory API. The banner, reply prefixes, report titles, export filenames, and proposal controls identify simulations.

Try a suggested prompt, or enter “Add 10 units of Multipurpose Cleaner”, “Record a sale of 2 Glass Cleaner”, “Prepare an order for 20 Thick Bleach”, “What needs reordering?”, or “Give me a sales report”. Simulate confirmation applies a change only to the demo session. Follow-up stock queries reflect demo changes. Reports use explicitly fixed illustrative 28-day figures; requested date ranges and simulated movements do not alter those reports. This is a deterministic workflow demonstration, not a live AI model. Unsupported or ambiguous requests return help rather than guessing a transaction.

Reset demo data restores the demo balances and clears proposals and chat. New chat clears the conversation but keeps simulated balances. Switching between Demo mode and Live AI clears the conversation and resets demo data; resolve pending proposals first. Page reload also resets the demo. Live AI remains available separately and still needs API credits.

## Connect the live AI service

Add these variables to `inventory-api/.env`, then restart the backend:

```dotenv
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5-mini
```

Use an OpenAI API project with access to the configured model. Keep the key in the backend environment; never add it to a Vite variable or source control. If no key is configured, Ask AI shows connection instructions and does not send requests. Check connection rechecks the backend configuration. Model access and API usage depend on the connected API project. This implementation uses the OpenAI Responses API and strict function calling:

- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/models/gpt-5-mini

## What users can ask

- “Add 10 units of Glass Cleaner to stock.”
- “Record a sale of 2 units of SKU TEA-01.”
- “Adjust Multipurpose Cleaner stock by -2 for damaged bottles.”
- “What needs reordering and why?”
- “Give me this month’s sales and gross profit report.”
- “Which products are out of stock?”
- “Show outstanding purchase orders and recent movements.”
- “Prepare an order for 20 Glass Cleaner units from CleanCare Wholesale.”

The assistant can search by name, SKU, barcode, and category; look up suppliers and lead times; review inventory totals, low stock, order balances, and movements; and calculate date-range revenue, known cost, gross profit, and best sellers. Report tables can be exported as CSV; answers can be saved as text. The AI report tool uses the same backend calculation as Reports. Older sales without cost snapshots are explicitly excluded from known cost and profit and counted separately. Report dates follow the database calendar. The assistant is instructed to ask when product names or quantities are ambiguous.

## Applying changes

Stock and order proposals appear as cards beneath the answer. Stock cards show product name, SKU, movement kind, quantity, reason, and the before/after balance. Order cards show product, supplier, quantity, and expected delivery. The user applies them using Confirm stock change or Confirm purchase order, or dismisses them with Cancel proposal. Saying “yes” in chat does not apply a pending change.

Proposals expire after 15 minutes. Confirmation uses a database transaction and row locks, rejects stale stock/product details, prevents negative stock, and records stock/order changes in History under “Ask AI · confirmed by user.” Repeating confirmation for the same applied proposal returns the original result. Preparing an order does not increase stock or send a supplier message. Receive its delivery through Reordering.

The tools cannot directly delete or edit existing records, receive orders, replace a counted stock balance, send messages, access files, run SQL/code, or browse the web. Use the existing screens for these other business operations. Adjustments are signed differences; physical counts belong in Stocktake.

## Conversation and data

Chat is held in the current browser session and survives navigation between app tabs, but is not saved across a page reload. New chat is available once pending proposals are confirmed, cancelled, or expired. Recent conversation text is sent for follow-up questions. Prompts and relevant data returned by approved lookup tools are sent to OpenAI when a user submits a question. Supplier contact details, audit history, credentials, and environment files are not exposed to the AI tools. The key remains server-side. Responses requests set `store:false`; this is not a claim that the provider has no other retention policies.

Tools use fixed parameterized queries and server-side validation; model output never becomes executable SQL. Read tools show limits (typically 100 rows); inventory and sales totals include the complete eligible dataset. Provider errors are sanitized and do not expose API keys or raw provider responses. A request is limited to eight model rounds, twelve tool calls, five proposals, and 90 seconds. The API allows two simultaneous chat requests and ten requests per minute per client IP in this local API process. Failed chat requests cancel their hidden proposals. No external AI requests are made during automated tests.

## Verification and limits

If OpenAI returns `credit_balance_exhausted`, the API account's prepaid credits are exhausted. Review API Billing and add credits before retrying; waiting a minute does not resolve it. The app distinguishes exhausted credits, project/organization spending limits, general quota failures, and temporary request throttling, and shows an appropriate message. These conditions can all use HTTP 429.

Tests use fresh in-memory PGlite databases and a mocked OpenAI Responses endpoint to exercise the full tool loop, grounded report data, stock proposals, confirmation, cancellation, expiry, stale-stock rejection, audit attribution, provider failures, and unsupported tools. Live model behavior and the API connection require a real API key and were not tested without one. Review AI explanations and proposals before using them for business decisions.
