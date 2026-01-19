export type SurfaceData = {
  tenorLabels: string[];
  expiryLabels: string[];
  xValues: number[];
  yValues: number[];
  zValues: number[][];
};

export const TENOR_LABELS = [
  "1M",
  "3M",
  "6M",
  "9M",
  "1Y",
  "2Y",
  "3Y",
  "5Y",
  "7Y",
  "10Y",
  "20Y",
  "30Y",
];

export const EXPIRY_LABELS = ["1W", "1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y"];

export const generateTenorSurface = (
  tenors: string[],
  expiries: string[]
): SurfaceData => {
  const xValues = tenors.map((_, index) => index);
  const yValues = expiries.map((_, index) => index);

  const zValues = yValues.map((yIndex) =>
    xValues.map((xIndex) => {
      const tenorFactor = 0.35 + xIndex / (xValues.length + 2);
      const expiryFactor = 0.25 + yIndex / (yValues.length + 1);
      return (
        0.2 +
        0.15 * Math.sin(xIndex * 0.6) +
        0.1 * Math.cos(yIndex * 0.5) +
        0.25 * tenorFactor +
        0.15 * expiryFactor
      );
    })
  );

  return {
    tenorLabels: tenors,
    expiryLabels: expiries,
    xValues,
    yValues,
    zValues,
  };
};
