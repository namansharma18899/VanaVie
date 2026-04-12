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
            this.buildProceduralLevel(levelName);
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

    buildProceduralLevel(levelName) {
        switch (levelName) {
            case 'level1': this._buildLevel1(); break;
            case 'level2': this._buildLevel2(); break;
            case 'level3': this._buildLevel3(); break;
            default: this._buildLevel1(); break;
        }
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
            drawWidth: 96,
            drawHeight: 96,
            speed: 2.5,
            health: 20,
            damage: 8,
            detectionRange: 180,
            attackRange: 55,
            attackCooldownTime: 800,
            hitboxOffsetX: 16,
            hitboxOffsetY: 24,
            hitboxWidth: 56,
            hitboxHeight: 64,
            animations: {
                idle:   { src: `${centipedePath}/Centipede_idle.png`, frames: 3 },
                walk:   { src: `${centipedePath}/Centipede_walk.png`, frames: 3 },
                attack: { src: `${centipedePath}/Centipede_attack2.png`, frames: 5 },
                hurt:   { src: `${centipedePath}/Centipede_hurt.png`, frames: 1 },
                dead:   { src: `${centipedePath}/Centipede_death.png`, frames: 3 },
            },
        });

        const turtlePath = 'assets/sprites/Enemy/2 Battle turtle';
        this.enemyManager.registerEnemyType('battle_turtle', {
            spriteWidth: 72,
            spriteHeight: 72,
            drawWidth: 96,
            drawHeight: 96,
            speed: 1.5,
            health: 40,
            damage: 12,
            detectionRange: 160,
            attackRange: 60,
            attackCooldownTime: 2000,
            hitboxOffsetX: 14,
            hitboxOffsetY: 20,
            hitboxWidth: 60,
            hitboxHeight: 68,
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
                idle:   { src: `${turtlePath}/Battle_turtle_idle.png`, frames: 3 },
                walk:   { src: `${turtlePath}/Battle_turtle_walk.png`, frames: 3 },
                attack: { src: `${turtlePath}/Battle_turtle_attack1.png`, frames: 3 },
                hurt:   { src: `${turtlePath}/Battle_turtle_hurt.png`, frames: 1 },
                dead:   { src: `${turtlePath}/Battle_turtle_death.png`, frames: 3 },
            },
        });

        const bloatedPath = 'assets/sprites/Enemy/3 Big bloated';
        this.enemyManager.registerEnemyType('big_bloated', {
            spriteWidth: 72,
            spriteHeight: 72,
            drawWidth: 112,
            drawHeight: 112,
            speed: 1.0,
            health: 60,
            damage: 18,
            detectionRange: 200,
            attackRange: 65,
            attackCooldownTime: 1500,
            hitboxOffsetX: 18,
            hitboxOffsetY: 24,
            hitboxWidth: 72,
            hitboxHeight: 80,
            animations: {
                idle:   { src: `${bloatedPath}/Big_bloated_idle.png`, frames: 3 },
                walk:   { src: `${bloatedPath}/Big_bloated_walk.png`, frames: 5 },
                attack: { src: `${bloatedPath}/Big_bloated_attack1.png`, frames: 5 },
                hurt:   { src: `${bloatedPath}/Big_bloated_hurt.png`, frames: 1 },
                dead:   { src: `${bloatedPath}/Big_bloated_death.png`, frames: 3 },
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

    _makeDoor(tileSize, cols, rows, doorCol) {
        const doorBasePath = 'assets/sprites/medivial/Objects/';
        const doorImages = [];
        for (let i = 1; i <= 4; i++) {
            const img = new Image();
            img.src = `${doorBasePath}door${i}.png`;
            doorImages.push(img);
        }
        const doorW = 64;
        const doorH = 80;
        return {
            x: doorCol * tileSize,
            y: (rows - 2) * tileSize - doorH,
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
        for (const zone of zones) {
            const count = zone.min + Math.floor(Math.random() * (zone.max - zone.min + 1));
            const groundRow = zone.groundRow ?? (rows - 2);
            for (let i = 0; i < count; i++) {
                const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
                const col = zone.startCol + Math.floor(Math.random() * (zone.endCol - zone.startCol));
                const x = col * tileSize;
                const groundY = groundRow * tileSize;
                this.enemyManager.spawnManual(type, x, groundY, {
                    patrolLeft: zone.startCol * tileSize,
                    patrolRight: zone.endCol * tileSize,
                });
            }
        }
    }

    _addDecorations(positions, tileSize, rows) {
        const propPaths = [
            'assets/sprites/medivial/Objects/barrel.png',
            'assets/sprites/medivial/Objects/box.png',
            'assets/sprites/medivial/Objects/vase.png',
        ];
        for (const pos of positions) {
            const src = propPaths[Math.floor(Math.random() * propPaths.length)];
            const img = new Image();
            img.src = src;
            this.decorations.push({
                image: img,
                x: pos.col * tileSize,
                y: (pos.row ?? (rows - 2)) * tileSize - 32,
                width: 32,
                height: 32,
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

    // ─── Level 1: The Verdant Path (forest) ────────────────────────────

    _buildLevel1() {
        const cols = 130, rows = 17, tileSize = 32;
        const terrainData = new Array(cols * rows).fill(0);

        for (let r = 0; r < rows; r++) this._setTile(terrainData, cols, rows, r, 0, 1);
        for (let r = 0; r < rows; r++) this._setTile(terrainData, cols, rows, r, cols - 1, 1);

        this._fillGround(terrainData, cols, rows, 1, 20, rows - 2);
        this._fillGround(terrainData, cols, rows, 23, 44, rows - 2);
        this._fillGround(terrainData, cols, rows, 47, 70, rows - 2);
        this._fillGround(terrainData, cols, rows, 73, 100, rows - 2);
        this._fillGround(terrainData, cols, rows, 103, cols - 1, rows - 2);

        // stepping stone over first gap
        for (let c = 21; c < 23; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);

        // platforms in zone 2
        for (let c = 28; c < 32; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 36; c < 39; c++) this._setTile(terrainData, cols, rows, rows - 4, c, 3);

        // stepping stones over second gap
        this._setTile(terrainData, cols, rows, rows - 3, 45, 3);
        this._setTile(terrainData, cols, rows, rows - 4, 46, 3);

        // platforms in zone 3
        for (let c = 55; c < 59; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 62; c < 65; c++) this._setTile(terrainData, cols, rows, rows - 6, c, 3);

        // narrow ledge over third gap
        for (let c = 71; c < 73; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);

        // platforms in zone 4
        for (let c = 80; c < 83; c++) this._setTile(terrainData, cols, rows, rows - 4, c, 3);
        for (let c = 88; c < 92; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 94; c < 97; c++) this._setTile(terrainData, cols, rows, rows - 6, c, 3);

        // stepping stones over fourth gap
        this._setTile(terrainData, cols, rows, rows - 3, 101, 3);
        this._setTile(terrainData, cols, rows, rows - 4, 102, 3);

        // platforms in zone 5
        for (let c = 110; c < 114; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);

        const groundImage = new Image();
        groundImage.src = 'assets/backgrounds/layer-5.png';

        const objects = [
            { name: 'start', type: 'playerStart', x: 64, y: (rows - 3) * tileSize, width: 32, height: 32 },
            {
                name: 'tutorial_move', type: 'story',
                x: 3 * tileSize, y: (rows - 4) * tileSize, width: 96, height: 96,
                properties: [
                    { name: 'text', value: 'Use W A S D to move around.|Press W to jump over gaps.' },
                    { name: 'speaker', value: 'Tutorial' },
                    { name: 'oneShot', value: true },
                ],
            },
            {
                name: 'tutorial_attack', type: 'story',
                x: 18 * tileSize, y: (rows - 4) * tileSize, width: 96, height: 96,
                properties: [
                    { name: 'text', value: 'Press SPACE to attack enemies.|Time your shots carefully!' },
                    { name: 'speaker', value: 'Tutorial' },
                    { name: 'oneShot', value: true },
                ],
            },
            {
                name: 'tutorial_gap', type: 'story',
                x: 43 * tileSize, y: (rows - 4) * tileSize, width: 96, height: 96,
                properties: [
                    { name: 'text', value: 'Watch out for gaps!|Falling means instant death.|Run and jump to cross wider ones.' },
                    { name: 'speaker', value: 'Tutorial' },
                    { name: 'oneShot', value: true },
                ],
            },
            {
                name: 'tutorial_door', type: 'story',
                x: 100 * tileSize, y: (rows - 4) * tileSize, width: 96, height: 96,
                properties: [
                    { name: 'text', value: 'Press E near doors to enter them.|The door ahead leads to new lands.' },
                    { name: 'speaker', value: 'Tutorial' },
                    { name: 'oneShot', value: true },
                ],
            },
        ];

        const tileMap = this._makeTileMap(cols, rows, tileSize, terrainData, objects, groundImage);
        this._finalizeLevel(tileMap, 64, (rows - 3) * tileSize, 'The Verdant Path');

        this.loadParallax('forest');
        this.environmentFX.setPreset('wind_leaves');

        // Random enemies
        this._spawnRandomEnemies(['centipede'], [
            { startCol: 25, endCol: 42, min: 1, max: 2 },
            { startCol: 50, endCol: 68, min: 2, max: 3 },
            { startCol: 75, endCol: 98, min: 2, max: 3 },
            { startCol: 105, endCol: 120, min: 1, max: 2 },
        ], tileSize, rows);

        this._addDecorations([
            { col: 5 }, { col: 15 }, { col: 35 }, { col: 52 },
            { col: 78 }, { col: 95 }, { col: 115 },
        ], tileSize, rows);

        this.door = this._makeDoor(tileSize, cols, rows, cols - 6);
        this.door.nextLevel = 'level2';

        this.audio.playMusic('assets/audio/Relaxing_Bagpipe_Harp_Ocarina_Violin_Celtic_Music_48KBPS.mp4', { startTime: 50 });
    }

    // ─── Level 2: The Barren Crossing (desert) ─────────────────────────

    _buildLevel2() {
        const cols = 140, rows = 17, tileSize = 32;
        const terrainData = new Array(cols * rows).fill(0);

        for (let r = 0; r < rows; r++) this._setTile(terrainData, cols, rows, r, 0, 1);
        for (let r = 0; r < rows; r++) this._setTile(terrainData, cols, rows, r, cols - 1, 1);

        // Wider gaps, more height variation
        this._fillGround(terrainData, cols, rows, 1, 16, rows - 2);
        // gap of 5 tiles
        this._fillGround(terrainData, cols, rows, 21, 38, rows - 2);
        // gap of 4 tiles with stepping stone
        this._setTile(terrainData, cols, rows, rows - 4, 39, 3);
        this._setTile(terrainData, cols, rows, rows - 5, 40, 3);
        this._fillGround(terrainData, cols, rows, 42, 55, rows - 2);
        // large gap of 6 tiles
        this._fillGround(terrainData, cols, rows, 61, 78, rows - 2);
        // staircase up
        for (let c = 78; c < 80; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);
        for (let c = 80; c < 82; c++) this._setTile(terrainData, cols, rows, rows - 4, c, 3);
        for (let c = 82; c < 84; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        // elevated ground section
        this._fillGround(terrainData, cols, rows, 85, 100, rows - 4);
        // drop down
        for (let c = 100; c < 102; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);
        this._fillGround(terrainData, cols, rows, 103, 115, rows - 2);
        // narrow bridges over gap
        this._setTile(terrainData, cols, rows, rows - 3, 116, 3);
        // gap
        this._setTile(terrainData, cols, rows, rows - 4, 118, 3);
        // gap
        this._setTile(terrainData, cols, rows, rows - 3, 120, 3);
        this._fillGround(terrainData, cols, rows, 122, cols - 1, rows - 2);

        // platforms in earlier sections
        for (let c = 26; c < 30; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 32; c < 35; c++) this._setTile(terrainData, cols, rows, rows - 6, c, 3);
        for (let c = 48; c < 52; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 66; c < 69; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 72; c < 75; c++) this._setTile(terrainData, cols, rows, rows - 6, c, 3);
        for (let c = 90; c < 93; c++) this._setTile(terrainData, cols, rows, rows - 7, c, 3);
        for (let c = 128; c < 132; c++) this._setTile(terrainData, cols, rows, rows - 4, c, 3);

        const groundImage = new Image();
        groundImage.src = 'assets/backgrounds/layer-5.png';

        const objects = [
            { name: 'start', type: 'playerStart', x: 64, y: (rows - 3) * tileSize, width: 32, height: 32 },
        ];

        const tileColors = {
            grass: '#a08860',
            grassTop: '#c0a870',
            dirt: '#8a7050',
            dirtAccent: '#6a5540',
            platform: '#7a6a50',
        };

        const tileMap = this._makeTileMap(cols, rows, tileSize, terrainData, objects, groundImage, tileColors);
        this._finalizeLevel(tileMap, 64, (rows - 3) * tileSize, 'The Barren Crossing');

        this.loadParallax('desert');
        this.environmentFX.setPreset('wind_dust');

        // NPC: Swordsman warrior
        this.npcManager.spawnManual({
            name: 'Kael',
            x: 8 * tileSize,
            y: (rows - 2) * tileSize - 128,
            spriteSrc: 'assets/sprites/Enemy/Swordsman/Idle.png',
            spriteWidth: 128,
            spriteHeight: 128,
            drawWidth: 128,
            drawHeight: 128,
            idleFrames: 5,
            interactRange: 120,
            facingRight: true,
            oneShot: false,
            cinematicZoom: true,
            zoomScale: 1.3,
            dialog: {
                text: 'Kael: You made it through the forest. Impressive.|' +
                      'Kael: This desert is unforgiving. The gaps are wider here.|' +
                      'Kael: The turtles... they are slow but their shells are tough.|' +
                      'Kael: Past this wasteland lies the Dark Hollow. Steel yourself.',
            },
        });

        // Mixed enemies: turtles + centipedes
        this._spawnRandomEnemies(['battle_turtle', 'centipede'], [
            { startCol: 23, endCol: 36, min: 1, max: 2 },
            { startCol: 44, endCol: 53, min: 2, max: 3 },
            { startCol: 63, endCol: 76, min: 2, max: 3 },
            { startCol: 87, endCol: 98, min: 1, max: 2, groundRow: rows - 4 },
            { startCol: 105, endCol: 113, min: 1, max: 2 },
            { startCol: 124, endCol: 135, min: 2, max: 3 },
        ], tileSize, rows);

        this._addDecorations([
            { col: 4 }, { col: 12 }, { col: 30 }, { col: 50 },
            { col: 70 }, { col: 108 }, { col: 130 },
        ], tileSize, rows);

        this.door = this._makeDoor(tileSize, cols, rows, cols - 6);
        this.door.nextLevel = 'level3';

        this.audio.playMusic('assets/audio/Relaxing_Bagpipe_Harp_Ocarina_Violin_Celtic_Music_48KBPS.mp4', { startTime: 120 });
    }

    // ─── Level 3: The Dark Hollow ───────────────────────────────────────

    _buildLevel3() {
        const cols = 150, rows = 17, tileSize = 32;
        const terrainData = new Array(cols * rows).fill(0);

        for (let r = 0; r < rows; r++) this._setTile(terrainData, cols, rows, r, 0, 1);
        for (let r = 0; r < rows; r++) this._setTile(terrainData, cols, rows, r, cols - 1, 1);

        // Dense, challenging terrain
        this._fillGround(terrainData, cols, rows, 1, 14, rows - 2);
        // narrow ledge
        for (let c = 15; c < 17; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);
        // single stepping stone
        this._setTile(terrainData, cols, rows, rows - 4, 18, 3);
        // narrow platform
        for (let c = 20; c < 22; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        this._fillGround(terrainData, cols, rows, 24, 40, rows - 2);

        // ascending staircase section
        for (let c = 40; c < 42; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);
        for (let c = 43; c < 45; c++) this._setTile(terrainData, cols, rows, rows - 4, c, 3);
        for (let c = 46; c < 48; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 49; c < 51; c++) this._setTile(terrainData, cols, rows, rows - 6, c, 3);

        // elevated section
        this._fillGround(terrainData, cols, rows, 52, 68, rows - 4);

        // descending staircase
        for (let c = 68; c < 70; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 71; c < 73; c++) this._setTile(terrainData, cols, rows, rows - 4, c, 3);
        for (let c = 74; c < 76; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);

        this._fillGround(terrainData, cols, rows, 78, 90, rows - 2);

        // gauntlet: alternating single-tile jumps
        this._setTile(terrainData, cols, rows, rows - 3, 91, 3);
        this._setTile(terrainData, cols, rows, rows - 4, 93, 3);
        this._setTile(terrainData, cols, rows, rows - 3, 95, 3);
        this._setTile(terrainData, cols, rows, rows - 5, 97, 3);
        this._setTile(terrainData, cols, rows, rows - 4, 99, 3);
        this._setTile(terrainData, cols, rows, rows - 3, 101, 3);

        this._fillGround(terrainData, cols, rows, 103, 118, rows - 2);

        // elevated platforms
        for (let c = 108; c < 112; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 113; c < 116; c++) this._setTile(terrainData, cols, rows, rows - 7, c, 3);

        // final gap gauntlet
        for (let c = 119; c < 121; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);
        this._setTile(terrainData, cols, rows, rows - 4, 122, 3);
        for (let c = 124; c < 126; c++) this._setTile(terrainData, cols, rows, rows - 3, c, 3);

        this._fillGround(terrainData, cols, rows, 128, cols - 1, rows - 2);

        // platforms in final section
        for (let c = 135; c < 139; c++) this._setTile(terrainData, cols, rows, rows - 5, c, 3);
        for (let c = 140; c < 143; c++) this._setTile(terrainData, cols, rows, rows - 4, c, 3);

        const groundImage = new Image();
        groundImage.src = 'assets/backgrounds/layer-5.png';

        const objects = [
            { name: 'start', type: 'playerStart', x: 64, y: (rows - 3) * tileSize, width: 32, height: 32 },
        ];

        const tileColors = {
            grass: '#3a5a3a',
            grassTop: '#4a6a4a',
            dirt: '#2e3e2e',
            dirtAccent: '#1e2e1e',
            platform: '#4a4a5a',
        };

        const tileMap = this._makeTileMap(cols, rows, tileSize, terrainData, objects, groundImage, tileColors);
        this._finalizeLevel(tileMap, 64, (rows - 3) * tileSize, 'The Dark Hollow');

        this.loadParallax('dark');
        this.environmentFX.setPreset('fireflies');

        // NPC: Mysterious figure
        this.npcManager.spawnManual({
            name: 'The Watcher',
            x: 6 * tileSize,
            y: (rows - 2) * tileSize - 128,
            spriteSrc: 'assets/sprites/Enemy/Wizard/Idle.png',
            spriteWidth: 128,
            spriteHeight: 128,
            drawWidth: 128,
            drawHeight: 128,
            idleFrames: 5,
            interactRange: 120,
            facingRight: true,
            oneShot: false,
            cinematicZoom: true,
            zoomScale: 1.35,
            dialog: {
                text: 'The Watcher: So you have come this far...|' +
                      'The Watcher: Few survive the Dark Hollow.|' +
                      'The Watcher: The creatures here are ancient and terrible.|' +
                      'The Watcher: Beyond the final door lies your destiny.|' +
                      'The Watcher: Go now. And do not look back.',
            },
        });

        // Hard enemies: big bloated + mixed
        this._spawnRandomEnemies(['big_bloated', 'battle_turtle', 'centipede'], [
            { startCol: 26, endCol: 38, min: 2, max: 3 },
            { startCol: 54, endCol: 66, min: 2, max: 4, groundRow: rows - 4 },
            { startCol: 80, endCol: 88, min: 2, max: 3 },
            { startCol: 105, endCol: 116, min: 2, max: 3 },
            { startCol: 130, endCol: 145, min: 3, max: 5 },
        ], tileSize, rows);

        this._addDecorations([
            { col: 4 }, { col: 10 }, { col: 30 }, { col: 60 },
            { col: 82 }, { col: 110 }, { col: 133 }, { col: 142 },
        ], tileSize, rows);

        this.door = this._makeDoor(tileSize, cols, rows, cols - 6);
        this.door.nextLevel = null; // final level

        this.audio.playMusic('assets/audio/Relaxing_Bagpipe_Harp_Ocarina_Violin_Celtic_Music_48KBPS.mp4', { startTime: 200 });
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
        for (const dec of this.decorations) {
            if (!this.camera.isVisible(dec.x, dec.y, dec.width, dec.height)) continue;
            const img = dec.image;
            if (!img?.complete || !img.naturalWidth) continue;
            const screen = this.camera.worldToScreen(dec.x, dec.y);
            const s = this.camera.scale;
            ctx.drawImage(img, screen.x, screen.y, dec.width * s, dec.height * s);
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

    restart() {
        this.gameOver = false;
        this.gameOverReason = '';
        this.camera.resetZoom();
        this.buildProceduralLevel(this.currentLevel);
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
