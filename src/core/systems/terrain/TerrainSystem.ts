import Graphics from "core/Graphics";
import TextureLoader from "core/loader/TextureLoader";
import { RenderSystem, UpdateSystem } from "core/systems/EntityComponentSystem";

export default class TerrainSystem implements RenderSystem, UpdateSystem {

    // private terrainGeometry: Geometry;


    constructor(private graphicsApi: Graphics) {
        const heightMap = TextureLoader.rawImages['heightMap'] as ImageData;

        let vertices = [];
        for (let z = 0; z < 64; z++) {
            for (let x = 0; x < 64; x++) {
                // Calculate vertex position from heightmap value (scale height as needed)
                // let heightValue = getHeightFromImage(x, z, heightMap);  // Get height value from the heightmap
                // vertices.push(x, heightValue, z);  // (x, y, z)

                // Optionally, generate the indices for the triangles (for rendering)
            }
        }
    }

    render(): void {
        // throw new Error("Method not implemented.");
    }
    update(deltaTime: number): void {
        // throw new Error("Method not implemented.");
    }

}