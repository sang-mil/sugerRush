# SUGAR RUSH

<div align="center">

### Grow Sweet. Fight Hard.

**A real-time dessert brawl where every bite makes you stronger, richer, and easier to hunt.**

[![Play Live](https://img.shields.io/badge/PLAY_LIVE-SUGAR_RUSH-ec4899?style=for-the-badge&logo=vercel&logoColor=white)](https://suger-rush.vercel.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=111827)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)

**[Play the deployed game](https://suger-rush.vercel.app/)**

</div>

## The Pitch

SUGAR RUSH is a fast, browser-based PvP growth arcade game set in a chaotic dessert arena. Collect sugar to grow your dessert fighter, choose when to take a fight, and turn every risky pickup into a chance to dominate the map.

The catch is simple: the sweeter you become, the more dangerous you look. High sugar increases your power and bounty, but also brings decay and unwanted attention. Every match is a push and pull between greed, positioning, and survival.

## How To Play

1. Choose a dessert champion and set the bot count.
2. Move through the arena and collect sugar.
3. Grow your HP, size, damage, and score.
4. Use attacks, abilities, power-ups, and the Hot Zone to outplay enemies.
5. Hunt valuable targets, protect your bounty, and survive as long as possible.

When a player dies, part of their sugar drops back onto the map. A strong opponent is both a threat and a walking reward.

## Four Dessert Fighters

| Character | Role | Signature ability | Playstyle |
| --- | --- | --- | --- |
| Cookie | Balanced | Cookie Shield | Reliable defense and steady pressure |
| Candy | Speed / Assassin | Sugar Dash | Dive in, burst a target, get out |
| Pudding | Tank / Melee | Pudding Slam | Close-range control and knockback |
| Donut | Charged Sniper | Sugar Hole Blast | Hold your nerve, charge up, hit hard |

## The Arena Is Always Moving

### Sugar Economy

Normal sugar fuels your growth. Rare pickups make the decision-making sharper:

- **Golden Sugar** delivers a large reward.
- **Rainbow Sugar** temporarily boosts sugar gain.
- **Toxic Sugar** offers a huge payout at the cost of HP.

### Hot Zone

The Hot Zone relocates throughout the match. It creates a high-value area with extra reward opportunities, but staying inside drains HP. It is a place to contest, ambush, or avoid depending on your current advantage.

### Power-ups

Collect Heal, Shield, Speed, and Damage power-ups to change the outcome of a fight in seconds.

## Controls

### Desktop

| Action | Input |
| --- | --- |
| Move | `WASD` or arrow keys |
| Aim | Mouse |
| Attack | Hold left mouse button |
| Ability | `SPACE` |
| Pause | `ESC` |
| Performance overlay | `F2` |

### Mobile

- Left stick: move
- Right stick: aim and attack
- Lightning button: use ability
- Pause button: pause the match

The mobile layout uses analog touch input and a wider camera view so the arena remains readable during movement and combat.

## Game Modes

### Solo Arena

Play against up to 20 AI bots. Bots have different personalities: Collector, Hunter, Coward, Aggressive, and Balanced.

### Online Mode

Enable `ONLINE MODE` from the main menu to connect browser players through the WebSocket relay. Remote player states, projectiles, ranking, and hit events are synchronized in real time.

> Online mode is currently an MVP relay architecture. The client owns most gameplay simulation; server-authoritative validation and matchmaking are future improvements.

## Performance-minded By Design

The game is built to run consistently across desktop and mobile browsers:

- Capped internal Canvas render budget for high-DPI devices
- Fixed particle budget and pooled particle objects
- Spatial grid for efficient sugar collection checks
- Staggered bot decision making instead of full AI planning every frame
- Compact HUD with nonessential overlays removed from the play area
- Camera zoom-out and corrected pointer coordinates for wider situational awareness

## Tech Stack

- React 19 + TypeScript
- Vite
- HTML Canvas 2D renderer
- Tailwind CSS
- Web Audio API for synthesized sound effects
- Node.js + `ws` WebSocket relay for online mode

Key client modules:

| Module | Responsibility |
| --- | --- |
| `GameEngine` | Game loop, combat, collisions, rendering orchestration |
| `Camera` | World/screen transforms and camera follow |
| `SugarManager` | Sugar spawning, collection, drops, spatial lookup |
| `BotAI` | Bot decisions, movement, targeting, attacks |
| `ParticleSystem` | Pooled particles, floating text, effect limits |
| `GameCanvas` | Canvas sizing and desktop/mobile input |
| `MultiplayerClient` | WebSocket connection and remote state handling |

## Run Locally

### Requirements

- Node.js 18 or later
- npm
- A modern browser with Canvas and Web Audio support

### Start the frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000/` and press **PLAY GAME**.

### Start online mode locally

Run the relay in a second terminal:

```bash
npm run multiplayer
```

Then enable **ONLINE MODE** in the main menu. The default relay port is `3001`; use `PORT` or `WS_PORT` to change it.

### Production build

```bash
npm run lint
npm run build
```

For a deployed WebSocket endpoint:

```bash
VITE_WS_URL=wss://your-game.example.com/multiplayer npm run build
```

## Project Map

```text
src/
   App.tsx                 # Application state and screen flow
   components/             # Menu, HUD, game canvas, result screens
   game/                   # Simulation, AI, camera, audio, networking
   types/                  # Shared game and snapshot types
server/
   multiplayer.ts          # WebSocket relay server
docs/
   GAME_OVERVIEW.md        # Extended game and systems overview
```

## Roadmap

- Server-authoritative multiplayer validation
- Matchmaking, rooms, and reconnect support
- Mobile sensitivity and performance presets
- More characters, maps, and Hot Zone variants
- Player progression, seasons, and ranked leaderboards
- Spectator mode and richer post-match statistics

## Documentation

For the longer game concept and system breakdown, see [docs/GAME_OVERVIEW.md](docs/GAME_OVERVIEW.md).

## License

No license has been declared yet.
