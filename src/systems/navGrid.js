// Shadow Strike: Last Stand - grid navigation built from the static colliders.
// A* with octile distance, then string-pulled with grid line-of-sight so
// soldiers walk straight lines between corners instead of zig-zagging.
import * as THREE from 'three';
import { collisionWorld } from './collisionWorld';

class NavGrid {
  constructor() {
    this.ready = false;
  }

  build({ minX, maxX, minZ, maxZ, cell = 1, agentRadius = 0.45 }) {
    this.minX = minX; this.minZ = minZ; this.cell = cell;
    this.cols = Math.ceil((maxX - minX) / cell);
    this.rows = Math.ceil((maxZ - minZ) / cell);
    const size = this.cols * this.rows;
    this.blocked = new Uint8Array(size);
    // Cover value per cell: tallest nearby obstacle (cm) for AI cover picking.
    this.cover = new Uint16Array(size);
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const x = minX + (c + 0.5) * cell; const z = minZ + (r + 0.5) * cell;
        const index = r * this.cols + c;
        this.blocked[index] = collisionWorld.blocksCircle(x, z, agentRadius) ? 1 : 0;
        if (!this.blocked[index]) this.cover[index] = Math.round(collisionWorld.obstacleHeightNear(x, z, agentRadius + 0.75) * 100);
      }
    }
    this.gScore = new Float32Array(size);
    this.parent = new Int32Array(size);
    this.state = new Uint32Array(size);
    this.search = 1;
    this.heap = new MinHeap(size);
    this.ready = true;
    this.version = collisionWorld.version;
  }

  index(x, z) {
    const c = Math.floor((x - this.minX) / this.cell); const r = Math.floor((z - this.minZ) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  center(index, target = new THREE.Vector3()) {
    const c = index % this.cols; const r = Math.floor(index / this.cols);
    return target.set(this.minX + (c + 0.5) * this.cell, 0, this.minZ + (r + 0.5) * this.cell);
  }

  walkable(index) { return index >= 0 && !this.blocked[index]; }

  isWalkable(x, z) { return this.walkable(this.index(x, z)); }

  /** Nearest walkable cell to (x, z) within a few rings. */
  nearestWalkable(x, z, maxRings = 6) {
    const start = this.index(x, z);
    if (this.walkable(start)) return start;
    const c0 = Math.floor((x - this.minX) / this.cell); const r0 = Math.floor((z - this.minZ) / this.cell);
    for (let ring = 1; ring <= maxRings; ring += 1) {
      let best = -1; let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr += 1) {
        for (let dc = -ring; dc <= ring; dc += 1) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = c0 + dc; const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const i = r * this.cols + c;
          if (this.blocked[i]) continue;
          const d = dc * dc + dr * dr;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Grid ray: true when every cell along the segment is walkable. */
  clearLine(ax, az, bx, bz) {
    const dx = bx - ax; const dz = bz - az;
    const length = Math.hypot(dx, dz);
    const steps = Math.ceil(length / (this.cell * 0.35));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      if (!this.walkable(this.index(ax + dx * t, az + dz * t))) return false;
    }
    return true;
  }

  findPath(from, to, maxExpanded = 9000) {
    if (!this.ready) return null;
    const start = this.nearestWalkable(from.x, from.z);
    const goal = this.nearestWalkable(to.x, to.z);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [this.center(goal)];
    const { cols, gScore, parent, state, heap } = this;
    this.search += 2;
    const open = this.search; const closed = this.search + 1;
    const gc = goal % cols; const gr = Math.floor(goal / cols);
    const h = (i) => {
      const dc = Math.abs((i % cols) - gc); const dr = Math.abs(Math.floor(i / cols) - gr);
      return (dc + dr) + (Math.SQRT2 - 2) * Math.min(dc, dr);
    };
    heap.clear();
    gScore[start] = 0; parent[start] = -1; state[start] = open;
    heap.push(start, h(start));
    let expanded = 0; let found = false;
    while (heap.size) {
      const current = heap.pop();
      if (state[current] === closed) continue;
      state[current] = closed;
      if (current === goal) { found = true; break; }
      if ((expanded += 1) > maxExpanded) break;
      const c = current % cols; const r = Math.floor(current / cols);
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const nc = c + dc; const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
          const n = nr * cols + nc;
          if (this.blocked[n] || state[n] === closed) continue;
          // No corner cutting.
          if (dr && dc && (this.blocked[r * cols + nc] || this.blocked[nr * cols + c])) continue;
          const g = gScore[current] + (dr && dc ? Math.SQRT2 : 1);
          if (state[n] === open && g >= gScore[n]) continue;
          gScore[n] = g; parent[n] = current; state[n] = open;
          heap.push(n, g + h(n));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i >= 0; i = parent[i]) cells.push(i);
    cells.reverse();
    // String pulling.
    const points = cells.map((i) => this.center(i));
    points[0].set(from.x, 0, from.z);
    if (this.walkable(this.index(to.x, to.z))) points[points.length - 1].set(to.x, 0, to.z);
    const smooth = [points[0]];
    let anchor = 0;
    for (let i = 2; i < points.length; i += 1) {
      if (!this.clearLine(points[anchor].x, points[anchor].z, points[i].x, points[i].z)) {
        anchor = i - 1;
        smooth.push(points[anchor]);
      }
    }
    smooth.push(points[points.length - 1]);
    return smooth.slice(1);
  }
}

class MinHeap {
  constructor(capacity) {
    this.items = new Int32Array(capacity * 4);
    this.keys = new Float32Array(capacity * 4);
    this.size = 0;
  }

  clear() { this.size = 0; }

  push(item, key) {
    if (this.size >= this.items.length) return;
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.items[i] = this.items[p]; this.keys[i] = this.keys[p]; i = p;
    }
    this.items[i] = item; this.keys[i] = key;
  }

  pop() {
    const top = this.items[0];
    const lastItem = this.items[--this.size]; const lastKey = this.keys[this.size];
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= this.size) break;
      if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) child += 1;
      if (this.keys[child] >= lastKey) break;
      this.items[i] = this.items[child]; this.keys[i] = this.keys[child]; i = child;
    }
    this.items[i] = lastItem; this.keys[i] = lastKey;
    return top;
  }
}

export const navGrid = new NavGrid();
