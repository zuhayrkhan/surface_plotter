import {
  EXPIRY_LABELS,
  SelectionState,
  STRIKE_LABELS,
  clampSelectionState,
  createSelectionState,
  extractSurfaceWindow,
  generateOptionSurface,
} from "./domain";
import { extractXSlice, extractYSlice } from "./slices";
import {
  renderDataPreview,
  renderSliceChart,
  renderSurfaceChart,
  updateSurfaceChart,
  updateSliceChart,
} from "./rendering";

const initialize = async () => {
  const surface = generateOptionSurface(STRIKE_LABELS, EXPIRY_LABELS);
  const fullSelection = createSelectionState(surface);

  const xSliceInput = document.getElementById("xSlice") as HTMLInputElement;
  const ySliceInput = document.getElementById("ySlice") as HTMLInputElement;
  const sliceReadout = document.getElementById("sliceReadout") as HTMLSpanElement;

  xSliceInput.max = String(surface.xValues.length - 1);
  ySliceInput.max = String(surface.yValues.length - 1);

  renderDataPreview("dataPreview", surface);

  const initialX = 3;
  const initialY = 2;
  let selectionState: SelectionState = {
    ...fullSelection,
    xIndex: initialX,
    yIndex: initialY,
  };
  await renderSurfaceChart(
    "surface3d",
    extractSurfaceWindow(surface, selectionState),
    selectionState
  );
  const initialXSlice = extractXSlice(surface, selectionState.xIndex);
  const initialYSlice = extractYSlice(surface, selectionState.yIndex);

  const sliceXHost = await renderSliceChart("sliceX", initialXSlice, "Expiry", "#38bdf8");
  const sliceYHost = await renderSliceChart("sliceY", initialYSlice, "Strike", "#f97316");

  sliceXHost.on("plotly_relayout", (event: any) => {
    const xRange0 = event["xaxis.range[0]"];
    const xRange1 = event["xaxis.range[1]"];
    const xRange = event["xaxis.range"];

    if (xRange0 !== undefined && xRange1 !== undefined) {
      void updateSelectionState({
        ...selectionState,
        yMin: xRange0,
        yMax: xRange1,
      });
    } else if (Array.isArray(xRange)) {
      void updateSelectionState({
        ...selectionState,
        yMin: xRange[0],
        yMax: xRange[1],
      });
    } else if (event["xaxis.autorange"]) {
      void updateSelectionState({
        ...selectionState,
        yMin: surface.yValues[0],
        yMax: surface.yValues[surface.yValues.length - 1],
      });
    }
  });

  sliceYHost.on("plotly_relayout", (event: any) => {
    const xRange0 = event["xaxis.range[0]"];
    const xRange1 = event["xaxis.range[1]"];
    const xRange = event["xaxis.range"];

    if (xRange0 !== undefined && xRange1 !== undefined) {
      void updateSelectionState({
        ...selectionState,
        xMin: xRange0,
        xMax: xRange1,
      });
    } else if (Array.isArray(xRange)) {
      void updateSelectionState({
        ...selectionState,
        xMin: xRange[0],
        xMax: xRange[1],
      });
    } else if (event["xaxis.autorange"]) {
      void updateSelectionState({
        ...selectionState,
        xMin: surface.xValues[0],
        xMax: surface.xValues[surface.xValues.length - 1],
      });
    }
  });

  const updateReadout = (xIndex: number, yIndex: number) => {
    sliceReadout.textContent = `Selected: ${surface.strikeLabels[xIndex]} / ${
      surface.expiryLabels[yIndex]
    }`;
    xSliceInput.value = String(xIndex);
    ySliceInput.value = String(yIndex);
  };

  const updateSlices = async (xIndex: number, yIndex: number) => {
    const xSlice = extractXSlice(surface, xIndex);
    const ySlice = extractYSlice(surface, yIndex);

    await updateSliceChart("sliceX", xSlice, "Expiry", "#38bdf8");
    await updateSliceChart("sliceY", ySlice, "Strike", "#f97316");

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
    // Sliders only update the active cross-section slices, 
    // they don't force a change to the 3D zoom window.
    await updateSelectionState({
      ...selectionState,
      xIndex,
      yIndex,
    });
  };

  const handleSliderChange = () => {
    void updateSelectionFromUserInput(
      Number(xSliceInput.value),
      Number(ySliceInput.value)
    );
  };

  xSliceInput.addEventListener("input", handleSliderChange);
  ySliceInput.addEventListener("input", handleSliderChange);

  updateReadout(selectionState.xIndex, selectionState.yIndex);
};

void initialize();
