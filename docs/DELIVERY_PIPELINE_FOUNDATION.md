# Delivery Pipeline Foundation

This initial delivery-system change establishes shared database records for the order-to-delivery workflow. It does not yet enable rider assignment, route-based ETA calculation, or live tracking; those are later pipeline phases.

## Order lifecycle

`placed → accepted → preparing → ready_for_pickup → out_for_delivery → delivered`

Exceptional outcomes include `rejected` and `cancelled`. Existing `confirmed` status remains supported for compatibility with older order records and consumers.

## Foundation data

- Order status events retain timestamp, actor role, actor ID, and optional note.
- The delivery address can hold optional coordinates and customer delivery instructions.
- ETA snapshot fields store route distance, travel duration, prep duration, buffer, estimate bounds, provider name, and calculation timestamp. These are values supplied by trusted backend services; do not derive road travel time from an LLM.
- A delivery task is a separate document linked uniquely to an order, so retrying task creation cannot create duplicate active tasks.

## Planned handoff

1. Restaurant accepts and prepares the order.
2. Restaurant marks it ready for pickup.
3. Backend creates a delivery task (next implementation phase).
4. A delivery person accepts, picks up, and completes the task.
5. Backend records order status events and exposes updates to customer and restaurant interfaces.

## Security and consistency

Delivery state changes must be validated on the server and authorized by role. Keep provider credentials in backend environment variables. Use idempotent task creation and append-only status history for auditability.
