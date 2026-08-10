import { Particle } from '../types/game';

export type ParticlePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PooledParticle extends Particle {
  active: boolean;
  priority: ParticlePriority;
}

export class ParticleSystem {
  public particles: PooledParticle[] = [];
  private pool: PooledParticle[] = [];
  private idCounter = 0;
  private readonly maxParticles = 90;

  // Adaptive Quality FPS Tracking
  private frameTimes: number[] = [];
  private frameTimeIndex = 0;
  private frameTimeTotal = 0;
  private currentFps = 60;
  public qualityLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

  constructor() {
    // Pre-allocate object pool
    for (let i = 0; i < 200; i++) {
      this.pool.push({
        id: `p_${i}`,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 5,
        color: '#FFFFFF',
        alpha: 1.0,
        life: 0,
        maxLife: 30,
        active: false,
        priority: 'LOW'
      });
    }
  }

  // Update FPS & Adaptive Quality level
  public reportFrameTime(frameDtSec: number) {
    if (frameDtSec <= 0) return;
    const instantFps = 1 / frameDtSec;
    if (this.frameTimes.length < 30) {
      this.frameTimes.push(instantFps);
      this.frameTimeTotal += instantFps;
    } else {
      this.frameTimeTotal -= this.frameTimes[this.frameTimeIndex];
      this.frameTimes[this.frameTimeIndex] = instantFps;
      this.frameTimeTotal += instantFps;
      this.frameTimeIndex = (this.frameTimeIndex + 1) % 30;
    }

    this.currentFps = Math.round(this.frameTimeTotal / this.frameTimes.length);

  }

  public getFps(): number {
    return this.currentFps;
  }

  // Fetch an available particle from pool
  private obtainParticle(): PooledParticle {
    let p = this.pool.pop();
    if (!p) {
      p = {
        id: `p_${this.idCounter++}`,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 5,
        color: '#FFFFFF',
        alpha: 1.0,
        life: 0,
        maxLife: 30,
        active: false,
        priority: 'LOW'
      };
    }
    p.active = true;
    p.text = undefined;
    return p;
  }

  // Recycle inactive particle back to pool
  private releaseParticle(p: PooledParticle) {
    p.active = false;
    p.text = undefined;
    if (this.pool.length < 250) {
      this.pool.push(p);
    }
  }

  // Spawn particle with adaptive priority filtering
  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    color: string,
    maxLife: number,
    priority: ParticlePriority,
    text?: string
  ) {
    // Drop LOW priority particles if Quality is LOW or MEDIUM
    if (priority === 'LOW' && this.qualityLevel === 'LOW') return;
    if (priority === 'MEDIUM' && this.qualityLevel === 'LOW' && Math.random() < 0.5) return;

    // Enforce max active particles cap
    if (this.particles.length >= this.maxParticles) {
      // Find oldest LOW or MEDIUM priority particle to replace
      let replaceIndex = -1;
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i].priority === 'LOW' || (priority === 'HIGH' && this.particles[i].priority === 'MEDIUM')) {
          replaceIndex = i;
          break;
        }
      }

      if (replaceIndex !== -1) {
        const oldP = this.particles[replaceIndex];
        this.releaseParticle(oldP);
        this.particles[replaceIndex] = this.particles[this.particles.length - 1];
        this.particles.pop();
      } else if (priority === 'LOW') {
        return; // Skip spawning if full of high priority
      }
    }

    const p = this.obtainParticle();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.color = color;
    p.alpha = 1.0;
    p.life = 0;
    p.maxLife = maxLife;
    p.priority = priority;
    p.text = text;

    this.particles.push(p);
  }

  // Add a spark or particle burst
  public addBurst(x: number, y: number, color: string, count = 12, speedScale = 1, priority: ParticlePriority = 'MEDIUM') {
    // Adjust particle count based on adaptive quality
    let adjustedCount = count;
    adjustedCount = Math.ceil(count * 0.6);

    for (let i = 0; i < adjustedCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 5) * speedScale;
      this.spawnParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        3 + Math.random() * 5,
        color,
        20 + Math.random() * 20,
        priority
      );
    }
  }

  // Add floating text (e.g. "-15", "+100 Sugar", "SHIELD!") - ALWAYS HIGH PRIORITY
  public addFloatingText(x: number, y: number, text: string, color: string, size = 18) {
    this.spawnParticle(
      x,
      y,
      (Math.random() - 0.5) * 1.5,
      -2.0 - Math.random() * 1.0,
      size,
      color,
      45,
      'HIGH',
      text
    );
  }

  // Add dash trail effect for Candy's Sugar Dash
  public addTrail(x: number, y: number, color: string, size: number) {
    this.spawnParticle(x, y, 0, 0, size, color, 15, 'LOW');
  }

  public update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;

      p.vx *= 0.95;
      p.vy *= 0.95;

      p.alpha = 1 - p.life / p.maxLife;

      if (p.life >= p.maxLife) {
        this.releaseParticle(p);
        // Swap with last item for fast O(1) removal without array splicing overhead
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number }) {
    ctx.save();
    for (const p of this.particles) {
      if (!p.active) continue;

      const pos = worldToScreen(p.x, p.y);

      // Skip drawing if outside screen area
      if (pos.x < -100 || pos.x > ctx.canvas.width + 100 || pos.y < -100 || pos.y > ctx.canvas.height + 100) {
        continue;
      }

      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.text) {
        ctx.save();
        ctx.translate(pos.x, pos.y);

        // Scale Pop animation: 0.7 -> 1.25 -> 1.0
        const progress = p.life / p.maxLife;
        let scale = 1.0;
        if (progress < 0.2) {
          scale = 0.7 + (progress / 0.2) * 0.55;
        } else if (progress < 0.4) {
          scale = 1.25 - ((progress - 0.2) / 0.2) * 0.25;
        }
        ctx.scale(scale, scale);

        ctx.font = `900 ${p.size}px 'Fredoka', 'Arial Black', sans-serif`;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

