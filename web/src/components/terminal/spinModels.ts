export type SpinModel = {
  verts: number[][];
  edges: [number, number][];
  cage?: { x: number; y: number; z: number };
};

function builder() {
  const verts: number[][] = [];
  const edges: [number, number][] = [];
  return {
    verts,
    edges,
    bar(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
      const b = verts.length;
      verts.push([x0, y0, z0], [x1, y1, z1]);
      edges.push([b, b + 1]);
    },
  };
}

export const JAIL_CELL: SpinModel = (() => {
  const j = builder();
  const hx = 1.0;
  const hy = 1.3;
  const hz = 1.0;
  const divisions = [-1, -0.5, 0, 0.5, 1];
  for (const y of [-hy, hy]) {
    for (const z of [-hz, hz]) {
      for (let i = 0; i < divisions.length - 1; i++) {
        j.bar(divisions[i], y, z, divisions[i + 1], y, z);
      }
    }
    for (const x of [-hx, hx]) {
      for (let i = 0; i < divisions.length - 1; i++) {
        j.bar(x, y, divisions[i], x, y, divisions[i + 1]);
      }
    }
  }
  for (const x of [-hx, hx]) {
    for (const z of [-hz, hz]) j.bar(x, -hy, z, x, hy, z);
  }
  for (const x of divisions.slice(1, -1)) {
    j.bar(x, -hy, hz, x, hy, hz);
    j.bar(x, -hy, -hz, x, hy, -hz);
  }
  for (const z of divisions.slice(1, -1)) {
    j.bar(hx, -hy, z, hx, hy, z);
    j.bar(-hx, -hy, z, -hx, hy, z);
  }
  return { verts: j.verts, edges: j.edges, cage: { x: hx, y: hy, z: hz } };
})();
