import { State } from '../game_stuff/state.js';

const EnemyStateEnum = Object.freeze({
    IDLE: 0,
    PATROL: 1,
    HURT: 2,
    DEAD: 3,
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
            this.entity.setState(EnemyStateEnum.PATROL);
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
