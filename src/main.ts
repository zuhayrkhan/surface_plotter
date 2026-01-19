import { EXPIRY_LABELS, TENOR_LABELS, generateTenorSurface } from "./domain";
import { extractXSlice, extractYSlice } from "./slices";
import {
  PlotlyHost,
  renderDataPreview,
  renderSliceChart,
  renderSurfaceChart,
  updateSliceChart,
} from "./rendering";

const initialize = async () => {
  const surface = generateTenorSurface(TENOR_LABELS, EXPIRY_LABELS);

  const xSliceInput = document.getElementById("xSlice") as HTMLInputElement;
  const ySliceInput = document.getElementById("ySlice") as HTMLInputElement;
  const sliceReadout = document.getElementById("sliceReadout") as HTMLSpanElement;

  xSliceInput.max = String(surface.xValues.length - 1);
  ySliceInput.max = String(surface.yValues.length - 1);

  renderDataPreview("dataPreview", surface);

  const surfaceHost = (await renderSurfaceChart("surface3d", surface)) as PlotlyHost;

  const initialX = 3;
  const initialY = 2;
  const initialXSlice = extractXSlice(surface, initialX);
  const initialYSlice = extractYSlice(surface, initialY);

  await renderSliceChart("sliceX", initialXSlice, "Expiry", "#38bdf8");
  await renderSliceChart("sliceY", initialYSlice, "Tenor", "#f97316");

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

  const handleSliderChange = () => {
    void updateSlices(Number(xSliceInput.value), Number(ySliceInput.value));
  };

  xSliceInput.addEventListener("input", handleSliderChange);
  ySliceInput.addEventListener("input", handleSliderChange);

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
