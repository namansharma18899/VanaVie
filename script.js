import { Player } from './player_stuff/player.js';
import { Camera } from './game_stuff/camera.js';
import { InputHandler, DEFAULT_KEY_BINDINGS } from './game_stuff/input.js';
import { LevelManager } from './game_stuff/levelManager.js';
import { EnemyManager } from './enemy_stuff/enemyManager.js';
import { StoryManager } from './game_stuff/storyManager.js';
import { AudioManager } from './game_stuff/audioHandler.js';
import { HUD } from './game_stuff/hud.js';
import { ParallaxBackground, ParallaxLayer } from './game_stuff/layers.js';
import { resolveCollisions } from './game_stuff/collision.js';
import { NPCManager } from './game_stuff/npc.js';
import { EnvironmentFX } from './game_stuff/particles.js';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;

        this.camera = new Camera(this.width, this.height);
        this.input = new InputHandler(DEFAULT_KEY_BINDINGS);
        this.audio = new AudioManager();
        this.levelManager = new LevelManager(this);
        this.enemyManager = new EnemyManager(this);
        this.storyManager = new StoryManager(this);
        this.npcManager = new NPCManager(this);
        this.hud = new HUD(this);
        this.environmentFX = new EnvironmentFX(this.width, this.height);
        this.parallax = null;

        this.player = null;
        this.gameOver = false;
        this.gameOverReason = '';
        this.paused = false;
        this.door = null;
        this.decorations = [];
        this.currentLevel = 'level1';

        this.devMode = new URLSearchParams(window.location.search).has('dev');
        this.debug = this.devMode;
    }

    async init() {
        this.registerSounds();
        this.registerEnemyTypes();

        const charData = localStorage.getItem('vanavie_character');
        const characterConfig = charData ? JSON.parse(charData) : this.getDefaultCharacter();
        this.player = new Player(this, characterConfig);

        this.storyManager.onDialogStart = () => {
            this.audio.lowerMusicVolume(0.25);
        };
        this.storyManager.onDialogEnd = () => {
            this.camera.resetZoom();
            this.audio.restoreMusicVolume();
        };

        await this.loadLevel('level1');

        this.camera.follow(this.player);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'p') this.paused = !this.paused;
            if (e.key === 'F1') {
                e.preventDefault();
                this.debug = !this.debug;
            }
            if (e.key === 'm') this.audio.toggleMute();
        });
    }

    async loadLevel(levelName) {
        this.currentLevel = levelName;
        this.door = null;
        this.decorations = [];
        this.enemyManager.clear();
        this.npcManager.clear();
        this.environmentFX.clear();

        try {
            await this.levelManager.loadLevel(levelName);
        } catch (_e) {
            await this.buildProceduralLevel(levelName);
        }

        this.camera.follow(this.player);
        this.camera.resetZoom();
    }

    async transitionToLevel(levelName) {
        this.levelManager.fadingOut = true;
        this.levelManager.fadeAlpha = 0;
        this.levelManager.transitioning = true;

        const fadeOut = () => new Promise(resolve => {
            const step = () => {
                this.levelManager.fadeAlpha += 0.03;
                if (this.levelManager.fadeAlpha >= 1) {
                    this.levelManager.fadeAlpha = 1;
                    resolve();
                } else {
                    requestAnimationFrame(step);
                }
            };
            step();
        });

        await fadeOut();
        await this.loadLevel(levelName);

        this.levelManager.fadingOut = false;
        this.levelManager.fadingIn = true;
        const fadeIn = () => new Promise(resolve => {
            const step = () => {
                this.levelManager.fadeAlpha -= 0.03;
                if (this.levelManager.fadeAlpha <= 0) {
                    this.levelManager.fadeAlpha = 0;
                    this.levelManager.fadingIn = false;
                    this.levelManager.transitioning = false;
                    resolve();
                } else {
                    requestAnimationFrame(step);
                }
            };
            step();
        });
        await fadeIn();
    }

    async buildProceduralLevel(levelName) {
        const resp = await fetch(`maps/custom/${levelName}.json`);
        if (!resp.ok) throw new Error(`Level ${levelName} not found`);
        const data = await resp.json();
        this._buildFromLevelData(data);
    }

    _buildFromLevelData(data) {
        const cols = data.cols;
        const rows = data.rows;
        const tileSize = data.tileSize || 32;
        const terrainData = data.terrain.slice();

        const objects = [];
        const ps = data.playerStart || { col: 2, row: rows - 3 };
        objects.push({
            name: 'start', type: 'playerStart',
            x: ps.col * tileSize, y: ps.row * tileSize,
            width: tileSize, height: tileSize,
        });

        if (data.storyTriggers) {
            for (const st of data.storyTriggers) {
                objects.push({
                    name: st.name, type: 'story',
                    x: st.col * tileSize, y: (st.row != null ? st.row : rows - 4) * tileSize,
                    width: 96, height: 96,
                    properties: [
                        { name: 'text', value: st.text },
                        { name: 'speaker', value: st.speaker || '' },
                        { name: 'oneShot', value: st.oneShot !== false },
                    ],
                });
            }
        }

        const groundImage = new Image();
        groundImage.src = 'assets/backgrounds/layer-5.png';

        const tileMap = this._makeTileMap(cols, rows, tileSize, terrainData, objects, groundImage, data.tileColors);
        const startX = ps.col * tileSize;
        const startY = ps.row * tileSize;
        this._finalizeLevel(tileMap, startX, startY, data.name || 'Untitled');

        this.loadParallax(data.theme || 'forest');
        this.environmentFX.setPreset(data.fx || 'wind_leaves');

        if (data.enemies) {
            for (const e of data.enemies) {
                const groundY = e.row * tileSize;
                this.enemyManager.spawnManual(e.type, e.col * tileSize, groundY, {
                    patrolLeft: (e.patrolLeftCol != null ? e.patrolLeftCol : e.col - 5) * tileSize,
                    patrolRight: (e.patrolRightCol != null ? e.patrolRightCol : e.col + 5) * tileSize,
                });
            }
        }

        if (data.decorations) {
            this._addDecorations(data.decorations, tileSize, rows);
        }

        if (data.npcs) {
            for (const n of data.npcs) {
                const npcRow = n.row != null ? n.row : rows - 2;
                const spriteBase = n.sprite === 'Wizard' ? 'Wizard' : 'Swordsman';
                this.npcManager.spawnManual({
                    name: n.name || 'NPC',
                    x: n.col * tileSize,
                    y: npcRow * tileSize - 128,
                    spriteSrc: `assets/sprites/Enemy/${spriteBase}/Idle.png`,
                    spriteWidth: 128, spriteHeight: 128,
                    drawWidth: 128, drawHeight: 128,
                    idleFrames: 5,
                    interactRange: 120,
                    facingRight: true,
                    oneShot: false,
                    cinematicZoom: true,
                    zoomScale: 1.3,
                    dialog: { text: n.dialog || '' },
                });
            }
        }

        if (data.door) {
            const doorCol = data.door.col != null ? data.door.col : cols - 6;
            const doorRow = data.door.row != null ? data.door.row : null;
            this.door = this._makeDoor(tileSize, cols, rows, doorCol, doorRow);
            this.door.nextLevel = data.door.nextLevel || null;
        }

        this.audio.playMusic('assets/audio/Relaxing_Bagpipe_Harp_Ocarina_Violin_Celtic_Music_48KBPS.mp4', { startTime: data.musicStartTime || 0 });
    }

    async loadParallax(theme) {
        const base = 'assets/backgrounds/craftpix-net-823949-free-nature-backgrounds-pixel-art';
        const themes = {
            forest: [
                { src: `${base}/nature_2/1.png`, speed: 0 },
                { src: `${base}/nature_2/2.png`, speed: 0.05 },
                { src: `${base}/nature_1/3.png`, speed: 0.15 },
                { src: `${base}/nature_2/3.png`, speed: 0.25 },
                { src: `${base}/nature_1/5.png`, speed: 0.4 },
                { src: `${base}/nature_1/6.png`, speed: 0.5 },
                { src: `${base}/nature_1/8.png`, speed: 0.65 },
            ],
            desert: [
                { src: `${base}/nature_4/1.png`, speed: 0 },
                { src: `${base}/nature_4/2.png`, speed: 0.05 },
                { src: `${base}/nature_4/3.png`, speed: 0.15 },
                { src: `${base}/nature_4/4.png`, speed: 0.3 },
                { src: `${base}/nature_3/3.png`, speed: 0.45 },
                { src: `${base}/nature_3/4.png`, speed: 0.6 },
            ],
            dark: [
                { src: `${base}/nature_5/1.png`, speed: 0 },
                { src: `${base}/nature_5/2.png`, speed: 0.05 },
                { src: `${base}/nature_5/3.png`, speed: 0.15 },
                { src: `${base}/nature_5/4.png`, speed: 0.3 },
                { src: `${base}/nature_5/5.png`, speed: 0.5 },
            ],
        };

        const layerConfigs = themes[theme] || themes.forest;

        const loadImage = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load ${src}`));
            img.src = src;
        });

        try {
            const images = await Promise.all(layerConfigs.map(c => loadImage(c.src)));
            const layers = images.map((img, i) =>
                new ParallaxLayer(img, layerConfigs[i].speed, this.height)
            );
            this.parallax = new ParallaxBackground(layers);
        } catch (e) {
            console.warn('Failed to load parallax backgrounds:', e);
        }
    }

    registerSounds() {
        this.audio.register('jump', 'assets/audio/jump.wav', { poolSize: 2 });
        this.audio.register('attack', 'assets/audio/attack.wav', { poolSize: 3 });
        this.audio.register('hurt', 'assets/audio/hurt.wav', { poolSize: 2 });
        this.audio.register('enemyHurt', 'assets/audio/enemy_hurt.wav', { poolSize: 3 });
        this.audio.register('pickup', 'assets/audio/pickup.wav');
        this.audio.register('door', 'assets/audio/door.wav');
    }

    registerEnemyTypes() {
        const centipedePath = 'assets/sprites/Enemy/1 Centipede';
        this.enemyManager.registerEnemyType('centipede', {
            spriteWidth: 72,
            spriteHeight: 72,
            drawWidth: 72,
            drawHeight: 72,
            speed: 2.5,
            health: 20,
            damage: 8,
            detectionRange: 180,
            attackRange: 55,
            attackCooldownTime: 800,
            hitboxOffsetX: 8,
            hitboxOffsetY: 12,
            hitboxWidth: 48,
            hitboxHeight: 52,
            canJump: true,
            jumpForce: -11,
            animations: {
                idle:   { src: `${centipedePath}/Centipede_idle.png`, frames: 4, fps: 6 },
                walk:   { src: `${centipedePath}/Centipede_walk.png`, frames: 4, fps: 8 },
                attack: { src: `${centipedePath}/Centipede_attack2.png`, frames: 6, fps: 10 },
                hurt:   { src: `${centipedePath}/Centipede_hurt.png`, frames: 2, fps: 8 },
                dead:   { src: `${centipedePath}/Centipede_death.png`, frames: 4, fps: 6 },
            },
        });

        const turtlePath = 'assets/sprites/Enemy/2 Battle turtle';
        this.enemyManager.registerEnemyType('battle_turtle', {
            spriteWidth: 72,
            spriteHeight: 72,
            drawWidth: 72,
            drawHeight: 72,
            speed: 1.5,
            health: 40,
            damage: 12,
            detectionRange: 160,
            attackRange: 60,
            attackCooldownTime: 2000,
            hitboxOffsetX: 8,
            hitboxOffsetY: 10,
            hitboxWidth: 50,
            hitboxHeight: 54,
            isRanged: true,
            projectileRange: 250,
            projectileConfig: {
                src: `${turtlePath}/laserBlue01.png`,
                width: 9,
                height: 54,
                speed: 4,
                damage: 8,
                maxDistance: 300,
            },
            animations: {
                idle:   { src: `${turtlePath}/Battle_turtle_idle.png`, frames: 4, fps: 5 },
                walk:   { src: `${turtlePath}/Battle_turtle_walk.png`, frames: 4, fps: 6 },
                attack: { src: `${turtlePath}/Battle_turtle_attack1.png`, frames: 4, fps: 8 },
                hurt:   { src: `${turtlePath}/Battle_turtle_hurt.png`, frames: 2, fps: 8 },
                dead:   { src: `${turtlePath}/Battle_turtle_death.png`, frames: 4, fps: 6 },
            },
        });

        const bloatedPath = 'assets/sprites/Enemy/3 Big bloated';
        this.enemyManager.registerEnemyType('big_bloated', {
            spriteWidth: 72,
            spriteHeight: 72,
            drawWidth: 144,
            drawHeight: 144,
            speed: 1.0,
            health: 60,
            damage: 18,
            detectionRange: 200,
            attackRange: 65,
            attackCooldownTime: 1500,
            hitboxOffsetX: 24,
            hitboxOffsetY: 32,
            hitboxWidth: 88,
            hitboxHeight: 100,
            animations: {
                idle:   { src: `${bloatedPath}/Big_bloated_idle.png`, frames: 4, fps: 5 },
                walk:   { src: `${bloatedPath}/Big_bloated_walk.png`, frames: 6, fps: 7 },
                attack: { src: `${bloatedPath}/Big_bloated_attack1.png`, frames: 6, fps: 9 },
                hurt:   { src: `${bloatedPath}/Big_bloated_hurt.png`, frames: 2, fps: 8 },
                dead:   { src: `${bloatedPath}/Big_bloated_death.png`, frames: 4, fps: 5 },
            },
        });
    }

    getDefaultCharacter() {
        return {
            name: 'Archer',
            spriteWidth: 128,
            spriteHeight: 128,
            drawWidth: 128,
            drawHeight: 128,
            speed: 4,
            jumpForce: -13,
            maxHealth: 75,
            damage: 12,
            hitboxOffsetX: 36,
            hitboxOffsetY: 36,
            hitboxWidth: 48,
            hitboxHeight: 84,
            projectile: {
                src: 'assets/sprites/Mainchar/Archer/Arrow.png',
                width: 48,
                height: 16,
            },
            animations: {
                idle:   { src: 'assets/sprites/Mainchar/Archer/Idle.png', frames: 5 },
                run:    { src: 'assets/sprites/Mainchar/Archer/Run.png', frames: 7 },
                jump:   { src: 'assets/sprites/Mainchar/Archer/Jump.png', frames: 8 },
                fall:   { src: 'assets/sprites/Mainchar/Archer/Jump.png', frames: 8 },
                attack: { src: 'assets/sprites/Mainchar/Archer/Attack_1.png', frames: 3 },
                hurt:   { src: 'assets/sprites/Mainchar/Archer/Hurt.png', frames: 2 },
                dead:   { src: 'assets/sprites/Mainchar/Archer/Dead.png', frames: 2 },
            },
        };
    }

    // ─── Shared level building helpers ──────────────────────────────────

    _makeTileMap(cols, rows, tileSize, terrainData, objects, groundImage, tileColors) {
        const extractProps = (obj) => {
            const props = {};
            if (obj.properties) {
                for (const p of obj.properties) props[p.name] = p.value;
            }
            return props;
        };

        const colors = {
            grass:    tileColors?.grass    || '#4a8c3f',
            grassTop: tileColors?.grassTop || '#5ca84d',
            dirt:     tileColors?.dirt     || '#5c3d2e',
            dirtAccent: tileColors?.dirtAccent || '#4a3125',
            platform: tileColors?.platform || '#555',
            ...tileColors,
        };

        return {
            tileWidth: tileSize,
            tileHeight: tileSize,
            cols,
            rows,
            worldWidth: cols * tileSize,
            worldHeight: rows * tileSize,
            layers: {
                terrain: { type: 'tile', data: terrainData, width: cols, height: rows, visible: true },
                collision: { type: 'tile', data: terrainData, width: cols, height: rows, visible: false },
                objects: { type: 'object', objects, visible: true },
            },
            isSolid(wx, wy) {
                const c = Math.floor(wx / tileSize);
                const r = Math.floor(wy / tileSize);
                if (c < 0 || c >= cols) return true;
                if (r < 0) return true;
                if (r >= rows) return false;
                return terrainData[r * cols + c] !== 0;
            },
            getObjectsByType(type) {
                const results = [];
                for (const obj of objects) {
                    if (obj.type === type) {
                        results.push({ x: obj.x, y: obj.y, width: obj.width, height: obj.height, name: obj.name, properties: extractProps(obj) });
                    }
                }
                return results;
            },
            drawLayer(ctx, camera, layerName) {
                const layer = this.layers[layerName];
                if (!layer || layer.type !== 'tile' || !layer.visible) return;

                const effectiveVW = camera.viewportWidth / camera.scale;
                const effectiveVH = camera.viewportHeight / camera.scale;
                const startCol = Math.max(0, Math.floor(camera.x / tileSize));
                const endCol = Math.min(cols, Math.ceil((camera.x + effectiveVW) / tileSize) + 1);
                const startRow = Math.max(0, Math.floor(camera.y / tileSize));
                const endRow = Math.min(rows, Math.ceil((camera.y + effectiveVH) / tileSize) + 1);

                const s = camera.scale;
                const drawSize = Math.ceil(tileSize * s);

                const useImg = groundImage?.complete && groundImage.naturalWidth;
                const srcBrickW = 50;
                const srcBrickH = 55;
                const srcTopY = 610;

                for (let r = startRow; r < endRow; r++) {
                    for (let c = startCol; c < endCol; c++) {
                        const gid = layer.data[r * cols + c];
                        if (gid === 0) continue;
                        const sx = Math.round(camera.worldToScreen(c * tileSize, 0).x);
                        const sy = Math.round(camera.worldToScreen(0, r * tileSize).y);
                        if (gid === 3) {
                            if (useImg) {
                                const srcX = (c * srcBrickW) % (2400 - srcBrickW);
                                ctx.drawImage(groundImage, srcX, srcTopY, srcBrickW, srcBrickH, sx, sy, drawSize, drawSize);
                            } else {
                                ctx.fillStyle = colors.platform;
                                ctx.fillRect(sx, sy, drawSize, drawSize);
                            }
                        } else if (gid === 2) {
                            ctx.fillStyle = colors.grass;
                            ctx.fillRect(sx, sy, drawSize, drawSize);
                            ctx.fillStyle = colors.grassTop;
                            ctx.fillRect(sx, sy, drawSize, Math.ceil(4 * s));
                        } else {
                            ctx.fillStyle = colors.dirt;
                            ctx.fillRect(sx, sy, drawSize, drawSize);
                            ctx.fillStyle = colors.dirtAccent;
                            const a4 = Math.round(4 * s), a6 = Math.round(6 * s);
                            const a8 = Math.round(8 * s), a10 = Math.round(10 * s);
                            ctx.fillRect(sx + a4, sy + a6, a8, a6);
                            ctx.fillRect(sx + Math.round(18 * s), sy + Math.round(14 * s), a10, a8);
                        }
                    }
                }
            },
        };
    }

    _setTile(terrainData, cols, rows, r, c, val = 1) {
        if (r >= 0 && r < rows && c >= 0 && c < cols)
            terrainData[r * cols + c] = val;
    }

    _fillGround(terrainData, cols, rows, startCol, endCol, topRow) {
        for (let c = startCol; c < endCol; c++) {
            this._setTile(terrainData, cols, rows, topRow, c, 2);
            for (let r = topRow + 1; r < rows; r++)
                this._setTile(terrainData, cols, rows, r, c, 1);
        }
    }

    _makeDoor(tileSize, cols, rows, doorCol, doorRow) {
        const doorBasePath = 'assets/sprites/medivial/Objects/';
        const doorImages = [];
        for (let i = 1; i <= 4; i++) {
            const img = new Image();
            img.src = `${doorBasePath}door${i}.png`;
            doorImages.push(img);
        }
        const doorW = 64;
        const doorH = 64;
        const doorPad = 6;
        const groundRow = doorRow != null ? doorRow : (rows - 2);
        return {
            x: doorCol * tileSize,
            y: (groundRow + 1) * tileSize - doorH + doorPad,
            width: doorW,
            height: doorH,
            images: doorImages,
            frameIndex: 0,
            state: 'closed',
            timer: 0,
            fadeAlpha: 0,
            playerScale: 1,
        };
    }

    _spawnRandomEnemies(enemyTypes, zones, tileSize, rows) {
        const MIN_SPACING = 4 * tileSize;

        for (const zone of zones) {
            const count = zone.min + Math.floor(Math.random() * (zone.max - zone.min + 1));
            const groundRow = zone.groundRow ?? (rows - 2);
            for (let i = 0; i < count; i++) {
                const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
                let x = null;
                for (let attempt = 0; attempt < 8; attempt++) {
                    const col = zone.startCol + Math.floor(Math.random() * (zone.endCol - zone.startCol));
                    const candidateX = col * tileSize;
                    let tooClose = false;
                    for (const existing of this.enemyManager.enemies) {
                        if (Math.abs(existing.x - candidateX) < MIN_SPACING) {
                            tooClose = true;
                            break;
                        }
                    }
                    if (!tooClose) {
                        x = candidateX;
                        break;
                    }
                }
                if (x === null) continue;
                const groundY = groundRow * tileSize;
                this.enemyManager.spawnManual(type, x, groundY, {
                    patrolLeft: zone.startCol * tileSize,
                    patrolRight: zone.endCol * tileSize,
                });
            }
        }
    }

    _addDecorations(positions, tileSize, rows) {
        // [width, height, bottomPadding] — padding compensates for transparent pixels inside the sprite
        const OBJ_INFO = {
            torch:          [32, 32, 4],
            barrel:         [32, 32, 2],
            box:            [32, 32, 3],
            vase:           [32, 32, 3],
            chest_closed:   [32, 32, 5],
            chest_opened:   [32, 32, 5],
            window_small:   [32, 32, 2],
            chain1:         [64, 64, 4],
            chain2:         [64, 64, 4],
            lever1:         [64, 64, 6],
            lever2:         [64, 64, 6],
            shield:         [64, 64, 6],
            window:         [64, 64, 4],
            walls1:         [64, 64, 2],
            walls2:         [64, 64, 2],
            stairs_full:    [128, 128, 2],
        };
        const fallbackPaths = [
            'assets/sprites/medivial/Objects/barrel.png',
            'assets/sprites/medivial/Objects/box.png',
            'assets/sprites/medivial/Objects/vase.png',
        ];
        for (const pos of positions) {
            const objType = pos.objectType || null;
            let src, w, h, pad;
            if (objType && OBJ_INFO[objType]) {
                src = 'assets/sprites/medivial/Objects/' + objType + '.png';
                w = OBJ_INFO[objType][0];
                h = OBJ_INFO[objType][1];
                pad = OBJ_INFO[objType][2];
            } else {
                src = fallbackPaths[Math.floor(Math.random() * fallbackPaths.length)];
                w = 32;
                h = 32;
                pad = 2;
            }
            const img = new Image();
            img.src = src;
            const posRow = pos.row ?? (rows - 2);
            this.decorations.push({
                image: img,
                objectType: objType,
                x: pos.col * tileSize,
                y: (posRow + 1) * tileSize - h + pad,
                width: w,
                height: h,
            });
        }
    }

    _finalizeLevel(tileMap, startX, startY, levelName) {
        this.levelManager.tileMap = tileMap;
        this.camera.setWorldBounds(tileMap.worldWidth, tileMap.worldHeight);
        this.camera.y = 0;
        this.camera.lockY = true;

        this.player.init(startX, startY - this.player.height);

        this.storyManager.loadTriggers(tileMap);
        if (this.devMode) {
            for (const t of this.storyManager.triggers) {
                this.storyManager.firedTriggers.add(t.name);
            }
        }
        this.levelManager.currentLevelName = levelName;
    }

    // ─── Update ─────────────────────────────────────────────────────────

    update(deltaTime) {
        if (this.paused || this.gameOver) return;

        this.audio.updateCrossfade(deltaTime);
        this.environmentFX.update(deltaTime);

        if (this.door && this.door.state !== 'closed') {
            this.updateDoor(deltaTime);
            if (this.door.state === 'walking') this.player.advanceFrame(deltaTime);
            this.camera.follow(this.player);
            this.camera.update();
            return;
        }

        this.storyManager.update(deltaTime, this.input.keys);
        if (this.storyManager.isActive()) {
            this.camera.update();
            return;
        }

        this.player.update(this.input.keys, deltaTime);

        if (this.levelManager.tileMap) {
            resolveCollisions(this.player, this.levelManager.tileMap);
        }

        this.enemyManager.update(deltaTime, this.player, this.levelManager.tileMap);
        this.npcManager.update(deltaTime);
        this.npcManager.checkInteraction(this.player, this.input.keys);
        this.storyManager.checkTriggers(this.player);
        this.levelManager.checkExits(this.player);
        this.levelManager.update();

        if (this.door) this.checkDoorInteraction();

        this.camera.follow(this.player);
        this.camera.update();

        this.hud.update();

        if (this.levelManager.tileMap && this.player.y > this.levelManager.tileMap.worldHeight + 64) {
            this.player.health = 0;
            this.gameOver = true;
            this.gameOverReason = 'fall';
        } else if (this.player.health <= 0) {
            this.gameOver = true;
            this.gameOverReason = 'death';
        }
    }

    checkDoorInteraction() {
        const d = this.door;
        const p = this.player;
        const px = p.x + p.hitboxOffsetX;
        const py = p.y + p.hitboxOffsetY;
        const near = px + p.hitboxWidth > d.x && px < d.x + d.width &&
                     py + p.hitboxHeight > d.y && py < d.y + d.height;

        if (near && this.input.keys.includes(this.input.keyBindings.interact)) {
            d.state = 'opening';
            d.timer = 0;
            d.frameIndex = 0;
        }
    }

    updateDoor(deltaTime) {
        const d = this.door;
        d.timer += deltaTime;
        const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        if (d.state === 'opening') {
            const frameTime = 200;
            d.frameIndex = Math.min(3, Math.floor(d.timer / frameTime));
            if (d.timer >= frameTime * 4) {
                d.state = 'walking';
                d.timer = 0;
                this.player.setAnimation('run');
            }
        } else if (d.state === 'walking') {
            const doorCenterX = d.x + d.width / 2 - this.player.width / 2;
            const dist = doorCenterX - this.player.x;
            this.player.vx = 0;
            this.player.vy = 0;
            this.player.facingRight = dist >= 0;

            if (Math.abs(dist) > 4) {
                this.player.x += dist * 0.06;
            } else {
                this.player.x = doorCenterX;
                d.state = 'entering';
                d.timer = 0;
                d.playerScale = 1;
                this.player.setAnimation('idle');
            }
        } else if (d.state === 'entering') {
            const duration = 800;
            const t = Math.min(1, d.timer / duration);
            const e = ease(t);

            const doorCenterX = d.x + d.width / 2 - this.player.width / 2;
            const doorCenterY = d.y + d.height * 0.4 - this.player.height / 2;
            this.player.x = doorCenterX;
            this.player.y += (doorCenterY - this.player.y) * 0.05;
            this.player.vx = 0;
            this.player.vy = 0;

            d.playerScale = Math.max(0, 1 - e);

            if (t >= 1) {
                d.state = 'fading';
                d.timer = 0;
                d.fadeAlpha = 0;
            }
        } else if (d.state === 'fading') {
            const duration = 1200;
            const t = Math.min(1, d.timer / duration);
            d.fadeAlpha = ease(t);
            if (t >= 1) {
                if (d.nextLevel) {
                    d.state = 'transitioning';
                    d.timer = 0;
                    this.transitionToLevel(d.nextLevel);
                } else {
                    d.state = 'complete';
                    d.timer = 0;
                }
            }
        }
    }

    // ─── Draw ───────────────────────────────────────────────────────────

    draw(ctx) {
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = '#0e1a0e';
        ctx.fillRect(0, 0, this.width, this.height);

        if (this.parallax) {
            this.parallax.update(this.camera.x);
            this.parallax.draw(ctx);
        }

        if (this.levelManager.tileMap) {
            this.levelManager.tileMap.drawLayer(ctx, this.camera, 'background');
            this.levelManager.tileMap.drawLayer(ctx, this.camera, 'terrain');
        }

        this.drawDecorations(ctx);
        if (this.door) this.drawDoor(ctx);

        this.npcManager.draw(ctx, this.camera);
        this.enemyManager.draw(ctx, this.camera);
        this.drawPlayer(ctx);

        if (this.levelManager.tileMap) {
            this.levelManager.tileMap.drawLayer(ctx, this.camera, 'foreground');
        }

        this.environmentFX.draw(ctx);
        this.npcManager.drawPrompts(ctx, this.camera, this.player);

        this.hud.draw(ctx);
        this.storyManager.draw(ctx);
        this.levelManager.drawFade(ctx);

        if (this.door && this.door.state === 'fading') {
            ctx.fillStyle = `rgba(0, 0, 0, ${this.door.fadeAlpha})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }
        if (this.door && this.door.state === 'complete') {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#ccaa55';
            ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('VICTORY', this.width / 2, this.height / 2 - 30);
            ctx.fillStyle = '#887755';
            ctx.font = '16px monospace';
            ctx.fillText('You have conquered the Dark Hollow.', this.width / 2, this.height / 2 + 15);
            ctx.fillStyle = '#665544';
            ctx.font = '13px monospace';
            ctx.fillText('The land of VanaVie is safe once more...', this.width / 2, this.height / 2 + 45);
            ctx.textAlign = 'left';
        }

        if (this.debug) this.drawDebug(ctx);

        if (this.gameOver) this.drawGameOver(ctx);

        if (this.paused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#ccaa55';
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PAUSED', this.width / 2, this.height / 2);
            ctx.textAlign = 'left';
        }
    }

    drawDecorations(ctx) {
        const now = performance.now();
        for (const dec of this.decorations) {
            if (!this.camera.isVisible(dec.x, dec.y, dec.width, dec.height)) continue;
            const img = dec.image;
            if (!img?.complete || !img.naturalWidth) continue;
            const screen = this.camera.worldToScreen(dec.x, dec.y);
            const s = this.camera.scale;
            const dw = dec.width * s;
            const dh = dec.height * s;

            ctx.save();
            if (dec.objectType === 'torch') {
                const flicker = 0.7 + 0.3 * Math.sin(now * 0.006 + dec.x);
                const glowR = 40 * s * flicker;
                const cx = screen.x + dw / 2;
                const cy = screen.y + dh * 0.25;
                const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
                grd.addColorStop(0, `rgba(255,150,30,${0.25 * flicker})`);
                grd.addColorStop(0.5, `rgba(255,100,0,${0.1 * flicker})`);
                grd.addColorStop(1, 'rgba(255,80,0,0)');
                ctx.fillStyle = grd;
                ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
            }

            if (dec.objectType === 'chain1' || dec.objectType === 'chain2') {
                const sway = Math.sin(now * 0.002 + dec.x * 0.1) * 2;
                const pivotX = screen.x + dw / 2;
                ctx.translate(pivotX, screen.y);
                ctx.rotate(sway * Math.PI / 180);
                ctx.translate(-pivotX, -screen.y);
            }

            ctx.drawImage(img, screen.x, screen.y, dw, dh);
            ctx.restore();
        }
    }

    drawDoor(ctx) {
        const d = this.door;
        const img = d.images[d.frameIndex];
        if (!img?.complete || !img.naturalWidth) return;
        const screen = this.camera.worldToScreen(d.x, d.y);
        const s = this.camera.scale;

        ctx.drawImage(img, screen.x, screen.y, d.width * s, d.height * s);

        if (d.state === 'closed') {
            const p = this.player;
            const px = p.x + p.hitboxOffsetX + p.hitboxWidth / 2;
            const dist = Math.abs(px - (d.x + d.width / 2));
            if (dist < 120) {
                const alpha = Math.max(0, 1 - dist / 120) * (0.7 + 0.3 * Math.sin(performance.now() / 400));
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#ccaa55';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('[E] Enter', screen.x + d.width * s / 2, screen.y - 8);
                ctx.restore();
            }
        }
    }

    drawPlayer(ctx) {
        if (this.door && (this.door.state === 'fading' || this.door.state === 'complete' || this.door.state === 'transitioning')) {
            return;
        }
        if (this.door && this.door.state === 'entering') {
            const scale = this.door.playerScale;
            if (scale <= 0) return;
            const p = this.player;
            const img = p.activeImage || p.image;
            if (!img) return;

            const screen = this.camera.worldToScreen(p.x, p.y);
            const s = this.camera.scale;
            const w = p.width * scale * s;
            const h = p.height * scale * s;
            const cx = screen.x + p.width * s / 2;
            const cy = screen.y + p.height * s / 2;

            ctx.save();
            ctx.globalAlpha = Math.max(0.05, scale);
            ctx.drawImage(
                img,
                p.frameX * p.spriteWidth, p.frameY * p.spriteHeight,
                p.spriteWidth, p.spriteHeight,
                cx - w / 2, cy - h / 2, w, h
            );
            ctx.restore();
        } else {
            this.player.draw(ctx, this.camera);
        }
    }

    drawGameOver(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, this.width, this.height);

        const cx = this.width / 2;
        const cy = this.height / 2;

        if (this.gameOverReason === 'fall') {
            ctx.fillStyle = '#cc5522';
            ctx.font = 'bold 48px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('YOU FAILED', cx, cy - 30);

            ctx.fillStyle = '#aa9977';
            ctx.font = '14px monospace';
            ctx.fillText('You fell into the abyss...', cx, cy + 15);
        } else {
            ctx.fillStyle = '#cc3333';
            ctx.font = 'bold 48px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('YOU DIED', cx, cy - 30);
        }

        ctx.fillStyle = '#ccaa55';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press R to restart', cx, cy + 50);
        ctx.textAlign = 'left';
    }

    drawDebug(ctx) {
        const p = this.player;
        const screen = this.camera.worldToScreen(p.x + p.hitboxOffsetX, p.y + p.hitboxOffsetY);
        const s = this.camera.scale;
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x, screen.y, p.hitboxWidth * s, p.hitboxHeight * s);

        ctx.fillStyle = 'lime';
        ctx.font = '10px monospace';
        ctx.fillText(`pos: ${Math.round(p.x)}, ${Math.round(p.y)}`, 20, this.height - 52);
        ctx.fillText(`vel: ${p.vx.toFixed(1)}, ${p.vy.toFixed(1)}`, 20, this.height - 40);
        ctx.fillText(`state: ${p.currentState?.name}`, 20, this.height - 28);
        ctx.fillText(`ground: ${p.onGround}`, 20, this.height - 16);
        ctx.fillText(`level: ${this.levelManager.currentLevelName}`, 20, this.height - 4);
    }

    async restart() {
        this.camera.resetZoom();
        this.door = null;
        this.decorations = [];
        this.enemyManager.clear();
        this.npcManager.clear();
        this.environmentFX.clear();
        await this.loadLevel(this.currentLevel);
        this.camera.follow(this.player);
        this.gameOver = false;
        this.gameOverReason = '';
    }
}

window.addEventListener('load', async () => {
    const canvas = document.getElementById('canvas1');
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    function fitCanvas() {
        const scaleX = window.innerWidth / CANVAS_WIDTH;
        const scaleY = window.innerHeight / CANVAS_HEIGHT;
        const scale = Math.min(scaleX, scaleY);
        canvas.style.width = Math.floor(CANVAS_WIDTH * scale) + 'px';
        canvas.style.height = Math.floor(CANVAS_HEIGHT * scale) + 'px';
    }
    fitCanvas();
    window.addEventListener('resize', fitCanvas);

    const game = new Game(canvas);
    await game.init();

    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');

    window.addEventListener('keydown', (e) => {
        if (e.key === 'r' && game.gameOver) game.restart();
    });

    let lastTime = 0;
    function animate(timestamp) {
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        game.update(deltaTime);
        game.draw(ctx);
        requestAnimationFrame(animate);
    }

    animate(0);
});
