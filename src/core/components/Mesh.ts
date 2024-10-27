import CubeGeometry from "core/components/geometry/CubeGeometry";
import GeometryComponent from "core/components/geometry/GeometryComponent";
import BasicMaterial from "core/components/material/BasicMaterial";
import MaterialComponent from "core/components/material/MaterialComponent";
import Component from "./Component";

export default class Mesh implements Component {
    static readonly ID: symbol = Symbol("Mesh");
    readonly id: symbol = Mesh.ID;

    // protected constructor(public geometry: GeometryComponent, public material: MaterialComponent) {
    constructor(public meshes: [geometry: GeometryComponent, material: MaterialComponent][]) {
    }
}