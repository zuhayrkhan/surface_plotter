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
  axesGroup: THREE.Group;
  container: HTMLElement;
  animationFrameId: number;
};

const surfaceRenderers = new Map<string, SurfaceRenderer>();

type SurfaceBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
};

type SurfaceGeometryData = {
  geometry: THREE.BufferGeometry;
  bounds: SurfaceBounds;
  center: THREE.Vector3;
};

const Z_SCALE = 15;

const computeSurfaceBounds = (surface: SurfaceData): SurfaceBounds => {
  const zValues = surface.zValues.flat();
  const zMin = Math.min(...zValues);
  const zMax = Math.max(...zValues);

  return {
    xMin: Math.min(...surface.xValues),
    xMax: Math.max(...surface.xValues),
    yMin: Math.min(...surface.yValues),
    yMax: Math.max(...surface.yValues),
    zMin: zMin * Z_SCALE,
    zMax: zMax * Z_SCALE,
  };
};

const buildSurfaceGeometry = (surface: SurfaceData): SurfaceGeometryData => {
  const rows = surface.yValues.length;
  const cols = surface.xValues.length;
  const vertexCount = rows * cols;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const rawZValues = surface.zValues.flat();
  const rawZMin = Math.min(...rawZValues);
  const rawZMax = Math.max(...rawZValues);
  const range = rawZMax - rawZMin || 1;

  const bounds = computeSurfaceBounds(surface);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x;
      const positionOffset = index * 3;
      const zValue = surface.zValues[y][x];
      positions[positionOffset] = surface.xValues[x];
      positions[positionOffset + 1] = surface.yValues[y];
      positions[positionOffset + 2] = zValue * Z_SCALE;

      const normalized = (zValue - rawZMin) / range;
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
  const center = new THREE.Vector3(
    (bounds.xMin + bounds.xMax) / 2,
    (bounds.yMin + bounds.yMax) / 2,
    (bounds.zMin + bounds.zMax) / 2
  );
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeBoundingBox();

  return { geometry, bounds, center };
};

const createTextSprite = (label: string, color: string, fontSize = 20) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Sprite();
  }
  context.font = `${fontSize}px sans-serif`;
  const padding = 8;
  const metrics = context.measureText(label);
  const textWidth = Math.ceil(metrics.width);
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + padding * 2;
  context.font = `${fontSize}px sans-serif`;
  context.fillStyle = color;
  context.textBaseline = "middle";
  context.fillText(label, padding, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  const scale = 0.02;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
  return sprite;
};

const buildAxesGroup = (
  bounds: SurfaceBounds,
  center: THREE.Vector3,
  surface: SurfaceData
) => {
  const group = new THREE.Group();
  group.name = "axes";
  const axisColors = {
    x: "#f87171",
    y: "#4ade80",
    z: "#60a5fa",
  };

  const origin = new THREE.Vector3(bounds.xMin, bounds.yMin, bounds.zMin).sub(
    center
  );
  const xEnd = new THREE.Vector3(bounds.xMax, bounds.yMin, bounds.zMin).sub(
    center
  );
  const yEnd = new THREE.Vector3(bounds.xMin, bounds.yMax, bounds.zMin).sub(
    center
  );
  const zEnd = new THREE.Vector3(bounds.xMin, bounds.yMin, bounds.zMax).sub(
    center
  );

  const lineForPoints = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: string
  ) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geometry, material);
  };

  group.add(lineForPoints(origin, xEnd, axisColors.x));
  group.add(lineForPoints(origin, yEnd, axisColors.y));
  group.add(lineForPoints(origin, zEnd, axisColors.z));

  const xTickCount = surface.xValues.length;
  const yTickCount = surface.yValues.length;
  const zTickCount = 4;

  const tickSize = Math.max(
    (bounds.xMax - bounds.xMin) * 0.02,
    (bounds.yMax - bounds.yMin) * 0.02,
    (bounds.zMax - bounds.zMin) * 0.02
  );

  const formatTickLabel = (value: number) => {
    const rounded = Number(value.toFixed(2));
    return rounded.toString();
  };

  const addTicks = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    axis: "x" | "y" | "z"
  ) => {
    const delta = new THREE.Vector3().subVectors(end, start);
    const count = axis === "x" ? xTickCount : axis === "y" ? yTickCount : zTickCount;
    const step = delta.clone().divideScalar(count - 1 || 1);

    for (let i = 0; i < count; i += 1) {
      const tickStart = new THREE.Vector3()
        .copy(start)
        .add(step.clone().multiplyScalar(i));
      const tickEnd = tickStart.clone();
      if (axis === "x") {
        tickEnd.y -= tickSize;
      } else if (axis === "y") {
        tickEnd.x -= tickSize;
      } else {
        tickEnd.x -= tickSize;
      }
      group.add(lineForPoints(tickStart, tickEnd, axisColors[axis]));

      let label = "";
      if (axis === "x") {
        label = surface.strikeLabels[i];
      } else if (axis === "y") {
        label = surface.expiryLabels[i];
      } else {
        const labelValue =
          (bounds.zMin + ((bounds.zMax - bounds.zMin) * i) / (count - 1 || 1)) /
          Z_SCALE;
        label = formatTickLabel(labelValue);
      }

      const tickLabel = createTextSprite(label, axisColors[axis], 14);
      if (axis === "x") {
        tickLabel.position
          .copy(tickEnd)
          .add(new THREE.Vector3(0, -tickSize * 1.5, 0));
      } else if (axis === "y") {
        tickLabel.position
          .copy(tickEnd)
          .add(new THREE.Vector3(-tickSize * 1.5, 0, 0));
      } else {
        tickLabel.position
          .copy(tickEnd)
          .add(new THREE.Vector3(-tickSize * 1.5, 0, 0));
      }
      group.add(tickLabel);
    }
  };

  addTicks(origin, xEnd, "x");
  addTicks(origin, yEnd, "y");
  addTicks(origin, zEnd, "z");

  const labelOffset = tickSize * 2;
  const xLabel = createTextSprite("Strike", axisColors.x, 16);
  xLabel.position.copy(xEnd).add(new THREE.Vector3(labelOffset, 0, 0));
  group.add(xLabel);

  const yLabel = createTextSprite("Expiry", axisColors.y, 16);
  yLabel.position.copy(yEnd).add(new THREE.Vector3(0, labelOffset, 0));
  group.add(yLabel);

  const zLabel = createTextSprite("Value", axisColors.z, 16);
  zLabel.position.copy(zEnd).add(new THREE.Vector3(0, 0, labelOffset));
  group.add(zLabel);

  return group;
};

const disposeAxesGroup = (group: THREE.Group) => {
  group.traverse((child) => {
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material as THREE.Material;
      material.dispose();
    }
    if (child instanceof THREE.Sprite) {
      const material = child.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
    }
  });
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
  camera.up.set(0, 0, 1);
  camera.position.set(15, -20, 12);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 1.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;
  controls.screenSpacePanning = true;

  // Map mouse buttons to allow rotation with right-click/two-finger drag
  // THREE.MOUSE.ROTATE is 0 (left), THREE.MOUSE.PAN is 2 (right), THREE.MOUSE.DOLLY is 1 (middle)
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  // Map touch actions to allow rotation with two-finger drag
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.ROTATE,
  };

  // Explicitly listen to wheel events for horizontal scrolling
  const onWheel = (event: WheelEvent) => {
    // If there is significant horizontal delta and it's not mostly vertical
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      // Manually rotate the camera horizontally
      // OrbitControls.rotateLeft rotates around the 'up' axis (now Z)
      const rotateAngle =
        2 * Math.PI * (event.deltaX / container.clientWidth) * controls.rotateSpeed;
      controls.rotateLeft(rotateAngle);
    }
  };
  renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

  // Ensure vertical rotation is not restricted
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;

  const { geometry, bounds, center } = buildSurfaceGeometry(surface);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.45,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  const axesGroup = buildAxesGroup(bounds, center, surface);
  scene.add(axesGroup);

  scene.add(new THREE.AmbientLight("#ffffff", 0.6));
  const directionalLight = new THREE.DirectionalLight("#ffffff", 0.6);
  directionalLight.position.set(15, -15, 25);
  scene.add(directionalLight);

  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  let animationFrameId: number;
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const resizeObserver = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  renderer.render(scene, camera);

  return {
    renderer,
    scene,
    camera,
    controls,
    mesh,
    axesGroup,
    container,
    resizeObserver,
    animationFrameId,
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
    cancelAnimationFrame(existing.animationFrameId);
    existing.resizeObserver.disconnect();
    existing.controls.dispose();
    existing.renderer.dispose();
    disposeAxesGroup(existing.axesGroup);
    existing.container.innerHTML = "";
    surfaceRenderers.delete(divId);
  }

  const renderer = createSurfaceRenderer(container, surface);
  surfaceRenderers.set(divId, renderer);

  return {
    dispose: () => {
      cancelAnimationFrame(renderer.animationFrameId);
      renderer.resizeObserver.disconnect();
      renderer.controls.dispose();
      renderer.renderer.dispose();
      renderer.mesh.geometry.dispose();
      renderer.mesh.material.dispose();
      disposeAxesGroup(renderer.axesGroup);
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

  const { geometry: nextGeometry, bounds, center } = buildSurfaceGeometry(surface);
  renderer.mesh.geometry.dispose();
  renderer.mesh.geometry = nextGeometry;
  renderer.scene.remove(renderer.axesGroup);
  disposeAxesGroup(renderer.axesGroup);
  renderer.axesGroup = buildAxesGroup(bounds, center, surface);
  renderer.scene.add(renderer.axesGroup);
  // Manual render is not strictly necessary due to animate loop, but helps immediate feedback
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
  const host = (await Plotly.newPlot(divId, [buildSliceTrace(slice, lineColor)], buildSliceLayout(slice, axisTitle), {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  })) as PlotlyHost;
  return host;
};

export const updateSliceChart = async (
  divId: string,
  slice: SliceData,
  axisTitle: string,
  lineColor: string
) => {
  await Plotly.react(divId, [buildSliceTrace(slice, lineColor)], buildSliceLayout(slice, axisTitle), {
    responsive: true,
    displayModeBar: true,
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
