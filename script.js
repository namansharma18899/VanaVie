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
        this.hud = new HUD(this);
        this.parallax = null;

        this.player = null;
        this.gameOver = false;
        this.gameOverReason = '';
        this.paused = false;

        this.debug = false;
    }

    async init() {
        this.registerSounds();
        this.registerEnemyTypes();

        const charData = localStorage.getItem('vanavie_character');
        const characterConfig = charData ? JSON.parse(charData) : this.getDefaultCharacter();

        this.player = new Player(this, characterConfig);

        await this.loadParallax();

        try {
            await this.levelManager.loadLevel('level1');
        } catch (e) {
            console.warn('No level1.json found, creating demo world');
            this.createDemoWorld();
        }

        this.camera.follow(this.player);
        this.audio.playMusic('assets/audio/Relaxing_Bagpipe_Harp_Ocarina_Violin_Celtic_Music_48KBPS.mp4', { startTime: 50 });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'p') this.paused = !this.paused;
            if (e.key === 'F1') {
                e.preventDefault();
                this.debug = !this.debug;
            }
            if (e.key === 'm') this.audio.toggleMute();
        });
    }

    async loadParallax() {
        const base = 'assets/backgrounds/craftpix-net-823949-free-nature-backgrounds-pixel-art';
        const layerConfigs = [
            { src: `${base}/nature_2/1.png`, speed: 0 },
            { src: `${base}/nature_2/2.png`, speed: 0.05 },
            { src: `${base}/nature_1/3.png`, speed: 0.15 },
            { src: `${base}/nature_2/3.png`, speed: 0.25 },
            { src: `${base}/nature_1/5.png`, speed: 0.4 },
            { src: `${base}/nature_1/6.png`, speed: 0.5 },
            { src: `${base}/nature_1/8.png`, speed: 0.65 },
        ];

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
        this.enemyManager.registerEnemyType('default', {
            spriteWidth: 64,
            spriteHeight: 64,
            drawWidth: 64,
            drawHeight: 64,
            speed: 1.5,
            health: 30,
            damage: 10,
            detectionRange: 200,
            attackRange: 50,
            hitboxOffsetX: 12,
            hitboxOffsetY: 12,
            hitboxWidth: 40,
            hitboxHeight: 52,
            spriteSrc: 'assets/sprites/enemy_sheet.png',
            animations: {
                idle:   { row: 0, frames: 3 },
                walk:   { row: 1, frames: 5 },
                attack: { row: 2, frames: 4 },
                hurt:   { row: 3, frames: 2 },
                dead:   { row: 4, frames: 5 },
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
                src: 'assets/sprites/Archer/Arrow.png',
                width: 48,
                height: 16,
            },
            animations: {
                idle:   { src: 'assets/sprites/Archer/Idle.png', frames: 5 },
                run:    { src: 'assets/sprites/Archer/Run.png', frames: 7 },
                jump:   { src: 'assets/sprites/Archer/Jump.png', frames: 8 },
                fall:   { src: 'assets/sprites/Archer/Jump.png', frames: 8 },
                attack: { src: 'assets/sprites/Archer/Attack_1.png', frames: 3 },
                hurt:   { src: 'assets/sprites/Archer/Hurt.png', frames: 2 },
                dead:   { src: 'assets/sprites/Archer/Dead.png', frames: 2 },
            },
        };
    }

    createDemoWorld() {
        const cols = 120;
        const rows = 17;
        const tileSize = 32;
        const terrainData = new Array(cols * rows).fill(0);

        const setTile = (r, c, val = 1) => {
            if (r >= 0 && r < rows && c >= 0 && c < cols)
                terrainData[r * cols + c] = val;
        };

        const fillGround = (startCol, endCol, topRow) => {
            for (let c = startCol; c < endCol; c++) {
                setTile(topRow, c, 2);
                for (let r = topRow + 1; r < rows; r++) setTile(r, c, 1);
            }
        };

        fillGround(0, 18, rows - 2);
        fillGround(21, 42, rows - 2);
        fillGround(45, 68, rows - 2);
        fillGround(71, 95, rows - 2);
        fillGround(98, 120, rows - 2);

        for (let c = 12; c < 16; c++) setTile(rows - 5, c, 3);
        for (let c = 25; c < 29; c++) setTile(rows - 4, c, 3);
        for (let c = 33; c < 36; c++) setTile(rows - 6, c, 3);
        for (let c = 48; c < 53; c++) setTile(rows - 5, c, 3);
        for (let c = 58; c < 62; c++) setTile(rows - 4, c, 3);
        for (let c = 59; c < 61; c++) setTile(rows - 7, c, 3);
        for (let c = 75; c < 79; c++) setTile(rows - 5, c, 3);
        for (let c = 84; c < 88; c++) setTile(rows - 6, c, 3);
        for (let c = 100; c < 104; c++) setTile(rows - 4, c, 3);
        for (let c = 110; c < 114; c++) setTile(rows - 5, c, 3);

        for (let r = 0; r < rows; r++) setTile(r, 0, 1);
        for (let r = 0; r < rows; r++) setTile(r, cols - 1, 1);

        const groundImage = new Image();
        groundImage.src = 'assets/backgrounds/layer-5.png';

        const objects = [
            { name: 'start', type: 'playerStart', x: 64, y: (rows - 3) * tileSize, width: 32, height: 32 },
            {
                name: 'welcome', type: 'story', x: 160, y: (rows - 3) * tileSize, width: 64, height: 64,
                properties: [
                    { name: 'text', value: 'Welcome to VanaVie.|The forest awaits beyond...|Use WASD to move, SPACE to attack.' },
                    { name: 'speaker', value: 'Ancient Stone' },
                    { name: 'oneShot', value: true },
                ],
            },
            {
                name: 'hint', type: 'story', x: 600, y: (rows - 3) * tileSize, width: 64, height: 64,
                properties: [
                    { name: 'text', value: 'Watch your step!|The gaps ahead are deadly.' },
                    { name: 'speaker', value: 'Worn Signpost' },
                    { name: 'oneShot', value: true },
                ],
            },
        ];

        const extractProps = (obj) => {
            const props = {};
            if (obj.properties) {
                for (const p of obj.properties) props[p.name] = p.value;
            }
            return props;
        };

        this.levelManager.tileMap = {
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
                const startCol = Math.max(0, Math.floor(camera.x / tileSize));
                const endCol = Math.min(cols, Math.ceil((camera.x + camera.viewportWidth) / tileSize) + 1);
                const startRow = Math.max(0, Math.floor(camera.y / tileSize));
                const endRow = Math.min(rows, Math.ceil((camera.y + camera.viewportHeight) / tileSize) + 1);

                const useImg = groundImage.complete && groundImage.naturalWidth;
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
                                ctx.drawImage(groundImage, srcX, srcTopY, srcBrickW, srcBrickH, sx, sy, tileSize, tileSize);
                            } else {
                                ctx.fillStyle = '#555';
                                ctx.fillRect(sx, sy, tileSize, tileSize);
                            }
                        } else if (gid === 2) {
                            ctx.fillStyle = '#4a8c3f';
                            ctx.fillRect(sx, sy, tileSize, tileSize);
                            ctx.fillStyle = '#5ca84d';
                            ctx.fillRect(sx, sy, tileSize, 4);
                        } else {
                            ctx.fillStyle = '#5c3d2e';
                            ctx.fillRect(sx, sy, tileSize, tileSize);
                            ctx.fillStyle = '#4a3125';
                            ctx.fillRect(sx + 4, sy + 6, 8, 6);
                            ctx.fillRect(sx + 18, sy + 14, 10, 8);
                        }
                    }
                }
            },
        };

        this.camera.setWorldBounds(this.levelManager.tileMap.worldWidth, this.levelManager.tileMap.worldHeight);

        const startObj = this.levelManager.tileMap.getObjectsByType('playerStart')[0];
        if (startObj) {
            this.player.init(startObj.x, startObj.y - this.player.height);
        } else {
            this.player.init(64, (rows - 4) * tileSize);
        }

        this.storyManager.loadTriggers(this.levelManager.tileMap);
        this.levelManager.currentLevelName = 'level1';
    }

    update(deltaTime) {
        if (this.paused || this.gameOver) return;

        if (this.storyManager.isActive()) {
            this.storyManager.update(deltaTime, this.input.keys);
            return;
        }

        this.player.update(this.input.keys, deltaTime);

        if (this.levelManager.tileMap) {
            resolveCollisions(this.player, this.levelManager.tileMap);
        }

        this.enemyManager.update(deltaTime, this.player, this.levelManager.tileMap);
        this.storyManager.checkTriggers(this.player);
        this.levelManager.checkExits(this.player);
        this.levelManager.update();

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

        this.enemyManager.draw(ctx, this.camera);
        this.player.draw(ctx, this.camera);

        if (this.levelManager.tileMap) {
            this.levelManager.tileMap.drawLayer(ctx, this.camera, 'foreground');
        }

        this.hud.draw(ctx);
        this.storyManager.draw(ctx);
        this.levelManager.drawFade(ctx);

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
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x, screen.y, p.hitboxWidth, p.hitboxHeight);

        ctx.fillStyle = 'lime';
        ctx.font = '10px monospace';
        ctx.fillText(`pos: ${Math.round(p.x)}, ${Math.round(p.y)}`, 20, this.height - 40);
        ctx.fillText(`vel: ${p.vx.toFixed(1)}, ${p.vy.toFixed(1)}`, 20, this.height - 28);
        ctx.fillText(`state: ${p.currentState?.name}`, 20, this.height - 16);
        ctx.fillText(`ground: ${p.onGround}`, 20, this.height - 4);
    }

    restart() {
        this.gameOver = false;
        this.gameOverReason = '';
        const startObj = this.levelManager.tileMap?.getObjectsByType('playerStart')[0];
        if (startObj) {
            this.player.init(startObj.x, startObj.y - this.player.height);
        }
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
