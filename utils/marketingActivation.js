function evaluateCustomerActivation({
  topUpAmount = 0,
  successfulShipments = 0,
  minimumTopUpAmount = 500,
  requiredSuccessfulShipments = 3,
}) {
  const topUpMet = topUpAmount >= minimumTopUpAmount;
  const shipmentsMet = successfulShipments >= requiredSuccessfulShipments;

  return {
    topUpAmount,
    successfulShipments,
    topUpMet,
    shipmentsMet,
    isActivated: topUpMet && shipmentsMet,
  };
}

function getTopUpUserId(transaction) {
  if (transaction.userId) return String(transaction.userId);
  const match = String(transaction.orderId || '').match(/^TOPUP-([a-f\d]{24})-/i);
  return match ? match[1] : null;
}

module.exports = { evaluateCustomerActivation, getTopUpUserId };