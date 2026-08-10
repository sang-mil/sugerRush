import React from 'react';
import { GameSnapshot } from '../types/game';
import { CHARACTERS } from '../game/constants';
import { Volume2, VolumeX, Pause, Sparkles, Heart } from 'lucide-react';

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
  if (!snapshot) return null;

  const { player, decayRate } = snapshot;
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

        </div>

        {/* Right Top Control Buttons */}
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

        </div>
      </div>

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

      </div>
    </div>
  );
};
