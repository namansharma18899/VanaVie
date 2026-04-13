import { State } from '../game_stuff/state.js';

const EnemyStateEnum = Object.freeze({
    IDLE: 0,
    PATROL: 1,
    CHASE: 2,
    ATTACK: 3,
    HURT: 4,
    DEAD: 5,
});

export class EnemyIdle extends State {
    constructor(entity) {
        super('IDLE', entity);
        this.idleTimer = 0;
        this.idleDuration = 800;
    }

    enter() {
        this.entity.setAnimation('idle');
        this.entity.fps = this.entity.config.animations?.idle?.fps || 8;
        this.entity.vx = 0;
        this.idleTimer = 0;
        this.idleDuration = 600 + Math.random() * 800;
    }

    handleInput(player, deltaTime) {
        if (this.entity.alerted) {
            this.entity.setState(EnemyStateEnum.CHASE);
            return;
        }
        const dist = this.entity.distanceTo(player);
        if (dist < this.entity.detectionRange) {
            this.entity.setState(EnemyStateEnum.CHASE);
            return;
        }
        this.idleTimer += deltaTime;
        if (this.idleTimer >= this.idleDuration) {
            this.entity.setState(EnemyStateEnum.PATROL);
        }
    }
}

export class EnemyPatrol extends State {
    constructor(entity) {
        super('PATROL', entity);
        this.patrolTimer = 0;
        this.patrolDuration = 2000;
    }

    enter() {
        this.entity.setAnimation('walk');
        this.entity.fps = this.entity.config.animations?.walk?.fps || 8;
        this.patrolTimer = 0;
        this.patrolDuration = 1500 + Math.random() * 2000;
    }

    handleInput(player, deltaTime) {
        if (this.entity.alerted) {
            this.entity.setState(EnemyStateEnum.CHASE);
            return;
        }
        const dist = this.entity.distanceTo(player);
        if (dist < this.entity.detectionRange) {
            this.entity.setState(EnemyStateEnum.CHASE);
            return;
        }

        if (this.entity.facingRight) {
            this.entity.vx = this.entity.speed * 0.5;
            if (this.entity.x >= this.entity.patrolRight) {
                this.entity.facingRight = false;
            }
        } else {
            this.entity.vx = -this.entity.speed * 0.5;
            if (this.entity.x <= this.entity.patrolLeft) {
                this.entity.facingRight = true;
            }
        }

        this.patrolTimer += deltaTime;
        if (this.patrolTimer >= this.patrolDuration) {
            this.entity.setState(EnemyStateEnum.IDLE);
        }
    }
}

export class EnemyChase extends State {
    constructor(entity) {
        super('CHASE', entity);
    }

    enter() {
        this.entity.setAnimation('walk');
        const baseFps = this.entity.config.animations?.walk?.fps || 8;
        this.entity.fps = Math.round(baseFps * 1.5);
    }

    handleInput(player, _deltaTime) {
        const dist = this.entity.distanceTo(player);
        const disengageRange = this.entity.alerted
            ? this.entity.detectionRange * 3
            : this.entity.detectionRange * 2;

        if (dist > disengageRange && !this.entity.alerted) {
            this.entity.setState(EnemyStateEnum.IDLE);
            return;
        }

        const playerCenterX = player.x + player.width / 2;
        const enemyCenterX = this.entity.x + this.entity.width / 2;

        this.entity.facingRight = playerCenterX > enemyCenterX;

        if (this.entity.isRanged) {
            const sameLevelThreshold = this.entity.height;
            const eCenterY = this.entity.y + this.entity.height / 2;
            const pCenterY = player.y + player.height / 2;
            const onSameLevel = Math.abs(eCenterY - pCenterY) < sameLevelThreshold;

            if (onSameLevel && dist <= this.entity.projectileRange) {
                if (this.entity.attackCooldown <= 0) {
                    this.entity.setState(EnemyStateEnum.ATTACK);
                    return;
                }
                this.entity.vx = 0;
                return;
            }
        }

        if (dist <= this.entity.attackRange) {
            this.entity.setState(EnemyStateEnum.ATTACK);
            return;
        }

        const chaseSpeed = this.entity.speed * 1.1;
        const mgr = this.entity.game?.enemyManager;
        const flank = mgr ? mgr.getFlankDirection(this.entity, player) : 0;

        if (flank !== 0 && dist < this.entity.detectionRange && dist > this.entity.attackRange * 2) {
            this.entity.vx = chaseSpeed * flank;
        } else if (playerCenterX > enemyCenterX) {
            this.entity.vx = chaseSpeed;
        } else {
            this.entity.vx = -chaseSpeed;
        }

        if (this.entity.canJump && this.entity.onGround && this.entity.jumpCooldown <= 0) {
            const tileMap = this.entity.game?.levelManager?.tileMap;
            if (tileMap) {
                const dir = this.entity.facingRight ? 1 : -1;
                const probeX = this.entity.x + this.entity.width / 2 + dir * (this.entity.width / 2 + 4);
                const feetY = this.entity.y + this.entity.height - 4;
                const chestY = this.entity.y + this.entity.height * 0.4;

                const wallAhead = tileMap.isSolid(probeX, chestY);
                const groundAhead = tileMap.isSolid(probeX, feetY + tileMap.tileHeight);

                if (wallAhead || !groundAhead) {
                    this.entity.jump();
                }
            }
        }
    }
}

export class EnemyAttack extends State {
    constructor(entity) {
        super('ATTACK', entity);
        this.hasDealtDamage = false;
    }

    enter() {
        this.entity.setAnimation('attack');
        this.entity.fps = this.entity.config.animations?.attack?.fps || 10;
        this.entity.vx = 0;
        this.hasDealtDamage = false;
    }

    handleInput(player, _deltaTime) {
        const playerCenterX = player.x + player.width / 2;
        const enemyCenterX = this.entity.x + this.entity.width / 2;
        this.entity.facingRight = playerCenterX > enemyCenterX;

        const midFrame = Math.floor(this.entity.maxFrame / 2);
        if (!this.hasDealtDamage && this.entity.frameX >= midFrame) {
            if (this.entity.isRanged) {
                this.entity.fireProjectile(player);
            } else {
                const dist = this.entity.distanceTo(player);
                if (dist <= this.entity.attackRange * 1.5) {
                    player.takeDamage(this.entity.damage);
                }
            }
            this.hasDealtDamage = true;
        }

        if (this.entity.frameX >= this.entity.maxFrame) {
            this.entity.attackCooldown = this.entity.attackCooldownTime;
            const dist = this.entity.distanceTo(player);
            if (dist < this.entity.detectionRange * 2) {
                this.entity.setState(EnemyStateEnum.CHASE);
            } else {
                this.entity.setState(EnemyStateEnum.IDLE);
            }
        }
    }
}

export class EnemyHurt extends State {
    constructor(entity) {
        super('HURT', entity);
    }

    enter() {
        this.entity.setAnimation('hurt');
        this.entity.fps = this.entity.config.animations?.hurt?.fps || 10;
        this.entity.vx = 0;
    }

    handleInput(player, _deltaTime) {
        if (this.entity.frameX >= this.entity.maxFrame) {
            const playerCenterX = player.x + player.width / 2;
            const enemyCenterX = this.entity.x + this.entity.width / 2;
            this.entity.facingRight = playerCenterX > enemyCenterX;
            this.entity.setState(EnemyStateEnum.CHASE);
        }
    }
}

export class EnemyDead extends State {
    constructor(entity) {
        super('DEAD', entity);
    }

    enter() {
        this.entity.setAnimation('dead');
        this.entity.fps = this.entity.config.animations?.dead?.fps || 8;
        this.entity.vx = 0;
        this.entity.vy = 0;
    }

    handleInput(_player, _deltaTime) {
        if (this.entity.frameX >= this.entity.maxFrame) {
            this.entity.markedForDeletion = true;
        }
    }
}
