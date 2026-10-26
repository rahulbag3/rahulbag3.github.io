/**
 * scene.js — the scroll-driven 3D layer.
 *
 * This module is loaded with a dynamic `import()` only when the browser reports WebGL and
 * the connection is not a data-saver, so it costs nothing on the paths where it cannot run.
 * It renders one thing: a monochrome lattice world in the reference's slate, built from the
 * same material vocabulary (wireframe masses, fog, tiny node markers).
 *
 * Legibility contract — this is the important part:
 *   The canvas is a fixed, full-bleed backdrop, so page text is always painted on top of it.
 *   Every colour used here is therefore bounded to a luminance band that keeps the page's
 *   dark ink at 4.5:1 or better, whatever is on screen behind it. The dimmest scene colour
 *   is #7A8494 (5.0:1 against #0C1119); brighter lines only increase that contrast.
 *   That is why the lattice has no dark core, no shadows and no warm accents: the warm
 *   accent is a DOM-only token, where it can be contrast-checked as text.
 *
 * Motion contract:
 *   Scroll progress drives a camera orbit and the lattice's own drift. Every value is damped
 *   so it eases rather than snaps. With `animate: false` (reduced motion) the module paints
 *   one still frame at the requested progress and never starts a loop.
 */

import * as THREE from "../vendor/three/three.module.min.js";

/** Reference canvas colour, measured from igloo.inc (`--bgColor: #A0A5B1`). */
const BG = 0xa0a5b1;

/** Scene palette — bounded so page text keeps its contrast (see the contract above). */
const C_DIM = 0x7a8494; // terrain ridges, far geometry, 5.0:1 against --ink
const C_MID = 0x949daa; // shell geometry
const C_HI = 0xc6ccd6; // core geometry + node markers

/** Camera/object stations, keyed by document scroll progress.
 *  `fade` scales the solid's line opacity: the object is a hero at rest, and a quiet
 *  ghost once it is sitting behind body copy. */
const STATIONS = [
  { at: 0.0, orbit: -0.10, radius: 9.0, height: 2.0, lookY: 0.9, gx: 2.30, gy: -0.80, scale: 0.90, yaw: 0.0, drop: 0.0, fade: 1.0 },
  { at: 0.17, orbit: 0.55, radius: 8.2, height: 1.4, lookY: 0.55, gx: 2.70, gy: -0.40, scale: 1.05, yaw: 0.8, drop: 0.6, fade: 0.55 },
  { at: 0.34, orbit: 1.30, radius: 6.8, height: 4.4, lookY: 0.15, gx: 2.35, gy: -0.10, scale: 1.20, yaw: 1.7, drop: 1.4, fade: 0.4 },
  { at: 0.52, orbit: 2.10, radius: 9.6, height: 2.6, lookY: 0.60, gx: -2.45, gy: -0.40, scale: 0.95, yaw: 2.6, drop: 0.4, fade: 0.44 },
  { at: 0.70, orbit: 2.85, radius: 7.8, height: 1.6, lookY: 0.70, gx: -2.60, gy: -0.70, scale: 1.14, yaw: 3.4, drop: 0.9, fade: 0.4 },
  { at: 0.86, orbit: 3.55, radius: 7.0, height: 5.0, lookY: 0.35, gx: 2.40, gy: -0.20, scale: 1.30, yaw: 4.2, drop: 1.2, fade: 0.34 },
  { at: 1.0, orbit: 4.20, radius: 11.5, height: 2.2, lookY: 0.95, gx: 0.50, gy: -0.50, scale: 0.90, yaw: 5.0, drop: 0.2, fade: 0.5 },
];

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
const lerp = (a, b, t) => a + (b - a) * t;

/** Amplitudes for the terrain: a cheap layered-sine ridge field, not real noise. */
const ridged = (x, z) =>
  Math.sin(x * 0.11) * Math.cos(z * 0.14) * 3.1 +
  Math.sin(x * 0.27 + 1.7) * Math.cos(z * 0.23 - 0.4) * 1.35 +
  Math.sin(x * 0.63 - 2.1) * Math.cos(z * 0.58 + 1.1) * 0.52 +
  Math.sin(x * 1.4 + 0.6) * Math.cos(z * 1.25 - 1.9) * 0.17;

/** Deterministic hash in [-1, 1) — used to break the plane grid into irregular facets. */
const hash = (n) => ((Math.sin(n * 127.1) * 43758.5453) % 1) * 2 - 1;

/** Interpolate the station list at a given progress. */
function sample(progress) {
  const p = clamp01(progress);
  let i = 0;
  while (i < STATIONS.length - 2 && p > STATIONS[i + 1].at) i++;
  const a = STATIONS[i];
  const b = STATIONS[i + 1];
  const span = b.at - a.at || 1;
  const t = smooth(clamp01((p - a.at) / span));
  return {
    orbit: lerp(a.orbit, b.orbit, t),
    radius: lerp(a.radius, b.radius, t),
    height: lerp(a.height, b.height, t),
    lookY: lerp(a.lookY, b.lookY, t),
    gx: lerp(a.gx, b.gx, t),
    gy: lerp(a.gy, b.gy, t),
    scale: lerp(a.scale, b.scale, t),
    yaw: lerp(a.yaw, b.yaw, t),
    drop: lerp(a.drop, b.drop, t),
    fade: lerp(a.fade, b.fade, t),
  };
}

/** Wireframe a throwaway geometry and release the original. */
function wire(source, material) {
  const edges = new THREE.WireframeGeometry(source);
  source.dispose();
  return new THREE.LineSegments(edges, material);
}

/** Build the lattice world: one terrain field plus three nested wireframe solids. */
function buildLattice({ terrainSegments = 48 } = {}) {
  const group = new THREE.Group();

  // ── Terrain. A displaced plane, drawn only as its wireframe. The grid vertices are
  //    jittered in the horizontal plane so the triangulation comes out irregular — a
  //    regular grid reads as netting, an irregular one reads as landscape.
  const ground = new THREE.PlaneGeometry(84, 84, terrainSegments, terrainSegments);
  const pos = ground.attributes.position;
  const cell = 84 / terrainSegments;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i); // plane space: z becomes height after the rotation below
    pos.setXY(i, x + hash(i * 1.7) * cell * 0.42, z + hash(i * 3.1 + 9.4) * cell * 0.42);
    pos.setZ(i, ridged(x, z) - 3.4);
  }
  ground.rotateX(-Math.PI / 2);
  ground.computeVertexNormals();

  const terrain = wire(
    ground,
    new THREE.LineBasicMaterial({ color: C_DIM, transparent: true, opacity: 0.36, fog: true }),
  );
  terrain.name = "terrain";
  group.add(terrain);

  // ── The solid: a coarse outer shell, a dense core, and a small inner facet.
  const shell = wire(
    new THREE.IcosahedronGeometry(1.78, 0),
    new THREE.LineBasicMaterial({ color: C_MID, transparent: true, opacity: 0.75, fog: true }),
  );
  const core = wire(
    new THREE.IcosahedronGeometry(1.06, 1),
    new THREE.LineBasicMaterial({ color: C_HI, transparent: true, opacity: 0.85, fog: true }),
  );
  const facet = wire(
    new THREE.OctahedronGeometry(0.58, 0),
    new THREE.LineBasicMaterial({ color: C_HI, transparent: true, opacity: 0.6, fog: true }),
  );

  // ── Node markers on the core's vertices: the tiny "hotspot" squares.
  const markers = new THREE.Points(
    new THREE.IcosahedronGeometry(1.06, 1),
    new THREE.PointsMaterial({ color: C_HI, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.95, fog: true }),
  );

  // ── A thin ring in the ground plane, to give the orbit something to read against.
  const ringPts = [];
  const R = 2.35;
  for (let i = 0; i < 128; i++) {
    const a0 = (i / 128) * Math.PI * 2;
    const a1 = ((i + 1) / 128) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a0) * R, 0, Math.sin(a0) * R));
    ringPts.push(new THREE.Vector3(Math.cos(a1) * R, 0, Math.sin(a1) * R));
  }
  const ring = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: C_MID, transparent: true, opacity: 0.55, fog: true }),
  );

  const solid = new THREE.Group();
  solid.add(shell, core, facet, markers, ring);
  solid.name = "solid";
  group.add(solid);

  const everything = [shell, core, facet, markers, ring, terrain];
  // Only the solid fades with scroll; the terrain keeps its own constant weight so the
  // ground plane still reads as a continuous landscape underneath the copy.
  const layers = [
    { object: shell, base: 0.75 },
    { object: core, base: 0.85 },
    { object: facet, base: 0.6 },
    { object: markers, base: 0.95 },
    { object: ring, base: 0.55 },
  ];

  return { group, solid, terrain, markers, layers, everything };
}

/**
 * Create the scene.
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {boolean} [opts.animate]  false renders a single still frame
 * @returns {{ setProgress(n:number):void, setPointer(x:number,y:number):void, resize():void, start():void, stop():void, dispose():void }}
 */
export function createScene({ canvas, animate = true }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
    stencil: false,
  });
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 8, 34);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const { group, solid, terrain, markers, layers, everything } = buildLattice();
  scene.add(group);

  let dpr = 1;
  let width = 1;
  let height = 1;
  let raf = null;
  let disposed = false;
  let clock = null;

  // Live state, and the damped values that chase it. These start at station zero so the
  // first painted frame is already in the right place.
  const want = { progress: 0, px: 0, py: 0 };
  const have = { progress: 0, px: 0, py: 0, spin: 0 };
  const cam = { orbit: -0.1, radius: 9.0, height: 2.0, lookY: 0.9 };
  const obj = { gx: 2.3, gy: -0.8, scale: 0.9, yaw: 0, drop: 0, fade: 1 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    markers.material.size = 2.4 * dpr;
    if (!animate) render(want.progress, 0);
  }

  /** Position the camera and the lattice for a given (possibly partial) interpolation. */
  function place(t, dt) {
    const s = sample(t);
    // Damping: exponential, so the smoothing is frame-rate independent.
    const k = dt ? 1 - Math.exp(-dt / 150) : 1;
    cam.orbit = lerp(cam.orbit, s.orbit, k);
    cam.radius = lerp(cam.radius, s.radius, k);
    cam.height = lerp(cam.height, s.height, k);
    cam.lookY = lerp(cam.lookY, s.lookY, k);
    obj.gx = lerp(obj.gx, s.gx, k);
    obj.gy = lerp(obj.gy, s.gy, k);
    obj.scale = lerp(obj.scale, s.scale, k);
    obj.yaw = lerp(obj.yaw, s.yaw, k);
    obj.drop = lerp(obj.drop, s.drop, k);
    obj.fade = lerp(obj.fade, s.fade, k);

    // Pointer parallax, small and damped.
    const park = dt ? 1 - Math.exp(-dt / 220) : 1;
    have.px = lerp(have.px, want.px, park);
    have.py = lerp(have.py, want.py, park);
    const px = have.px * 0.42;
    const py = have.py * 0.32;

    camera.position.set(
      Math.sin(cam.orbit) * cam.radius - px,
      cam.height - py,
      Math.cos(cam.orbit) * cam.radius,
    );
    camera.lookAt(0, cam.lookY, 0);

    // The solid is framed by the station offsets; the terrain stays near the origin and
    // drifts the other way, so the ground reads as a stable plane with real parallax depth
    // rather than sliding sideways with the object.
    group.scale.setScalar(obj.scale);
    solid.position.set(obj.gx, obj.gy, 0);
    terrain.position.set(-obj.gx * 0.32, obj.drop * -0.9, 0);

    for (const layer of layers) layer.object.material.opacity = layer.base * obj.fade;

    solid.rotation.set(-0.14 + obj.gy * 0.05, obj.yaw + have.spin, -obj.gx * 0.04);
  }

  function render(t, dt) {
    place(t, dt);
    renderer.render(scene, camera);
  }

  function loop() {
    if (disposed) return;
    const dt = Math.min(clock.getDelta() * 1000, 64);
    have.progress = lerp(have.progress, want.progress, 1 - Math.exp(-dt / 180));
    have.spin += dt * 0.00006;
    render(have.progress, dt);
    raf = requestAnimationFrame(loop);
  }

  return {
    setProgress(p) {
      want.progress = clamp01(p);
      if (!animate) render(want.progress, 0);
    },
    setPointer(nx, ny) {
      want.px = nx;
      want.py = ny;
    },
    resize,
    start() {
      if (!animate || raf != null || disposed) return;
      clock = new THREE.Clock();
      have.progress = want.progress;
      raf = requestAnimationFrame(loop);
    },
    stop() {
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
    },
    dispose() {
      disposed = true;
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      for (const node of everything) {
        node.geometry?.dispose?.();
        node.material?.dispose?.();
      }
      renderer.dispose();
    },
  };
}
