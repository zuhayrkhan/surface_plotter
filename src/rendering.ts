import Plotly from "plotly.js-dist-min";

import { SelectionState, SurfaceData } from "./domain";
import { SliceData } from "./slices";

export type PlotlyHost = HTMLElement & {
  on: (event: string, handler: (event: unknown) => void) => void;
};

const baseLayout = {
  paper_bgcolor: "#1a1f2b",
  plot_bgcolor: "#1a1f2b",
  font: { color: "#eef2f7" },
  margin: { l: 40, r: 20, t: 30, b: 40 },
};

const buildSurfaceLayout = (surface: SurfaceData, selection: SelectionState) => ({
  ...baseLayout,
  dragmode: "orbit",
  scene: {
    xaxis: {
      title: {text: "Tenor"},
      tickvals: surface.xValues,
      ticktext: surface.tenorLabels,
      range: [selection.xMin, selection.xMax],
    },
    yaxis: {
      title: {text: "Expiry"},
      tickvals: surface.yValues,
      ticktext: surface.expiryLabels,
      range: [selection.yMin, selection.yMax],
    },
    zaxis: {
      title: {text: "Value (Z)"},
    },
  },
});

const findSurfaceMinimum = (surface: SurfaceData) =>
  surface.zValues.reduce(
    (minValue, row) =>
      row.reduce((rowMin, value) => Math.min(rowMin, value), minValue),
    Number.POSITIVE_INFINITY
  );

const buildSelectionOutline = (selection: SelectionState, zValue: number) => ({
  type: "scatter3d" as const,
  mode: "lines" as const,
  x: [
    selection.xMin,
    selection.xMax,
    selection.xMax,
    selection.xMin,
    selection.xMin,
  ],
  y: [
    selection.yMin,
    selection.yMin,
    selection.yMax,
    selection.yMax,
    selection.yMin,
  ],
  z: [zValue, zValue, zValue, zValue, zValue],
  line: { color: "#fbbf24", width: 6 },
  hoverinfo: "skip" as const,
  showlegend: false,
});

const buildSurfaceData = (surface: SurfaceData, selection: SelectionState) => {
  const zFloor = findSurfaceMinimum(surface);
  return [
    {
      type: "surface" as const,
      x: surface.xValues,
      y: surface.yValues,
      z: surface.zValues,
      colorscale: "Viridis",
      showscale: true,
    },
    buildSelectionOutline(selection, zFloor),
  ];
};

export const renderSurfaceChart = async (
  divId: string,
  surface: SurfaceData,
  selection: SelectionState
): Promise<PlotlyHost> => {
  const data = buildSurfaceData(surface, selection);
  const layout = buildSurfaceLayout(surface, selection);

  return (await Plotly.newPlot(divId, data, layout, {
    responsive: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  })) as PlotlyHost;
};

export const updateSurfaceChart = async (
  divId: string,
  surface: SurfaceData,
  selection: SelectionState
): Promise<void> => {
  await Plotly.react(divId, buildSurfaceData(surface, selection), buildSurfaceLayout(surface, selection), {
    responsive: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  });
};

const buildSliceLayout = (slice: SliceData, axisTitle: string) => ({
  ...baseLayout,
  xaxis: {
    title: {text: axisTitle},
    tickvals: slice.axisValues,
    ticktext: slice.axisLabels,
  },
  yaxis: {
    title: {text: "Value (Z)"},
    fixedrange: true,
  },
});

const buildSliceTrace = (slice: SliceData, lineColor: string) => ({
  type: "scatter" as const,
  mode: "lines+markers" as const,
  x: slice.axisValues,
  y: slice.zValues,
  line: { color: lineColor, width: 2 },
  marker: { color: lineColor, size: 6 },
});

export const renderSliceChart = async (
  divId: string,
  slice: SliceData,
  axisTitle: string,
  lineColor: string
): Promise<PlotlyHost> => {
  return (await Plotly.newPlot(divId, [buildSliceTrace(slice, lineColor)], buildSliceLayout(slice, axisTitle), {
    responsive: true,
    displayModeBar: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  })) as PlotlyHost;
};

export const updateSliceChart = async (
  divId: string,
  slice: SliceData,
  axisTitle: string,
  lineColor: string
) => {
  await Plotly.react(divId, [buildSliceTrace(slice, lineColor)], buildSliceLayout(slice, axisTitle), {
    responsive: true,
    displayModeBar: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  });
};

export const renderDataPreview = (
  divId: string,
  surface: SurfaceData,
  maxRows = 4,
  maxCols = 5
) => {
  const container = document.getElementById(divId);
  if (!container) {
    return;
  }

  const rows = surface.expiryLabels.slice(0, maxRows);
  const cols = surface.tenorLabels.slice(0, maxCols);

  const table = document.createElement("table");
  table.className = "data-preview-table";

  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th"));
  cols.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  rows.forEach((expiryLabel, rowIndex) => {
    const tr = document.createElement("tr");
    const rowHeader = document.createElement("th");
    rowHeader.textContent = expiryLabel;
    tr.appendChild(rowHeader);

    cols.forEach((_, colIndex) => {
      const cell = document.createElement("td");
      cell.textContent = surface.zValues[rowIndex][colIndex].toFixed(3);
      tr.appendChild(cell);
    });

    table.appendChild(tr);
  });

  container.innerHTML = "";
  container.appendChild(table);
};
