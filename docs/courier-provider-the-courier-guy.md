# The Courier Guy / ShipLogic adapter

The first outbound provider adapter is The Courier Guy's ShipLogic API. The published API docs identify the sandbox base URL as `https://api.shiplogic.com`, with `POST /rates`, `POST /shipments`, and `GET /tracking/shipments?tracking_reference=...`. Shipment booking accepts a service-level code returned by a rate lookup. The adapter uses the `Token` authorization scheme confirmed for this integration.

Configure the sandbox key in the runtime environment as `COURIER_TCG_API_KEY`; do not commit the value. `COURIER_TCG_AUTH_SCHEME` defaults to `Token`. `COURIER_TCG_ACCOUNT_ID` is optional. Production traffic should use the provider's production host (`https://api.portal.thecourierguy.co.za`) and a production credential, configured separately from sandbox.

Admin routes:

- `POST /api/admin/courier/the-courier-guy/shipments/:shipmentId/rates` — request and persist a 15-minute rate quote for a Shipday shipment.
- `POST /api/admin/courier/the-courier-guy/shipments/:shipmentId/book` with `{"rateQuoteId":"...","serviceLevelCode":"..."}` — book the selected service from an unexpired rate quote.
- `GET /api/admin/courier/the-courier-guy/shipments/:shipmentId` — retrieve the provider booking record.
- `GET /api/admin/courier/the-courier-guy/shipments/:shipmentId/tracking` — request tracking using the Shipday shipment ID as the custom provider tracking reference.

The provider booking response is retained as returned by the provider for reconciliation. A network timeout after booking is recorded as `unknown`, and the endpoint blocks repeat booking attempts until an admin reconciles the carrier account; it never blindly retries a potentially successful booking. Provider HTTP rejections are recorded as failed and may be retried with a fresh rate quote.

Carrier booking is allowed only for paid shipments or shipments belonging to an approved invoice account. Cancelled shipments and shipments with failed payment are rejected. Missing provider credentials are checked before a booking attempt is reserved.

Published references:

- [The Courier Guy API documentation](https://www.shiplogic.com/tcg/api-docs)
- [Authentication and sandbox setup](https://www.shiplogic.com/tcg/api-docs/authentication)
- [Getting rates](https://www.shiplogic.com/tcg/api-docs/post-getting-rates)
- [Create a shipment](https://www.shiplogic.com/tcg/api-docs/post-create-a-shipment)
- [Tracking a shipment](https://www.shiplogic.com/tcg/api-docs/get-tracking-a-shipment)
