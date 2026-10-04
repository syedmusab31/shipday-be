const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

const provinceLookup = new Map(PROVINCES.map(province => [province.toLowerCase(), province]));

function normalizeProvince(province) {
  const key = String(province || '').trim().toLowerCase();
  return provinceLookup.get(key) || null;
}

function normalizeInterProvinceFees(fees = []) {
  if (!Array.isArray(fees)) {
    throw new Error('Inter-province fees must be a list');
  }

  const routeKeys = new Set();
  return fees.map((route, index) => {
    const fromProvince = normalizeProvince(route?.fromProvince);
    const toProvince = normalizeProvince(route?.toProvince);
    const fee = Number(route?.fee);

    if (!fromProvince || !toProvince || fromProvince === toProvince || !Number.isFinite(fee) || fee < 0) {
      throw new Error(`Inter-province fee ${index + 1} requires two different valid provinces and a non-negative fee`);
    }

    const routeKey = `${fromProvince.toLowerCase()}->${toProvince.toLowerCase()}`;
    if (routeKeys.has(routeKey)) {
      throw new Error(`Inter-province fee route ${fromProvince} to ${toProvince} is duplicated`);
    }
    routeKeys.add(routeKey);

    return {
      id: String(route.id || routeKey.replace(/[^a-z0-9]+/g, '-')),
      fromProvince,
      toProvince,
      fee: Math.round(fee * 100) / 100,
    };
  });
}

function getInterProvinceFee(fromProvince, toProvince, fees = []) {
  const from = normalizeProvince(fromProvince);
  const to = normalizeProvince(toProvince);

  if (!from || !to || from === to || !Array.isArray(fees)) return 0;

  const route = normalizeInterProvinceFees(fees).find(fee =>
    fee.fromProvince === from && fee.toProvince === to
  );

  return route ? Math.round((Number(route.fee) || 0) * 100) / 100 : 0;
}

module.exports = {
  PROVINCES,
  normalizeProvince,
  normalizeInterProvinceFees,
  getInterProvinceFee,
};