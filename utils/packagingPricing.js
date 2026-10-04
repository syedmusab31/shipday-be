const DEFAULT_PACKAGING_OPTIONS = [
  { id: 'boxing', name: 'Boxing', price: 35, active: true },
  { id: 'bubble-wrap', name: 'Bubble Wrap', price: 20, active: true },
  { id: 'tape', name: 'Tape', price: 10, active: true },
];

function normalizePackagingOptions(options = []) {
  if (!Array.isArray(options)) {
    throw new Error('Packaging options must be a list');
  }

  const normalized = options.map((option, index) => {
    const name = String(option?.name || '').trim();
    const id = String(option?.id || name.toLowerCase().replace(/\s+/g, '-')).trim();
    const price = Number(option?.price);

    if (!name || !id || !Number.isFinite(price) || price < 0) {
      throw new Error(`Packaging option ${index + 1} requires a name and a non-negative price`);
    }

    return {
      id,
      name,
      price,
      active: option.active !== false,
    };
  });

  const ids = normalized.map(option => option.id.toLowerCase());
  if (new Set(ids).size !== ids.length) {
    throw new Error('Packaging option IDs must be unique');
  }

  return normalized;
}

function resolvePackagingSelection(selectedPackaging = [], packagingOptions = []) {
  if (!Array.isArray(selectedPackaging)) {
    throw new Error('Invalid packaging selection: expected a list');
  }

  const options = normalizePackagingOptions(packagingOptions);
  const optionMap = new Map(options.map(option => [option.id.toLowerCase(), option]));
  const selectedIds = new Set();

  return selectedPackaging.map(selection => {
    const id = String(selection?.id || '').trim().toLowerCase();
    const option = optionMap.get(id);

    if (!option || !option.active) {
      throw new Error(`Invalid packaging selection: ${id || 'missing option'} is unavailable`);
    }
    if (selectedIds.has(id)) {
      throw new Error(`Invalid packaging selection: ${id} was selected more than once`);
    }

    selectedIds.add(id);
    return { id: option.id, name: option.name, price: option.price };
  });
}

function calculatePackagingTotal(selectedPackaging = [], packagingOptions = []) {
  const canonicalSelection = resolvePackagingSelection(selectedPackaging, packagingOptions);
  const totalCents = canonicalSelection.reduce((sum, option) => sum + Math.round(option.price * 100), 0);
  return totalCents / 100;
}

function calculateShipmentBasePrice(parcelDetails = {}, pricing = {}) {
  const serviceType = parcelDetails.serviceType === 'express' ? 'express' : 'economy';
  const parcelType = String(parcelDetails.parcelType || '').toLowerCase();
  const satchelSize = parcelType.includes('a3') ? 'a3' : parcelType.includes('a4') ? 'a4' : null;

  if (parcelType.includes('satchel') && satchelSize) {
    const amount = pricing.satchel?.[serviceType]?.[satchelSize];
    return roundMoney(Number(amount) || 0);
  }

  const config = pricing[serviceType] || {};
  const baseAmount = Number(config.baseAmount) || 0;
  const divisor = Number(config.divisor) || 1;
  const rate = Number(config.rate) || 0;
  const rawDimensions = parcelDetails.dimensions;
  const dimensions = Array.isArray(rawDimensions)
    ? rawDimensions
    : rawDimensions && typeof rawDimensions === 'object'
      ? [rawDimensions]
      : [];

  let totalVolumetricWeight = 0;
  let totalActualWeight = 0;

  dimensions.forEach(dimension => {
    const length = Number(dimension.length) || 0;
    const width = Number(dimension.width) || 0;
    const height = Number(dimension.height) || 0;
    totalVolumetricWeight += (length * width * height) / divisor;
    totalActualWeight += Number(dimension.weight) || 0;
  });

  const chargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);
  return roundMoney((baseAmount * Math.max(dimensions.length, 1)) + (chargeableWeight * rate));
}

function roundMoney(amount) {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

module.exports = {
  DEFAULT_PACKAGING_OPTIONS,
  normalizePackagingOptions,
  resolvePackagingSelection,
  calculatePackagingTotal,
  calculateShipmentBasePrice,
  roundMoney,
};