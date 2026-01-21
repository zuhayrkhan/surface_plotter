export type SurfaceData = {
  strikeLabels: string[];
  expiryLabels: string[];
  xValues: number[];
  yValues: number[];
  zValues: number[][];
};

export type SelectionState = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xIndex: number;
  yIndex: number;
};

export const STRIKE_LABELS = [
  "80",
  "85",
  "90",
  "95",
  "100",
  "105",
  "110",
  "115",
  "120",
];

export const EXPIRY_LABELS = ["1M", "2M", "3M", "6M", "1Y", "2Y"];

export const generateOptionSurface = (
  strikes: string[],
  expiries: string[]
): SurfaceData => {
  const xValues = strikes.map((_, index) => index);
  const yValues = expiries.map((_, index) => index);

  const zValues = yValues.map((yIndex) =>
    xValues.map((xIndex) => {
      // Create more significant variation across both axes
      const strikeFactor = xIndex / xValues.length;
      const expiryFactor = yIndex / yValues.length;

      // A more dynamic surface: Z = f(strike, expiry)
      // We use sine and cosine with different frequencies and amplitudes
      // to ensure that changing one index results in a noticeably different 1D slice.
      return (
          0.3 +
          0.2 * Math.sin(strikeFactor * Math.PI * 2) * Math.cos(expiryFactor * Math.PI) +
          0.15 * expiryFactor -
          0.1 * strikeFactor
      );
    })
  );

  return {
    strikeLabels: strikes,
    expiryLabels: expiries,
    xValues,
    yValues,
    zValues,
  };
};

export const createSelectionState = (surface: SurfaceData): SelectionState => ({
  xMin: surface.xValues[0],
  xMax: surface.xValues[surface.xValues.length - 1],
  yMin: surface.yValues[0],
  yMax: surface.yValues[surface.yValues.length - 1],
  xIndex: 0,
  yIndex: 0,
});

export const clampSelectionState = (
  surface: SurfaceData,
  selection: SelectionState
): SelectionState => {
  const minX = surface.xValues[0];
  const maxX = surface.xValues[surface.xValues.length - 1];
  const minY = surface.yValues[0];
  const maxY = surface.yValues[surface.yValues.length - 1];

  const xMin = Math.min(
    Math.max(Math.min(selection.xMin, selection.xMax), minX),
    maxX
  );
  const xMax = Math.max(
    Math.min(Math.max(selection.xMin, selection.xMax), maxX),
    minX
  );
  const yMin = Math.min(
    Math.max(Math.min(selection.yMin, selection.yMax), minY),
    maxY
  );
  const yMax = Math.max(
    Math.min(Math.max(selection.yMin, selection.yMax), maxY),
    minY
  );

  const xIndex = Math.min(
    Math.max(Math.round(selection.xIndex), 0),
    surface.xValues.length - 1
  );
  const yIndex = Math.min(
    Math.max(Math.round(selection.yIndex), 0),
    surface.yValues.length - 1
  );

  return { xMin, xMax, yMin, yMax, xIndex, yIndex };
};

const nearestIndexForValue = (values: number[], target: number) =>
  values.reduce((bestIndex, value, index) => {
    const bestDistance = Math.abs(values[bestIndex] - target);
    const nextDistance = Math.abs(value - target);
    return nextDistance < bestDistance ? index : bestIndex;
  }, 0);

export const extractSurfaceWindow = (
  surface: SurfaceData,
  selection: SelectionState
): SurfaceData => {
  const clamped = clampSelectionState(surface, selection);

  const xCandidates = surface.xValues
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value >= clamped.xMin && value <= clamped.xMax);
  const yCandidates = surface.yValues
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value >= clamped.yMin && value <= clamped.yMax);

  const fallbackX =
    xCandidates.length === 0
      ? (() => {
          const midpoint = (clamped.xMin + clamped.xMax) / 2;
          const index = nearestIndexForValue(surface.xValues, midpoint);
          return [{ value: surface.xValues[index], index }];
        })()
      : xCandidates;
  const fallbackY =
    yCandidates.length === 0
      ? (() => {
          const midpoint = (clamped.yMin + clamped.yMax) / 2;
          const index = nearestIndexForValue(surface.yValues, midpoint);
          return [{ value: surface.yValues[index], index }];
        })()
      : yCandidates;

  const xValues = fallbackX.map(({ value }) => value);
  const yValues = fallbackY.map(({ value }) => value);
  const strikeLabels = fallbackX.map(({ index }) => surface.strikeLabels[index]);
  const expiryLabels = fallbackY.map(({ index }) => surface.expiryLabels[index]);

  const zValues = fallbackY.map(({ index: rowIndex }) =>
    fallbackX.map(({ index: colIndex }) => surface.zValues[rowIndex][colIndex])
  );

  return {
    strikeLabels,
    expiryLabels,
    xValues,
    yValues,
    zValues,
  };
};
