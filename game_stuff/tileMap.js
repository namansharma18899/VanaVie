export class TileMap {
    constructor(mapData, tilesetImages) {
        this.mapData = mapData;
        this.tileWidth = mapData.tilewidth;
        this.tileHeight = mapData.tileheight;
        this.cols = mapData.width;
        this.rows = mapData.height;
        this.worldWidth = this.cols * this.tileWidth;
        this.worldHeight = this.rows * this.tileHeight;
        this.tilesetImages = tilesetImages;
        this.tilesets = this.parseTilesets(mapData.tilesets);
        this.layers = this.parseLayers(mapData.layers);
    }

    parseTilesets(tilesets) {
        return tilesets.map((ts) => ({
            firstGid: ts.firstgid,
            tileWidth: ts.tilewidth,
            tileHeight: ts.tileheight,
            columns: ts.columns,
            tileCount: ts.tilecount,
            image: this.tilesetImages[ts.name] || this.tilesetImages[ts.source],
            name: ts.name,
        }));
    }

    parseLayers(layers) {
        const result = {};
        for (const layer of layers) {
            if (layer.type === 'tilelayer') {
                result[layer.name] = {
                    type: 'tile',
                    data: layer.data,
                    width: layer.width,
                    height: layer.height,
                    visible: layer.visible !== false,
                    properties: this.extractProperties(layer.properties),
                };
            } else if (layer.type === 'objectgroup') {
                result[layer.name] = {
                    type: 'object',
                    objects: layer.objects || [],
                    visible: layer.visible !== false,
                    properties: this.extractProperties(layer.properties),
                };
            }
        }
        return result;
    }

    extractProperties(props) {
        if (!props) return {};
        const result = {};
        for (const p of props) {
            result[p.name] = p.value;
        }
        return result;
    }

    getTilesetForGid(gid) {
        for (let i = this.tilesets.length - 1; i >= 0; i--) {
            if (gid >= this.tilesets[i].firstGid) return this.tilesets[i];
        }
        return null;
    }

    isSolid(worldX, worldY) {
        const col = Math.floor(worldX / this.tileWidth);
        const row = Math.floor(worldY / this.tileHeight);
        const collisionLayer = this.layers['collision'] || this.layers['terrain'];
        if (!collisionLayer || collisionLayer.type !== 'tile') return false;
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return true;
        const index = row * collisionLayer.width + col;
        return collisionLayer.data[index] !== 0;
    }

    getTileAt(col, row, layerName) {
        const layer = this.layers[layerName];
        if (!layer || layer.type !== 'tile') return 0;
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
        return layer.data[row * layer.width + col];
    }

    getObjectsByType(type) {
        const results = [];
        for (const layer of Object.values(this.layers)) {
            if (layer.type !== 'object') continue;
            for (const obj of layer.objects) {
                if (obj.type === type || obj.class === type) {
                    results.push({
                        x: obj.x,
                        y: obj.y,
                        width: obj.width,
                        height: obj.height,
                        name: obj.name,
                        properties: this.extractProperties(obj.properties),
                    });
                }
            }
        }
        return results;
    }

    drawLayer(ctx, camera, layerName) {
        const layer = this.layers[layerName];
        if (!layer || layer.type !== 'tile' || !layer.visible) return;

        const startCol = Math.max(0, Math.floor(camera.x / this.tileWidth));
        const endCol = Math.min(this.cols, Math.ceil((camera.x + camera.viewportWidth) / this.tileWidth) + 1);
        const startRow = Math.max(0, Math.floor(camera.y / this.tileHeight));
        const endRow = Math.min(this.rows, Math.ceil((camera.y + camera.viewportHeight) / this.tileHeight) + 1);

        for (let row = startRow; row < endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                const gid = layer.data[row * layer.width + col];
                if (gid === 0) continue;

                const tileset = this.getTilesetForGid(gid);
                if (!tileset || !tileset.image) continue;

                const localId = gid - tileset.firstGid;
                const srcX = (localId % tileset.columns) * tileset.tileWidth;
                const srcY = Math.floor(localId / tileset.columns) * tileset.tileHeight;

                const screenPos = camera.worldToScreen(col * this.tileWidth, row * this.tileHeight);

                ctx.drawImage(
                    tileset.image,
                    srcX, srcY,
                    tileset.tileWidth, tileset.tileHeight,
                    Math.round(screenPos.x), Math.round(screenPos.y),
                    this.tileWidth, this.tileHeight
                );
            }
        }
    }
}
