import { Enemy, EnemyState } from './enemy.js';
import { resolveCollisions, checkEntityCollision } from '../game_stuff/collision.js';

const ALERT_RADIUS = 500;
const ALERT_DURATION = 6000;

export class EnemyManager {
    constructor(game) {
        this.game = game;
        this.enemies = [];
        this.enemyConfigs = {};
    }

    registerEnemyType(typeName, config) {
        this.enemyConfigs[typeName] = config;
    }

    spawnFromMap(tileMap) {
        this.enemies = [];
        const spawns = tileMap.getObjectsByType('enemy');
        for (const spawn of spawns) {
            const typeName = spawn.properties.enemyType || spawn.name || 'default';
            this.spawnManual(typeName, spawn.x, spawn.y, {
                patrolLeft: spawn.properties.patrolLeft,
                patrolRight: spawn.properties.patrolRight,
            });
        }
    }

    spawnManual(typeName, x, y, overrides = {}) {
        const baseConfig = this.enemyConfigs[typeName] || this.enemyConfigs['default'] || {};
        const config = {
            ...baseConfig,
            x,
            y: y - (baseConfig.drawHeight || baseConfig.spriteHeight || 64),
            patrolLeft: overrides.patrolLeft ?? x - 100,
            patrolRight: overrides.patrolRight ?? x + 100,
            ...overrides,
        };
        const enemy = new Enemy(this.game, config);
        this.enemies.push(enemy);
        return enemy;
    }

    clear() {
        this.enemies = [];
    }

    alertNearby(sourceEnemy) {
        for (const other of this.enemies) {
            if (other === sourceEnemy || other.alerted) continue;
            if (other.currentState === other.states[EnemyState.DEAD]) continue;
            const dist = sourceEnemy.distanceTo(other);
            if (dist <= ALERT_RADIUS) {
                other.alerted = true;
                other.alertTimer = ALERT_DURATION;
            }
        }
    }

    update(deltaTime, player, tileMap) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const wasChasing = enemy.currentState === enemy.states[EnemyState.CHASE]
                             || enemy.currentState === enemy.states[EnemyState.ATTACK];

            enemy.update(deltaTime, player);
            resolveCollisions(enemy, tileMap);

            if (enemy.markedForDeletion) {
                this.enemies.splice(i, 1);
                continue;
            }

            const nowChasing = enemy.currentState === enemy.states[EnemyState.CHASE]
                             || enemy.currentState === enemy.states[EnemyState.ATTACK];
            if (!wasChasing && nowChasing) {
                enemy.alerted = true;
                enemy.alertTimer = ALERT_DURATION;
                this.alertNearby(enemy);
            }

            this.checkProjectileHits(enemy, player);
            this.checkEnemyProjectileHits(enemy, player);
        }
    }

    checkProjectileHits(enemy, player) {
        for (const projectile of player.projectiles) {
            if (projectile.markedForDeletion) continue;
            if (projectile.collidesWith(enemy)) {
                projectile.markedForDeletion = true;
                enemy.takeDamage(player.damage);
                if (this.game.audio) this.game.audio.play('enemyHurt');
            }
        }
    }

    checkEnemyProjectileHits(enemy, player) {
        for (const proj of enemy.projectiles) {
            if (proj.markedForDeletion) continue;
            if (proj.collidesWithPlayer(player)) {
                proj.markedForDeletion = true;
                player.takeDamage(proj.damage);
            }
        }
    }

    draw(ctx, camera) {
        for (const enemy of this.enemies) {
            enemy.draw(ctx, camera);
        }
    }
}
