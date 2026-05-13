import { EnemyIdle, EnemyPatrol, EnemyHurt, EnemyDead } from './enemyStates.js';

const EnemyState = Object.freeze({
    IDLE: 0,
    PATROL: 1,
    HURT: 2,
    DEAD: 3,
});

export { EnemyState };

export class Enemy {
    constructor(game, config) {
        this.game = game;
        this.config = config;

        this.spriteWidth = config.spriteWidth || 64;
        this.spriteHeight = config.spriteHeight || 64;
        this.width = config.drawWidth || this.spriteWidth;
        this.height = config.drawHeight || this.spriteHeight;

        this.x = config.x || 0;
        this.y = config.y || 0;
        this.vx = 0;
        this.vy = 0;

        this.speed = config.speed || 1.5;
        this.gravity = 0.5;
        this.onGround = false;
        this.facingRight = config.facingRight ?? true;

        this.health = config.health || 30;
        this.maxHealth = this.health;
        this.damage = config.damage || 10;

        this.patrolLeft = config.patrolLeft ?? (this.x - 100);
        this.patrolRight = config.patrolRight ?? (this.x + 100);

        this.hitboxOffsetX = config.hitboxOffsetX || 12;
        this.hitboxOffsetY = config.hitboxOffsetY || 12;
        this.hitboxWidth = config.hitboxWidth || 40;
        this.hitboxHeight = config.hitboxHeight || 52;

        this.hitInvincibilityTimer = 0;
        this.hitInvincibilityDuration = 400;

        this.image = null;
        this.activeImage = null;
        this.animationImages = {};

        if (config.spriteSrc) {
            this.image = new Image();
            this.image.src = config.spriteSrc;
            this.activeImage = this.image;
        }

        const anims = config.animations || {};
        for (const [name, anim] of Object.entries(anims)) {
            if (anim.src) {
                const img = new Image();
                img.src = anim.src;
                this.animationImages[name] = img;
            }
        }

        this.frameX = 0;
        this.frameY = 0;
        this.maxFrame = 0;
        this.fps = 10;
        this.frameTimer = 0;

        this.markedForDeletion = false;

        this.states = [
            new EnemyIdle(this),
            new EnemyPatrol(this),
            new EnemyHurt(this),
            new EnemyDead(this),
        ];
        this.currentState = null;
        this.setState(EnemyState.PATROL);
    }

    setAnimation(animName) {
        const anim = this.config.animations?.[animName];
        if (!anim) return;
        this.frameX = 0;
        this.maxFrame = (anim.frames ?? 4) - 1;
        this.frameTimer = 0;
        if (this.animationImages[animName]) {
            this.activeImage = this.animationImages[animName];
            this.frameY = 0;
        } else {
            this.activeImage = this.image;
            this.frameY = anim.row ?? 0;
        }
    }

    setState(stateIndex) {
        this.currentState = this.states[stateIndex];
        this.currentState.enter();
    }

    update(deltaTime, player) {
        if (this.currentState) {
            this.currentState.handleInput(player, deltaTime);
        }

        this.vy += this.gravity;

        if (this.hitInvincibilityTimer > 0) this.hitInvincibilityTimer -= deltaTime;

        this.advanceFrame(deltaTime);
    }

    advanceFrame(deltaTime) {
        this.frameTimer += deltaTime;
        const frameInterval = 1000 / this.fps;
        if (this.frameTimer >= frameInterval) {
            this.frameTimer -= frameInterval;
            this.frameX = this.frameX < this.maxFrame ? this.frameX + 1 : 0;
        }
    }

    draw(ctx, camera) {
        if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

        const img = this.activeImage || this.image;
        if (!img) return;

        const screen = camera.worldToScreen(this.x, this.y);
        const s = camera.scale;
        const sx = Math.round(screen.x);
        const sy = Math.round(screen.y);
        const dw = Math.round(this.width * s);
        const dh = Math.round(this.height * s);

        ctx.save();
        if (!this.facingRight) {
            ctx.translate(sx + dw, sy);
            ctx.scale(-1, 1);
            ctx.drawImage(
                img,
                this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                this.spriteWidth, this.spriteHeight,
                0, 0,
                dw, dh
            );
        } else {
            ctx.drawImage(
                img,
                this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                this.spriteWidth, this.spriteHeight,
                sx, sy,
                dw, dh
            );
        }
        ctx.restore();
    }

    takeDamage(amount) {
        if (this.currentState === this.states[EnemyState.DEAD]) return;
        if (this.hitInvincibilityTimer > 0) return;

        this.health = Math.max(0, this.health - amount);
        this.hitInvincibilityTimer = this.hitInvincibilityDuration;

        if (this.health <= 0) {
            this.setState(EnemyState.DEAD);
        } else {
            this.setState(EnemyState.HURT);
        }
    }
}
