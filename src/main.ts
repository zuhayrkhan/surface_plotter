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
  const INITIAL_SELECTION: SelectionState = {
    ...fullSelection,
    xIndex: initialX,
    yIndex: initialY,
  };
  let selectionState: SelectionState = { ...INITIAL_SELECTION };
  await renderSurfaceChart(
    "surface3d",
    extractSurfaceWindow(surface, selectionState),
    selectionState
  );
  const initialXSlice = extractXSlice(surface, selectionState.xIndex);
  const initialYSlice = extractYSlice(surface, selectionState.yIndex);

  const sliceXHost = await renderSliceChart(
    "sliceX",
    initialXSlice,
    "Expiry",
    "Strike",
    "#38bdf8"
  );
  const sliceYHost = await renderSliceChart(
    "sliceY",
    initialYSlice,
    "Strike",
    "Expiry",
    "#f97316"
  );

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

  sliceXHost.on("plotly_doubleclick", () => {
    console.log(`[DEBUG_LOG] Double-click on Expiry chart. Resetting to initial state.`);
    void updateSelectionState(INITIAL_SELECTION);
    return false; // Prevent default Plotly reset if we want total control
  });

  sliceXHost.on("plotly_click", (data: any) => {
    if (data.points && data.points.length > 0) {
      const clickedYIndex = data.points[0].pointIndex;
      console.log(`[DEBUG_LOG] Marker clicked in Expiry Chart (Slice X). Target Expiry Index: ${clickedYIndex}`);
      // Ensure we use the latest selectionState when updating
      void updateSelectionState({
        ...selectionState,
        yIndex: clickedYIndex,
      });
    }
  });

  // Listen for clicks on axis labels (DOM based)
  const addAxisLabelClickListener = (host: HTMLElement, labels: string[], callback: (index: number) => void) => {
    host.addEventListener("click", (event) => {
      let target = event.target as HTMLElement;
      
      // Plotly labels are often inside <text> or <tspan> elements within <g class="xtick"> or <g class="ytick">
      // We search up the tree slightly or check the target itself
      const findTextContent = (el: HTMLElement | null): string | null => {
        if (!el) return null;
        if (el.tagName === "text" || el.tagName === "tspan") return el.textContent?.trim() || null;
        return null;
      };

      const textContent = findTextContent(target);
      if (textContent) {
        const index = labels.indexOf(textContent);
        if (index !== -1) {
          console.log(`[DEBUG_LOG] Axis label detected: ${textContent}, Index: ${index}`);
          callback(index);
          return;
        }
      }
      
      // Fallback: check children if a tick group was clicked
      if (target.tagName === "g") {
        const textEl = target.querySelector("text");
        if (textEl && textEl.textContent) {
          const index = labels.indexOf(textEl.textContent.trim());
          if (index !== -1) {
            callback(index);
          }
        }
      }
    });
  };

  addAxisLabelClickListener(sliceXHost, surface.expiryLabels, (index) => {
    void updateSelectionState({ ...selectionState, yIndex: index });
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

  sliceYHost.on("plotly_doubleclick", () => {
    console.log(`[DEBUG_LOG] Double-click on Strike chart. Resetting to initial state.`);
    void updateSelectionState(INITIAL_SELECTION);
    return false;
  });

  sliceYHost.on("plotly_click", (data: any) => {
    if (data.points && data.points.length > 0) {
      const clickedXIndex = data.points[0].pointIndex;
      console.log(`[DEBUG_LOG] Marker clicked in Strike Chart (Slice Y). Target Strike Index: ${clickedXIndex}`);
      // Ensure we use the latest selectionState when updating
      void updateSelectionState({
        ...selectionState,
        xIndex: clickedXIndex,
      });
    }
  });

  addAxisLabelClickListener(sliceYHost, surface.strikeLabels, (index) => {
    void updateSelectionState({ ...selectionState, xIndex: index });
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

    console.log(`[DEBUG_LOG] Updating Slice X (Expiry Chart) with Strike Index ${xIndex}. Data sample:`, xSlice.zValues.slice(0, 3));
    console.log(`[DEBUG_LOG] Updating Slice Y (Strike Chart) with Expiry Index ${yIndex}. Data sample:`, ySlice.zValues.slice(0, 3));

    await updateSliceChart("sliceX", xSlice, "Expiry", "Strike", "#38bdf8");
    await updateSliceChart("sliceY", ySlice, "Strike", "Expiry", "#f97316");

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
