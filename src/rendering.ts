import Plotly from "plotly.js-dist-min";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { SelectionState, SurfaceData } from "./domain";
import { SliceData } from "./slices";

export type PlotlyHost = HTMLElement & {
  on: (event: string, handler: (event: unknown) => void) => void;
};

export type SurfaceHost = {
  dispose: () => void;
};

const baseLayout = {
  paper_bgcolor: "#1a1f2b",
  plot_bgcolor: "#1a1f2b",
  font: { color: "#eef2f7" },
  margin: { l: 40, r: 20, t: 30, b: 40 },
};

type SurfaceRenderer = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  container: HTMLElement;
  resizeObserver: ResizeObserver;
};

const surfaceRenderers = new Map<string, SurfaceRenderer>();

const buildSurfaceGeometry = (surface: SurfaceData) => {
  const rows = surface.yValues.length;
  const cols = surface.xValues.length;
  const vertexCount = rows * cols;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;
  surface.zValues.forEach((row) => {
    row.forEach((value) => {
      zMin = Math.min(zMin, value);
      zMax = Math.max(zMax, value);
    });
  });
  const range = zMax - zMin || 1;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x;
      const positionOffset = index * 3;
      const zValue = surface.zValues[y][x];
      positions[positionOffset] = surface.xValues[x];
      positions[positionOffset + 1] = surface.yValues[y];
      positions[positionOffset + 2] = zValue;

      const normalized = (zValue - zMin) / range;
      const color = new THREE.Color();
      color.setHSL(0.65 - normalized * 0.55, 0.8, 0.55);
      colors[positionOffset] = color.r;
      colors[positionOffset + 1] = color.g;
      colors[positionOffset + 2] = color.b;
    }
  }

  for (let y = 0; y < rows - 1; y += 1) {
    for (let x = 0; x < cols - 1; x += 1) {
      const a = y * cols + x;
      const b = y * cols + x + 1;
      const c = (y + 1) * cols + x;
      const d = (y + 1) * cols + x + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  if (geometry.boundingBox) {
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
  }

  return geometry;
};

const createSurfaceRenderer = (
  container: HTMLElement,
  surface: SurfaceData
): SurfaceRenderer => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#1a1f2b");

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(8, -10, 6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.8;

  const geometry = buildSurfaceGeometry(surface);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.45,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  scene.add(new THREE.AmbientLight("#ffffff", 0.6));
  const directionalLight = new THREE.DirectionalLight("#ffffff", 0.6);
  directionalLight.position.set(6, -6, 8);
  scene.add(directionalLight);

  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const render = () => {
    renderer.render(scene, camera);
  };

  controls.addEventListener("change", render);

  const resizeObserver = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    render();
  });
  resizeObserver.observe(container);

  render();

  return {
    renderer,
    scene,
    camera,
    controls,
    mesh,
    container,
    resizeObserver,
  };
};

export const renderSurfaceChart = async (
  divId: string,
  surface: SurfaceData,
  _selection: SelectionState
): Promise<SurfaceHost> => {
  const container = document.getElementById(divId);
  if (!container) {
    throw new Error(`Surface container #${divId} not found.`);
  }

  const existing = surfaceRenderers.get(divId);
  if (existing) {
    existing.resizeObserver.disconnect();
    existing.controls.dispose();
    existing.renderer.dispose();
    existing.container.innerHTML = "";
    surfaceRenderers.delete(divId);
  }

  const renderer = createSurfaceRenderer(container, surface);
  surfaceRenderers.set(divId, renderer);

  return {
    dispose: () => {
      renderer.resizeObserver.disconnect();
      renderer.controls.dispose();
      renderer.renderer.dispose();
      renderer.mesh.geometry.dispose();
      renderer.mesh.material.dispose();
      renderer.container.innerHTML = "";
      surfaceRenderers.delete(divId);
    },
  };
};

export const updateSurfaceChart = async (
  divId: string,
  surface: SurfaceData,
  selection: SelectionState
): Promise<void> => {
  const renderer = surfaceRenderers.get(divId);
  if (!renderer) {
    await renderSurfaceChart(divId, surface, selection);
    return;
  }

  const nextGeometry = buildSurfaceGeometry(surface);
  renderer.mesh.geometry.dispose();
  renderer.mesh.geometry = nextGeometry;
  renderer.renderer.render(renderer.scene, renderer.camera);
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
