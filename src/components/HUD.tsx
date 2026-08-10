import React, { useEffect, useRef } from 'react';
import { GameSnapshot } from '../types/game';
import { CHARACTERS, WORLD_SIZE } from '../game/constants';
import { Leaderboard } from './Leaderboard';
import { soundManager } from '../game/audio';
import { Volume2, VolumeX, Pause, Sparkles, Flame, ShieldAlert, Heart, Radar } from 'lucide-react';

interface HUDProps {
  snapshot: GameSnapshot | null;
  onPauseToggle: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  snapshot,
  onPauseToggle,
  isAudioMuted,
  onToggleAudio
}) => {
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  // Draw Minimap
  useEffect(() => {
    if (!snapshot || !minimapRef.current) return;
    const canvas = minimapRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Map background
    ctx.fillStyle = 'rgba(23, 14, 32, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = canvas.width / WORLD_SIZE;

    // Draw Hot Zone on Minimap
    if (snapshot.hotZone) {
      const hz = snapshot.hotZone;
      const hx = hz.x * scale;
      const hy = hz.y * scale;
      const hr = hz.radius * scale;

      ctx.fillStyle = hz.isWarning ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.28)';
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = hz.isWarning ? '#EF4444' : '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw King on Minimap
    if (snapshot.kingPlayer) {
      const kx = snapshot.kingPlayer.x * scale;
      const ky = snapshot.kingPlayer.y * scale;

      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(kx, ky, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw player dot
    const p = snapshot.player;
    if (!p.isDead) {
      const px = p.x * scale;
      const py = p.y * scale;

      ctx.fillStyle = '#FDE047'; // Bright yellow
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing player ring
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }, [snapshot]);

  if (!snapshot) return null;

  const { player, topPlayers, playerRank, decayRate, dangerLevel, killEvents } = snapshot;
  const currentChar = CHARACTERS[player.characterId] || CHARACTERS.cookie;
  const cd = player.abilityCooldownRemaining;
  const cdPercent = Math.min(100, Math.max(0, (cd / currentChar.abilityCooldown) * 100));

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none p-2 sm:p-4 md:p-6 flex flex-col justify-between">
      {/* TOP HEADER ROW */}
      <div className="flex items-start justify-between w-full">
        {/* Left Stats & Kill Feed */}
        <div className="flex flex-col gap-3">
          {/* Sugar & Score Card */}
          <div className="pointer-events-auto max-w-[calc(100vw-5rem)] bg-purple-950/85 border border-purple-500/30 rounded-2xl p-2 sm:p-4 backdrop-blur-xl shadow-2xl flex flex-wrap items-center gap-2 sm:gap-6 text-white">
            <div>
              <span className="text-[10px] font-black tracking-wider text-pink-300 uppercase block">
                SUGAR COLLECTED
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-base sm:text-2xl md:text-3xl font-black text-amber-300">
                  {Math.floor(player.sugar).toLocaleString()}
                </span>
                {decayRate > 0 && (
                  <span className="text-xs font-bold text-rose-400">
                    (-{decayRate.toFixed(1)}/s)
                  </span>
                )}
              </div>
            </div>

            <div className="h-8 w-[1px] bg-purple-500/30" />

            <div>
              <span className="text-[10px] font-black tracking-wider text-pink-300 uppercase block">
                TOTAL SCORE
              </span>
                <span className="text-sm sm:text-xl md:text-2xl font-black text-white">
                {player.score.toLocaleString()}
              </span>
            </div>

            <div className="h-8 w-[1px] bg-purple-500/30" />

            <div>
              <span className="text-[10px] font-black tracking-wider text-pink-300 uppercase block">
                BOUNTY
              </span>
                <span className="text-xs sm:text-lg font-black text-rose-400">
                {player.bounty.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Kill Feed Log */}
          <div className="space-y-1.5 max-w-sm max-sm:hidden">
            {killEvents.slice(0, 3).map((k) => (
              <div
                key={k.id}
                className="bg-purple-950/70 border border-purple-500/20 px-3 py-1.5 rounded-xl backdrop-blur-md text-xs font-bold text-pink-200 flex items-center gap-2 animate-fade-in"
              >
                <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>
                  <strong className="text-amber-300">{k.killerName}</strong> defeated{' '}
                  <strong className="text-rose-300">{k.victimName}</strong> (+{k.bountyClaimed} Bounty)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Top Leaderboard & Control Buttons */}
        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={onToggleAudio}
              className="p-2.5 bg-purple-950/80 border border-purple-500/30 hover:border-pink-500/50 rounded-2xl text-pink-300 hover:text-white transition-all shadow-lg active:scale-95"
              title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isAudioMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              onClick={onPauseToggle}
              className="p-2.5 bg-purple-950/80 border border-purple-500/30 hover:border-pink-500/50 rounded-2xl text-pink-300 hover:text-white transition-all shadow-lg active:scale-95"
              title="Pause Game (ESC)"
            >
              <Pause className="w-5 h-5" />
            </button>
          </div>

            <div className="hidden sm:block">
              <Leaderboard topPlayers={topPlayers} playerRank={playerRank} />
            </div>
        </div>
      </div>

      {/* CENTER TOP MAP ANNOUNCEMENT BANNER */}
      {snapshot.activeAnnouncement && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-auto border-2 rounded-2xl px-6 py-3 backdrop-blur-xl shadow-2xl flex flex-col items-center gap-0.5 animate-bounce z-50 text-center"
          style={{
            borderColor: snapshot.activeAnnouncement.color,
            backgroundColor: 'rgba(23, 14, 32, 0.92)'
          }}
        >
          <span
            className="text-base md:text-lg font-black tracking-widest uppercase"
            style={{ color: snapshot.activeAnnouncement.color }}
          >
            {snapshot.activeAnnouncement.title}
          </span>
          <span className="text-xs font-bold text-white/90">
            {snapshot.activeAnnouncement.subtitle}
          </span>
        </div>
      )}

      {/* KING OF SUGAR BANNER */}
      {snapshot.kingPlayer && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto bg-amber-500/20 border-2 border-amber-400 rounded-full px-5 py-1.5 backdrop-blur-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2 text-amber-200 font-black text-xs tracking-wider uppercase">
          <span className="text-base">👑</span>
          <span>
            KING OF SUGAR: <strong className="text-white">{snapshot.kingPlayer.name}</strong> (${snapshot.kingPlayer.bounty})
          </span>
        </div>
      )}

      {/* CENTER TOP DANGER LEVEL WARNING */}
      {(dangerLevel === 'HIGH' || dangerLevel === 'DANGER') && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-auto bg-rose-950/80 border-2 border-rose-500 rounded-full px-6 py-2 backdrop-blur-xl shadow-[0_0_24px_rgba(239,68,68,0.5)] flex items-center gap-2 text-rose-200 font-black text-sm tracking-widest uppercase animate-pulse">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <span>
            ⚠ {dangerLevel === 'DANGER' ? 'CRITICAL HIGH VALUE TARGET!' : 'HIGH VALUE TARGET (BOUNTY HIGH)'}
          </span>
        </div>
      )}

      {/* BOTTOM CONTROLS & STATUS BAR */}
      <div className="flex items-end justify-between w-full pointer-events-auto max-sm:pb-36">
        {/* HP Bar & Ability Wheel */}
        <div className="flex items-center gap-2 sm:gap-4 bg-purple-950/85 border border-purple-500/30 rounded-2xl sm:rounded-3xl p-2 sm:p-4 backdrop-blur-xl shadow-2xl text-white max-w-[calc(100vw-8rem)]">
          {/* Ability Icon & Cooldown Wheel */}
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-purple-900/60 border-2 border-purple-500/40 flex flex-col items-center justify-center overflow-hidden shadow-lg shrink-0">
            <span className="text-xl sm:text-2xl">{currentChar.icon}</span>
            <span className="text-[8px] sm:text-[10px] font-black text-pink-300 tracking-wider">SPACE</span>

            {cd > 0 && (
              <div
                className="absolute inset-0 bg-purple-950/80 flex items-center justify-center text-amber-300 font-black text-lg backdrop-blur-xs"
                style={{ clipPath: `inset(${100 - cdPercent}% 0 0 0)` }}
              >
                {cd.toFixed(1)}s
              </div>
            )}
          </div>

          {/* Ability Text & HP Bar */}
          <div className="flex flex-col gap-1 sm:gap-1.5 w-32 sm:w-48 md:w-60">
            {/* Active Power-up Buff Badges */}
            {(player.speedBoostTimeRemaining > 0 || player.damageBoostTimeRemaining > 0 || player.powerUpShieldTimeRemaining > 0 || player.isShielded || (player.rainbowTimeRemaining && player.rainbowTimeRemaining > 0)) && (
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                {player.rainbowTimeRemaining && player.rainbowTimeRemaining > 0 && (
                  <span className="bg-purple-500/20 border border-purple-400/50 text-purple-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    🌈 Rainbow 1.5x {player.rainbowTimeRemaining.toFixed(1)}s
                  </span>
                )}
                {player.speedBoostTimeRemaining > 0 && (
                  <span className="bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    ⚡ Speed {player.speedBoostTimeRemaining.toFixed(1)}s
                  </span>
                )}
                {player.damageBoostTimeRemaining > 0 && (
                  <span className="bg-orange-500/20 border border-orange-400/50 text-orange-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    🔥 Power {player.damageBoostTimeRemaining.toFixed(1)}s
                  </span>
                )}
                {(player.powerUpShieldTimeRemaining > 0 || player.isShielded) && (
                  <span className="bg-blue-500/20 border border-blue-400/50 text-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    🛡️ Shield {Math.max(player.powerUpShieldTimeRemaining, player.shieldTimeRemaining).toFixed(1)}s
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {currentChar.abilityName}
              </span>
              <span className={cd <= 0 ? 'text-emerald-400' : 'text-pink-400'}>
                {cd <= 0 ? 'READY' : 'COOLDOWN'}
              </span>
            </div>

            {/* Health Bar */}
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold text-pink-200 mb-1">
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  HP
                </span>
                <span>
                  {Math.max(0, Math.round(player.hp))} / {player.maxHp}
                </span>
              </div>

              <div className="w-full bg-purple-900/80 h-3.5 rounded-full overflow-hidden border border-purple-500/30 p-0.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-150 shadow-md"
                  style={{ width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Right Minimap */}
        <div className="relative max-sm:hidden bg-purple-950/85 border border-purple-500/30 rounded-2xl p-2 backdrop-blur-xl shadow-2xl flex flex-col items-center">
          <div className="flex items-center gap-1 text-[10px] font-black text-pink-300 mb-1 tracking-wider uppercase">
            <Radar className="w-3 h-3 text-pink-400" />
            <span>RADAR MINIMAP</span>
          </div>
          <canvas
            ref={minimapRef}
            width={120}
            height={120}
            className="rounded-xl border border-purple-500/30"
          />
        </div>
      </div>
    </div>
  );
};
