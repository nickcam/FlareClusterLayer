
/**
Typings for esri loaded modules that aren't exposed in the offical typings file for ESRI or Dojo
*/

declare namespace __esriExtend {
   
    export const dojoxGfx: any;

    interface PropertyMetadata<T> {
        get?: () => T;
        set?: (value: T) => void;
        cast?: (value: any) => T;
        dependsOn?: string[];
        value?: T;
        type?: (new (...params: any[]) => T) | [new (...params: any[]) => T];
        readOnly?: boolean;
        aliasOf?: string;
    }

    export const GFXObject: any;
    export const Projector: any;
}


declare module "esri/views/2d/engine/graphics/GFXObject" {
    import GFXObject = __esriExtend.GFXObject;
    export = GFXObject;
}

declare module "esri/views/2d/engine/graphics/Projector" {
    import Projector = __esriExtend.Projector;
    export = Projector;
}

declare module "dojox/gfx" {
    import dojoxGfx = __esriExtend.dojoxGfx;
    export = dojoxGfx;
}
