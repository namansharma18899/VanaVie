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
        this.idleDuration = 2000;
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.idle?.row ?? 0;
        this.entity.maxFrame = this.entity.config.animations?.idle?.frames ?? 3;
        this.entity.vx = 0;
        this.idleTimer = 0;
    }

    handleInput(player) {
        const dist = this.entity.distanceTo(player);
        if (dist < this.entity.detectionRange) {
            this.entity.setState(EnemyStateEnum.CHASE);
            return;
        }
        this.idleTimer += 16;
        if (this.idleTimer >= this.idleDuration) {
            this.entity.setState(EnemyStateEnum.PATROL);
        }
    }
}

export class EnemyPatrol extends State {
    constructor(entity) {
        super('PATROL', entity);
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.walk?.row ?? 1;
        this.entity.maxFrame = this.entity.config.animations?.walk?.frames ?? 5;
    }

    handleInput(player) {
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
    }
}

export class EnemyChase extends State {
    constructor(entity) {
        super('CHASE', entity);
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.walk?.row ?? 1;
        this.entity.maxFrame = this.entity.config.animations?.walk?.frames ?? 5;
    }

    handleInput(player) {
        const dist = this.entity.distanceTo(player);

        if (dist > this.entity.detectionRange * 1.5) {
            this.entity.setState(EnemyStateEnum.IDLE);
            return;
        }

        if (dist <= this.entity.attackRange) {
            this.entity.setState(EnemyStateEnum.ATTACK);
            return;
        }

        const playerCenterX = player.x + player.width / 2;
        const enemyCenterX = this.entity.x + this.entity.width / 2;

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
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.attack?.row ?? 2;
        this.entity.maxFrame = this.entity.config.animations?.attack?.frames ?? 4;
        this.entity.vx = 0;
        this.hasDealtDamage = false;
    }

    handleInput(player) {
        const midFrame = Math.floor(this.entity.maxFrame / 2);
        if (!this.hasDealtDamage && this.entity.frameX >= midFrame) {
            const dist = this.entity.distanceTo(player);
            if (dist <= this.entity.attackRange * 1.5) {
                player.takeDamage(this.entity.damage);
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
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.hurt?.row ?? 3;
        this.entity.maxFrame = this.entity.config.animations?.hurt?.frames ?? 2;
        this.entity.vx = 0;
    }

    handleInput(_player) {
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
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.dead?.row ?? 4;
        this.entity.maxFrame = this.entity.config.animations?.dead?.frames ?? 5;
        this.entity.vx = 0;
        this.entity.vy = 0;
    }

    handleInput(_player) {
        if (this.entity.frameX >= this.entity.maxFrame) {
            this.entity.markedForDeletion = true;
        }
    }
}
