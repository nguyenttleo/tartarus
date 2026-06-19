// 3D wireframe models (vertices + edges) for the spinning ASCII graphics.
// Each is built once at module load and rendered by <AsciiSpinner/>.
// `cullFrom`: edges before this index are the frame (always drawn); edges from
// it onward are back-face culled when the spinner runs with culling.
export type SpinModel = { verts: number[][]; edges: [number, number][]; cullFrom?: number };

function builder() {
  const verts: number[][] = [];
  const edges: [number, number][] = [];
  return {
    verts,
    edges,
    box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number) {
      const b = verts.length;
      verts.push(
        [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz], [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz],
        [cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz]
      );
      edges.push(
        [b, b + 1], [b + 1, b + 2], [b + 2, b + 3], [b + 3, b],
        [b + 4, b + 5], [b + 5, b + 6], [b + 6, b + 7], [b + 7, b + 4],
        [b, b + 4], [b + 1, b + 5], [b + 2, b + 6], [b + 3, b + 7]
      );
    },
    bar(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
      const b = verts.length;
      verts.push([x0, y0, z0], [x1, y1, z1]);
      edges.push([b, b + 1]);
    },
    // A closed ring in the X/Y plane (faces the viewer).
    ringXY(cx: number, cy: number, cz: number, r: number, n: number) {
      const b = verts.length;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        verts.push([cx + r * Math.cos(t), cy + r * Math.sin(t), cz]);
      }
      for (let i = 0; i < n; i++) edges.push([b + i, b + ((i + 1) % n)]);
      return b;
    },
    // An open arc in the X/Y plane (degrees).
    arcXY(cx: number, cy: number, cz: number, r: number, a0: number, a1: number, n: number) {
      const b = verts.length;
      for (let i = 0; i < n; i++) {
        const t = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
        verts.push([cx + r * Math.cos(t), cy + r * Math.sin(t), cz]);
      }
      for (let i = 0; i < n - 1; i++) edges.push([b + i, b + i + 1]);
    },
  };
}

// A barred cell: a cuboid cage with vertical bars on every face. Rendered with
// back-face culling (cull) so only the near, camera-facing bars draw.
export const JAIL_CELL: SpinModel = (() => {
  const j = builder();
  const hx = 1.0;
  const hy = 1.3;
  const hz = 1.0;
  j.box(0, 0, 0, hx, hy, hz);
  const cullFrom = j.edges.length; // the box frame above always draws; bars below are culled
  for (const x of [-0.5, 0, 0.5]) {
    j.bar(x, -hy, hz, x, hy, hz);
    j.bar(x, -hy, -hz, x, hy, -hz);
  }
  for (const z of [-0.5, 0, 0.5]) {
    j.bar(hx, -hy, z, hx, hy, z);
    j.bar(-hx, -hy, z, -hx, hy, z);
  }
  return { verts: j.verts, edges: j.edges, cullFrom };
})();

// A magnifying glass: a flat lens (two concentric rims), a handle, and a glint.
export const MAGNIFIER: SpinModel = (() => {
  const m = builder();
  const cx = 0;
  const cy = 0.5;
  m.ringXY(cx, cy, 0, 0.85, 32);
  m.ringXY(cx, cy, 0, 0.68, 32);
  m.bar(0.52, -0.04, 0, 1.5, -1.18, 0);
  m.bar(0.68, 0.04, 0, 1.66, -1.1, 0);
  m.bar(1.5, -1.18, 0, 1.66, -1.1, 0);
  m.arcXY(cx, cy, 0, 0.5, 112, 165, 5);
  return { verts: m.verts, edges: m.edges };
})();

// A faceted gem / octahedron.
export const GEM: SpinModel = (() => {
  const g = builder();
  const b = g.verts.length;
  g.verts.push([0, 1.2, 0], [0, -1.2, 0], [1.1, 0, 0], [-1.1, 0, 0], [0, 0, 1.1], [0, 0, -1.1]);
  const top = b;
  const bottom = b + 1;
  const ring = [b + 2, b + 4, b + 3, b + 5];
  for (const e of ring) {
    g.edges.push([top, e]);
    g.edges.push([bottom, e]);
  }
  for (let i = 0; i < 4; i++) g.edges.push([ring[i], ring[(i + 1) % 4]]);
  return { verts: g.verts, edges: g.edges };
})();
