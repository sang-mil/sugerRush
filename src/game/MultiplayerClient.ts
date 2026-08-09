import { CharacterId } from '../types/game';

export interface RemotePlayerState {
  id: string;
  name: string;
  characterId: CharacterId;
  x: number;
  y: number;
  radius: number;
  hp?: number;
  maxHp?: number;
  isDead?: boolean;
}

export interface RemoteProjectileState {
  id: string;
  ownerId: string;
  characterId: CharacterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isAoE?: boolean;
  lifeRemaining?: number;
}

type PlayersHandler = (players: RemotePlayerState[]) => void;
type StatusHandler = (connected: boolean) => void;
type SelfStateHandler = (state: RemotePlayerState) => void;
type ProjectileHandler = (projectile: RemoteProjectileState) => void;

export class MultiplayerClient {
  private socket: WebSocket | null = null;
  private sendTimer: number | null = null;
  private onPlayers: PlayersHandler;
  private onStatus?: StatusHandler;
  private onSelfState?: SelfStateHandler;
  private onProjectile?: ProjectileHandler;
  private playerId: string | null = null;
  private serverUrl: string;

  private static getDefaultServerUrl() {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${hostname}:3001`;
  }

  constructor(
    onPlayers: PlayersHandler,
    onStatus?: StatusHandler,
    serverUrl = (import.meta as ImportMeta & { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL || MultiplayerClient.getDefaultServerUrl(),
    onSelfState?: SelfStateHandler,
    onProjectile?: ProjectileHandler
  ) {
    this.onPlayers = onPlayers;
    this.onStatus = onStatus;
    this.onSelfState = onSelfState;
    this.onProjectile = onProjectile;
    this.serverUrl = serverUrl;
  }

  public connect(name: string, characterId: CharacterId) {
    if (typeof WebSocket === 'undefined') return;

    this.disconnect();
    this.socket = new WebSocket(this.serverUrl);

    this.socket.addEventListener('open', () => {
      this.socket?.send(JSON.stringify({ type: 'join', name, characterId }));
      this.onStatus?.(true);
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data as string) as {
          type?: string;
          id?: string;
          players?: RemotePlayerState[];
          selfId?: string;
          projectile?: RemoteProjectileState;
        };

        if (message.type === 'welcome') {
          this.playerId = message.id || null;
        } else if (message.type === 'projectile' && message.projectile && message.projectile.ownerId !== this.playerId) {
          this.onProjectile?.(message.projectile);
        } else if (message.type === 'players' && Array.isArray(message.players)) {
          const self = message.players.find((player) => player.id === this.playerId);
          if (self) this.onSelfState?.(self);
          this.onPlayers(message.players.filter((player) => player.id !== this.playerId));
        }
      } catch {
        // Ignore malformed network messages.
      }
    });

    this.socket.addEventListener('close', () => {
      this.onStatus?.(false);
      this.socket = null;
    });

    this.socket.addEventListener('error', () => {
      this.onStatus?.(false);
    });
  }

  public sendState(state: RemotePlayerState) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.sendTimer !== null) return;

    this.sendTimer = window.setTimeout(() => {
      this.sendTimer = null;
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'state', state }));
      }
    }, 80);
  }

  public sendHit(targetId: string, damage: number) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'hit', targetId, damage }));
  }

  public sendProjectile(projectile: RemoteProjectileState) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'projectile', projectile }));
  }

  public disconnect() {
    if (this.sendTimer !== null) {
      window.clearTimeout(this.sendTimer);
      this.sendTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.playerId = null;
    this.onStatus?.(false);
  }
}
