const { roundMoney } = require('./packagingPricing');

const DEFAULT_PARCEL_SURCHARGES = {
  includedBoxes: 1,
  additionalBoxFee: 0,
  maxDimensionCm: null,
  oversizeFeePerBox: 0,
};

function normalizeParcelSurcharges(surcharges = {}) {
  if (!surcharges || typeof surcharges !== 'object' || Array.isArray(surcharges)) {
    throw new Error('Parcel surcharges must be an object');
  }

  const includedBoxes = Number(surcharges.includedBoxes ?? DEFAULT_PARCEL_SURCHARGES.includedBoxes);
  const additionalBoxFee = Number(surcharges.additionalBoxFee ?? DEFAULT_PARCEL_SURCHARGES.additionalBoxFee);
  const maxDimensionInput = surcharges.maxDimensionCm;
  const maxDimensionCm = maxDimensionInput === null || maxDimensionInput === undefined || maxDimensionInput === ''
    ? null
    : Number(maxDimensionInput);
  const oversizeFeePerBox = Number(surcharges.oversizeFeePerBox ?? DEFAULT_PARCEL_SURCHARGES.oversizeFeePerBox);

  if (!Number.isInteger(includedBoxes) || includedBoxes < 1) {
    throw new Error('Parcel surcharges includedBoxes must be a positive integer');
  }
  if (!Number.isFinite(additionalBoxFee) || additionalBoxFee < 0) {
    throw new Error('Parcel surcharges additionalBoxFee must be a non-negative amount');
  }
  if (maxDimensionCm !== null && (!Number.isFinite(maxDimensionCm) || maxDimensionCm <= 0)) {
    throw new Error('Parcel surcharges maxDimensionCm must be a positive number or null');
  }
  if (!Number.isFinite(oversizeFeePerBox) || oversizeFeePerBox < 0) {
    throw new Error('Parcel surcharges oversizeFeePerBox must be a non-negative amount');
  }

  return {
    includedBoxes,
    additionalBoxFee: roundMoney(additionalBoxFee),
    maxDimensionCm,
    oversizeFeePerBox: roundMoney(oversizeFeePerBox),
  };
}

function calculateParcelSurcharges(dimensions = [], parcelCount, configuredSurcharges = {}) {
  const surcharges = normalizeParcelSurcharges(configuredSurcharges);
  const count = Number(parcelCount ?? Math.max(dimensions.length, 1));

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Parcel count must be a positive integer');
  }

  const oversizeBoxes = surcharges.maxDimensionCm === null
    ? []
    : dimensions.reduce((boxes, dimension, index) => {
      const largestDimension = Math.max(
        Number(dimension?.length) || 0,
        Number(dimension?.width) || 0,
        Number(dimension?.height) || 0
      );
      if (largestDimension > surcharges.maxDimensionCm) {
        boxes.push({ boxNumber: index + 1, maxDimensionCm: largestDimension });
      }
      return boxes;
    }, []);
  const additionalBoxCount = Math.max(0, count - surcharges.includedBoxes);
  const oversizeFee = roundMoney(oversizeBoxes.length * surcharges.oversizeFeePerBox);
  const additionalBoxFee = roundMoney(additionalBoxCount * surcharges.additionalBoxFee);

  return {
    oversizeBoxes: oversizeBoxes.map(box => ({
      ...box,
      fee: surcharges.oversizeFeePerBox,
    })),
    oversizeBoxCount: oversizeBoxes.length,
    oversizeFee,
    additionalBoxCount,
    additionalBoxFee,
    total: roundMoney(oversizeFee + additionalBoxFee),
  };
}

module.exports = {
  DEFAULT_PARCEL_SURCHARGES,
  normalizeParcelSurcharges,
  calculateParcelSurcharges,
};
