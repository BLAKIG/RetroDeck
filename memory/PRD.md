# DOOMFALL — Retro Raycasting FPS

## Problem Statement
Build a complete Wolfenstein 3D / classic DOOM inspired browser FPS using HTML5 Canvas + Vanilla JS + CSS. A real first-person DDA raycasting engine. Not a platformer, not top-down.

## Architecture
- Vanilla JS game served as static assets from `/app/frontend/public/game/`
- React root iframes the game at `/game/index.html`
- Modular: engine/, entities/, weapons/, levels/, audio/, ui/

## Phase 1 — SHIPPED (2026-02-12)
- [x] DDA raycasting engine with textured walls (brick/stone/metal), floor, ceiling, distance shading
- [x] Reduced-res pixel buffer + upscale for perf (60 FPS target)
- [x] Player: WASD + arrows + mouse look (pointer lock) + sprint + collision + view bob
- [x] Pistol weapon: fire rate, ammo, muzzle flash, recoil, procedural sound
- [x] 2 enemy types (Guard, Soldier) with idle/patrol/chase/attack AI + LOS
- [x] Sprite billboard rendering with zBuffer
- [x] Pickups (medkits, ammo)
- [x] Level 1: 24×20 handcrafted maze with enemies and pickups
- [x] HUD: Level, Score, Face portrait (health-reactive), Health, Ammo, Weapon, FPS
- [x] Damage flash, screen shake, blood + spark particles
- [x] Procedural retro audio (pistol/hurt/pickup/death/footstep/gameover)
- [x] Background music (contramusic.mp3 from previous project)
- [x] Start screen + Game Over screen

## Phase 2 — BACKLOG
- P0: Shotgun, SMG, Chaingun weapons + weapon switching (1-4 keys)
- P0: Heavy, Robot, Boss enemies + advanced pathfinding
- P0: 4 more levels + level progression + doors/keys/secrets/barrels
- P1: Full menu system (main/pause/settings/victory)
- P1: Additional particle effects (gib, smoke, shell casings)
- P2: Save/high score, difficulty selection, mobile touch controls

## File Structure
```
/app/frontend/public/game/
├── index.html
├── styles.css
├── assets/audio/music.mp3
└── src/
    ├── engine/{textures,raycaster,renderer}.js
    ├── entities/{player,enemy}.js
    ├── weapons/pistol.js
    ├── levels/level1.js
    ├── audio/sound.js
    ├── ui/hud.js
    └── main.js
```
