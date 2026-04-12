import { State } from '../../game_stuff/state.js';

const PlayerState = Object.freeze({
    IDLE: 0,
    RUNNING: 1,
    JUMPING: 2,
    FALLING: 3,
    ATTACKING: 4,
    HURT: 5,
    DEAD: 6,
});

export class Idle extends State {
    constructor(entity) {
        super('IDLE', entity);
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.idle?.row ?? 0;
        this.entity.maxFrame = this.entity.config.animations?.idle?.frames ?? 3;
        this.entity.vx = 0;
    }

    handleInput(input) {
        const kb = this.entity.game.input.keyBindings;
        if (input.includes(kb.left) || input.includes(kb.right)) {
            this.entity.setState(PlayerState.RUNNING);
        } else if (input.includes(kb.up) && this.entity.onGround) {
            this.entity.setState(PlayerState.JUMPING);
        } else if (input.includes(kb.attack)) {
            this.entity.setState(PlayerState.ATTACKING);
        }
    }
}

export class Running extends State {
    constructor(entity) {
        super('RUNNING', entity);
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.run?.row ?? 1;
        this.entity.maxFrame = this.entity.config.animations?.run?.frames ?? 5;
    }

    handleInput(input) {
        const kb = this.entity.game.input.keyBindings;
        if (input.includes(kb.right)) {
            this.entity.vx = this.entity.speed;
            this.entity.facingRight = true;
        } else if (input.includes(kb.left)) {
            this.entity.vx = -this.entity.speed;
            this.entity.facingRight = false;
        } else {
            this.entity.setState(PlayerState.IDLE);
            return;
        }
        if (input.includes(kb.up) && this.entity.onGround) {
            this.entity.setState(PlayerState.JUMPING);
        } else if (input.includes(kb.attack)) {
            this.entity.setState(PlayerState.ATTACKING);
        }
    }
}

export class Jumping extends State {
    constructor(entity) {
        super('JUMPING', entity);
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.jump?.row ?? 2;
        this.entity.maxFrame = this.entity.config.animations?.jump?.frames ?? 3;
        if (this.entity.onGround) {
            this.entity.vy = this.entity.jumpForce;
            this.entity.onGround = false;
            if (this.entity.game.audio) this.entity.game.audio.play('jump');
        }
    }

    handleInput(input) {
        const kb = this.entity.game.input.keyBindings;
        if (input.includes(kb.right)) {
            this.entity.vx = this.entity.speed;
            this.entity.facingRight = true;
        } else if (input.includes(kb.left)) {
            this.entity.vx = -this.entity.speed;
            this.entity.facingRight = false;
        } else {
            this.entity.vx = 0;
        }
        if (this.entity.vy > this.entity.weight) {
            this.entity.setState(PlayerState.FALLING);
        }
    }
}

export class Falling extends State {
    constructor(entity) {
        super('FALLING', entity);
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.fall?.row ?? 3;
        this.entity.maxFrame = this.entity.config.animations?.fall?.frames ?? 2;
    }

    handleInput(input) {
        const kb = this.entity.game.input.keyBindings;
        if (input.includes(kb.right)) {
            this.entity.vx = this.entity.speed;
            this.entity.facingRight = true;
        } else if (input.includes(kb.left)) {
            this.entity.vx = -this.entity.speed;
            this.entity.facingRight = false;
        } else {
            this.entity.vx = 0;
        }
        if (this.entity.onGround) {
            this.entity.setState(PlayerState.RUNNING);
        }
    }
}

export class Attacking extends State {
    constructor(entity) {
        super('ATTACKING', entity);
        this.attackFired = false;
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.attack?.row ?? 4;
        this.entity.maxFrame = this.entity.config.animations?.attack?.frames ?? 4;
        this.entity.vx = 0;
        this.attackFired = false;
    }

    handleInput(_input) {
        const midFrame = Math.floor(this.entity.maxFrame / 2);
        if (!this.attackFired && this.entity.frameX >= midFrame) {
            this.entity.fireProjectile();
            this.attackFired = true;
        }
        if (this.entity.frameX >= this.entity.maxFrame) {
            this.entity.setState(PlayerState.IDLE);
        }
    }
}

export class Hurt extends State {
    constructor(entity) {
        super('HURT', entity);
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.hurt?.row ?? 5;
        this.entity.maxFrame = this.entity.config.animations?.hurt?.frames ?? 2;
        this.entity.vx = 0;
    }

    handleInput(_input) {
        if (this.entity.frameX >= this.entity.maxFrame) {
            this.entity.setState(PlayerState.IDLE);
        }
    }
}

export class Dead extends State {
    constructor(entity) {
        super('DEAD', entity);
    }

    enter() {
        this.entity.frameX = 0;
        this.entity.frameY = this.entity.config.animations?.dead?.row ?? 6;
        this.entity.maxFrame = this.entity.config.animations?.dead?.frames ?? 5;
        this.entity.vx = 0;
        this.entity.vy = 0;
    }

    handleInput(_input) {
        // locked in dead state until game resets
    }
}
