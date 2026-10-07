# Third-party courier partner API

Courier partners use their own API key and are not represented as customer accounts. An admin provisions partners with `POST /api/admin/courier-partners`, lists them with `GET /api/admin/courier-partners`, revokes access with `DELETE /api/admin/courier-partners/:partnerId`, and rotates a key with `POST /api/admin/courier-partners/:partnerId/rotate-key`. Creation and rotation return the API key once; store it in a secret manager. Only a SHA-256 hash is stored.

All partner requests use the `X-API-Key` header and the `/api/v1/courier-partner` base path.

## Get a quotation

`POST /api/v1/courier-partner/quotes` accepts the same parcel and address format as the store quote endpoint. `senderDetails.email` is required because the prepaid checkout uses PayFast.

```json
{
  "serviceType": "express",
  "senderDetails": {
    "fullName": "Sender Name",
    "mobile": "+27123456789",
    "email": "sender@example.com"
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
  "parcels": [{ "length": 40, "width": 30, "height": 20, "weight": 8 }]
}
```

Quotes use the current Shipday tariff and packaging rules, are returned in ZAR, and expire after 15 minutes. Client-supplied packaging prices are ignored.

## Book and pay

`POST /api/v1/courier-partner/shipments` with `{"quoteId":"<quote id>"}` creates one shipment per quote and returns a hosted PayFast `payment.checkoutUrl` while payment is pending. The payer must complete checkout; the normal PayFast notification updates its payment status. Retrying with the same quote ID returns the original shipment and, only while it remains unpaid, a checkout link instead of creating a duplicate.

`GET /api/v1/courier-partner/shipments/:shipmentId` returns only shipments created by the authenticated partner. A partner cannot retrieve another partner's shipment by guessing its ID.

## Operational notes

- Admin provisioning, revocation, and key rotation require the existing admin JWT authorization.
- Partner API keys are independent of store integration keys and do not grant access to store scopes.
- Do not log or publicly expose checkout URLs. Treat them as payment-session links and send them only to the intended payer.
- Payment depends on the existing PayFast configuration and notification endpoint; verify `PAYFAST_MODE`, merchant settings, and `API_URL` before production use.
