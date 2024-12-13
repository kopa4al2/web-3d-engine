interface PackedTexture {
    x: number; // Top-left corner x offset
    y: number; // Top-left corner y offset
    width: number; // Actual width (after scaling if necessary)
    height: number; // Actual height (after scaling if necessary)
    originalWidth: number,
    originalHeight: number,
    uv: [number, number, number, number]; // Normalized UV coordinates
    layer: number; // The layer in the texture array
}

interface TextureArrayLayer {
    currentX: number;
    currentY: number;
    currentRowHeight: number
}

export default class TexturePacker {
    private readonly layers: TextureArrayLayer[];

    constructor(private readonly atlasWidth: number,
                private readonly atlasHeight: number,
                private readonly initialLayers: number = 1,
                private readonly scaleFactor: number = 1) {
        this.atlasWidth = atlasWidth;
        this.atlasHeight = atlasHeight;
        this.layers = Array(initialLayers)
            .fill(null)
            .map(() => ({ currentX: 0, currentY: 0, currentRowHeight: 0 }));
        this.scaleFactor = scaleFactor;
    }

    addTexture(width: number, height: number): PackedTexture | null {
        // Try to fit the texture in existing layers
        for (let layer = 0; layer < this.layers.length; layer++) {
            const packed = this.tryFitTexture(layer, width, height);
            if (packed) {
                return packed;
            }
        }

        // If it doesn't fit, create a new layer and try again
        this.addLayer();
        return this.tryFitTexture(this.layers.length - 1, width, height);
    }

    private tryFitTexture(layer: number, width: number, height: number): PackedTexture | null {
        const layerState = this.layers[layer];
        const scaledWidth = Math.min(width, this.atlasWidth * this.scaleFactor);
        const scaledHeight = Math.min(height, this.atlasHeight * this.scaleFactor);

        // If texture fits in the current row
        if (layerState.currentX + scaledWidth <= this.atlasWidth) {
            const x = layerState.currentX;
            const y = layerState.currentY;

            // Update the current row and position
            layerState.currentX += scaledWidth;
            layerState.currentRowHeight = Math.max(layerState.currentRowHeight, scaledHeight);

            // Return UVs
            return this.generatePackedTexture(layer, x, y, scaledWidth, scaledHeight, width, height);
        }

        // Move to a new row if texture doesn't fit horizontally
        if (layerState.currentY + layerState.currentRowHeight + scaledHeight <= this.atlasHeight) {
            layerState.currentX = 0; // Reset X for the new row
            layerState.currentY += layerState.currentRowHeight; // Move to the next row
            layerState.currentRowHeight = 0; // Reset row height

            return this.tryFitTexture(layer, width, height); // Retry in the new row
        }

        return null;
        // console.error(`Layer: ${layer}, width: ${width}, height: ${height}, initialLayer: ${this.initialLayers}`)
        // throw new Error('Texture doesnt fit in any layer');
    }

    private generatePackedTexture(
        layer: number,
        x: number,
        y: number,
        scaledWidth: number,
        scaledHeight: number,
        originalWidth: number,
        originalHeight: number
    ): PackedTexture {
        const offsetX = x / this.atlasWidth;
        const offsetY = y / this.atlasHeight;
        const scaleX = scaledWidth / this.atlasWidth;
        const scaleY = scaledHeight / this.atlasHeight;

        return {
            x, y,
            originalWidth, originalHeight,
            width: scaledWidth, height: scaledHeight,
            uv: [offsetX, offsetY, scaleX, scaleY],
            layer,
        };
    }

    private addLayer(): void {
        this.layers.push({ currentX: 0, currentY: 0, currentRowHeight: 0 });
    }
}