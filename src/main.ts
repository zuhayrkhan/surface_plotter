import Plotly from "plotly.js-dist-min";
import {
  clampSelectionState,
  createSelectionState,
  EXPIRY_LABELS,
  extractSurfaceWindow,
  generateOptionSurface,
  SelectionState,
  STRIKE_LABELS,
} from "./domain";
import {extractXSlice, extractYSlice} from "./slices";
import {
  renderDataPreview,
  renderSliceChart,
  renderSurfaceChart,
  updateSliceChart,
  updateSurfaceChart,
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
  const addAxisLabelListeners = (host: HTMLElement, labels: string[], callback: (index: number) => void, resetCallback: () => void) => {
    // We use 'mousedown' which is often more reliable than 'click' for elements inside Plotly
    host.addEventListener("mousedown", (event) => {
      const target = event.target as SVGElement;

      // Detailed debug logging to understand what is being hit in the user's browser
      console.log(`[DEBUG_LOG] Element mousedown: <${target.tagName}> class="${target.getAttribute('class')}" content="${target.textContent}"`);

      // 1. Direct hit on text or tspan
      let textContent = "";
      if (target.tagName === "text" || target.tagName === "tspan") {
        textContent = target.textContent?.trim() || "";
      } else {
        // 2. Check if we hit a group that contains text (like xtick/ytick)
        const tickGroup = target.closest('.xtick, .ytick');
        if (tickGroup) {
          const textEl = tickGroup.querySelector('text');
          textContent = textEl?.textContent?.trim() || "";
        }
      }

      if (textContent) {
        const index = labels.indexOf(textContent);
        if (index !== -1) {
          console.log(`[DEBUG_LOG] Match found! Label: ${textContent}, Index: ${index}`);
          callback(index);
          return;
        }
      }
    }, true);

    host.addEventListener("dblclick", (event) => {
      const target = event.target as HTMLElement;
      // More inclusive check for axis area
      if (target.closest(".axis") || target.closest(".xtick") || target.closest(".ytick") || target.closest(".main-svg")) {
        // If it's not a point, it might be the background or axis
        if (!target.classList.contains('point')) {
          console.log(`[DEBUG_LOG] Area double-clicked. Resetting.`);
          resetCallback();
        }
      }
    }, true);
  };

  addAxisLabelListeners(sliceXHost, surface.expiryLabels, (index) => {
    void updateSelectionState({ ...selectionState, yIndex: index });
  }, () => void updateSelectionState(INITIAL_SELECTION));

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

  addAxisLabelListeners(sliceYHost, surface.strikeLabels, (index) => {
    void updateSelectionState({ ...selectionState, xIndex: index });
  }, () => void updateSelectionState(INITIAL_SELECTION));

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

  // Layout Resizer Implementation
  const layout = document.querySelector(".layout") as HTMLElement;
  const resizer = document.getElementById("layoutResizer") as HTMLElement;
  let isDragging = false;

  resizer.addEventListener("mousedown", (e) => {
    isDragging = true;
    resizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    // Calculate the percentage width for the left panel
    const containerWidth = layout.clientWidth;
    const padding = 16; // layout padding
    const relativeX = e.clientX - padding;
    const percentage = (relativeX / (containerWidth - padding * 2)) * 100;

    // Clamp between 20% and 80%
    const clampedPercentage = Math.min(Math.max(percentage, 20), 80);

    layout.style.gridTemplateColumns = `${clampedPercentage}% 8px 1fr`;

    // Explicitly tell Plotly to resize.
    const sliceX = document.getElementById("sliceX");
    const sliceY = document.getElementById("sliceY");
    if (sliceX) Plotly.Plots.resize(sliceX);
    if (sliceY) Plotly.Plots.resize(sliceY);

    // Force a window resize event to trigger the 3D renderer's ResizeObserver
    // and Plotly's internal responsive logic.
    window.dispatchEvent(new Event("resize"));
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      resizer.classList.remove("dragging");
      document.body.style.cursor = "";
    }
  });

  updateReadout(selectionState.xIndex, selectionState.yIndex);
};

void initialize();
