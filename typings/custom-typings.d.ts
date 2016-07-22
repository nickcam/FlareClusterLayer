
/**
Typings for esri loaded modules that aren't exposed in the offical typings file for ESRI or Dojo
*/

declare namespace __esriExtend {
    export interface VectorGroup {
        transform: any;
        surface: any;
        vectors: any;
        view: any;

        _updateTransform(): void;
        drawVector(a: any): void;
        removeVector(a: any): void;

        _drawPoint(surface: any, webGeometry: any, symbol: any, vector: any, e: any): any;
    }

    interface VectorGroupConstructor {
        new (properties?: any): VectorGroup;
    }

    export const VectorGroup: VectorGroupConstructor;

    export const dojoxGfx: any;
}

declare module "esri/views/2d/VectorGroup" {
    import VectorGroup = __esriExtend.VectorGroup;
    export = VectorGroup;
}

declare module "dojox/gfx" {
    import dojoxGfx = __esriExtend.dojoxGfx;
    export = dojoxGfx;
}
