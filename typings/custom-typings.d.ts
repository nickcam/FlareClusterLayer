
/**
Typings for esri loaded modules that aren't exposed in the offical typings file for ESRI or Dojo
*/

declare namespace __esriExtend {
    export interface VectorGroup {
        transform: any;
        surface: any;
        vectors: any;
        view: any;

        _viewExtent: __esri.Extent;
        _viewGeoExtent: __esri.Extent;

        _updateTransform(): void;
        drawVector(c: any, a: any): void;
        removeVector(a: any): void;

        _drawPoint(surface: any, webGeometry: any, symbol: any, vector: any, e: any): any;
    }

    interface VectorGroupConstructor {
        new (properties?: any): VectorGroup;
    }

    export const VectorGroup: VectorGroupConstructor;

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
}

declare module "esri/views/2d/VectorGroup" {
    import VectorGroup = __esriExtend.VectorGroup;
    export = VectorGroup;
}

declare module "dojox/gfx" {
    import dojoxGfx = __esriExtend.dojoxGfx;
    export = dojoxGfx;
}

declare module "esri/core/accessorSupport/decorators" {
    export function cast(proto: Object, methodName: string, descriptor: PropertyDescriptor): any;
    export function cast(ctor: Function): any;
    export function cast(propertyName: string): any;
    export function declared<T>(base: T, ...rest: any[]): T;
    export function property<T>(metadata?: __esriExtend.PropertyMetadata<T>): any;
    export function subclass(declaredClass?: string): any;
}

declare module "esri/views/2d/viewpointUtils" {
    export function getExtent(a: any, b: any, c: any): __esri.Extent;
}