/// <reference path="../typings/index.d.ts" />


import * as GraphicsLayer from "esri/layers/GraphicsLayer";
import * as FeatureLayer from "esri/layers/FeatureLayer";
import * as GroupLayer from "esri/layers/GroupLayer";
import * as ClassBreaksRenderer from "esri/renderers/ClassBreaksRenderer";
import * as PopupTemplate from "esri/PopupTemplate";
import * as SimpleMarkerSymbol from "esri/symbols/SimpleMarkerSymbol";
import * as TextSymbol from "esri/symbols/TextSymbol";
import * as SimpleLineSymbol from "esri/symbols/SimpleLineSymbol";
import * as Color from "esri/Color";
import * as watchUtils from 'esri/core/watchUtils';
import * as View from 'esri/views/View';
import * as webMercatorUtils from "esri/geometry/support/webMercatorUtils";
import * as Graphic from "esri/Graphic";
import * as Point from "esri/geometry/Point";
import * as Multipoint from "esri/geometry/Multipoint";
import * as Polygon from "esri/geometry/Polygon";
import * as geometryEngine from 'esri/geometry/geometryEngine';
import * as SpatialReference from "esri/geometry/SpatialReference";
import * as Extent from "esri/geometry/Extent";
import * as externalRenderers from 'esri/views/3d/externalRenderers';
import * as VectorGroup from "esri/views/2d/VectorGroup";
import * as viewpointUtils from "esri/views/2d/viewpointUtils";
import * as accessorSupportDecorators from "esri/core/accessorSupport/decorators";

import * as on from 'dojo/on';
import * as gfx from 'dojox/gfx';
import * as domConstruct from 'dojo/dom-construct';
import * as query from 'dojo/query';
import * as domAttr from 'dojo/dom-attr';
import * as domStyle from 'dojo/dom-style';
import * as deferred from 'dojo/Deferred';

interface FlareClusterLayerProperties extends __esri.GroupLayerProperties {

    singleRenderer?: any;
    renderer?: ClassBreaksRenderer;
    areaRenderer?: ClassBreaksRenderer;
    singlePopupTemplate?: PopupTemplate;
    spatialReference?: SpatialReference;

    clusterRatio?: number;
    clusterToScale?: number;
    clusterAreaDisplay?: string;

    maxFlareCount?: number;
    maxSingleFlareCount?: number;
    singleFlareTooltipProperty?: string;

    flareSymbol?: SimpleMarkerSymbol;
    textSymbol?: TextSymbol;
    flareTextSymbol?: TextSymbol;
    clusterMinCount?: number;
    flareShowMode?: string;

    displaySubTypeFlares?: boolean;
    subTypeFlareProperty?: string;
    refreshOnStationary?: boolean;

    xPropertyName?: string;
    yPropertyName?: string;
    zPropertyName?: string;

    filters?: PointFilter[];

    data?: any[];
}


//This is how you have to extend classes in arcgis api that are a subclass of Accessor.
//Will likely change in future releases. See these links - https://github.com/Esri/jsapi-resources/issues/40 & https://github.com/ycabon/extend-accessor-example
interface BaseGroupLayer extends GroupLayer { }
interface BaseGroupLayerConstructor { new (options?: __esri.GraphicsLayerProperties): BaseGroupLayer; }
let baseGroupLayer: BaseGroupLayerConstructor = accessorSupportDecorators.declared(<any>GroupLayer);

@accessorSupportDecorators.subclass("FlareClusterLayer")
export class FlareClusterLayer extends baseGroupLayer {

    singlePopupTemplate: PopupTemplate;
    singleRenderer: any;
    renderer: ClassBreaksRenderer;
    areaRenderer: ClassBreaksRenderer;
    spatialReference: SpatialReference;
    refreshOnStationary: boolean = true;
    gridClusters: GridCluster[];
    clusterRatio: number;
    clusterToScale: number;
    clusterMinCount: number;
    clusterAreaDisplay: string;
    maxSingleFlareCount: number;
    singleFlareTooltipProperty: string;
    maxFlareCount: number;
    flareSymbol: SimpleMarkerSymbol;
    textSymbol: TextSymbol;
    flareTextSymbol: TextSymbol;
    flareShowMode: string;
    xPropertyName: string;
    yPropertyName: string; 
    zPropertyName: string;
    displaySubTypeFlares: boolean;
    subTypeFlareProperty: string;

    private _data: any[];
    private _singleLayer: GraphicsLayer;
    private _clusterLayer: GraphicsLayer;
    private _areaLayer: GraphicsLayer;
    private _flareLayer: GraphicsLayer;
    private _isClustered: boolean;
    private _activeView: View;
    private _viewLoadCount: number = 0;

    private get _currentExtent(): Extent {
        return this._activeView ? this._activeView["extent"] : undefined;
    }

    private get _currentScale(): number {
        return this._activeView ? this._activeView["scale"] : undefined;
    }

    constructor(options: FlareClusterLayerProperties) {

        super(options);

        //set the defaults
        if (!options) {
            options = {};
        }

        this.singlePopupTemplate = options.singlePopupTemplate;
        this.clusterRatio = options.clusterRatio || 75;
        this.clusterToScale = options.clusterToScale || 2000000;
        this.clusterMinCount = options.clusterMinCount || 2;
        this.clusterAreaDisplay = options.clusterAreaDisplay || "activated";
        this.singleFlareTooltipProperty = options.singleFlareTooltipProperty || "name";

        this.maxFlareCount = options.maxFlareCount || 8;
        this.maxSingleFlareCount = options.maxSingleFlareCount || 8;

        this.areaRenderer = options.areaRenderer;
        this.renderer = options.renderer;
        this.singleRenderer = options.singleRenderer;

        this.xPropertyName = options.xPropertyName || "x";
        this.yPropertyName = options.yPropertyName || "y";
        this.zPropertyName = options.zPropertyName || "z";

        this.displaySubTypeFlares = options.displaySubTypeFlares === true;
        this.subTypeFlareProperty = options.subTypeFlareProperty || undefined;

        this.refreshOnStationary = options.refreshOnStationary === false ? false : true;

        this.flareSymbol = options.flareSymbol || new SimpleMarkerSymbol({
            size: 13,
            color: new Color([0, 0, 0, 0.5]),
            outline: new SimpleLineSymbol({ color: new Color([255, 255, 255, 0.5]), width: 1 })
        });

        this.textSymbol = options.textSymbol || new TextSymbol({
            color: new Color([255, 255, 255]),
            font: {
                size: 10,
                family: "arial"
            },
            yoffset: -3
        });

        this.flareTextSymbol = options.flareTextSymbol || new TextSymbol({
            color: new Color([255, 255, 255]),
            font: {
                size: 6,
                family: "arial"
            }
        });

        this._data = options.data || undefined;

        this._setupLayers();

        this.on("layerview-create", (evt) => this._layerViewCreated(evt));

        if (this._data) {
            //this.drawData();
        }
    }

    private _layerViewCreated(evt) {

        if (evt.layerView.view.type === "2d") {
            //this is map view so set up a watch to find out when the vector group has been created. Since 4.1 - use the gfx poroperty pm the graphicsView instead of group??
            //watchUtils.whenDefinedOnce(evt.layerView._graphicsView, "gfx", (vectorGroup, b, c, graphicsView) => this.vectorGroupCreated(vectorGroup, b, c, graphicsView));
        }
        else {
            //this is 3d so add a custom external rendeder to hook into webgl pipeline to do things.
            //let fclExternalRenderer = new FlareClusterLayerExternalRenderer(evt.layerView);
            //externalRenderers.add(evt.layerView.view, fclExternalRenderer);
        }

        //Refresh the data when the view is stationary if not set to false in options.
        if (this.refreshOnStationary) {
            watchUtils.pausable(evt.layerView.view, "stationary", (isStationary, b, c, view) => this.viewStationary(isStationary, b, c, view));
        }

        //this.viewPopupMessageEnabled = evt.layerView.view.popup.messageEnabled;

        //watch this property so we can not display popups for graphics we don't want to.
        //watchUtils.watch(evt.layerView.view.popup.viewModel, "selectedFeature", (selectedFeature, b, c, viewModel) => this.viewPopupSelectedFeatureChange(selectedFeature, b, c, viewModel));

        //this.layerViews.push(evt.layerView);

        if (this._viewLoadCount === 0) {
            this._activeView = evt.layerView.view;
        }
        this._viewLoadCount++;
    }

    setData(data: any[], drawData: boolean = true) {
        this._data = data;
        if (drawData) {
            this.drawData();
        }
    }


    drawData(activeView?: any) {
        
        if (activeView) {
            this._activeView = activeView;
        }

        console.log('in draw data');
        if(!this._activeView || !this._data) return;

        this.clear();
        console.time("draw-data");

        this._isClustered = this.clusterToScale < this._currentScale;

        //console.log("draw data " + this.activeView.type);
        console.log("draw data ");

        let graphics: Graphic[] = [];

        //get an extent that is in web mercator to make sure it's flat for extent checking
        //The webextent will need to be normalized since panning over the international dateline will cause
        //cause the extent to shift outside the -180 to 180 degree window.  If we don't normalize then the
        //clusters will not be drawn if the map pans over the international dateline.
        let webExtent: any = !this._currentExtent.spatialReference.isWebMercator ? <Extent>webMercatorUtils.project(this._currentExtent, new SpatialReference({ "wkid": 102100 })) : this._currentExtent;
        let extentIsUnioned = false;
        
        let normalizedWebExtent = webExtent.normalize();
        webExtent = normalizedWebExtent[0];
        if (normalizedWebExtent.length > 1) {
            webExtent = webExtent.union(normalizedWebExtent[1]);
            extentIsUnioned = true;
        }

        if (this._isClustered) {
            this._createClusterGrid(webExtent, extentIsUnioned);
        }


        let web: number[], obj: any, dataLength = this._data.length, xVal: number, yVal: number;
        for (let i = 0; i < dataLength; i++) {
            obj = this._data[i];

            //check if filters are specified and continue if this object doesn't pass
            //if (!this.passesFilter(obj)) {
            //    continue;
            //}

            xVal = obj[this.xPropertyName];
            yVal = obj[this.yPropertyName];

            //get a web merc lng/lat for extent checking. Use web merc as it's flat to cater for longitude pole
            if (this.spatialReference.isWebMercator) {
                web = [xVal, yVal];
            } else {
                web = webMercatorUtils.lngLatToXY(xVal, yVal);
            }

            //check if the obj is visible in the extent before proceeding
            if ((web[0] <= webExtent.xmin || web[0] > webExtent.xmax) || (web[1] <= webExtent.ymin || web[1] > webExtent.ymax)) {
                continue;
            }

            if (this._isClustered) {

                //loop cluster grid to see if it should be added to one
                for (let j = 0, jLen = this.gridClusters.length; j < jLen; j++) {
                    let cl = this.gridClusters[j];

                    if (web[0] <= cl.extent.xmin || web[0] > cl.extent.xmax || web[1] <= cl.extent.ymin || web[1] > cl.extent.ymax) {
                        continue; //not here so carry on
                    }

                    //recalc the x and y of the cluster by averaging the points again
                    cl.x = cl.clusterCount > 0 ? (xVal + (cl.x * cl.clusterCount)) / (cl.clusterCount + 1) : xVal;
                    cl.y = cl.clusterCount > 0 ? (yVal + (cl.y * cl.clusterCount)) / (cl.clusterCount + 1) : yVal;

                    //push every point into the cluster so we have it for area display if required. This could be omitted if never checking areas, or on demand at least
                    if (this.clusterAreaDisplay) {
                        cl.points.push([xVal, yVal]);
                    }

                    cl.clusterCount++;

                    var subTypeExists = false;
                    for (var s = 0, sLen = cl.subTypeCounts.length; s < sLen; s++) {
                        if (cl.subTypeCounts[s].name === obj[this.subTypeFlareProperty]) {
                            cl.subTypeCounts[s].count++;
                            subTypeExists = true;
                            break;
                        }
                    }

                    if (!subTypeExists) {
                        cl.subTypeCounts.push({ name: obj[this.subTypeFlareProperty], count: 1 });
                    }

                    //add the single fix record if still under the maxSingleFlareCount
                    if (cl.clusterCount <= this.maxSingleFlareCount) {
                        cl.singles.push(obj);
                    }
                    else {
                        cl.singles = [];
                    }

                    break;
                }
            }
            else {
                //not clustered so just add every obj
                //this.createSingle(obj);
            }
        }

        if (this._isClustered) {
            for (let i = 0, len = this.gridClusters.length; i < len; i++) {
                if (this.gridClusters[i].clusterCount < this.clusterMinCount) {
                    for (let j = 0, jlen = this.gridClusters[i].singles.length; j < jlen; j++) {
                        //this.createSingle(this.gridClusters[i].singles[j]);
                    }
                }
                else if (this.gridClusters[i].clusterCount > 1) {
                    //this.createCluster(this.gridClusters[i]);
                }
            }
        }

        //emit an event to signal drawing is complete.
        this.emit("draw-complete", {});

        console.timeEnd("draw-data");
    }

    
    clear() {
        this._singleLayer.removeAll();
        this._clusterLayer.removeAll();
        this._areaLayer.removeAll();
        this._flareLayer.removeAll();

    }

     private viewStationary(isStationary, b, c, view) {
        if (this._data && isStationary) {
            this._activeView = view;
            this.drawData();
        }
    }

    private _createClusterGrid(webExtent: Extent, extentIsUnioned: boolean) {

        //get the total amount of grid spaces based on the height and width of the map (divide it by clusterRatio) - then get the degrees for x and y 
        var xCount = Math.round(this._activeView.width / this.clusterRatio);
        var yCount = Math.round(this._activeView.height / this.clusterRatio);

        //if the extent has been unioned due to normalization, double the count of x in the cluster grid as the unioning will halve it.
        if (extentIsUnioned) {
            xCount *= 2;
        }

        var xw = (webExtent.xmax - webExtent.xmin) / xCount;
        var yh = (webExtent.ymax - webExtent.ymin) / yCount;

        var gsxmin, gsxmax, gsymin, gsymax;

        //create an array of clusters that is a grid over the visible extent. Each cluster contains the extent (in web merc) that bounds the grid space for it.
        this.gridClusters = [];
        for (let i = 0; i < xCount; i++) {
            gsxmin = webExtent.xmin + (xw * i);
            gsxmax = gsxmin + xw;
            for (let j = 0; j < yCount; j++) {
                gsymin = webExtent.ymin + (yh * j);
                gsymax = gsymin + yh;
                var ext = { xmin: gsxmin, xmax: gsxmax, ymin: gsymin, ymax: gsymax };
                this.gridClusters.push({
                    extent: ext,
                    clusterCount: 0,
                    subTypeCounts: [],
                    singles: [],
                    points: [],
                    x: 0,
                    y: 0
                });
            }
        }
    }

    /**
     * Setup the layers.
     */
    _setupLayers() {
        this._singleLayer = new GraphicsLayer();
        this._clusterLayer = new GraphicsLayer();
        this._areaLayer = new GraphicsLayer();
        this._flareLayer = new GraphicsLayer();
         
        this.addMany([this._areaLayer, this._clusterLayer, this._singleLayer, this._flareLayer]);        

        this._clusterLayer["popupEnabled"] = false;
        this._areaLayer["popupEnabled"] = false;
        this._flareLayer["popupEnabled"] = false;

    }

    
}


class GridCluster {
    extent: any;
    clusterCount: number;
    subTypeCounts: any[] = [];
    singles: any[] = [];
    points: any[] = [];
    x: number;
    y: number;
}

export class PointFilter {
    propertyName: string;
    propertyValues: any[];

    constructor(name?: string, values?: any[]) {
        this.propertyName = name;
        this.propertyValues = values;
    }

}