import { Idle, Running, Jumping, Falling, Attacking, Hurt, Dead } from './states/playerStates.js';
import { Projectile } from './projectile.js';

const PlayerState = Object.freeze({
    IDLE: 0,
    RUNNING: 1,
    JUMPING: 2,
    FALLING: 3,
    ATTACKING: 4,
    HURT: 5,
    DEAD: 6,
});

export { PlayerState };

export class Player {
    constructor(game, characterConfig) {
        this.game = game;
        this.config = characterConfig;

        this.spriteWidth = characterConfig.spriteWidth || 64;
        this.spriteHeight = characterConfig.spriteHeight || 64;
        this.width = characterConfig.drawWidth || this.spriteWidth;
        this.height = characterConfig.drawHeight || this.spriteHeight;

        this.x = 100;
        this.y = 300;
        this.vx = 0;
        this.vy = 0;

        this.speed = characterConfig.speed || 3;
        this.jumpForce = characterConfig.jumpForce || -12;
        this.gravity = 0.5;
        this.weight = 1;
        this.onGround = false;
        this.facingRight = true;

        this.health = characterConfig.maxHealth || 100;
        this.maxHealth = this.health;
        this.displayHealth = this.health;
        this.damage = characterConfig.damage || 10;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.invincibleDuration = 1000;

        this.hitboxOffsetX = characterConfig.hitboxOffsetX || 16;
        this.hitboxOffsetY = characterConfig.hitboxOffsetY || 16;
        this.hitboxWidth = characterConfig.hitboxWidth || 32;
        this.hitboxHeight = characterConfig.hitboxHeight || 48;

        this.image = null;
        this.activeImage = null;
        this.animationImages = {};

        if (characterConfig.spriteSrc) {
            this.image = new Image();
            this.image.src = characterConfig.spriteSrc;
            this.activeImage = this.image;
        }

        const anims = characterConfig.animations || {};
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
        this.fps = 12;
        this.frameTimer = 0;

        this.projectiles = [];
        this.attackCooldown = 0;

        this.states = [
            new Idle(this),
            new Running(this),
            new Jumping(this),
            new Falling(this),
            new Attacking(this),
            new Hurt(this),
            new Dead(this),
        ];
        this.currentState = null;
    }

    init(startX, startY) {
        this.x = startX;
        this.y = startY;
        this.health = this.maxHealth;
        this.displayHealth = this.health;
        this.setState(PlayerState.IDLE);
    }

    setState(stateIndex) {
        this.currentState = this.states[stateIndex];
        this.currentState.enter();
    }

    setAnimation(animName) {
        const anim = this.config.animations?.[animName];
        if (!anim) return;
        this.frameX = 0;
        this.maxFrame = anim.frames ?? 3;
        if (this.animationImages[animName]) {
            this.activeImage = this.animationImages[animName];
            this.frameY = 0;
        } else {
            this.activeImage = this.image;
            this.frameY = anim.row ?? 0;
        }
    }

    update(input, deltaTime) {
        if (this.currentState) {
            this.currentState.handleInput(input);
        }

        this.advanceFrame(deltaTime);

        if (this.invincible) {
            this.invincibleTimer += deltaTime;
            if (this.invincibleTimer >= this.invincibleDuration) {
                this.invincible = false;
                this.invincibleTimer = 0;
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown -= deltaTime;

        this.vy += this.gravity;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].update(deltaTime);
            if (this.projectiles[i].markedForDeletion) {
                this.projectiles.splice(i, 1);
            }
        }
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
        if (this.invincible && Math.floor(this.invincibleTimer / 100) % 2 === 0) return;

        const img = this.activeImage || this.image;
        if (!img) return;

        const screen = camera.worldToScreen(this.x, this.y);

        ctx.save();
        if (!this.facingRight) {
            ctx.translate(screen.x + this.width, screen.y);
            ctx.scale(-1, 1);
            ctx.drawImage(
                img,
                this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                this.spriteWidth, this.spriteHeight,
                0, 0,
                this.width, this.height
            );
        } else {
            ctx.drawImage(
                img,
                this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                this.spriteWidth, this.spriteHeight,
                screen.x, screen.y,
                this.width, this.height
            );
        }
        ctx.restore();

        for (const projectile of this.projectiles) {
            projectile.draw(ctx, camera);
        }
    }

    takeDamage(amount) {
        if (this.invincible || this.currentState === this.states[PlayerState.DEAD]) return;
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.setState(PlayerState.DEAD);
        } else {
            this.setState(PlayerState.HURT);
            this.invincible = true;
            this.invincibleTimer = 0;
        }
        if (this.game.audio) this.game.audio.play('hurt');
    }

    fireProjectile() {
        if (this.attackCooldown > 0) return;
        const dir = this.facingRight ? 1 : -1;
        const px = this.facingRight ? this.x + this.width : this.x;
        const py = this.y + this.height / 2;
        this.projectiles.push(new Projectile(px, py, dir, this.config.projectile));
        this.attackCooldown = 500;
        if (this.game.audio) this.game.audio.play('attack');
    }
}
