import {
  CursorModifier,
  FastLineRenderableSeries,
  MouseWheelZoomModifier,
  NumericAxis,
  SciChartSurface,
  XyDataSeries,
  ZoomPanModifier,
} from "scichart";
import {
  GradientColorPalette,
  MouseWheelZoomModifier3D,
  NumericAxis3D,
  OrbitModifier3D,
  PanModifier3D,
  SciChart3DSurface,
  SurfaceMeshRenderableSeries3D,
  UniformGridDataSeries3D,
} from "scichart";

type SurfaceData = {
  tenorLabels: string[];
  expiryLabels: string[];
  xValues: number[];
  yValues: number[];
  zValues: number[][];
};

type SliceCharts = {
  xSliceSeries: FastLineRenderableSeries;
  ySliceSeries: FastLineRenderableSeries;
};

const TENOR_LABELS = [
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

const EXPIRY_LABELS = [
  "1W",
  "1M",
  "3M",
  "6M",
  "1Y",
  "2Y",
  "3Y",
  "5Y",
];

// -------------------------------
// Data generation
// -------------------------------
const generateTenorSurface = (tenors: string[], expiries: string[]): SurfaceData => {
  const xValues = tenors.map((label, index) => index);
  const yValues = expiries.map((label, index) => index);

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

// -------------------------------
// Chart construction
// -------------------------------
const buildSurfaceChart = async (divId: string, data: SurfaceData) => {
  // SciChart 3D WASM initialization must happen before creating surfaces.
  SciChart3DSurface.useWasmFromCDN();

  const { sciChart3DSurface, wasmContext } = await SciChart3DSurface.create(divId);

  sciChart3DSurface.xAxis = new NumericAxis3D(wasmContext, {
    axisTitle: "Tenor",
    autoRange: "Always",
  });
  sciChart3DSurface.yAxis = new NumericAxis3D(wasmContext, {
    axisTitle: "Expiry",
    autoRange: "Always",
  });
  sciChart3DSurface.zAxis = new NumericAxis3D(wasmContext, {
    axisTitle: "Volatility",
    autoRange: "Always",
  });

  const dataSeries = new UniformGridDataSeries3D(wasmContext, {
    xStart: 0,
    xStep: 1,
    yStart: 0,
    yStep: 1,
    zValues: data.zValues,
  });

  // Surface mesh series uses a gradient palette to map Z values to color.
  const surfaceSeries = new SurfaceMeshRenderableSeries3D(wasmContext, {
    dataSeries,
    drawMeshAs: "SolidMesh",
    stroke: "#1f2937",
    strokeThickness: 1,
    meshColorPalette: new GradientColorPalette({
      gradientStops: [
        { offset: 0, color: "#1e3a8a" },
        { offset: 0.5, color: "#38bdf8" },
        { offset: 1, color: "#f97316" },
      ],
    }),
  });

  sciChart3DSurface.renderableSeries.add(surfaceSeries);
  sciChart3DSurface.chartModifiers.add(
    new OrbitModifier3D(),
    new MouseWheelZoomModifier3D(),
    new PanModifier3D()
  );

  return { sciChart3DSurface, dataSeries };
};

const buildSliceCharts = async (
  xSliceDiv: string,
  ySliceDiv: string
): Promise<SliceCharts> => {
  // SciChart 2D WASM initialization for slice charts.
  SciChartSurface.useWasmFromCDN();

  const { sciChartSurface: xSliceSurface, wasmContext: xContext } =
    await SciChartSurface.create(xSliceDiv);
  const { sciChartSurface: ySliceSurface, wasmContext: yContext } =
    await SciChartSurface.create(ySliceDiv);

  xSliceSurface.xAxes.add(new NumericAxis(xContext, { axisTitle: "Expiry Index" }));
  xSliceSurface.yAxes.add(new NumericAxis(xContext, { axisTitle: "Volatility" }));

  ySliceSurface.xAxes.add(new NumericAxis(yContext, { axisTitle: "Tenor Index" }));
  ySliceSurface.yAxes.add(new NumericAxis(yContext, { axisTitle: "Volatility" }));

  const xSliceSeries = new FastLineRenderableSeries(xContext, {
    stroke: "#38bdf8",
    strokeThickness: 2,
    dataSeries: new XyDataSeries(xContext),
  });
  const ySliceSeries = new FastLineRenderableSeries(yContext, {
    stroke: "#f97316",
    strokeThickness: 2,
    dataSeries: new XyDataSeries(yContext),
  });

  xSliceSurface.renderableSeries.add(xSliceSeries);
  ySliceSurface.renderableSeries.add(ySliceSeries);

  xSliceSurface.chartModifiers.add(
    new ZoomPanModifier(),
    new MouseWheelZoomModifier(),
    new CursorModifier()
  );
  ySliceSurface.chartModifiers.add(
    new ZoomPanModifier(),
    new MouseWheelZoomModifier(),
    new CursorModifier()
  );

  return { xSliceSeries, ySliceSeries };
};

// -------------------------------
// Interaction logic
// -------------------------------
const buildSliceUpdater = (
  data: SurfaceData,
  sliceCharts: SliceCharts,
  onUpdateLabel: (xIndex: number, yIndex: number) => void
) => {
  const updateSlices = (xIndex: number, yIndex: number) => {
    const clampedX = Math.max(0, Math.min(data.xValues.length - 1, xIndex));
    const clampedY = Math.max(0, Math.min(data.yValues.length - 1, yIndex));

    const xSliceYValues = data.zValues.map((row) => row[clampedX]);
    const ySliceYValues = data.zValues[clampedY];

    const xSliceDataSeries = sliceCharts.xSliceSeries.dataSeries as XyDataSeries;
    xSliceDataSeries.clear();
    data.yValues.forEach((yValue, index) => {
      xSliceDataSeries.append(yValue, xSliceYValues[index]);
    });

    const ySliceDataSeries = sliceCharts.ySliceSeries.dataSeries as XyDataSeries;
    ySliceDataSeries.clear();
    data.xValues.forEach((xValue, index) => {
      ySliceDataSeries.append(xValue, ySliceYValues[index]);
    });

    onUpdateLabel(clampedX, clampedY);
  };

  return updateSlices;
};

const attachCursorInteraction = (
  target: HTMLElement,
  maxX: number,
  maxY: number,
  onHover: (xIndex: number, yIndex: number) => void
) => {
  let rafId: number | null = null;
  const handlePointerMove = (event: PointerEvent) => {
    if (rafId !== null) {
      return;
    }
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const rect = target.getBoundingClientRect();
      const normalizedX = (event.clientX - rect.left) / rect.width;
      const normalizedY = (event.clientY - rect.top) / rect.height;
      const xIndex = Math.round(normalizedX * maxX);
      const yIndex = Math.round(normalizedY * maxY);
      onHover(xIndex, yIndex);
    });
  };

  target.addEventListener("pointermove", handlePointerMove);
};

const initialize = async () => {
  const data = generateTenorSurface(TENOR_LABELS, EXPIRY_LABELS);

  const xSliceInput = document.getElementById("xSlice") as HTMLInputElement;
  const ySliceInput = document.getElementById("ySlice") as HTMLInputElement;
  const sliceReadout = document.getElementById("sliceReadout") as HTMLSpanElement;

  xSliceInput.max = String(data.xValues.length - 1);
  ySliceInput.max = String(data.yValues.length - 1);

  const { sciChart3DSurface } = await buildSurfaceChart("surface3d", data);
  const sliceCharts = await buildSliceCharts("sliceX", "sliceY");

  const updateReadout = (xIndex: number, yIndex: number) => {
    sliceReadout.textContent = `Selected: ${data.tenorLabels[xIndex]} / ${
      data.expiryLabels[yIndex]
    }`;
    xSliceInput.value = String(xIndex);
    ySliceInput.value = String(yIndex);
  };

  const updateSlices = buildSliceUpdater(data, sliceCharts, updateReadout);

  const handleSliderChange = () => {
    updateSlices(Number(xSliceInput.value), Number(ySliceInput.value));
  };

  xSliceInput.addEventListener("input", handleSliderChange);
  ySliceInput.addEventListener("input", handleSliderChange);

  const surfaceHost = document.getElementById("surface3d");
  if (surfaceHost) {
    attachCursorInteraction(
      surfaceHost,
      data.xValues.length - 1,
      data.yValues.length - 1,
      updateSlices
    );
  }

  updateSlices(3, 2);
};

void initialize();
