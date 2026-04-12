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
    }

    handleInput(player, _deltaTime) {
        const dist = this.entity.distanceTo(player);
        const disengageRange = this.entity.alerted
            ? this.entity.detectionRange * 2
            : this.entity.detectionRange * 1.2;

        if (dist > disengageRange && !this.entity.alerted) {
            this.entity.setState(EnemyStateEnum.IDLE);
            return;
        }

        const playerCenterX = player.x + player.width / 2;
        const enemyCenterX = this.entity.x + this.entity.width / 2;

        if (this.entity.isRanged) {
            const sameLevelThreshold = this.entity.height;
            const eCenterY = this.entity.y + this.entity.height / 2;
            const pCenterY = player.y + player.height / 2;
            const onSameLevel = Math.abs(eCenterY - pCenterY) < sameLevelThreshold;

            if (onSameLevel && dist <= this.entity.projectileRange) {
                this.entity.facingRight = playerCenterX > enemyCenterX;
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

        if (playerCenterX > enemyCenterX) {
            this.entity.vx = this.entity.speed;
            this.entity.facingRight = true;
        } else {
            this.entity.vx = -this.entity.speed;
            this.entity.facingRight = false;
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
        this.entity.vx = 0;
        this.hasDealtDamage = false;
    }

    handleInput(player, _deltaTime) {
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
            if (dist <= this.entity.attackRange && this.entity.attackCooldown <= 0) {
                this.entity.setState(EnemyStateEnum.ATTACK);
            } else if (dist < this.entity.detectionRange) {
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
        this.entity.vx = 0;
    }

    handleInput(_player, _deltaTime) {
        if (this.entity.frameX >= this.entity.maxFrame) {
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
        this.entity.vx = 0;
        this.entity.vy = 0;
    }

    handleInput(_player, _deltaTime) {
        if (this.entity.frameX >= this.entity.maxFrame) {
            this.entity.markedForDeletion = true;
        }
    }
}
