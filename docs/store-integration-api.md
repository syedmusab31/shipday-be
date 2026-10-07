# Online-store integration API

The store integration API is versioned under `/api/v1/store`. It uses dedicated integration keys rather than customer JWTs and books only against an admin-approved invoice account. Invoice balances are unlimited as configured for this first release; transactions remain pending until reconciled.

## Provisioning

An admin creates a key with `POST /api/admin/integrations/store-keys`:

```json
{
  "name": "Example Store",
  "userId": "<active customer user id>",
  "scopes": [
    "store:quotes:write",
    "store:shipments:write",
    "store:shipments:read"
  ]
}
```

The API returns the key once. Store the key in the merchant's secret manager and send it in the `X-API-Key` header. Admins can list keys at `GET /api/admin/integrations/store-keys` and revoke one with `DELETE /api/admin/integrations/store-keys/:credentialId`.

Invoice access must be approved separately with `PATCH /api/admin/invoice-accounts/:userId` and body `{"status":"approved"}`. Use `{"status":"revoked"}` to disable future invoice bookings. Only active customer accounts can be approved.

## Quote

`POST /api/v1/store/quotes` requires `store:quotes:write`. Quotes are valid for 15 minutes.

```json
{
  "serviceType": "express",
  "senderDetails": {
    "fullName": "Sender Name",
    "mobile": "+27123456789"
  },
  "collectionDetails": {
    "address": {
      "street": "1 Collection Road",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2000"
    }
  },
  "deliveryDetails": {
    "receiverName": "Receiver Name",
    "mobile": "+27987654321",
    "address": {
      "street": "2 Delivery Road",
      "city": "Cape Town",
      "province": "Western Cape",
      "postalCode": "8000"
    }
  },
  "parcelType": "custom",
  "parcels": [
    { "length": 40, "width": 30, "height": 20, "weight": 8 },
    { "length": 110, "width": 30, "height": 20, "weight": 4 }
  ],
  "packaging": [{ "id": "boxing" }],
  "orderNumber": "STORE-ORDER-1001",
  "marketplaceName": "Example Store"
}
```

The server resolves packaging and current pricing rules; client-supplied prices are not trusted. The result includes a quote ID, itemized pricing, total in ZAR, parcel count, and expiry.

## Book and retrieve

- `POST /api/v1/store/shipments` requires `store:shipments:write` and body `{"quoteId":"<quote id>"}`. A quote can produce one shipment; retrying a successful booking returns that shipment instead of creating another.
- `POST /api/v1/store/shipments/:shipmentId/parcels` requires `store:shipments:write`, a unique `Idempotency-Key` header (8-128 safe characters), and a `parcels` array. It appends boxes and recalculates the waybill from the original quote's pricing snapshot; it is allowed only before invoice payment or processing. Reusing a key with a different parcel request returns `409`.
- `POST /api/v1/store/shipments/:shipmentId/cancel` requires `store:shipments:write`. It cancels only shipments still awaiting invoice payment and marks the pending invoice transaction failed. Retries are safe.
- `GET /api/v1/store/shipments/:shipmentId` requires `store:shipments:read` and only returns shipments created by that integration key.

Booking creates a shipment in `Awaiting Payment` with invoice payment pending and records a pending Invoice debit transaction against the merchant account. A caller cannot mark an invoice as paid through this API; this integration API does not settle invoices.

## Common errors

- `400`: invalid request data or unavailable packaging.
- `401`: missing, invalid, or revoked API key.
- `403`: missing scope, inactive customer, or invoice account not approved.
- `404`: quote or shipment not owned by this integration key.
- `409`: quote expired or another booking is in progress.
