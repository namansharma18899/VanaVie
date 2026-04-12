import { EnemyIdle, EnemyPatrol, EnemyChase, EnemyAttack, EnemyHurt, EnemyDead } from './enemyStates.js';

const EnemyState = Object.freeze({
    IDLE: 0,
    PATROL: 1,
    CHASE: 2,
    ATTACK: 3,
    HURT: 4,
    DEAD: 5,
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

        this.image = new Image();
        this.image.src = config.spriteSrc || '';
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
        this.setState(EnemyState.IDLE);
    }

    setState(stateIndex) {
        this.currentState = this.states[stateIndex];
        this.currentState.enter();
    }

    update(deltaTime, player) {
        if (this.currentState) {
            this.currentState.handleInput(player);
        }

        this.vy += this.gravity;

        if (this.attackCooldown > 0) this.attackCooldown -= deltaTime;

        this.advanceFrame(deltaTime);
    }

    advanceFrame(deltaTime) {
        if (this.frameTimer > 1000 / this.fps) {
            this.frameTimer = 0;
            this.frameX = this.frameX < this.maxFrame ? this.frameX + 1 : 0;
        } else {
            this.frameTimer += deltaTime;
        }
    }

    draw(ctx, camera) {
        if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

        const screen = camera.worldToScreen(this.x, this.y);

        ctx.save();
        if (!this.facingRight) {
            ctx.translate(screen.x + this.width, screen.y);
            ctx.scale(-1, 1);
            ctx.drawImage(
                this.image,
                this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                this.spriteWidth, this.spriteHeight,
                0, 0,
                this.width, this.height
            );
        } else {
            ctx.drawImage(
                this.image,
                this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                this.spriteWidth, this.spriteHeight,
                screen.x, screen.y,
                this.width, this.height
            );
        }
        ctx.restore();
    }

    takeDamage(amount) {
        if (this.currentState === this.states[EnemyState.DEAD]) return;
        this.health = Math.max(0, this.health - amount);
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
}
