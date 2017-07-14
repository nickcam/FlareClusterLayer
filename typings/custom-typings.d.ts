
/**
Typings for esri loaded modules that aren't exposed in the offical typings file for ESRI or Dojo
*/

declare namespace __esriExtend {
   
    export const dojoxGfx: any;

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

//declare module "dojox/gfx" {
//    import dojoxGfx = __esriExtend.dojoxGfx;
//    export = dojoxGfx; 
//}
