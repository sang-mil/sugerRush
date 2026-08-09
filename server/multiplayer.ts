import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const port = Number(process.env.PORT || process.env.WS_PORT || 3001);
const worldSize = 3000;
const validCharacters = new Set(['cookie', 'candy', 'pudding', 'donut']);

type PlayerState = {
  id: string;
  name: string;
  characterId: 'cookie' | 'candy' | 'pudding' | 'donut';
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  isDead: boolean;
};

type ClientMessage =
  | { type: 'join'; name?: unknown; characterId?: unknown }
  | { type: 'state'; state?: Partial<PlayerState> }
  | { type: 'hit'; targetId?: unknown; damage?: unknown }
  | { type: 'projectile'; projectile?: Record<string, unknown> };

const players = new Map<WebSocket, PlayerState>();
const server = new WebSocketServer({ port });

function broadcastPlayers() {
  const payload = JSON.stringify({ type: 'players', players: [...players.values()] });
  for (const client of players.keys()) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

function broadcastProjectile(source: WebSocket, projectile: Record<string, unknown>, ownerId: string) {
  const characterId = validCharacters.has(String(projectile.characterId))
    ? String(projectile.characterId)
    : 'cookie';
  const safeProjectile = {
    id: `remote_projectile_${randomUUID()}`,
    ownerId,
    characterId,
    x: sanitizeNumber(projectile.x, 0, 0, worldSize),
    y: sanitizeNumber(projectile.y, 0, 0, worldSize),
    vx: sanitizeNumber(projectile.vx, 0, -30, 30),
    vy: sanitizeNumber(projectile.vy, 0, -30, 30),
    radius: sanitizeNumber(projectile.radius, 9, 2, 40),
    color: typeof projectile.color === 'string' ? projectile.color.slice(0, 20) : '#FFFFFF',
    isAoE: Boolean(projectile.isAoE)
  };
  const payload = JSON.stringify({ type: 'projectile', projectile: safeProjectile });
  for (const client of players.keys()) {
    if (client !== source && client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

function characterMaxHp(characterId: PlayerState['characterId']) {
  return { cookie: 180, candy: 140, pudding: 270, donut: 190 }[characterId];
}

function sanitizeName(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 12) || 'Player' : 'Player';
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

server.on('connection', (client) => {
  const id = `remote_${randomUUID()}`;

  client.on('message', (raw) => {
    if (raw.toString().length > 8192) return;

    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }

    if (message.type === 'join') {
      const characterId = validCharacters.has(String(message.characterId))
        ? String(message.characterId) as PlayerState['characterId']
        : 'cookie';
      const state: PlayerState = {
        id,
        name: sanitizeName(message.name),
        characterId,
        x: worldSize / 2,
        y: worldSize / 2,
        radius: 24,
        hp: characterMaxHp(characterId),
        maxHp: characterMaxHp(characterId),
        isDead: false
      };
      players.set(client, state);
      client.send(JSON.stringify({ type: 'welcome', id }));
      broadcastPlayers();
      return;
    }

    if (message.type === 'state') {
      const current = players.get(client);
      if (!current || !message.state) return;

      current.x = sanitizeNumber(message.state.x, current.x, 0, worldSize);
      current.y = sanitizeNumber(message.state.y, current.y, 0, worldSize);
      current.radius = sanitizeNumber(message.state.radius, current.radius, 12, 120);
      broadcastPlayers();
      return;
    }

    if (message.type === 'hit') {
      const attacker = players.get(client);
      const target = [...players.values()].find((player) => player.id === String(message.targetId));
      const damage = sanitizeNumber(message.damage, 0, 1, 100);
      if (!attacker || !target || target.id === attacker.id || target.isDead) return;

      target.hp = Math.max(0, target.hp - damage);
      target.isDead = target.hp <= 0;
      broadcastPlayers();
      return;
    }

    if (message.type === 'projectile') {
      const current = players.get(client);
      if (!current || !message.projectile) return;
      broadcastProjectile(client, message.projectile, current.id);
    }
  });

  client.on('close', () => {
    players.delete(client);
    broadcastPlayers();
  });
});

server.on('listening', () => {
  console.log(`WebSocket multiplayer server listening on ws://localhost:${port}`);
});

server.on('error', (error) => {
  console.error('WebSocket server error:', error);
});
