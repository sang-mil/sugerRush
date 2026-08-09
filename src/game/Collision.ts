import { MapObstacle } from '../types/game';

// Check circle vs circle collision
export function checkCircleCollision(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distSq = dx * dx + dy * dy;
  const minDist = r1 + r2;
  return distSq < minDist * minDist;
}

// Get distance between two points
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// Get squared distance between two points (fast)
export function getDistanceSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

// Check circle vs axis-aligned bounding box (AABB rectangle)
export function checkCircleRectCollision(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  const dx = cx - closestX;
  const dy = cy - closestY;

  return dx * dx + dy * dy < cr * cr;
}

// Resolve entity pushing out of map obstacle rectangle
export function resolveCircleRectCollision(
  cx: number, cy: number, cr: number,
  obstacle: MapObstacle
): { x: number; y: number; collided: boolean } {
  const rx = obstacle.x;
  const ry = obstacle.y;
  const rw = obstacle.width;
  const rh = obstacle.height;

  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq < cr * cr && distSq > 0) {
    const dist = Math.sqrt(distSq);
    const overlap = cr - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    return {
      x: cx + nx * overlap,
      y: cy + ny * overlap,
      collided: true
    };
  }

  return { x: cx, y: cy, collided: false };
}

// Clamp position inside world boundaries with radius padding
export function clampToWorldBounds(x: number, y: number, radius: number, worldSize: number) {
  const min = radius + 20; // 20px border buffer
  const max = worldSize - radius - 20;
  return {
    x: Math.max(min, Math.min(x, max)),
    y: Math.max(min, Math.min(y, max))
  };
}
