
import * as Graphic from "esri/Graphic";
import * as GraphicsLayer from "esri/layers/GraphicsLayer";
import * as GroupLayer from "esri/layers/GroupLayer";
import * as FeatureLayer from "esri/layers/FeatureLayer";

import * as SpatialReference from "esri/geometry/SpatialReference";
import * as Point from "esri/geometry/Point";

import * as ClassBreaksRenderer from "esri/renderers/ClassBreaksRenderer";

import * as asd from "esri/core/accessorSupport/decorators";
import { Renderer } from "esri/renderers";


type AreaDisplayMode = "activated" | "always" | "none";

export interface FlareClusterLayerProperties extends __esri.GroupLayerProperties {

    areaDisplayMode?: AreaDisplayMode;
    spatialReference?: SpatialReference;

    clusterRenderer: ClassBreaksRenderer;
    singleRenderer: Renderer;
    areaRenderer?: ClassBreaksRenderer;

    popupTemplate?: __esri.PopupTemplate;

    singlesFields: __esri.FieldProperties[];
    singlesObjectIdDataPropertyName?: string;
    xPropertyName?: string;
    yPropertyName?: string;
    zPropertyName?: string;

    data?: any[]
}


interface FlareClusterFeatureLayerProperties extends __esri.FeatureLayerProperties {
    clusterRenderer: ClassBreaksRenderer;
    
}

interface Cluster {

}

/**
 * The cluster layer, which is an extended GroupLayer. 
 * It contains a custom feature layer to perform clustering and flare display, and a graphics layer to display the area boundaries.
 * */
@asd.subclass("FlareClusterLayer")
export class FlareClusterLayer extends asd.declared(GroupLayer) {

    // the raw data
    private data: any[];
    private clusters: Cluster[] = [];

    private xPropertyName: string;
    private yPropertyName: string;
    private zPropertyName: string;
    private spatialReference: __esri.SpatialReference;

    private boundaryLayer: GraphicsLayer;
    //private clustersLayer: FlareClusterFeatureLayer;
    //private singlesLayer: FlareClusterFeatureLayer;
    private clustersLayer: FeatureLayer;
    private singlesLayer: FeatureLayer;

    areaDisplayMode: AreaDisplayMode;


    private singlesObjectIdField: __esri.FieldProperties;
    private singlesObjectIdDataPropertyName: string;
    private singleGraphics: __esri.Graphic[] = [];

    constructor(properties: FlareClusterLayerProperties) {
        super(properties);

        // set up the properties and initialize the two child layers
        this.areaDisplayMode = properties.areaDisplayMode || "activated"

        // data set property names
        this.xPropertyName = properties.xPropertyName || "x";
        this.yPropertyName = properties.yPropertyName || "y";
        this.zPropertyName = properties.zPropertyName || "z";
        this.spatialReference = properties.spatialReference || new SpatialReference({ wkid: 4326 }); // default to 4326
        this.singlesObjectIdDataPropertyName = properties.singlesObjectIdDataPropertyName;

        this.data = properties.data;

        this.boundaryLayer = new GraphicsLayer();

        this.clustersLayer = new FeatureLayer({
            fields: [
                { name: "objectId", type: "oid", alias: "objectId" },
                { name: "count", type: "integer", alias: "count"}
            ],
            objectIdField: "objectId",
            geometryType: "point",
            spatialReference: properties.spatialReference,
            renderer: properties.clusterRenderer,
            source: []
        });

        // set the object id field of the singles
        this.singlesObjectIdField = properties.singlesFields.find(x => x.type === "oid");
        if (!this.singlesObjectIdField) {
            console.error("An object id (oid type) must be set in singlesFields array");
            return;
        }

        this.singlesLayer = new FeatureLayer({
            fields: properties.singlesFields,
            objectIdField: this.singlesObjectIdField.name,
            geometryType: "point",
            renderer: properties.singleRenderer,
            spatialReference: properties.spatialReference,
            popupTemplate: properties.popupTemplate,
            source: []
        });

        this.addMany([this.boundaryLayer, this.clustersLayer, this.singlesLayer]);

        if (this.data && this.data.length > 0) {
            this.runCluster();
        }
    }

    setData(data: any[]) {
        if (!data || data.length == 0) return;

        this.data = data;
    }


    async runCluster() {
        if (!this.data) return;

        // clear the feature layers
        await this.clustersLayer.applyEdits({
            deleteFeatures: this.clustersLayer.source.toArray()
        });

        await this.singlesLayer.applyEdits({
            deleteFeatures: this.singleGraphics
        });


        // starter test, create them all as singles
        this.singleGraphics = [];
        for (let i = 0, len = this.data.length; i < len; i++) {
            let g = this.createSingleGraphic(this.data[i], i);
            this.singleGraphics.push(g);
        }

        await this.singlesLayer.applyEdits({
            addFeatures: this.singleGraphics
        });

    }


    private createSingleGraphic(obj: any, index: number): __esri.Graphic {
        let g = new Graphic({
            attributes: obj,
            geometry: new Point({
                x: obj[this.xPropertyName],
                y: obj[this.yPropertyName],
                z: obj[this.zPropertyName] ? obj[this.zPropertyName] : 1,
                spatialReference: this.spatialReference
            })
        });


        // set the object id data attribute on teh graphic if a property was set to get from the data set.
        if (this.singlesObjectIdDataPropertyName) {
            g.attributes[this.singlesObjectIdField.name] = obj[this.singlesObjectIdDataPropertyName];
        }
       
        return g;
    }

}

