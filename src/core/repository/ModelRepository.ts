import { TextureName } from 'core/loader/TextureLoader';
import ObjParser, { ObjFile } from 'core/parser/ObjParser';
import Texture from 'core/texture/Texture';


export interface IModelRepository {
    wavefrontFiles: {
        [id: string]: () => Promise<ObjFile>
    },
    textures: {
        [id: TextureName]: () => Promise<Texture>
    }
}

const cacheablePromise = <T>(promise: Promise<T>): () => Promise<T> => {
    let data: T | null = null;
    let i = 0;
    return () => data
        ? Promise.resolve(data)
        : promise.then(result => {
            console.log(`Counter: ${i++}`)
            data = result;
            return data;
        })
}

export const ModelRepository = {
    wavefrontFiles: {
        dragon: cacheablePromise(ObjParser.parseObjFile('assets/advanced/dragon.obj')),
        lightBulb: cacheablePromise(ObjParser.parseObjFile('assets/advanced/light/lightBulb.obj', 'assets/advanced/light/lightBulb.mtl')),
        bunny: cacheablePromise(ObjParser.parseObjFile('assets/advanced/stanford-bunny.obj')),
    }
}

export default ModelRepository;