import React from 'react';
import { Trophy, Crown, Flame } from 'lucide-react';

interface LeaderboardProps {
  topPlayers: {
    id: string;
    name: string;
    score: number;
    sugar: number;
    bounty: number;
    bountyTier?: 'NORMAL' | 'WANTED' | 'HIGH_VALUE' | 'KING';
    isPlayer: boolean;
    rank: number;
  }[];
  playerRank: number;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ topPlayers, playerRank }) => {
  return (
    <div className="bg-purple-950/80 border border-purple-500/30 rounded-2xl p-4 backdrop-blur-xl shadow-2xl w-64 md:w-72 select-none text-white">
      <div className="flex items-center justify-between border-b border-purple-500/30 pb-2 mb-3">
        <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm tracking-wider uppercase">
          <Trophy className="w-4 h-4" />
          <span>LEADERBOARD</span>
        </div>
        <span className="text-xs font-bold text-pink-300 bg-purple-900/60 px-2 py-0.5 rounded-full border border-purple-500/30">
          RANK #{playerRank}
        </span>
      </div>

      <div className="space-y-2 text-xs font-bold">
        {topPlayers.slice(0, 5).map((p) => {
          const tier = p.bountyTier || 'NORMAL';

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded-xl transition-all ${
                tier === 'KING'
                  ? 'bg-amber-500/30 border-2 border-amber-400 text-amber-200 shadow-lg'
                  : p.isPlayer
                  ? 'bg-gradient-to-r from-amber-500/30 to-pink-500/30 border border-amber-400/60 text-amber-300 shadow-md'
                  : 'bg-purple-900/40 text-purple-200'
              }`}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="w-4 text-center font-black text-pink-300">
                  {tier === 'KING' ? (
                    '👑'
                  ) : p.rank === 1 ? (
                    <Crown className="w-4 h-4 text-amber-400 inline" />
                  ) : (
                    `#${p.rank}`
                  )}
                </span>
                <span className="truncate">{p.name}</span>
              </div>

              <div className="text-right whitespace-nowrap">
                <span className="block font-black">{p.score.toLocaleString()}</span>
                {p.bounty > 0 && (
                  <span className="text-[10px] text-rose-400 flex items-center justify-end gap-0.5">
                    {tier === 'KING' && <span className="text-amber-400 text-[9px]">👑 KING</span>}
                    {tier === 'HIGH_VALUE' && <span className="text-pink-400 text-[9px]">🏆 HIGH</span>}
                    {tier === 'WANTED' && <Flame className="w-3 h-3 text-rose-500" />}
                    <span>${p.bounty}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
