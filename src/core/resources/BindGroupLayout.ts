import ShaderStruct from 'core/resources/ShaderStruct';

export type BingGroupLayoutName = 'GLOBAL' | 'UNIFORMS' | 'INSTANCE';
export default interface BindGroupLayout {
    label: string | BingGroupLayoutName,
    entries: ShaderStruct[],
}
