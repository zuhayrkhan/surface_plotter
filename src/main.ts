import {
  EXPIRY_LABELS,
  SelectionState,
  TENOR_LABELS,
  clampSelectionState,
  createSelectionState,
  extractSurfaceWindow,
  generateTenorSurface,
} from "./domain";
import { extractXSlice, extractYSlice } from "./slices";
import {
  PlotlyHost,
  renderDataPreview,
  renderSliceChart,
  renderSurfaceChart,
  updateSurfaceChart,
  updateSliceChart,
} from "./rendering";

const initialize = async () => {
  const surface = generateTenorSurface(TENOR_LABELS, EXPIRY_LABELS);
  const fullSelection = createSelectionState(surface);
  let selectionState: SelectionState = fullSelection;

  const xSliceInput = document.getElementById("xSlice") as HTMLInputElement;
  const ySliceInput = document.getElementById("ySlice") as HTMLInputElement;
  const sliceReadout = document.getElementById("sliceReadout") as HTMLSpanElement;

  xSliceInput.max = String(surface.xValues.length - 1);
  ySliceInput.max = String(surface.yValues.length - 1);

  renderDataPreview("dataPreview", surface);

  const surfaceHost = (await renderSurfaceChart(
    "surface3d",
    extractSurfaceWindow(surface, selectionState),
    selectionState
  )) as PlotlyHost;

  const initialX = 3;
  const initialY = 2;
  const initialXSlice = extractXSlice(surface, initialX);
  const initialYSlice = extractYSlice(surface, initialY);

  const sliceXHost = await renderSliceChart("sliceX", initialXSlice, "Expiry", "#38bdf8");
  const sliceYHost = await renderSliceChart("sliceY", initialYSlice, "Tenor", "#f97316");

  const updateReadout = (xIndex: number, yIndex: number) => {
    sliceReadout.textContent = `Selected: ${surface.tenorLabels[xIndex]} / ${
      surface.expiryLabels[yIndex]
    }`;
    xSliceInput.value = String(xIndex);
    ySliceInput.value = String(yIndex);
  };

  const updateSlices = async (xIndex: number, yIndex: number) => {
    const xSlice = extractXSlice(surface, xIndex);
    const ySlice = extractYSlice(surface, yIndex);

    await updateSliceChart("sliceX", xSlice, "Expiry", "#38bdf8");
    await updateSliceChart("sliceY", ySlice, "Tenor", "#f97316");

    updateReadout(xSlice.fixedIndex, ySlice.fixedIndex);
  };

  const updateSelectionState = async (nextSelection: SelectionState) => {
    selectionState = clampSelectionState(surface, nextSelection);
    await updateSurfaceChart(
      "surface3d",
      extractSurfaceWindow(surface, selectionState),
      selectionState
    );
  };

  const parseAxisRange = (event: Record<string, unknown>) => {
    const range = event["xaxis.range"];
    if (Array.isArray(range) && range.length === 2) {
      const [min, max] = range;
      if (typeof min === "number" && typeof max === "number") {
        return { min, max };
      }
    }

    const min = event["xaxis.range[0]"];
    const max = event["xaxis.range[1]"];
    if (typeof min === "number" && typeof max === "number") {
      return { min, max };
    }

    return null;
  };

  const handleSliceZoom = (axis: "tenor" | "expiry") => (event: unknown) => {
    const payload = event as Record<string, unknown>;
    const isAuto = payload["xaxis.autorange"] === true;
    if (isAuto) {
      const resetWindow =
        axis === "tenor"
          ? { ...selectionState, xMin: fullSelection.xMin, xMax: fullSelection.xMax }
          : { ...selectionState, yMin: fullSelection.yMin, yMax: fullSelection.yMax };
      void updateSelectionState(resetWindow);
      return;
    }

    const range = parseAxisRange(payload);
    if (!range) {
      return;
    }

    const updatedWindow =
      axis === "tenor"
        ? { ...selectionState, xMin: range.min, xMax: range.max }
        : { ...selectionState, yMin: range.min, yMax: range.max };
    void updateSelectionState(updatedWindow);
  };

  const handleSliderChange = () => {
    void updateSlices(Number(xSliceInput.value), Number(ySliceInput.value));
  };

  xSliceInput.addEventListener("input", handleSliderChange);
  ySliceInput.addEventListener("input", handleSliderChange);

  sliceXHost.on("plotly_relayout", handleSliceZoom("expiry"));
  sliceYHost.on("plotly_relayout", handleSliceZoom("tenor"));

  surfaceHost.on("plotly_click", (event) => {
    const payload = event as { points?: Array<{ x: number; y: number }> };
    const point = payload.points?.[0];
    if (!point) {
      return;
    }
    void updateSlices(Math.round(point.x), Math.round(point.y));
  });

  updateReadout(initialXSlice.fixedIndex, initialYSlice.fixedIndex);
};

void initialize();
