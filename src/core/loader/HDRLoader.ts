import parseHDR, { HDRImageData } from 'parse-hdr';
export default class HDRLoader {
    public static async loadHDRImage(url: string): Promise<void> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const hdrData = parseHDR(arrayBuffer);

        console.log('HDR:', hdrData);
        console.log('Image Dimensions:', hdrData.shape);
        console.log('Exposure Level:', hdrData.exposure);
        console.log('Gamma Value:', hdrData.gamma);

        // Further processing of hdrData.data as needed...
    }

    public static async loadHDRImages(rootUrl: string, relativeUrls: string[]): Promise<HDRImageData[]> {
        const allData = await Promise.all(relativeUrls.map(relative => fetch(rootUrl + relative).then(data => data.arrayBuffer())))
            .then(data => data.map(parseHDR));

        return allData;
    }
}