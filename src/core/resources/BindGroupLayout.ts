import ShaderStruct from 'core/resources/shader/ShaderStruct';

export type BingGroupLayoutName = 'GLOBAL' | 'UNIFORMS' | 'INSTANCE';
export default interface BindGroupLayout {
    label: string | BingGroupLayoutName,
    entries: ShaderStruct[],
}
