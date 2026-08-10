import { WORLD_SIZE } from './constants';

export class Camera {
  public x: number = WORLD_SIZE / 2;
  public y: number = WORLD_SIZE / 2;
  public targetX: number = WORLD_SIZE / 2;
  public targetY: number = WORLD_SIZE / 2;
  public viewportWidth: number = 1280;
  public viewportHeight: number = 720;
  public zoom = 0.82;
  public lerpSpeed: number = 0.1; // Smooth follow speed

  constructor(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  public resize(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  public follow(targetX: number, targetY: number) {
    this.targetX = targetX;
    this.targetY = targetY;
  }

  public update() {
    // Lerp towards target
    this.x += (this.targetX - this.x) * this.lerpSpeed;
    this.y += (this.targetY - this.y) * this.lerpSpeed;

    // Clamp camera within world bounds so viewport doesn't go too far outside map
    const halfW = this.viewportWidth / (2 * this.zoom);
    const halfH = this.viewportHeight / (2 * this.zoom);

    this.x = Math.max(halfW, Math.min(this.x, WORLD_SIZE - halfW));
    this.y = Math.max(halfH, Math.min(this.y, WORLD_SIZE - halfH));
  }

  // Convert world coordinates to screen canvas coordinates
  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom + this.viewportWidth / 2,
      y: (worldY - this.y) * this.zoom + this.viewportHeight / 2
    };
  }

  // Convert screen coordinates to world coordinates
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.viewportWidth / 2) / this.zoom + this.x,
      y: (screenY - this.viewportHeight / 2) / this.zoom + this.y
    };
  }
}
