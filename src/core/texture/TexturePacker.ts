import Texture from "core/texture/Texture";
import debugCanvas from "../../util/debug/DebugCanvas";
import DebugCanvas from "../../util/debug/DebugCanvas";
import DebugUtil from "../../util/debug/DebugUtil";
import MathUtil from '../../util/MathUtil';

interface TextureRegion {
    x: number,
    y: number,
    width: number,
    height: number,
}

interface PackedTexture extends TextureRegion {
    label: string,
    layer: number,
    uvOffsetX: number,
    uvOffsetY: number,
    uvScaleX: number,
    uvScaleY: number,
}

interface TextureArrayLayer {
    occupiedRegions: PackedTexture[],
    freeRegions: TextureRegion[],
}

export default class TexturePacker {
    public readonly layers: TextureArrayLayer[];

    constructor(private readonly atlasWidth: number,
                private readonly atlasHeight: number,
                private readonly maxLayers: number,
                private readonly allocate1x1Spaces: number = 0
    ) {
        this.atlasWidth = atlasWidth;
        this.atlasHeight = atlasHeight;
        this.layers = [];

        if (allocate1x1Spaces && allocate1x1Spaces > 0) {
            this.layers.push({
                freeRegions: this.addFreeSpaceFor1x1Textures(allocate1x1Spaces),
                occupiedRegions: []
            });
        }
        DebugUtil.addToWindowObject('texturePacker', this);
    }

    addTexture(label: string, width: number, height: number): PackedTexture {
        if (width > this.atlasWidth || height > this.atlasHeight) {
            throw new Error(`Texture ${label} (${width}x${height}) exceeds atlas dimensions (${this.atlasWidth}x${this.atlasHeight})`);
        }
        if ((width !== 1 && !MathUtil.isPowerOfTwo(width)) || (height !== 1 && !MathUtil.isPowerOfTwo(height))) {
            console.warn('Texture is not with size that is power of 2, this may cause errors!!!', label, width, height);
        }

        // if (width <= 16 && height <= 16) {
        //     return this.tryFitTexture(this.layers[0], 0, label, width, height)!;
        // }
        const startIndex = 0;
        for (let layerIndex = startIndex; layerIndex < this.layers.length; layerIndex++) {
            const layer = this.layers[layerIndex];
            const packedTexture = this.tryFitTexture(layer, layerIndex, label, width, height);
            if (packedTexture) {
                return packedTexture;
            }
        }

        this.addLayer();
        const newLayerIndex = this.layers.length - 1;
        return this.tryFitTexture(this.layers[newLayerIndex], newLayerIndex, label, width, height)!;
    }

    private tryFitTexture(layer: TextureArrayLayer, layerIndex: number,
                          label: string, width: number, height: number): PackedTexture | null {
        for (const space of layer.freeRegions) {
            if (space.width >= width && space.height >= height) {
                const uvScaleX = width === 1 ? 0 : width / this.atlasWidth;
                const uvScaleY = height === 1 ? 0 : height / this.atlasHeight;
                const packedTexture: PackedTexture = {
                    label,
                    layer: layerIndex,
                    x: space.x,
                    y: space.y,
                    width,
                    height,
                    uvOffsetX: space.x / this.atlasWidth,
                    uvOffsetY: space.y / this.atlasHeight,
                    uvScaleX,
                    uvScaleY,
                };
                layer.occupiedRegions.push(packedTexture);

                this.splitFreeSpace(layer, space, width, height);
                // if (layerIndex > 1) {
                //     // Layer 1 has reserve spots for 1x1 textures which should not be merged
                //     this.mergeFreeRegions(layer);
                // }

                return packedTexture;
            }
        }

        return null;
    }

    private splitFreeSpace(layer: TextureArrayLayer, usedSpace: TextureRegion, width: number, height: number) {
        const { x, y, width: spaceWidth, height: spaceHeight } = usedSpace;

        layer.freeRegions = layer.freeRegions.filter((space) => space !== usedSpace);

        if (width < spaceWidth) {
            layer.freeRegions.push({
                x: x + width,
                y,
                width: spaceWidth - width,
                height,
            });
        }
        if (height < spaceHeight) {
            layer.freeRegions.push({
                x,
                y: y + height,
                width: spaceWidth,
                height: spaceHeight - height,
            });
        }

        // if (width < spaceWidth && height < spaceHeight) {
        //     layer.freeRegions.push({
        //         x: x + width,
        //         y: y + height,
        //         width: spaceWidth - width,
        //         height: spaceHeight - height
        //     });
        // }
    }

    private mergeFreeRegions(layer: TextureArrayLayer) {
        const merged: TextureRegion[] = [];

        for (const region of layer.freeRegions) {
            let wasMerged = false;

            for (const other of merged) {
                // Check if two regions are adjacent or overlapping
                if (
                    (region.x === other.x && region.width === other.width &&
                        (region.y + region.height === other.y || other.y + other.height === region.y)) ||
                    (region.y === other.y && region.height === other.height &&
                        (region.x + region.width === other.x || other.x + other.width === region.x))
                ) {
                    console.groupCollapsed('========== MERGING REGIONS ==========')
                    console.log(`region: X:${region.x},Y:${region.y},W:${region.width},H:${region.height}`)
                    console.log(`other: X:${other.x},Y:${other.y},W:${other.width},H:${other.height}`)
                    // Merge regions by expanding the existing one
                    other.x = Math.min(other.x, region.x);
                    other.y = Math.min(other.y, region.y);
                    other.width = Math.max(other.x + other.width, region.x + region.width) - other.x;
                    other.height = Math.max(other.y + other.height, region.y + region.height) - other.y;
                    console.log(`merged: X:${other.x},Y:${other.y},W:${other.width},H:${other.height}`)
                    console.groupEnd()
                    wasMerged = true;
                    break;
                }
            }

            if (!wasMerged) {
                merged.push(region);
            }
        }


        layer.freeRegions = merged;
    }

    private addLayer() {
        if (this.layers.length >= this.maxLayers) {
            throw new Error("Maximum number of layers exceeded!");
        }

        this.layers.push({
            occupiedRegions: [],
            freeRegions: [{ x: 0, y: 0, width: this.atlasWidth, height: this.atlasHeight }],
        });
    }

    private addFreeSpaceFor1x1Textures(max1x1Layers: number): TextureRegion[] {
        const regions = [];
        const rows = Math.sqrt(max1x1Layers);
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < rows; j++) {
                regions.push({
                    x: i,
                    y: j,
                    width: 1,
                    height: 1,
                })
            }
        }

        regions.push({
            x: rows, y: 0, width: this.atlasWidth - rows, height: rows,
        });

        regions.push({
            x: 0, y: rows, width: this.atlasWidth, height: this.atlasHeight - rows,
        });

        return regions;
    }

    debugLayer(layerIndex: number) {
        const layer = this.layers[layerIndex];
        const sorted = layer.occupiedRegions.toSorted((el1, el2) => (el1.x + el1.y) - (el2.x + el2.y))
        for (const occupiedRegion of sorted) {
            const { x, y, width, height, layer, label, uvScaleX, uvScaleY, uvOffsetY, uvOffsetX } = occupiedRegion;
            const shortLabel = label.substring(label.lastIndexOf('/') + 1, (label.lastIndexOf('.')));
            console.groupCollapsed(`X=${x} Y=${y} W=${width} H=${height} ${shortLabel}`)
            console.log(`Layer: ${layerIndex}, x: ${x}, y: ${occupiedRegion.y}, width: ${occupiedRegion.width}, height: ${occupiedRegion.height}`);
            console.log(occupiedRegion);
            console.groupEnd();
        }

        return sorted;
    }

    debugVisualizeLayer(layerIndex: number) {
        const layer = this.layers[layerIndex];
        const regions = [...layer.occupiedRegions, ...layer.freeRegions]
        // .filter(r => r.x > 1 && r.y > 1);
        const spacing = 0;

        const ctx = DebugCanvas.getContext();
        const canvasScaleX = DebugCanvas.canvasWidth / (this.atlasWidth + (regions.length - 1) * spacing);
        const canvasScaleY = DebugCanvas.canvasHeight / (this.atlasHeight + (regions.length - 1) * spacing);
        const globalScale = Math.min(canvasScaleX, canvasScaleY);

        ctx.clearRect(0, 0, DebugCanvas.canvasWidth, DebugCanvas.canvasHeight);
        ctx.font = "12px Arial";

        let i = 0;
        for (const region of regions) {
            if (region.width <= 32 || region.height <= 32) {
                continue;
            }

            const label = (region as PackedTexture).label
            const isTaken = !!label;

            const scaledX = region.x * canvasScaleX + spacing * canvasScaleX;
            const scaledY = region.y * canvasScaleY + spacing * canvasScaleY;

            ctx.fillStyle = isTaken ? 'red' : 'green';
            ctx.fillRect(scaledX, scaledY, region.width * globalScale, region.height * globalScale);

            ctx.strokeStyle = isTaken ? 'white' : 'black';
            ctx.lineWidth = 1;
            ctx.strokeRect(scaledX, scaledY, region.width * globalScale, region.height * globalScale);

            // Optional: Label the region
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(`(${region.x}, ${region.y})`, scaledX + 5, scaledY + 15);
            if (label) {
                console.log('Has label:', label, region)
                const shortLabel = label.length > 10 ? label.substring(label.lastIndexOf('/') + 1, label.lastIndexOf('.')) : label;
                ctx.fillText(shortLabel, scaledX + 5, scaledY + 30);
            }
            i++;
        }

        return layer.occupiedRegions;
    }

    debugFindTexture(texture: Texture) {
        const found = [];
        for (const layer of this.layers) {
            for (const occupiedRegion of layer.occupiedRegions) {
                if (occupiedRegion.label === texture.path) {
                    found.push(occupiedRegion);
                }
            }
        }

        if (found.length > 1) {
            console.error(texture)
            throw new Error(`Found more than one texture: ${texture.path}`)
        }
        return found;
    }
}
