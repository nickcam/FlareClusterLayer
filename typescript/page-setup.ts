
import * as Map from "esri/Map";
import * as MapView from "esri/views/MapView";
import * as SceneView from "esri/views/SceneView";
import * as SimpleRenderer from "esri/renderers/SimpleRenderer";
import * as ClassBreaksRenderer from "esri/renderers/ClassBreaksRenderer";

import * as SimpleMarkerSymbol from "esri/symbols/SimpleMarkerSymbol";
import * as SimpleLineSymbol from "esri/symbols/SimpleLineSymbol";
import * as SimpleFillSymbol from "esri/symbols/SimpleFillSymbol";

import * as Point from "esri/geometry/Point";
import * as SpatialReference from "esri/geometry/SpatialReference";

import * as esriRequest from "esri/request";

import * as on from "dojo/on";
import * as dom from "dojo/dom";
import * as domClass from "dojo/dom-class";

import { FlareClusterLayer } from "./FlareClusterLayer_v4";

export class PageSetup {

    map: __esri.Map;
    mapView: __esri.MapView;
    sceneView: __esri.SceneView;

    constructor() {
    }


    async init() {

        // get the data from the json file
        let resp = await esriRequest("./data/data.json", {
            responseType: "json"
        });

        let data = resp.data;


        this.map = new Map({
            basemap: "gray"
        });

        this.mapView = new MapView({
            container: "views",
            center: new Point({ x: 134, y: -24, spatialReference: new SpatialReference({ wkid: 4326 }) }),
            zoom: 4,
            map: this.map,
            ui: { components: ["compass", "zoom"] }
        });
        this.mapView.ui.move("zoom", "bottom-right");
        this.mapView.ui.move("compass", "bottom-right"); 


        // simple renderer for singles
        let singlesRenderer = new SimpleRenderer({
            symbol: new SimpleMarkerSymbol({
                outline: new SimpleLineSymbol({
                    color: [255, 255, 255],
                    width: 1
                }),
                color: [255, 0, 0],
                size: 6
            })
        });


        let fcl = new FlareClusterLayer({
            singleRenderer: singlesRenderer,
            clusterRenderer: new ClassBreaksRenderer(),
            singlesFields: [
                { name: "objectId", type: "oid", alias: "objectId" },
                { name: "toiletId", type: "integer", alias: "toiletId" }, 
                { name: "name", type: "string", alias: "name" },
                { name: "postcode", type: "string", alias: "postcode" },
                { name: "facilityType", type: "string", alias: "facilityType" },
                { name: "isOpen", type: "string", alias: "isOpen" },
                { name: "x", type: "double", alias: "x" },
                { name: "y", type: "double", alias: "y" }
            ],
            singlesObjectIdDataPropertyName: "toiletId",
            data: data
        });


        this.map.add(fcl); 

    }


}