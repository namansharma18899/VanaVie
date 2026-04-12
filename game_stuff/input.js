export class InputHandler {
    constructor(keyBindings) {
        this.keys = [];
        this.keyBindings = keyBindings;
        this.validKeys = Object.values(keyBindings);

        window.addEventListener('keydown', (e) => {
            if (this.validKeys.includes(e.key) && !this.keys.includes(e.key)) {
                this.keys.push(e.key);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.validKeys.includes(e.key)) {
                this.keys.splice(this.keys.indexOf(e.key), 1);
            }
        });
    }
}

export const DEFAULT_KEY_BINDINGS = Object.freeze({
    up: 'w',
    down: 's',
    left: 'a',
    right: 'd',
    attack: ' ',
    interact: 'e',
});
