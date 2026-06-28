import { State } from '../game_stuff/state.js';

const EnemyStateEnum = Object.freeze({
    IDLE: 0,
    PATROL: 1,
    HURT: 2,
    DEAD: 3,
    CHASE: 4,
    ATTACK: 5,
});

function distToPlayer(entity, player) {
    const ex = entity.x + entity.hitboxOffsetX + entity.hitboxWidth / 2;
    const px = player.x + player.hitboxOffsetX + player.hitboxWidth / 2;
    return Math.abs(ex - px);
}

function facePlayer(entity, player) {
    const ex = entity.x + entity.hitboxOffsetX + entity.hitboxWidth / 2;
    const px = player.x + player.hitboxOffsetX + player.hitboxWidth / 2;
    entity.facingRight = px > ex;
}

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
        if (this.entity.config.detectionRange && distToPlayer(this.entity, player) < this.entity.config.detectionRange) {
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
        if (this.entity.config.detectionRange && distToPlayer(this.entity, player) < this.entity.config.detectionRange) {
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
        this.entity.fps = this.entity.config.animations?.walk?.fps || 8;
    }

    handleInput(player, deltaTime) {
        const dist = distToPlayer(this.entity, player);
        const attackRange = this.entity.config.isRanged
            ? (this.entity.config.projectileRange || 250)
            : (this.entity.config.attackRange || 55);
        const loseRange = (this.entity.config.detectionRange || 180) * 2;

        if (dist > loseRange) {
            this.entity.setState(EnemyStateEnum.PATROL);
            return;
        }

        if (dist <= attackRange && this.entity.attackCooldown <= 0) {
            this.entity.setState(EnemyStateEnum.ATTACK);
            return;
        }

        facePlayer(this.entity, player);
        this.entity.vx = this.entity.facingRight ? this.entity.speed : -this.entity.speed;
    }
}

export class EnemyAttack extends State {
    constructor(entity) {
        super('ATTACK', entity);
        this.attackFired = false;
    }

    enter() {
        this.entity.setAnimation('attack');
        this.entity.fps = this.entity.config.animations?.attack?.fps || 10;
        this.entity.vx = 0;
        this.attackFired = false;
    }

    handleInput(player, deltaTime) {
        const midFrame = Math.floor(this.entity.maxFrame / 2);
        if (!this.attackFired && this.entity.frameX >= midFrame) {
            this.attackFired = true;
            if (this.entity.config.isRanged) {
                this.entity.fireProjectile();
            } else {
                const dist = distToPlayer(this.entity, player);
                if (dist <= (this.entity.config.attackRange || 55)) {
                    player.takeDamage(this.entity.damage);
                }
            }
        }

        if (this.entity.frameX >= this.entity.maxFrame) {
            this.entity.attackCooldown = this.entity.config.attackCooldownTime || 1000;
            this.entity.setState(EnemyStateEnum.CHASE);
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

    handleInput(player, deltaTime) {
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
