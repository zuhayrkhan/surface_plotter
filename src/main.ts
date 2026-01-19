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

  const xSliceInput = document.getElementById("xSlice") as HTMLInputElement;
  const ySliceInput = document.getElementById("ySlice") as HTMLInputElement;
  const sliceReadout = document.getElementById("sliceReadout") as HTMLSpanElement;

  xSliceInput.max = String(surface.xValues.length - 1);
  ySliceInput.max = String(surface.yValues.length - 1);

  renderDataPreview("dataPreview", surface);

  const initialX = 3;
  const initialY = 2;
  let selectionState: SelectionState = clampSelectionState(surface, {
    ...fullSelection,
    xIndex: initialX,
    yIndex: initialY,
  });
  const surfaceHost = (await renderSurfaceChart(
    "surface3d",
    extractSurfaceWindow(surface, selectionState),
    selectionState
  )) as PlotlyHost;
  const initialXSlice = extractXSlice(surface, selectionState.xIndex);
  const initialYSlice = extractYSlice(surface, selectionState.yIndex);

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
    const previousSelection = selectionState;
    selectionState = clampSelectionState(surface, nextSelection);
    const windowChanged =
      selectionState.xMin !== previousSelection.xMin ||
      selectionState.xMax !== previousSelection.xMax ||
      selectionState.yMin !== previousSelection.yMin ||
      selectionState.yMax !== previousSelection.yMax;
    if (windowChanged) {
      await updateSurfaceChart(
        "surface3d",
        extractSurfaceWindow(surface, selectionState),
        selectionState
      );
    }
    if (
      selectionState.xIndex !== previousSelection.xIndex ||
      selectionState.yIndex !== previousSelection.yIndex
    ) {
      await updateSlices(selectionState.xIndex, selectionState.yIndex);
    }
  };

  const updateSelectionFromUserInput = async (xIndex: number, yIndex: number) => {
    await updateSelectionState({
      ...selectionState,
      xIndex,
      yIndex,
    });
  };

  const updateSelectionWindow = async (
    nextWindow: Pick<SelectionState, "xMin" | "xMax" | "yMin" | "yMax">
  ) => {
    await updateSelectionState({
      ...selectionState,
      xMin: nextWindow.xMin,
      xMax: nextWindow.xMax,
      yMin: nextWindow.yMin,
      yMax: nextWindow.yMax,
    });
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
          ? {
              xMin: fullSelection.xMin,
              xMax: fullSelection.xMax,
              yMin: selectionState.yMin,
              yMax: selectionState.yMax,
            }
          : {
              xMin: selectionState.xMin,
              xMax: selectionState.xMax,
              yMin: fullSelection.yMin,
              yMax: fullSelection.yMax,
            };
      // Slice zoom should never mutate slice indices; only window bounds are updated here.
      void updateSelectionWindow(resetWindow);
      return;
    }

    const range = parseAxisRange(payload);
    if (!range) {
      return;
    }

    const updatedWindow =
      axis === "tenor"
        ? {
            xMin: range.min,
            xMax: range.max,
            yMin: selectionState.yMin,
            yMax: selectionState.yMax,
          }
        : {
            xMin: selectionState.xMin,
            xMax: selectionState.xMax,
            yMin: range.min,
            yMax: range.max,
          };
    // Slice zoom should never mutate slice indices; only window bounds are updated here.
    void updateSelectionWindow(updatedWindow);
  };

  const handleSliderChange = () => {
    void updateSelectionFromUserInput(
      Number(xSliceInput.value),
      Number(ySliceInput.value)
    );
  };

  xSliceInput.addEventListener("input", handleSliderChange);
  ySliceInput.addEventListener("input", handleSliderChange);

  sliceXHost.on("plotly_relayout", handleSliceZoom("expiry"));
  sliceYHost.on("plotly_relayout", handleSliceZoom("tenor"));

  let ignoreNextSurfaceClick = false;
  surfaceHost.on("plotly_relayout", (event) => {
    const payload = event as Record<string, unknown>;
    const hasCameraChange = Object.keys(payload).some((key) =>
      key.startsWith("scene.camera")
    );
    if (hasCameraChange) {
      ignoreNextSurfaceClick = true;
      requestAnimationFrame(() => {
        ignoreNextSurfaceClick = false;
      });
    }
  });

  surfaceHost.on("plotly_click", (event) => {
    if (ignoreNextSurfaceClick) {
      ignoreNextSurfaceClick = false;
      return;
    }
    const payload = event as { points?: Array<{ x: number; y: number }> };
    const point = payload.points?.[0];
    if (!point) {
      return;
    }
    void updateSelectionFromUserInput(Math.round(point.x), Math.round(point.y));
  });

  updateReadout(selectionState.xIndex, selectionState.yIndex);
};

void initialize();
