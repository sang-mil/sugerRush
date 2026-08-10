import { PlayerEntity, SugarItem, PowerUpItem, HotZoneState } from '../types/game';
import { getDistance, getDistanceSq } from './Collision';
import { COMBAT_CONFIG } from './constants';

export interface BotDecisionState {
  nextDecisionTime: number;
  targetMoveX: number;
  targetMoveY: number;
  attackTargetPlayer: PlayerEntity | null;
  nearestPlayerDist: number;
  isTacticalCombatMove: boolean;
}

const botDecisionMap = new Map<string, BotDecisionState>();

export class BotAI {
  // Clear cache on game reset
  public static resetCache() {
    botDecisionMap.clear();
  }

  // Compute movement direction & trigger attack/ability for a bot player
  public static updateBot(
    bot: PlayerEntity,
    allPlayers: PlayerEntity[],
    sugars: SugarItem[],
    powerUps: PowerUpItem[],
    hotZone: HotZoneState | null,
    kingId: string | null,
    onAttack: (bot: PlayerEntity, targetX: number, targetY: number, chargeTimeSeconds?: number) => void,
    onAbility: (bot: PlayerEntity) => void
  ) {
    if (bot.isDead) return;

    const now = performance.now();
    const botPersonality = bot.personality || 'balanced';
    const hpRatio = bot.hp / bot.maxHp;

    // Get or initialize decision cache for this bot
    let decision = botDecisionMap.get(bot.id);
    if (!decision) {
      decision = {
        nextDecisionTime: now + Math.random() * 80,
        targetMoveX: bot.x,
        targetMoveY: bot.y,
        attackTargetPlayer: null,
        nearestPlayerDist: Infinity,
        isTacticalCombatMove: false
      };
      botDecisionMap.set(bot.id, decision);
    }

    const otherPlayers = allPlayers;

    // AI DECISION STEP: Run AI planning every ~70-90ms (staggered) instead of 60 FPS
    if (now >= decision.nextDecisionTime) {
      decision.nextDecisionTime = now + 70 + Math.random() * 30;

      // Find nearest player & distance
      let nearestPlayer: PlayerEntity | null = null;
      let nearestPlayerDistSq = Infinity;

      for (const p of otherPlayers) {
        if (p.id === bot.id || p.isDead) continue;
        const dSq = getDistanceSq(bot.x, bot.y, p.x, p.y);
        if (dSq < nearestPlayerDistSq) {
          nearestPlayerDistSq = dSq;
          nearestPlayer = p;
        }
      }
      const nearestPlayerDist = Math.sqrt(nearestPlayerDistSq);
      decision.nearestPlayerDist = nearestPlayerDist;

      // Find best sugar based on type score & distance
      let nearestSugar: SugarItem | null = null;
      let bestSugarScore = -Infinity;
      const sugarSampleLimit = Math.min(sugars.length, 50);

      for (let i = 0; i < sugarSampleLimit; i++) {
        const s = sugars[i];
        const dSq = getDistanceSq(bot.x, bot.y, s.x, s.y);
        if (dSq > 640000) continue; // > 800px range

        const d = Math.sqrt(dSq);
        let typeBonus = 0;
        if (s.type === 'golden') typeBonus = 800;
        else if (s.type === 'rainbow') typeBonus = 600;
        else if (s.type === 'toxic') {
          typeBonus = hpRatio > 0.5 && botPersonality !== 'coward' ? 400 : -1000;
        } else if (s.type === 'donut_hole') typeBonus = 150;
        else if (s.type === 'candy') typeBonus = 80;

        const score = typeBonus - d;
        if (score > bestSugarScore) {
          bestSugarScore = score;
          nearestSugar = s;
        }
      }

      // Find best power-up for this bot
      let bestPowerUp: PowerUpItem | null = null;
      let bestPowerUpScore = -Infinity;

      for (const pu of powerUps) {
        const distSq = getDistanceSq(bot.x, bot.y, pu.x, pu.y);
        if (distSq > 490000) continue; // Out of 700px perception range

        const dist = Math.sqrt(distSq);
        let typeScore = 0;
        switch (pu.type) {
          case 'heal':
            typeScore = hpRatio < 0.5 ? 800 - hpRatio * 600 : 150;
            break;
          case 'shield':
            typeScore = (nearestPlayerDist < 350 ? 500 : 200) + (1 - hpRatio) * 300;
            break;
          case 'speed':
            typeScore = botPersonality === 'hunter' || botPersonality === 'coward' ? 350 : 200;
            break;
          case 'damage':
            typeScore = botPersonality === 'hunter' || botPersonality === 'aggressive' ? 450 : 220;
            break;
        }

        if (botPersonality === 'collector' && pu.type === 'heal' && hpRatio < 0.6) typeScore += 300;
        if (botPersonality === 'coward' && (pu.type === 'heal' || pu.type === 'shield')) typeScore += 350;
        if (botPersonality === 'hunter' && (pu.type === 'damage' || pu.type === 'speed')) typeScore += 300;

        const score = typeScore - dist;
        if (score > bestPowerUpScore) {
          bestPowerUpScore = score;
          bestPowerUp = pu;
        }
      }

      let targetMoveX = bot.x;
      let targetMoveY = bot.y;
      let attackTargetPlayer: PlayerEntity | null = null;
      let isTacticalCombatMove = false;

      // Hot Zone danger / opportunity evaluation
      let hotZoneDistSq = Infinity;
      if (hotZone) {
        hotZoneDistSq = getDistanceSq(bot.x, bot.y, hotZone.x, hotZone.y);
      }

      const isInsideHotZone = hotZone && hotZoneDistSq < hotZone.radius * hotZone.radius;
      const shouldAvoidHotZone = isInsideHotZone && (hpRatio < 0.45 || botPersonality === 'coward');

      if (shouldAvoidHotZone && hotZone) {
        const escapeAngle = Math.atan2(bot.y - hotZone.y, bot.x - hotZone.x);
        targetMoveX = hotZone.x + Math.cos(escapeAngle) * (hotZone.radius + 150);
        targetMoveY = hotZone.y + Math.sin(escapeAngle) * (hotZone.radius + 150);
      } else {
        switch (botPersonality) {
          case 'coward': {
            if (nearestPlayer && (nearestPlayerDist < 350 || hpRatio < 0.4)) {
              const dx = bot.x - nearestPlayer.x;
              const dy = bot.y - nearestPlayer.y;
              targetMoveX = bot.x + dx;
              targetMoveY = bot.y + dy;
              isTacticalCombatMove = true;
              if (nearestPlayerDist <= bot.attackRange) {
                attackTargetPlayer = nearestPlayer;
              }
            } else if (bestPowerUp && bestPowerUpScore > 100) {
              targetMoveX = bestPowerUp.x;
              targetMoveY = bestPowerUp.y;
            } else if (nearestSugar) {
              targetMoveX = nearestSugar.x;
              targetMoveY = nearestSugar.y;
            }
            break;
          }

          case 'hunter': {
            let primeTarget: PlayerEntity | null = null;
            let primeScore = -Infinity;

            for (const p of otherPlayers) {
              if (p.id === bot.id || p.isDead) continue;
              const distSq = getDistanceSq(bot.x, bot.y, p.x, p.y);
              if (distSq < 490000) {
                const dist = Math.sqrt(distSq);
                const targetHpRatio = 1 - p.hp / p.maxHp;
                const isKing = kingId === p.id;
                const score = p.bounty * (isKing ? 1.5 : 0.8) + targetHpRatio * 500 - dist;
                if (score > primeScore) {
                  primeScore = score;
                  primeTarget = p;
                }
              }
            }

            if (bestPowerUp && (bestPowerUp.type === 'damage' || bestPowerUp.type === 'speed' || (bestPowerUp.type === 'heal' && hpRatio < 0.5)) && bestPowerUpScore > 150) {
              targetMoveX = bestPowerUp.x;
              targetMoveY = bestPowerUp.y;
            } else if (primeTarget) {
              attackTargetPlayer = primeTarget;
              isTacticalCombatMove = true;
            } else if (hotZone && hotZoneDistSq > 10000 && hpRatio > 0.6) {
              targetMoveX = hotZone.x;
              targetMoveY = hotZone.y;
            } else if (nearestSugar) {
              targetMoveX = nearestSugar.x;
              targetMoveY = nearestSugar.y;
            }
            break;
          }

          case 'aggressive': {
            if (nearestPlayer && nearestPlayerDist < 500) {
              attackTargetPlayer = nearestPlayer;
              isTacticalCombatMove = true;
            } else if (bestPowerUp && bestPowerUpScore > 120) {
              targetMoveX = bestPowerUp.x;
              targetMoveY = bestPowerUp.y;
            } else if (nearestSugar) {
              targetMoveX = nearestSugar.x;
              targetMoveY = nearestSugar.y;
            }
            break;
          }

          case 'collector': {
            if (bestPowerUp && (bestPowerUp.type === 'heal' || hpRatio < 0.7) && bestPowerUpScore > 100) {
              targetMoveX = bestPowerUp.x;
              targetMoveY = bestPowerUp.y;
            } else if (hotZone && hotZoneDistSq > 6400 && hpRatio > 0.55 && !isInsideHotZone) {
              targetMoveX = hotZone.x;
              targetMoveY = hotZone.y;
            } else if (nearestPlayer && nearestPlayerDist < 180 && hpRatio < 0.8) {
              const dx = bot.x - nearestPlayer.x;
              const dy = bot.y - nearestPlayer.y;
              targetMoveX = bot.x + dx;
              targetMoveY = bot.y + dy;
              isTacticalCombatMove = true;
              if (nearestPlayerDist <= bot.attackRange) {
                attackTargetPlayer = nearestPlayer;
              }
            } else if (nearestSugar) {
              targetMoveX = nearestSugar.x;
              targetMoveY = nearestSugar.y;
            }
            break;
          }

          case 'balanced':
          default: {
            if (bestPowerUp && (hpRatio < 0.5 || bestPowerUp.type === 'heal' || bestPowerUp.type === 'shield') && bestPowerUpScore > 150) {
              targetMoveX = bestPowerUp.x;
              targetMoveY = bestPowerUp.y;
            } else if (nearestPlayer && nearestPlayerDist < 350 && hpRatio > 0.35) {
              attackTargetPlayer = nearestPlayer;
              isTacticalCombatMove = true;
            } else if (nearestSugar) {
              targetMoveX = nearestSugar.x;
              targetMoveY = nearestSugar.y;
            }
            break;
          }
        }
      }

      decision.targetMoveX = targetMoveX;
      decision.targetMoveY = targetMoveY;
      decision.attackTargetPlayer = attackTargetPlayer;
      decision.isTacticalCombatMove = isTacticalCombatMove;
    }

    // 60 FPS MOVEMENT STEP
    let { targetMoveX, targetMoveY, attackTargetPlayer, isTacticalCombatMove } = decision;
    const prefCombatDist = COMBAT_CONFIG.preferredCombatDistance[bot.characterId] ?? 180;

    if (isTacticalCombatMove && attackTargetPlayer && !attackTargetPlayer.isDead) {
      const dist = getDistance(bot.x, bot.y, attackTargetPlayer.x, attackTargetPlayer.y);
      const minRetreatDist = prefCombatDist * 0.7;

      if (dist < minRetreatDist) {
        const retreatAngle = Math.atan2(bot.y - attackTargetPlayer.y, bot.x - attackTargetPlayer.x);
        targetMoveX = bot.x + Math.cos(retreatAngle) * 200;
        targetMoveY = bot.y + Math.sin(retreatAngle) * 200;
      } else if (dist <= bot.attackRange && dist >= minRetreatDist && dist <= prefCombatDist + 40) {
        targetMoveX = bot.x;
        targetMoveY = bot.y;
      } else {
        const approachAngle = Math.atan2(attackTargetPlayer.y - bot.y, attackTargetPlayer.x - bot.x);
        targetMoveX = attackTargetPlayer.x - Math.cos(approachAngle) * prefCombatDist;
        targetMoveY = attackTargetPlayer.y - Math.sin(approachAngle) * prefCombatDist;
      }
    }

    const dx = targetMoveX - bot.x;
    const dy = targetMoveY - bot.y;
    const distToMoveSq = dx * dx + dy * dy;

    const effectiveSpeed = bot.speedBoostTimeRemaining > 0 ? bot.speed * 1.3 : bot.speed;

    let moveVx = 0;
    let moveVy = 0;

    if (distToMoveSq > 64) {
      const distToMove = Math.sqrt(distToMoveSq);
      moveVx = (dx / distToMove) * effectiveSpeed;
      moveVy = (dy / distToMove) * effectiveSpeed;
      bot.facingAngle = Math.atan2(dy, dx);
    }

    bot.vx = moveVx;
    bot.vy = moveVy;

    // Target lock & Reaction Delay Handling
    let canFireNow = false;
    let shootTargetX = bot.x;
    let shootTargetY = bot.y;

    if (attackTargetPlayer && !attackTargetPlayer.isDead) {
      const targetId = attackTargetPlayer.id;

      if (bot.targetLockId !== targetId) {
        bot.targetLockId = targetId;
        bot.reactionEndTime = now + (200 + Math.random() * 200);
      }

      if (now >= (bot.reactionEndTime || 0)) {
        canFireNow = true;

        const accuracyMap: Record<string, number> = {
          collector: 0.60,
          balanced: 0.75,
          hunter: 0.85,
          aggressive: 0.90,
          coward: 0.70
        };
        const accuracy = accuracyMap[botPersonality] ?? 0.75;
        const maxAngleError = (1.0 - accuracy) * 0.7;

        const baseAngle = Math.atan2(attackTargetPlayer.y - bot.y, attackTargetPlayer.x - bot.x);
        const errorAngle = (Math.random() * 2 - 1) * maxAngleError;
        const finalAngle = baseAngle + errorAngle;

        const targetDist = getDistance(bot.x, bot.y, attackTargetPlayer.x, attackTargetPlayer.y);
        shootTargetX = bot.x + Math.cos(finalAngle) * targetDist;
        shootTargetY = bot.y + Math.sin(finalAngle) * targetDist;

        bot.facingAngle = baseAngle;
      }
    } else {
      bot.targetLockId = null;
      bot.reactionEndTime = 0;
    }

    // Execute attack strictly respecting attack intervals
    const minAttackInterval = Math.max(100, bot.attackInterval);

    if (canFireNow && attackTargetPlayer && !attackTargetPlayer.isDead) {
      const actualDist = getDistance(bot.x, bot.y, attackTargetPlayer.x, attackTargetPlayer.y);

      if (bot.characterId === 'donut') {
        if (actualDist <= bot.attackRange) {
          if (!bot.donutChargeStartTime && now - bot.lastAttackTime >= minAttackInterval) {
            bot.donutChargeStartTime = now;
            bot.donutAiTargetChargeDuration = 0.6 + Math.random() * 0.8;
          }

          if (bot.donutChargeStartTime) {
            const chargeTime = (now - bot.donutChargeStartTime) / 1000;
            if (chargeTime >= (bot.donutAiTargetChargeDuration || 0.8)) {
              onAttack(bot, shootTargetX, shootTargetY, chargeTime);
              bot.donutChargeStartTime = null;
              bot.lastAttackTime = now;
            }
          }
        } else if (bot.donutChargeStartTime) {
          bot.donutChargeStartTime = null;
        }
      } else if (bot.characterId === 'pudding') {
        if (actualDist <= bot.attackRange + 35 && now - bot.lastAttackTime >= minAttackInterval) {
          bot.lastAttackTime = now;
          onAttack(bot, shootTargetX, shootTargetY);
        }
      } else {
        if (actualDist <= bot.attackRange && now - bot.lastAttackTime >= minAttackInterval) {
          bot.lastAttackTime = now;
          onAttack(bot, shootTargetX, shootTargetY);
        }
      }
    } else if (bot.characterId === 'donut' && bot.donutChargeStartTime) {
      bot.donutChargeStartTime = null;
    }

    // Smart ability trigger
    if (bot.abilityCooldownRemaining <= 0) {
      if (
        (bot.characterId === 'candy' && decision.nearestPlayerDist < 280) ||
        (bot.characterId === 'pudding' && decision.nearestPlayerDist < 180) ||
        (bot.characterId === 'cookie' && bot.hp < bot.maxHp * 0.7 && decision.nearestPlayerDist < 250) ||
        (bot.characterId === 'donut' && decision.nearestPlayerDist < 160)
      ) {
        onAbility(bot);
      }
    }
  }
}
