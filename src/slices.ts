import { SurfaceData } from "./domain";

export type SliceData = {
  axisValues: number[];
  axisLabels: string[];
  zValues: number[];
  fixedIndex: number;
  fixedLabel: string;
};

const clampIndex = (index: number, max: number) =>
  Math.min(Math.max(index, 0), max);

export const extractXSlice = (surface: SurfaceData, xIndex: number): SliceData => {
  const clampedIndex = clampIndex(xIndex, surface.xValues.length - 1);
  const zValues = surface.zValues.map((row) => row[clampedIndex]);

  return {
    axisValues: surface.yValues,
    axisLabels: surface.expiryLabels,
    zValues,
    fixedIndex: clampedIndex,
    fixedLabel: surface.tenorLabels[clampedIndex],
  };
};

export const extractYSlice = (surface: SurfaceData, yIndex: number): SliceData => {
  const clampedIndex = clampIndex(yIndex, surface.yValues.length - 1);
  const zValues = surface.zValues[clampedIndex];

  return {
    axisValues: surface.xValues,
    axisLabels: surface.tenorLabels,
    zValues,
    fixedIndex: clampedIndex,
    fixedLabel: surface.expiryLabels[clampedIndex],
  };
};
