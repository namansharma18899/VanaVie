import { EnemyIdle, EnemyPatrol, EnemyChase, EnemyAttack, EnemyHurt, EnemyDead } from './enemyStates.js';
import { EnemyProjectile } from './enemyProjectile.js';

const EnemyState = Object.freeze({
    IDLE: 0,
    PATROL: 1,
    CHASE: 2,
    ATTACK: 3,
    HURT: 4,
    DEAD: 5,
});

export { EnemyState };

let _alertImage = null;
function getAlertImage() {
    if (!_alertImage) {
        _alertImage = new Image();
        _alertImage.src = 'assets/sprites/Enemy/alert/bolt_bronze.png';
    }
    return _alertImage;
}

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
        this.detectionRange = config.detectionRange || 200;
        this.attackRange = config.attackRange || 50;
        this.attackCooldown = 0;
        this.attackCooldownTime = config.attackCooldownTime || 1000;

        this.patrolLeft = config.patrolLeft ?? (this.x - 100);
        this.patrolRight = config.patrolRight ?? (this.x + 100);

        this.hitboxOffsetX = config.hitboxOffsetX || 12;
        this.hitboxOffsetY = config.hitboxOffsetY || 12;
        this.hitboxWidth = config.hitboxWidth || 40;
        this.hitboxHeight = config.hitboxHeight || 52;

        this.isRanged = config.isRanged || false;
        this.projectileRange = config.projectileRange || 250;
        this.projectiles = [];
        this.projectileConfig = config.projectileConfig || null;
        this._projectileImage = null;
        if (this.projectileConfig?.src) {
            this._projectileImage = new Image();
            this._projectileImage.src = this.projectileConfig.src;
        }

        this.alerted = false;
        this.alertTimer = 0;
        this.alertImage = getAlertImage();

        this.hitInvincibilityTimer = 0;
        this.hitInvincibilityDuration = 400;

        this.canJump = config.canJump || false;
        this.jumpForce = config.jumpForce || -10;
        this.jumpCooldown = 0;
        this.jumpCooldownTime = 500;

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
            new EnemyChase(this),
            new EnemyAttack(this),
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

    fireProjectile(player) {
        const playerCX = player.x + player.width / 2;
        const enemyCX = this.x + this.width / 2;
        const direction = playerCX > enemyCX ? 1 : -1;

        const spawnX = direction > 0
            ? this.x + this.width
            : this.x - (this.projectileConfig?.height || 54);
        const spawnY = this.y + this.height / 2 - (this.projectileConfig?.width || 9) / 2;

        const proj = new EnemyProjectile(spawnX, spawnY, direction, {
            ...this.projectileConfig,
            image: this._projectileImage,
            damage: this.projectileConfig?.damage || this.damage,
        });
        this.projectiles.push(proj);
    }

    jump() {
        if (this.onGround && this.jumpCooldown <= 0) {
            this.vy = this.jumpForce;
            this.onGround = false;
            this.jumpCooldown = this.jumpCooldownTime;
        }
    }

    update(deltaTime, player) {
        if (this.currentState) {
            this.currentState.handleInput(player, deltaTime);
        }

        this.vy += this.gravity;

        if (this.attackCooldown > 0) this.attackCooldown -= deltaTime;
        if (this.hitInvincibilityTimer > 0) this.hitInvincibilityTimer -= deltaTime;
        if (this.jumpCooldown > 0) this.jumpCooldown -= deltaTime;
        if (this.alertTimer > 0) {
            this.alertTimer -= deltaTime;
            if (this.alertTimer <= 0) {
                this.alerted = false;
                this.alertTimer = 0;
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].update(deltaTime);
            if (this.projectiles[i].markedForDeletion) {
                this.projectiles.splice(i, 1);
            }
        }

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

        if (this.alerted && this.alertImage?.complete && this.alertImage.naturalWidth) {
            const iconW = 19 * s;
            const iconH = 30 * s;
            const iconX = screen.x + (dw - iconW) / 2;
            const iconY = screen.y - iconH - 4 * s;
            const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 200);
            ctx.globalAlpha = pulse;
            ctx.drawImage(this.alertImage, iconX, iconY, iconW, iconH);
            ctx.globalAlpha = 1.0;
        }

        for (const proj of this.projectiles) {
            proj.draw(ctx, camera);
        }
    }

    takeDamage(amount) {
        if (this.currentState === this.states[EnemyState.DEAD]) return;
        if (this.hitInvincibilityTimer > 0) return;

        this.health = Math.max(0, this.health - amount);
        this.hitInvincibilityTimer = this.hitInvincibilityDuration;

        if (!this.alerted) {
            this.alerted = true;
            this.alertTimer = 6000;
        }
        if (this.game?.enemyManager) {
            this.game.enemyManager.alertNearby(this);
        }

        if (this.health <= 0) {
            this.setState(EnemyState.DEAD);
        } else {
            this.setState(EnemyState.HURT);
        }
    }

    distanceTo(target) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const tx = target.x + target.width / 2;
        const ty = target.y + target.height / 2;
        return Math.hypot(tx - cx, ty - cy);
    }

    /** True when the target is roughly on the same ground level. */
    isOnSameLevel(target) {
        const eFeet = this.y + this.height;
        const tFeet = target.y + target.height;
        return Math.abs(eFeet - tFeet) < this.height * 1.2;
    }
}
