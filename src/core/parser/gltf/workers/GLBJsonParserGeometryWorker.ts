// TODO: UNFINISHED
export interface GlbJsonParserRequest {
    rootDir: string,
    relativePath: string,
}

export interface GlbJsonParserResponse {
    imageBitmap: ImageBitmap;
}

self.onmessage = async (event: MessageEvent<GlbJsonParserRequest>) => {

}