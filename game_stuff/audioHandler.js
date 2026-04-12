export class AudioManager {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.musicVolume = 0.3;
        this.sfxVolume = 0.5;
        this.muted = false;
    }

    register(name, src, options = {}) {
        const audio = new Audio(src);
        audio.volume = options.volume ?? this.sfxVolume;
        audio.preload = 'auto';
        this.sounds[name] = {
            audio,
            pool: [audio],
            poolSize: options.poolSize || 3,
            src,
            volume: options.volume ?? this.sfxVolume,
        };

        for (let i = 1; i < (options.poolSize || 3); i++) {
            const clone = new Audio(src);
            clone.volume = options.volume ?? this.sfxVolume;
            this.sounds[name].pool.push(clone);
        }
    }

    play(name) {
        if (this.muted) return;
        const sound = this.sounds[name];
        if (!sound) return;

        const available = sound.pool.find(a => a.paused || a.ended);
        if (available) {
            available.currentTime = 0;
            available.volume = sound.volume;
            available.play().catch(() => {});
        }
    }

    playMusic(src) {
        if (this.music) {
            this.music.pause();
            this.music.currentTime = 0;
        }
        this.music = new Audio(src);
        this.music.loop = true;
        this.music.volume = this.musicVolume;
        if (!this.muted) {
            this.music.play().catch(() => {});
        }
    }

    stopMusic() {
        if (this.music) {
            this.music.pause();
            this.music.currentTime = 0;
            this.music = null;
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            if (this.music) this.music.pause();
        } else {
            if (this.music) this.music.play().catch(() => {});
        }
    }

    setMusicVolume(vol) {
        this.musicVolume = vol;
        if (this.music) this.music.volume = vol;
    }

    setSfxVolume(vol) {
        this.sfxVolume = vol;
        for (const sound of Object.values(this.sounds)) {
            sound.volume = vol;
            for (const a of sound.pool) {
                a.volume = vol;
            }
        }
    }
}
