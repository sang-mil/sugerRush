import { SugarItem, SugarType, PlayerEntity } from '../types/game';
import { WORLD_SIZE, MAX_SUGAR_ON_MAP, calculateSugarDecayRate } from './constants';
import { checkCircleCollision } from './Collision';

export class SugarManager {
  public sugars: SugarItem[] = [];
  private idCounter = 0;
  private readonly gridCellSize = 180;
  private sugarGrid = new Map<number, SugarItem[]>();
  private gridDirty = true;
  private removedSugarIds = new Set<string>();

  constructor() {
    this.seedSugar();
  }

  // Populate map with sugar
  public seedSugar() {
    this.sugars = [];
    this.removedSugarIds.clear();
    this.sugarGrid.clear();
    this.gridDirty = true;
    for (let i = 0; i < MAX_SUGAR_ON_MAP; i++) {
      this.spawnSugarItem();
    }
  }

  public spawnSugarItem(x?: number, y?: number, customType?: SugarType, customValue?: number, inHotZone = false): SugarItem {
    const rand = Math.random();
    let type: SugarType = customType || 'cube';

    if (!customType) {
      if (inHotZone) {
        // Boosted Special Sugar rates in Hot Zone
        if (rand < 0.25) type = 'cube';
        else if (rand < 0.43) type = 'candy';
        else if (rand < 0.55) type = 'donut_hole';
        else if (rand < 0.75) type = 'golden';    // 20%
        else if (rand < 0.90) type = 'rainbow';   // 15%
        else type = 'toxic';                      // 10%
      } else {
        // Standard Map rates
        if (rand < 0.60) type = 'cube';
        else if (rand < 0.80) type = 'candy';
        else if (rand < 0.90) type = 'donut_hole';
        else if (rand < 0.95) type = 'golden';    // 5%
        else if (rand < 0.98) type = 'rainbow';   // 3%
        else type = 'toxic';                      // 2%
      }
    }

    let value = customValue || 1;
    let scoreValue = 10;
    let color = '#F472B6'; // Pink
    let radius = 8;

    if (type === 'cube') {
      value = customValue || 1;
      scoreValue = 10;
      color = '#FCE7F3'; // Light sugar cube white-pink
      radius = 7;
    } else if (type === 'candy') {
      value = customValue || 3;
      scoreValue = 30;
      color = '#EC4899';
      radius = 9;
    } else if (type === 'donut_hole') {
      value = customValue || 5;
      scoreValue = 50;
      color = '#FB923C'; // Orange glaze
      radius = 11;
    } else if (type === 'golden') {
      value = customValue || 100;
      scoreValue = 150;
      color = '#FBBF24'; // Golden amber
      radius = 16;
    } else if (type === 'rainbow') {
      value = customValue || 20;
      scoreValue = 50;
      color = '#A855F7'; // Purple rainbow
      radius = 14;
    } else if (type === 'toxic') {
      value = customValue || 200;
      scoreValue = 250;
      color = '#22C55E'; // Toxic green
      radius = 15;
    }

    const padding = 100;
    const item: SugarItem = {
      id: `s_${this.idCounter++}`,
      x: x !== undefined ? x : padding + Math.random() * (WORLD_SIZE - padding * 2),
      y: y !== undefined ? y : padding + Math.random() * (WORLD_SIZE - padding * 2),
      radius,
      type,
      value,
      scoreValue,
      color,
      spawnTime: Date.now(),
      rotation: Math.random() * Math.PI * 2
    };

    this.sugars.push(item);
    this.gridDirty = true;
    return item;
  }

  // When a player dies, drop 30-50% of their sugar as pickup piles around death position
  public dropSugarOnDeath(deathX: number, deathY: number, totalSugar: number) {
    if (totalSugar <= 0) return;

    const dropAmount = Math.round(totalSugar * (0.35 + Math.random() * 0.15));
    if (dropAmount <= 0) return;

    // Distribute in a ring of sweet items
    const itemCount = Math.min(25, Math.max(5, Math.ceil(dropAmount / 10)));
    const valuePerItem = Math.max(1, Math.floor(dropAmount / itemCount));

    for (let i = 0; i < itemCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 90;
      const x = deathX + Math.cos(angle) * dist;
      const y = deathY + Math.sin(angle) * dist;

      const sugarType: SugarType = valuePerItem >= 10 ? 'golden' : valuePerItem >= 5 ? 'donut_hole' : 'candy';
      this.spawnSugarItem(x, y, sugarType, valuePerItem);
    }
  }

  // Process passive Sugar Decay for high sugar holders
  public processSugarDecay(player: PlayerEntity, deltaTimeSec: number) {
    if (player.isDead || player.sugar < 500) return 0;

    const decayPerSec = calculateSugarDecayRate(player.sugar);
    const amountLost = decayPerSec * deltaTimeSec;

    player.sugar = Math.max(0, player.sugar - amountLost);
    return decayPerSec;
  }

  // Maintain overall sugar density across world
  public maintainSugarCount() {
    this.removedSugarIds.clear();
    while (this.sugars.length < MAX_SUGAR_ON_MAP) {
      this.spawnSugarItem();
    }
  }

  private getGridKey(cellX: number, cellY: number) {
    return cellY * 32 + cellX;
  }

  private rebuildSugarGrid() {
    this.sugarGrid.clear();
    for (const sugar of this.sugars) {
      const cellX = Math.floor(sugar.x / this.gridCellSize);
      const cellY = Math.floor(sugar.y / this.gridCellSize);
      const key = this.getGridKey(cellX, cellY);
      const cell = this.sugarGrid.get(key);
      if (cell) cell.push(sugar);
      else this.sugarGrid.set(key, [sugar]);
    }
    this.gridDirty = false;
  }

  // Check collision with player
  public collectSugarForPlayer(player: PlayerEntity, onCollect: (sugar: SugarItem) => void) {
    if (player.isDead) return;

    const px = player.x;
    const py = player.y;
    const pr = player.radius;
    if (this.gridDirty) this.rebuildSugarGrid();

    const searchRadius = pr + 16;
    const minCellX = Math.floor((px - searchRadius) / this.gridCellSize);
    const maxCellX = Math.floor((px + searchRadius) / this.gridCellSize);
    const minCellY = Math.floor((py - searchRadius) / this.gridCellSize);
    const maxCellY = Math.floor((py + searchRadius) / this.gridCellSize);

    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const cell = this.sugarGrid.get(this.getGridKey(cellX, cellY));
        if (!cell) continue;

        for (const sugar of cell) {
          if (this.removedSugarIds.has(sugar.id)) continue;
          const maxDist = pr + sugar.radius;

          if (Math.abs(px - sugar.x) > maxDist || Math.abs(py - sugar.y) > maxDist) continue;

          if (checkCircleCollision(px, py, pr, sugar.x, sugar.y, sugar.radius)) {
            onCollect(sugar);
            this.removedSugarIds.add(sugar.id);
            const index = this.sugars.indexOf(sugar);
            if (index !== -1) {
              this.sugars[index] = this.sugars[this.sugars.length - 1];
              this.sugars.pop();
            }
          }
        }
      }
    }
  }

  // Render sugar items on Canvas
  public draw(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, y: number) => { x: number; y: number }, time: number) {
    ctx.save();
    for (const s of this.sugars) {
      const pos = worldToScreen(s.x, s.y);

      // Viewport frustum culling
      if (pos.x < -30 || pos.x > ctx.canvas.width + 30 || pos.y < -30 || pos.y > ctx.canvas.height + 30) {
        continue;
      }

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Gentle floating animation
      const floatY = Math.sin((time * 0.003) + s.rotation) * 3;
      ctx.translate(0, floatY);

      if (s.type === 'cube') {
        ctx.fillStyle = s.color;
        ctx.strokeStyle = '#F472B6';
        ctx.lineWidth = 1.5;
        const side = s.radius * 1.5;
        ctx.fillRect(-side / 2, -side / 2, side, side);
        ctx.strokeRect(-side / 2, -side / 2, side, side);
      } else if (s.type === 'golden') {
        // Glowing Golden Star Coin
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 14;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFBEB';
        ctx.font = "bold 13px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🟡', 0, 1);
      } else if (s.type === 'rainbow') {
        // Shimmering Rainbow Aura Ring
        const hue = (time * 0.15 + s.x) % 360;
        ctx.shadowColor = `hsl(${hue}, 90%, 65%)`;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(168, 85, 247, 0.85)';
        ctx.beginPath();
        ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "12px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌈', 0, 1);
      } else if (s.type === 'toxic') {
        // Toxic Green/Purple Danger Biohazard
        ctx.shadowColor = '#22C55E';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#15803D';
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "12px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠️', 0, 1);
      } else {
        // Candy or donut hole circle
        ctx.fillStyle = s.color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
  }
}
