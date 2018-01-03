/// <reference path="../typings/index.d.ts" />

import * as GraphicsLayer from "esri/layers/GraphicsLayer";
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
import * as ScreenPoint from "esri/geometry/ScreenPoint";
import * as Multipoint from "esri/geometry/Multipoint";
import * as Polygon from "esri/geometry/Polygon";
import * as geometryEngine from 'esri/geometry/geometryEngine';
import * as SpatialReference from "esri/geometry/SpatialReference";
import * as Extent from "esri/geometry/Extent";
import * as MapView from 'esri/views/MapView';
import * as SceneView from 'esri/views/SceneView';
 
import * as GFXObject from "esri/views/2d/engine/graphics/GFXObject";
import * as Projector from "esri/views/2d/engine/graphics/Projector";
 
import * as asd from "esri/core/accessorSupport/decorators";

import * as on from 'dojo/on';
import * as gfx from 'dojox/gfx';
import * as domConstruct from 'dojo/dom-construct';
import * as query from 'dojo/query';
import * as domAttr from 'dojo/dom-attr';
import * as domStyle from 'dojo/dom-style';
 

interface FlareClusterLayerProperties extends __esri.GraphicsLayerProperties {

    clusterRenderer?: ClassBreaksRenderer;

    singleRenderer?: any;
    singleSymbol?: SimpleMarkerSymbol;
    areaRenderer?: ClassBreaksRenderer;
    flareRenderer?: ClassBreaksRenderer;

    singlePopupTemplate?: PopupTemplate;
    spatialReference?: SpatialReference;

    clusterRatio?: number;
    clusterToScale?: number;
    clusterMinCount?: number;
    clusterAreaDisplay?: string;

    displayFlares?: boolean;
    maxFlareCount?: number;
    maxSingleFlareCount?: number;
    singleFlareTooltipProperty?: string;
    flareSymbol?: SimpleMarkerSymbol;
    flareBufferPixels?: number;
    textSymbol?: TextSymbol;
    flareTextSymbol?: TextSymbol;
    displaySubTypeFlares?: boolean;
    subTypeFlareProperty?: string;

    xPropertyName?: string;
    yPropertyName?: string;
    zPropertyName?: string;

    refreshOnStationary?: boolean;

    filters?: PointFilter[];

    data?: any[];

}

@asd.subclass("FlareClusterLayer")
export class FlareClusterLayer extends asd.declared(GraphicsLayer) {

    singleRenderer: any;
    singleSymbol: SimpleMarkerSymbol;
    singlePopupTemplate: PopupTemplate;

    clusterRenderer: ClassBreaksRenderer;
    areaRenderer: ClassBreaksRenderer;
    flareRenderer: ClassBreaksRenderer;

    spatialReference: SpatialReference;

    clusterRatio: number;
    clusterToScale: number;
    clusterMinCount: number;
    clusterAreaDisplay: string;

    displayFlares: boolean;
    maxFlareCount: number;
    maxSingleFlareCount: number;
    singleFlareTooltipProperty: string;
    flareSymbol: SimpleMarkerSymbol;
    flareBufferPixels: number;
    textSymbol: TextSymbol;
    flareTextSymbol: TextSymbol;
    displaySubTypeFlares: boolean;
    subTypeFlareProperty: string;

    refreshOnStationary: boolean;

    xPropertyName: string;
    yPropertyName: string;
    zPropertyName: string;

    filters: PointFilter[];

    private _gridClusters: GridCluster[];
    private _isClustered: boolean;
    private _activeView: ActiveView;
    private _viewLoadCount: number = 0;

    private _readyToDraw: boolean;
    private _queuedInitialDraw: boolean;
    private _data: any[];
    private _is2d: boolean;

    private _clusters: { [clusterId: number]: Cluster; } = {};
    private _activeCluster: Cluster;

    private _layerView2d: any;
    private _layerView3d: any;

    constructor(options: FlareClusterLayerProperties) {

        super(options);

        // set the defaults
        if (!options) {
            // missing required parameters
            console.error("Missing required parameters to flare cluster layer constructor.");
            return;
        }

        this.singlePopupTemplate = options.singlePopupTemplate;

        // set up the clustering properties

        this.clusterRatio = options.clusterRatio || 75; // sets the size of each clusters bounds
        this.clusterToScale = options.clusterToScale || 2000000; // the scale to stop clustering at and just display single points
        this.clusterMinCount = options.clusterMinCount || 2; // the min amount of points required in a cluster bounds to justify creating a cluster
        this.singleFlareTooltipProperty = options.singleFlareTooltipProperty || "name"; // The property name of the dataset to display in a tooltip for a flare when a flare represents a single object.
        if (options.clusterAreaDisplay) {
            this.clusterAreaDisplay = options.clusterAreaDisplay === "none" ? undefined : options.clusterAreaDisplay; // when to display the area (convex hull) of the points for each each cluster
        }
        this.maxFlareCount = options.maxFlareCount || 8; // maximum number of flares for each cluster
        this.maxSingleFlareCount = options.maxSingleFlareCount || 8; // maximum number of single object flares before converting to aggregated flares
        this.displayFlares = options.displayFlares === false ? false : true; // whether to display flares, default to true 
        this.displaySubTypeFlares = options.displaySubTypeFlares === true; // whether to display sub type flares, ie: flares that represent the counts of a certain property of the data that is clustered
        this.subTypeFlareProperty = options.subTypeFlareProperty || undefined; // the property name that the subtype flare will use to count on
        this.flareBufferPixels = options.flareBufferPixels || 6; // buffer between flares and cluster

        // data set property names
        this.xPropertyName = options.xPropertyName || "x";
        this.yPropertyName = options.yPropertyName || "y";
        this.zPropertyName = options.zPropertyName || "z";

        // set up the symbology/renderer properties
        this.clusterRenderer = options.clusterRenderer;
        this.areaRenderer = options.areaRenderer;
        this.singleRenderer = options.singleRenderer;
        this.singleSymbol = options.singleSymbol;
        this.flareRenderer = options.flareRenderer;

        this.refreshOnStationary = options.refreshOnStationary === false ? false : true; // whether this layer should refresh the clusters and redraw when stationary is true, default to true

        // add some default symbols or use the options values.
        this.flareSymbol = options.flareSymbol || new SimpleMarkerSymbol({
            size: 14,
            color: new Color([0, 0, 0, 0.5]),
            outline: new SimpleLineSymbol({ color: new Color([255, 255, 255, 0.5]), width: 1 })
        });

        this.textSymbol = options.textSymbol || new TextSymbol({
            color: new Color([255, 255, 255]),
            font: {
                size: 10,
                family: "arial"
            },
            yoffset: -3 // setting yoffset as vertical alignment doesn't work in IE/Edge
        });

        this.flareTextSymbol = options.flareTextSymbol || new TextSymbol({
            color: new Color([255, 255, 255]),
            font: {
                size: 6,
                family: "arial"
            },
            yoffset: -2 // setting yoffset as vertical alignment doesn't work in IE/Edge
        });

        // initial data
        this._data = options.data || undefined;

        this.on("layerview-create", (evt) => this._layerViewCreated(evt));

        if (this._data) {
            this.draw();
        }

    }


    private _layerViewCreated(evt) {

        if (evt.layerView.view.type === "2d") {
            this._layerView2d = evt.layerView;
        }
        else {
            this._layerView3d = evt.layerView;
        }

        // add a stationary watch on the view to refresh if specified in options.
        if (this.refreshOnStationary) {
            watchUtils.pausable(evt.layerView.view, "stationary", (isStationary, b, c, view) => this._viewStationary(isStationary, b, c, view));
        }

        if (this._viewLoadCount === 0) {
            this._activeView = evt.layerView.view;

            this._readyToDraw = true;
            if (this._queuedInitialDraw) {
                // we've been waiting for this to happen to draw
                this.draw();
                this._queuedInitialDraw = false;
            }
        }
        this._viewLoadCount++;


        if (evt.layerView.view.type === "2d") {
            // for map views, wait for the layerview ot be attached, before adding events
            watchUtils.whenTrueOnce(evt.layerView, "attached", () => this._addViewEvents(evt.layerView));
        }
        else {
            // for scene views just add the events straight away
            this._addViewEvents(evt.layerView);
        }

    }

    private _addViewEvents(layerView: any) {
        let v: ActiveView = layerView.view;
        if (!v.fclPointerMove) {

            let container: HTMLElement = undefined;
            if (v.type === "2d") {
                // for a map view get the container element of the layer view to add mousemove event to.
                container = layerView.container.element;
            }
            else {
                // for scene view get the canvas element under the view container to add mousemove to.
                container = <HTMLElement>query("canvas", v.container)[0];
            }

            // Add pointer move and pointer down. Pointer down to handle touch devices.
            v.fclPointerMove = v.on("pointer-move", (evt) => this._viewPointerMove(evt));
            v.fclPointerDown = v.on("pointer-down", (evt) => this._viewPointerMove(evt));
        }
    }


    private _viewStationary(isStationary, b, c, view) {

        if (isStationary) {
            if (this._data) {
                this.draw();
            }
        }

        if (!isStationary && this._activeCluster) {
            // if moving deactivate cluster;
            this._deactivateCluster();
        }
    }


    clear() {
        this.removeAll();
        this._clusters = {};
    }


    setData(data: any[], drawData: boolean = true) {
        this._data = data;
        if (drawData) {
            this.draw();
        }
    }

    draw(activeView?: any) {

        if (activeView) {
            // if we're swapping views from the currently active one, clear the surface object so it get's recreated fresh after the first draw
            if (this._activeView && activeView !== this._activeView) {
                this._activeView.fclSurface = null;
            }
            this._activeView = activeView;
        }

        // Not ready to draw yet so queue one up
        if (!this._readyToDraw) {
            this._queuedInitialDraw = true;
            return;
        }

        let currentExtent = this._extent();
        if (!this._activeView || !this._data || !currentExtent) return;

        this._is2d = this._activeView.type === "2d";

        // check for required renderer
        if (!this.clusterRenderer) {
            console.error("FlareClusterLayer: clusterRenderer must be set.");
        }

        // check to make sure we have an area renderer set if one needs to be
        if (this.clusterAreaDisplay && !this.areaRenderer) {
            console.error("FlareClusterLayer: areaRenderer must be set if clusterAreaDisplay is set.");
            return;
        }

        this.clear();
        console.time("draw-data-" + this._activeView.type);

        this._isClustered = this.clusterToScale < this._scale();

        let graphics: Graphic[] = [];

        // Get an extent that is in web mercator to make sure it's flat for extent checking
        // The webextent will need to be normalized since panning over the international dateline will cause
        // cause the extent to shift outside the -180 to 180 degree window.  If we don't normalize then the
        // clusters will not be drawn if the map pans over the international dateline.
        let webExtent: any = !currentExtent.spatialReference.isWebMercator ? <Extent>webMercatorUtils.project(currentExtent, new SpatialReference({ "wkid": 102100 })) : currentExtent;
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

            // check if filters are specified and continue if this object doesn't pass
            if (!this._passesFilter(obj)) {
                continue;
            }

            xVal = obj[this.xPropertyName];
            yVal = obj[this.yPropertyName];

            // get a web merc lng/lat for extent checking. Use web merc as it's flat to cater for longitude pole
            if (this.spatialReference.isWebMercator) {
                web = [xVal, yVal];
            } else {
                web = webMercatorUtils.lngLatToXY(xVal, yVal);
            }

            // check if the obj is visible in the extent before proceeding
            if ((web[0] <= webExtent.xmin || web[0] > webExtent.xmax) || (web[1] <= webExtent.ymin || web[1] > webExtent.ymax)) {
                continue;
            }

            if (this._isClustered) {

                // loop cluster grid to see if it should be added to one
                for (let j = 0, jLen = this._gridClusters.length; j < jLen; j++) {
                    let cl = this._gridClusters[j];

                    if (web[0] <= cl.extent.xmin || web[0] > cl.extent.xmax || web[1] <= cl.extent.ymin || web[1] > cl.extent.ymax) {
                        continue; //not here so carry on
                    }

                    // recalc the x and y of the cluster by averaging the points again
                    cl.x = cl.clusterCount > 0 ? (xVal + (cl.x * cl.clusterCount)) / (cl.clusterCount + 1) : xVal;
                    cl.y = cl.clusterCount > 0 ? (yVal + (cl.y * cl.clusterCount)) / (cl.clusterCount + 1) : yVal;

                    // push every point into the cluster so we have it for area display if required. This could be omitted if never checking areas, or on demand at least
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

                    // add the single fix record if still under the maxSingleFlareCount
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
                // not clustered so just add every obj
                this._createSingle(obj);
            }
        }

        if (this._isClustered) {
            for (let i = 0, len = this._gridClusters.length; i < len; i++) {
                if (this._gridClusters[i].clusterCount < this.clusterMinCount) {
                    for (let j = 0, jlen = this._gridClusters[i].singles.length; j < jlen; j++) {
                        this._createSingle(this._gridClusters[i].singles[j]);
                    }
                }
                else if (this._gridClusters[i].clusterCount > 1) {
                    this._createCluster(this._gridClusters[i]);
                }
            }
        }

        // emit an event to signal drawing is complete. emit is not in typings for graphics layers, so use []'s to access.
        this.emit("draw-complete", {});
        console.timeEnd(`draw-data-${this._activeView.type}`);

        if (!this._activeView.fclSurface) {
            setTimeout(() => {
                this._createSurface();
            }, 10);
        }
    }

    private _passesFilter(obj: any): boolean {
        if (!this.filters || this.filters.length === 0) return true;
        let passes = true;
        for (let i = 0, len = this.filters.length; i < len; i++) {
            let filter = this.filters[i];
            if (obj[filter.propertyName] == null) continue;

            let valExists = filter.propertyValues.indexOf(obj[filter.propertyName]) !== -1;
            if (valExists) {
                passes = filter.keepOnlyIfValueExists; // the value exists so return whether we should be keeping it or not.
            }
            else if (!valExists && filter.keepOnlyIfValueExists) {
                passes = false; // return false as the value doesn't exist, and we should only be keeping point objects where it does exist.
            }

            if (!passes) return false; // if it hasn't passed any of the filters return false;
        }

        return passes;
    }

    private _createSingle(obj) {
        let point = new Point({
            x: obj[this.xPropertyName], y: obj[this.yPropertyName], z: obj[this.zPropertyName]
        });

        if (!point.spatialReference.isWebMercator) {
            point = <Point>webMercatorUtils.geographicToWebMercator(point);
        }

        let graphic = new Graphic({
            geometry: point,
            attributes: obj
        });

        graphic.popupTemplate = this.singlePopupTemplate;
        if (this.singleRenderer) {
            let symbol = this.singleRenderer.getSymbol(graphic, this._activeView);
            graphic.symbol = symbol;
        }
        else if (this.singleSymbol) {
            graphic.symbol = this.singleSymbol;
        }
        else {
            // no symbology for singles defined, use the default symbol from the cluster renderer
            graphic.symbol = this.clusterRenderer.defaultSymbol;
        }

        this.add(graphic);
    }


    private _createCluster(gridCluster: GridCluster) {

        let cluster = new Cluster();
        cluster.gridCluster = gridCluster;

        // make sure all geometries added to Graphic objects are in web mercator otherwise wrap around doesn't work.
        let point = new Point({ x: gridCluster.x, y: gridCluster.y });
        if (!point.spatialReference.isWebMercator) {
            point = <Point>webMercatorUtils.geographicToWebMercator(point);
        }

        let attributes: any = {
            x: gridCluster.x,
            y: gridCluster.y,
            clusterCount: gridCluster.clusterCount,
            isCluster: true,
            clusterObject: gridCluster
        }

        cluster.clusterGraphic = new Graphic({
            attributes: attributes,
            geometry: point
        });
        cluster.clusterGraphic.symbol = this.clusterRenderer.getClassBreakInfo(cluster.clusterGraphic).symbol;

        if (this._is2d && this._activeView.rotation) {
            cluster.clusterGraphic.symbol["angle"] = 360 - this._activeView.rotation;
        }
        else {
            cluster.clusterGraphic.symbol["angle"] = 0;
        }

        cluster.clusterId = cluster.clusterGraphic["uid"];
        cluster.clusterGraphic.attributes.clusterId = cluster.clusterId;

        // also create a text symbol to display the cluster count
        let textSymbol = this.textSymbol.clone();
        textSymbol.text = gridCluster.clusterCount.toString();
        if (this._is2d && this._activeView.rotation) {
            textSymbol.angle = 360 - this._activeView.rotation;
        }

        cluster.textGraphic = new Graphic({
            geometry: point,
            attributes: {
                isClusterText: true,
                isText: true,
                clusterId: cluster.clusterId
            },
            symbol: textSymbol
        });

        // add an area graphic to display the bounds of the cluster if configured to
        if (this.clusterAreaDisplay && gridCluster.points && gridCluster.points.length > 0) {

            let mp = new Multipoint();
            mp.points = gridCluster.points;
            let area: any = geometryEngine.convexHull(mp, true); // use convex hull on the points to get the boundary

            let areaAttr: any = {
                x: gridCluster.x,
                y: gridCluster.y,
                clusterCount: gridCluster.clusterCount,
                clusterId: cluster.clusterId,
                isClusterArea: true
            }

            if (area.rings && area.rings.length > 0) {
                let areaPoly = new Polygon(); // had to create a new polygon and fill it with the ring of the calculated area for SceneView to work.
                areaPoly = areaPoly.addRing(area.rings[0]);

                if (!areaPoly.spatialReference.isWebMercator) {
                    areaPoly = <Polygon>webMercatorUtils.geographicToWebMercator(areaPoly);
                }

                cluster.areaGraphic = new Graphic({ geometry: areaPoly, attributes: areaAttr });
                cluster.areaGraphic.symbol = this.areaRenderer.getClassBreakInfo(cluster.areaGraphic).symbol;

            }
        }

        // add the graphics in order        
        if (cluster.areaGraphic && this.clusterAreaDisplay === "always") {
            this.add(cluster.areaGraphic);
        }
        this.add(cluster.clusterGraphic);
        this.add(cluster.textGraphic);

        this._clusters[cluster.clusterId] = cluster;
    }


    private _createClusterGrid(webExtent: Extent, extentIsUnioned: boolean) {

        // get the total amount of grid spaces based on the height and width of the map (divide it by clusterRatio) - then get the degrees for x and y 
        let xCount = Math.round(this._activeView.width / this.clusterRatio);
        let yCount = Math.round(this._activeView.height / this.clusterRatio);

        // if the extent has been unioned due to normalization, double the count of x in the cluster grid as the unioning will halve it.
        if (extentIsUnioned) {
            xCount *= 2;
        }

        let xw = (webExtent.xmax - webExtent.xmin) / xCount;
        let yh = (webExtent.ymax - webExtent.ymin) / yCount;

        let gsxmin, gsxmax, gsymin, gsymax;

        // create an array of clusters that is a grid over the visible extent. Each cluster contains the extent (in web merc) that bounds the grid space for it.
        this._gridClusters = [];
        for (let i = 0; i < xCount; i++) {
            gsxmin = webExtent.xmin + (xw * i);
            gsxmax = gsxmin + xw;
            for (let j = 0; j < yCount; j++) {
                gsymin = webExtent.ymin + (yh * j);
                gsymax = gsymin + yh;
                let ext = { xmin: gsxmin, xmax: gsxmax, ymin: gsymin, ymax: gsymax };
                this._gridClusters.push({
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
     * Create an svg surface on the view if it doesn't already exist
     * @param view
     */
    private _createSurface() {

        if (this._activeView.fclSurface || (this._activeView.type === "2d" && !this._layerView2d.container.element)) return;
        let surfaceParentElement = undefined;
        if (this._is2d) {
            surfaceParentElement = this._layerView2d.container.element.parentElement || this._layerView2d.container.element.parentNode;
        }
        else {
            surfaceParentElement = this._activeView.canvas.parentElement || this._activeView.canvas.parentNode;
        }

        let surface: any = gfx.createSurface(surfaceParentElement, "0", "0");
        surface.containerGroup = surface.createGroup();

        domStyle.set(surface.rawNode, { position: "absolute", top: "0", zIndex: -1 });
        domAttr.set(surface.rawNode, "overflow", "visible");
        domAttr.set(surface.rawNode, "class", "fcl-surface");
        this._activeView.fclSurface = surface;

    }

    private _viewPointerMove(evt) {

        let mousePos = this._getMousePos(evt);

        // if there's an active cluster and the current screen pos is within the bounds of that cluster's group container, don't do anything more. 
        // TODO: would probably be better to check if the point is in the actual circle of the cluster group and it's flares instead of using the rectanglar bounding box.
        if (this._activeCluster && this._activeCluster.clusterGroup) {
            let bbox = this._activeCluster.clusterGroup.rawNode.getBoundingClientRect();
            if (bbox) {
                if (mousePos.x >= bbox.left && mousePos.x <= bbox.right && mousePos.y >= bbox.top && mousePos.y <= bbox.bottom) return;
            }
        }

        if (!this._activeView.ready) return;

        let hitTest = this._activeView.hitTest(mousePos);
        if (!hitTest) return;
        hitTest.then((response) => {

            let graphics = response.results;
            if (graphics.length === 0) {
                this._deactivateCluster();
                return;
            }

            for (let i = 0, len = graphics.length; i < len; i++) {
                let g = graphics[i].graphic;
                if (g && (g.attributes.clusterId != null && !g.attributes.isClusterArea)) {
                    let cluster = this._clusters[g.attributes.clusterId];
                    this._activateCluster(cluster);
                    return;
                }
                else {
                    this._deactivateCluster();
                }
            }
        });
    }

    private _activateCluster(cluster: Cluster) {

        if (this._activeCluster === cluster) {
            return; // already active
        }

        if (!this._activeView.fclSurface) {
            this._createSurface();
        }

        this._deactivateCluster();

        this._activeCluster = cluster;
        this._initSurface();
        this._initCluster();
        this._initFlares();

        this._hideGraphic([this._activeCluster.clusterGraphic, this._activeCluster.textGraphic]);

        if (this.clusterAreaDisplay === "activated") {
            this._showGraphic(this._activeCluster.areaGraphic);
        }

        //console.log("activate cluster");
    }

    private _deactivateCluster() {

        if (!this._activeCluster || !this._activeCluster.clusterGroup) return;

        this._showGraphic([this._activeCluster.clusterGraphic, this._activeCluster.textGraphic]);
        this._removeClassFromElement(this._activeCluster.clusterGroup.rawNode, "activated");

        if (this.clusterAreaDisplay === "activated") {
            this._hideGraphic(this._activeCluster.areaGraphic);
        }

        this._clearSurface();
        this._activeCluster = undefined;

        //console.log("DE-activate cluster");

    }


    private _initSurface() {
        if (!this._activeCluster) return;

        let surface = this._activeView.fclSurface;
        if (!surface) return;

        let sp: ScreenPoint = this._activeView.toScreen(<Point>this._activeCluster.clusterGraphic.geometry);

        // toScreen() returns the wrong value for x if a 2d map has been wrapped around the globe. Need to check and cater for this. I think this a bug in the api.
        if (this._is2d) {
            var wsw = this._activeView.state.worldScreenWidth;
            let ratio = parseInt((sp.x / wsw).toFixed(0)); // get a ratio to determine how many times the map has been wrapped around.
            if (sp.x < 0) {
                // x is less than 0, WTF. Need to adjust by the world screen width.
                sp.x += wsw * (ratio * -1);
            }
            else if (sp.x > wsw) {
                // x is too big, WTF as well, cater for it.
                sp.x -= wsw * ratio;
            }
        }

        domStyle.set(surface.rawNode, { zIndex: 11, overflow: "visible", width: "1px", height: "1px", left: sp.x + "px", top: sp.y + "px" });
        domAttr.set(surface.rawNode, "overflow", "visible");

    }

    private _clearSurface() {
        let surface = this._activeView.fclSurface;
        query(".cluster-group", surface.containerGroup.rawNode).forEach(domConstruct.destroy);
        domStyle.set(surface.rawNode, { zIndex: -1, overflow: "hidden", top: "0px", left: "0px" });
        domAttr.set(surface.rawNode, "overflow", "hidden");
    }

    private _initCluster() {
        if (!this._activeCluster) return;
        let surface = this._activeView.fclSurface;
        if (!surface) return;

        // we're going to replicate a cluster graphic in the svg element we added to the layer view. Just so it can be styled easily. Native WebGL for Scene Views would probably be better, but at least this way css can still be used to style/animate things.
        this._activeCluster.clusterGroup = surface.containerGroup.createGroup();
        this._addClassToElement(this._activeCluster.clusterGroup.rawNode, "cluster-group");

        // create the cluster shape
        let clonedClusterElement = this._createClonedElementFromGraphic(this._activeCluster.clusterGraphic, this._activeCluster.clusterGroup);
        this._addClassToElement(clonedClusterElement, "cluster");

        // create the cluster text shape
        let clonedTextElement = this._createClonedElementFromGraphic(this._activeCluster.textGraphic, this._activeCluster.clusterGroup);
        this._addClassToElement(clonedTextElement, "cluster-text");
        clonedTextElement.setAttribute("pointer-events", "none");

        this._activeCluster.clusterGroup.rawNode.appendChild(clonedClusterElement);
        this._activeCluster.clusterGroup.rawNode.appendChild(clonedTextElement);

        // set the group elements class     
        this._addClassToElement(this._activeCluster.clusterGroup.rawNode, "activated", 10);

    }


    private _initFlares() {
        if (!this._activeCluster || !this.displayFlares) return;

        let gridCluster = this._activeCluster.gridCluster;

        // check if we need to create flares for the cluster
        let singleFlares = (gridCluster.singles && gridCluster.singles.length > 0) && (gridCluster.clusterCount <= this.maxSingleFlareCount);
        let subTypeFlares = !singleFlares && (gridCluster.subTypeCounts && gridCluster.subTypeCounts.length > 0);

        if (!singleFlares && !subTypeFlares) {
            return; // no flares required
        }

        let flares: Flare[] = [];
        if (singleFlares) {
            for (var i = 0, len = gridCluster.singles.length; i < len; i++) {
                let f = new Flare();
                f.tooltipText = gridCluster.singles[i][this.singleFlareTooltipProperty];
                f.singleData = gridCluster.singles[i];
                f.flareText = "";
                flares.push(f);
            }
        }
        else if (subTypeFlares) {

            // sort sub types by highest count first
            var subTypes = gridCluster.subTypeCounts.sort(function (a, b) {
                return b.count - a.count;
            });

            for (var i = 0, len = subTypes.length; i < len; i++) {
                let f = new Flare();
                f.tooltipText = `${subTypes[i].name} (${subTypes[i].count})`;
                f.flareText = subTypes[i].count;
                flares.push(f);
            }
        }

        // if there are more flare objects to create than the maxFlareCount and this is one of those - create a summary flare that contains '...' as the text.
        let willContainSummaryFlare = flares.length > this.maxFlareCount;
        let flareCount = willContainSummaryFlare ? this.maxFlareCount : flares.length;

        // if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
        // for an add amount position the first flare on top, -90 to do this. Looks nicer this way.
        let degreeVariance = (flareCount % 2 === 0) ? -180 : -90;
        let viewRotation = this._is2d ? this._activeView.rotation : 0;

        let clusterScreenPoint = this._activeView.toScreen(<Point>this._activeCluster.clusterGraphic.geometry);
        let clusterSymbolSize = <number>this._activeCluster.clusterGraphic.symbol.get("size");
        for (let i = 0; i < flareCount; i++) {

            let flare = flares[i];

            // set some attribute data
            let flareAttributes = {
                isFlare: true,
                isSummaryFlare: false,
                tooltipText: "",
                flareTextGraphic: undefined,
                clusterGraphicId: this._activeCluster.clusterId,
                clusterCount: gridCluster.clusterCount
            };

            let flareTextAttributes = {};

            // do a couple of things differently if this is a summary flare or not
            let isSummaryFlare = willContainSummaryFlare && i >= this.maxFlareCount - 1;
            if (isSummaryFlare) {
                flare.isSummary = true;
                flareAttributes.isSummaryFlare = true;
                let tooltipText = "";
                // multiline tooltip for summary flares, ie: greater than this.maxFlareCount flares per cluster
                for (let j = this.maxFlareCount - 1, jlen = flares.length; j < jlen; j++) {
                    tooltipText += j > (this.maxFlareCount - 1) ? "\n" : "";
                    tooltipText += flares[j].tooltipText;
                }
                flare.tooltipText = tooltipText;
            }

            flareAttributes.tooltipText = flare.tooltipText;

            // create a graphic for the flare and for the flare text
            flare.graphic = new Graphic({
                attributes: flareAttributes,
                geometry: this._activeCluster.clusterGraphic.geometry,
                popupTemplate: null
            });

            flare.graphic.symbol = this._getFlareSymbol(flare.graphic);
            if (this._is2d && this._activeView.rotation) {
                flare.graphic.symbol["angle"] = 360 - this._activeView.rotation;
            }
            else {
                flare.graphic.symbol["angle"] = 0;
            }


            if (flare.flareText) {
                let textSymbol = this.flareTextSymbol.clone();
                textSymbol.text = !isSummaryFlare ? flare.flareText.toString() : "...";

                if (this._is2d && this._activeView.rotation) {
                    textSymbol.angle = 360 - this._activeView.rotation;
                }

                flare.textGraphic = new Graphic({
                    attributes: {
                        isText: true,
                        clusterGraphicId: this._activeCluster.clusterId
                    },
                    symbol: textSymbol,
                    geometry: this._activeCluster.clusterGraphic.geometry
                });
            }
        }

        // flares have been created so add them to the dom
        for (let i = 0, len = flares.length; i < len; i++) {
            let f = flares[i];
            if (!f.graphic) continue;

            // create a group to hold flare object and text if needed. 
            f.flareGroup = this._activeCluster.clusterGroup.createGroup();

            let position = this._setFlarePosition(f.flareGroup, clusterSymbolSize, flareCount, i, degreeVariance, viewRotation);

            this._addClassToElement(f.flareGroup.rawNode, "flare-group");
            let flareElement = this._createClonedElementFromGraphic(f.graphic, f.flareGroup);
            f.flareGroup.rawNode.appendChild(flareElement);
            if (f.textGraphic) {
                let flareTextElement = this._createClonedElementFromGraphic(f.textGraphic, f.flareGroup);
                flareTextElement.setAttribute("pointer-events", "none");
                f.flareGroup.rawNode.appendChild(flareTextElement);
            }

            this._addClassToElement(f.flareGroup.rawNode, "activated", 10);

            // assign some event handlers for the tooltips
            f.flareGroup.mouseEnter = on.pausable(f.flareGroup.rawNode, "mouseenter", () => this._createTooltip(f));
            f.flareGroup.mouseLeave = on.pausable(f.flareGroup.rawNode, "mouseleave", () => this._destroyTooltip());

        }

    }

    private _setFlarePosition(flareGroup: any, clusterSymbolSize: number, flareCount: number, flareIndex: number, degreeVariance: number, viewRotation: number) {

        // get the position of the flare to be placed around the container circle.
        let degree = parseInt(((360 / flareCount) * flareIndex).toFixed());
        degree = degree + degreeVariance;

        // take into account any rotation on the view
        if (viewRotation !== 0) {
            degree -= viewRotation;
        }

        var radian = degree * (Math.PI / 180);
        let buffer = this.flareBufferPixels;

        // position the flare group around the cluster
        let position = {
            x: (buffer + clusterSymbolSize) * Math.cos(radian),
            y: (buffer + clusterSymbolSize) * Math.sin(radian)
        }

        flareGroup.setTransform({ dx: position.x, dy: position.y });
        return position;
    }

    private _getFlareSymbol(flareGraphic: Graphic): SimpleMarkerSymbol {
        return !this.flareRenderer ? this.flareSymbol : this.flareRenderer.getClassBreakInfo(flareGraphic).symbol;
    }

    private _createTooltip(flare: Flare) {

        let flareGroup = flare.flareGroup;
        this._destroyTooltip();

        let tooltipLength = query(".tooltip-text", flareGroup.rawNode).length;
        if (tooltipLength > 0) {
            return;
        }

        // get the text from the data-tooltip attribute of the shape object
        let text = flare.tooltipText;
        if (!text) {
            console.log("no tooltip text for flare.");
            return;
        }

        // split on \n character that should be in tooltip to signify multiple lines
        let lines = text.split("\n");

        // create a group to hold the tooltip elements
        let tooltipGroup = flareGroup.createGroup();

        // get the flare symbol, we'll use this to style the tooltip box
        let flareSymbol = this._getFlareSymbol(flare.graphic);

        // align on top for normal flare, align on bottom for summary flares.
        let height = flareSymbol.size;

        let xPos = 1;
        let yPos = !flare.isSummary ? ((height) * -1) : height + 5;

        tooltipGroup.rawNode.setAttribute("class", "tooltip-text");
        let textShapes = [];
        for (let i = 0, len = lines.length; i < len; i++) {

            let textShape = tooltipGroup.createText({ x: xPos, y: yPos + (i * 10), text: lines[i], align: 'middle' })
                .setFill(this.flareTextSymbol.color)
                .setFont({ size: 10, family: this.flareTextSymbol.font.get("family"), weight: this.flareTextSymbol.font.get("weight") });

            textShapes.push(textShape);
            textShape.rawNode.setAttribute("pointer-events", "none");
        }

        let rectPadding = 2;
        let textBox = tooltipGroup.getBoundingBox();

        let rectShape = tooltipGroup.createRect({ x: textBox.x - rectPadding, y: textBox.y - rectPadding, width: textBox.width + (rectPadding * 2), height: textBox.height + (rectPadding * 2), r: 0 })
            .setFill(flareSymbol.color);

        if (flareSymbol.outline) {
            rectShape.setStroke({ color: flareSymbol.outline.color, width: 0.5 });
        }

        rectShape.rawNode.setAttribute("pointer-events", "none");

        flareGroup.moveToFront();
        for (let i = 0, len = textShapes.length; i < len; i++) {
            textShapes[i].moveToFront();
        }

    }

    private _destroyTooltip() {
        query(".tooltip-text", this._activeView.fclSurface.rawNode).forEach(domConstruct.destroy);
    }


    // #region helper functions

    private _createClonedElementFromGraphic(graphic: Graphic, surface: any): HTMLElement {

        // fake out a GFXObject so we can generate an svg shape that the passed in graphics shape
        let g = new GFXObject();
        g.graphic = graphic;
        g.renderingInfo = { symbol: graphic.symbol };

        // set up parameters for the call to render
        // set the transform of the projector to 0's as we're just placing the generated cluster shape at exactly 0,0.
        let projector = new Projector();
        projector._transform = [0, 0, 0, 0, 0, 0];
        projector._resolution = 0;

        let state = undefined;
        if (this._is2d) {
            state = this._activeView.state;
        }
        else {
            // fake out a state object for 3d views.
            state = {
                clippedExtent: this._activeView.extent,
                rotation: 0,
                spatialReference: this._activeView.spatialReference,
                worldScreenWidth: 1
            };
        }

        let par = {
            surface: surface,
            state: state,
            projector: projector
        };

        g.doRender(par);

        // need to fix up the transform of the new shape. Text symbols seem to get a bit out of whack.
        let yoffset = graphic.symbol["yoffset"] ? graphic.symbol["yoffset"] * -1 : 0;
        let xoffset = graphic.symbol["xoffset"] ? graphic.symbol["xoffset"] * -1 : 0;
        g._shape.setTransform({ xx: 1, yy: 1, dy: yoffset, dx: xoffset });

        return g._shape.rawNode;
    }


    private _extent(): Extent {
        return this._activeView ? this._activeView.extent : undefined;
    }

    private _scale(): number {
        return this._activeView ? this._activeView.scale : undefined;
    }

    /**
     * IE / Edge don't have the classList property on svg elements, so we can't use that add / remove classes - probably why dojo domClass doesn't work either.
       so the following two functions are dodgy string hacks to add / remove classes. Uses a timeout so you can make css transitions work if desired.
     * @param element
     * @param className
     * @param timeoutMs
     * @param callback
     */
    private _addClassToElement(element: HTMLElement, className: string, timeoutMs?: number, callback?: Function) {

        let addClass: Function = (_element, _className) => {
            let currentClass = _element.getAttribute("class");
            if (!currentClass) currentClass = "";
            if (currentClass.indexOf(" " + _className) !== -1) return;
            let newClass = (currentClass + " " + _className).trim();
            _element.setAttribute("class", newClass);
        };

        if (timeoutMs) {
            setTimeout(() => {
                addClass(element, className);
                if (callback) {
                    callback();
                }
            }, timeoutMs);
        }
        else {
            addClass(element, className);
        }
    }


    private _removeClassFromElement(element: HTMLElement, className: string, timeoutMs?: number, callback?: Function) {

        let removeClass: Function = (_element, _className) => {
            let currentClass = _element.getAttribute("class");
            if (!currentClass) return;
            if (currentClass.indexOf(" " + _className) === -1) return;
            _element.setAttribute("class", currentClass.replace(" " + _className, ""));
        };

        if (timeoutMs) {
            setTimeout(() => {
                removeClass(element, className);
                if (callback) {
                    callback();
                }
            }, timeoutMs);
        }
        else {
            removeClass(element, className);
        }

    }

    private _getMousePos(evt) {
        // container on the view is actually a html element at this point, not a string as the typings suggest.
        let container: any = this._activeView.container;
        if (!container) { return { x: 0, y: 0 } };
        let rect = container.getBoundingClientRect();
        return {
            x: evt.x - rect.left,
            y: evt.y - rect.top
        };
    }


    /**
     * Setting visible to false on a graphic doesn't work in 4.2 for some reason. Removing the graphic to hide it instead. I think visible property should probably work though.
     * @param graphic
     */
    private _hideGraphic(graphic: Graphic | Graphic[]) {
        if (!graphic) return;
        if (graphic.hasOwnProperty("length")) {
            this.removeMany(<Graphic[]>graphic);
        }
        else {
            this.remove(<Graphic>graphic);
        }
    }

    private _showGraphic(graphic: Graphic | Graphic[]) {
        if (!graphic) return;
        if (graphic.hasOwnProperty("length")) {
            this.addMany(<Graphic[]>graphic);
        }
        else {
            this.add(<Graphic>graphic);
        }
    }

    //#endregion

}


// interface ActiveView extends MapView and SceneView to add some properties {
interface ActiveView extends MapView, SceneView {
    canvas: any;
    state: any;
    fclSurface: any;
    fclPointerMove: IHandle;
    fclPointerDown: IHandle;

    constraints: any;
    goTo: (target: any, options: __esri.MapViewGoToOptions) => IPromise<any>;
    toMap: (screenPoint: ScreenPoint) => Point;
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


class Cluster {
    clusterGraphic: Graphic;
    textGraphic: Graphic;
    areaGraphic: Graphic;
    clusterId: number;
    clusterGroup: any;
    gridCluster: GridCluster;
}

class Flare {
    graphic: Graphic;
    textGraphic: Graphic;
    tooltipText: string;
    flareText: string;
    singleData: any[];
    flareGroup: any;
    isSummary: boolean;
}

export class PointFilter {
    filterName: string;
    propertyName: string;
    propertyValues: any[];

    // determines whether the filter includes or excludes the point depending on whether it contains the property value.
    // false means the point will be excluded if the value does exist in the object, true means it will be excluded if it doesn't.
    keepOnlyIfValueExists: boolean;

    constructor(filterName: string, propertyName: string, values: any[], keepOnlyIfValueExists: boolean = false) {
        this.filterName = filterName;
        this.propertyName = propertyName;
        this.propertyValues = values;
        this.keepOnlyIfValueExists = keepOnlyIfValueExists;
    }

}

