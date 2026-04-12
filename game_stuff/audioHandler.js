export class AudioManager {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.musicVolume = 0.3;
        this.sfxVolume = 0.5;
        this.muted = false;

        this._crossfading = false;
        this._crossfadeTimer = 0;
        this._crossfadeDuration = 0;
        this._fadeOutTrack = null;

        this.sceneTracks = {};
        this.currentScene = null;
        this._savedScene = null;
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

    registerScene(sceneName, src, options = {}) {
        this.sceneTracks[sceneName] = { src, ...options };
    }

    setScene(sceneName) {
        if (sceneName === this.currentScene) return;
        const track = this.sceneTracks[sceneName];
        if (!track) return;
        this.currentScene = sceneName;
        this.crossfadeTo(track.src, track.crossfadeDuration || 1500, { startTime: track.startTime || 0 });
    }

    saveScene() {
        this._savedScene = this.currentScene;
    }

    restoreScene() {
        if (this._savedScene) {
            this.setScene(this._savedScene);
            this._savedScene = null;
        }
    }

    lowerMusicVolume(factor = 0.3) {
        if (this.music) {
            this.music.volume = this.musicVolume * factor;
        }
    }

    restoreMusicVolume() {
        if (this.music) {
            this.music.volume = this.musicVolume;
        }
    }

    playMusic(src, { startTime = 0 } = {}) {
        if (this.music) {
            this.music.pause();
            this.music.currentTime = 0;
        }
        this.music = new Audio(src);
        this.music.loop = true;
        this.music.volume = this.musicVolume;
        this.musicStartTime = startTime;
        if (startTime > 0) {
            this.music.currentTime = startTime;
            this.music.addEventListener('timeupdate', () => {
                if (this.music && this.music.currentTime < startTime) {
                    this.music.currentTime = startTime;
                }
            });
        }
        if (!this.muted) {
            this.music.play().catch(() => {});
        }
    }

    crossfadeTo(src, duration = 1500, { startTime = 0 } = {}) {
        if (this.music) {
            this._fadeOutTrack = this.music;
            this._crossfading = true;
            this._crossfadeTimer = 0;
            this._crossfadeDuration = duration;
        }

        this.music = new Audio(src);
        this.music.loop = true;
        this.music.volume = 0;
        if (startTime > 0) {
            this.music.currentTime = startTime;
            const st = startTime;
            this.music.addEventListener('timeupdate', () => {
                if (this.music && this.music.currentTime < st) {
                    this.music.currentTime = st;
                }
            });
        }
        if (!this.muted) {
            this.music.play().catch(() => {});
        }
    }

    updateCrossfade(deltaTime) {
        if (!this._crossfading) return;

        this._crossfadeTimer += deltaTime;
        const t = Math.min(1, this._crossfadeTimer / this._crossfadeDuration);

        if (this._fadeOutTrack) {
            this._fadeOutTrack.volume = Math.max(0, this.musicVolume * (1 - t));
        }
        if (this.music) {
            this.music.volume = this.musicVolume * t;
        }

        if (t >= 1) {
            if (this._fadeOutTrack) {
                this._fadeOutTrack.pause();
                this._fadeOutTrack.currentTime = 0;
                this._fadeOutTrack = null;
            }
            this._crossfading = false;
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
