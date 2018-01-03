/// <reference path="../typings/index.d.ts" />
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
define(["require", "exports", "esri/layers/GraphicsLayer", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/TextSymbol", "esri/symbols/SimpleLineSymbol", "esri/Color", "esri/core/watchUtils", "esri/geometry/support/webMercatorUtils", "esri/Graphic", "esri/geometry/Point", "esri/geometry/Multipoint", "esri/geometry/Polygon", "esri/geometry/geometryEngine", "esri/geometry/SpatialReference", "esri/views/2d/engine/graphics/GFXObject", "esri/views/2d/engine/graphics/Projector", "esri/core/accessorSupport/decorators", "dojo/on", "dojox/gfx", "dojo/dom-construct", "dojo/query", "dojo/dom-attr", "dojo/dom-style"], function (require, exports, GraphicsLayer, SimpleMarkerSymbol, TextSymbol, SimpleLineSymbol, Color, watchUtils, webMercatorUtils, Graphic, Point, Multipoint, Polygon, geometryEngine, SpatialReference, GFXObject, Projector, asd, on, gfx, domConstruct, query, domAttr, domStyle) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var FlareClusterLayer = /** @class */ (function (_super) {
        __extends(FlareClusterLayer, _super);
        function FlareClusterLayer(options) {
            var _this = _super.call(this, options) || this;
            _this._viewLoadCount = 0;
            _this._clusters = {};
            // set the defaults
            if (!options) {
                // missing required parameters
                console.error("Missing required parameters to flare cluster layer constructor.");
                return _this;
            }
            _this.singlePopupTemplate = options.singlePopupTemplate;
            // set up the clustering properties
            _this.clusterRatio = options.clusterRatio || 75; // sets the size of each clusters bounds
            _this.clusterToScale = options.clusterToScale || 2000000; // the scale to stop clustering at and just display single points
            _this.clusterMinCount = options.clusterMinCount || 2; // the min amount of points required in a cluster bounds to justify creating a cluster
            _this.singleFlareTooltipProperty = options.singleFlareTooltipProperty || "name"; // The property name of the dataset to display in a tooltip for a flare when a flare represents a single object.
            if (options.clusterAreaDisplay) {
                _this.clusterAreaDisplay = options.clusterAreaDisplay === "none" ? undefined : options.clusterAreaDisplay; // when to display the area (convex hull) of the points for each each cluster
            }
            _this.maxFlareCount = options.maxFlareCount || 8; // maximum number of flares for each cluster
            _this.maxSingleFlareCount = options.maxSingleFlareCount || 8; // maximum number of single object flares before converting to aggregated flares
            _this.displayFlares = options.displayFlares === false ? false : true; // whether to display flares, default to true 
            _this.displaySubTypeFlares = options.displaySubTypeFlares === true; // whether to display sub type flares, ie: flares that represent the counts of a certain property of the data that is clustered
            _this.subTypeFlareProperty = options.subTypeFlareProperty || undefined; // the property name that the subtype flare will use to count on
            _this.flareBufferPixels = options.flareBufferPixels || 6; // buffer between flares and cluster
            // data set property names
            _this.xPropertyName = options.xPropertyName || "x";
            _this.yPropertyName = options.yPropertyName || "y";
            _this.zPropertyName = options.zPropertyName || "z";
            // set up the symbology/renderer properties
            _this.clusterRenderer = options.clusterRenderer;
            _this.areaRenderer = options.areaRenderer;
            _this.singleRenderer = options.singleRenderer;
            _this.singleSymbol = options.singleSymbol;
            _this.flareRenderer = options.flareRenderer;
            _this.refreshOnStationary = options.refreshOnStationary === false ? false : true; // whether this layer should refresh the clusters and redraw when stationary is true, default to true
            // add some default symbols or use the options values.
            _this.flareSymbol = options.flareSymbol || new SimpleMarkerSymbol({
                size: 14,
                color: new Color([0, 0, 0, 0.5]),
                outline: new SimpleLineSymbol({ color: new Color([255, 255, 255, 0.5]), width: 1 })
            });
            _this.textSymbol = options.textSymbol || new TextSymbol({
                color: new Color([255, 255, 255]),
                font: {
                    size: 10,
                    family: "arial"
                },
                yoffset: -3 // setting yoffset as vertical alignment doesn't work in IE/Edge
            });
            _this.flareTextSymbol = options.flareTextSymbol || new TextSymbol({
                color: new Color([255, 255, 255]),
                font: {
                    size: 6,
                    family: "arial"
                },
                yoffset: -2 // setting yoffset as vertical alignment doesn't work in IE/Edge
            });
            // initial data
            _this._data = options.data || undefined;
            _this.on("layerview-create", function (evt) { return _this._layerViewCreated(evt); });
            if (_this._data) {
                _this.draw();
            }
            return _this;
        }
        FlareClusterLayer.prototype._layerViewCreated = function (evt) {
            var _this = this;
            if (evt.layerView.view.type === "2d") {
                this._layerView2d = evt.layerView;
            }
            else {
                this._layerView3d = evt.layerView;
            }
            // add a stationary watch on the view to refresh if specified in options.
            if (this.refreshOnStationary) {
                watchUtils.pausable(evt.layerView.view, "stationary", function (isStationary, b, c, view) { return _this._viewStationary(isStationary, b, c, view); });
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
                watchUtils.whenTrueOnce(evt.layerView, "attached", function () { return _this._addViewEvents(evt.layerView); });
            }
            else {
                // for scene views just add the events straight away
                this._addViewEvents(evt.layerView);
            }
        };
        FlareClusterLayer.prototype._addViewEvents = function (layerView) {
            var _this = this;
            var v = layerView.view;
            if (!v.fclPointerMove) {
                var container = undefined;
                if (v.type === "2d") {
                    // for a map view get the container element of the layer view to add mousemove event to.
                    container = layerView.container.element;
                }
                else {
                    // for scene view get the canvas element under the view container to add mousemove to.
                    container = query("canvas", v.container)[0];
                }
                // Add pointer move and pointer down. Pointer down to handle touch devices.
                v.fclPointerMove = v.on("pointer-move", function (evt) { return _this._viewPointerMove(evt); });
                v.fclPointerDown = v.on("pointer-down", function (evt) { return _this._viewPointerMove(evt); });
            }
        };
        FlareClusterLayer.prototype._viewStationary = function (isStationary, b, c, view) {
            if (isStationary) {
                if (this._data) {
                    this.draw();
                }
            }
            if (!isStationary && this._activeCluster) {
                // if moving deactivate cluster;
                this._deactivateCluster();
            }
        };
        FlareClusterLayer.prototype.clear = function () {
            this.removeAll();
            this._clusters = {};
        };
        FlareClusterLayer.prototype.setData = function (data, drawData) {
            if (drawData === void 0) { drawData = true; }
            this._data = data;
            if (drawData) {
                this.draw();
            }
        };
        FlareClusterLayer.prototype.draw = function (activeView) {
            var _this = this;
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
            var currentExtent = this._extent();
            if (!this._activeView || !this._data || !currentExtent)
                return;
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
            var graphics = [];
            // Get an extent that is in web mercator to make sure it's flat for extent checking
            // The webextent will need to be normalized since panning over the international dateline will cause
            // cause the extent to shift outside the -180 to 180 degree window.  If we don't normalize then the
            // clusters will not be drawn if the map pans over the international dateline.
            var webExtent = !currentExtent.spatialReference.isWebMercator ? webMercatorUtils.project(currentExtent, new SpatialReference({ "wkid": 102100 })) : currentExtent;
            var extentIsUnioned = false;
            var normalizedWebExtent = webExtent.normalize();
            webExtent = normalizedWebExtent[0];
            if (normalizedWebExtent.length > 1) {
                webExtent = webExtent.union(normalizedWebExtent[1]);
                extentIsUnioned = true;
            }
            if (this._isClustered) {
                this._createClusterGrid(webExtent, extentIsUnioned);
            }
            var web, obj, dataLength = this._data.length, xVal, yVal;
            for (var i = 0; i < dataLength; i++) {
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
                }
                else {
                    web = webMercatorUtils.lngLatToXY(xVal, yVal);
                }
                // check if the obj is visible in the extent before proceeding
                if ((web[0] <= webExtent.xmin || web[0] > webExtent.xmax) || (web[1] <= webExtent.ymin || web[1] > webExtent.ymax)) {
                    continue;
                }
                if (this._isClustered) {
                    // loop cluster grid to see if it should be added to one
                    for (var j = 0, jLen = this._gridClusters.length; j < jLen; j++) {
                        var cl = this._gridClusters[j];
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
                for (var i = 0, len = this._gridClusters.length; i < len; i++) {
                    if (this._gridClusters[i].clusterCount < this.clusterMinCount) {
                        for (var j = 0, jlen = this._gridClusters[i].singles.length; j < jlen; j++) {
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
            console.timeEnd("draw-data-" + this._activeView.type);
            if (!this._activeView.fclSurface) {
                setTimeout(function () {
                    _this._createSurface();
                }, 10);
            }
        };
        FlareClusterLayer.prototype._passesFilter = function (obj) {
            if (!this.filters || this.filters.length === 0)
                return true;
            var passes = true;
            for (var i = 0, len = this.filters.length; i < len; i++) {
                var filter = this.filters[i];
                if (obj[filter.propertyName] == null)
                    continue;
                var valExists = filter.propertyValues.indexOf(obj[filter.propertyName]) !== -1;
                if (valExists) {
                    passes = filter.keepOnlyIfValueExists; // the value exists so return whether we should be keeping it or not.
                }
                else if (!valExists && filter.keepOnlyIfValueExists) {
                    passes = false; // return false as the value doesn't exist, and we should only be keeping point objects where it does exist.
                }
                if (!passes)
                    return false; // if it hasn't passed any of the filters return false;
            }
            return passes;
        };
        FlareClusterLayer.prototype._createSingle = function (obj) {
            var point = new Point({
                x: obj[this.xPropertyName], y: obj[this.yPropertyName], z: obj[this.zPropertyName]
            });
            if (!point.spatialReference.isWebMercator) {
                point = webMercatorUtils.geographicToWebMercator(point);
            }
            var graphic = new Graphic({
                geometry: point,
                attributes: obj
            });
            graphic.popupTemplate = this.singlePopupTemplate;
            if (this.singleRenderer) {
                var symbol = this.singleRenderer.getSymbol(graphic, this._activeView);
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
        };
        FlareClusterLayer.prototype._createCluster = function (gridCluster) {
            var cluster = new Cluster();
            cluster.gridCluster = gridCluster;
            // make sure all geometries added to Graphic objects are in web mercator otherwise wrap around doesn't work.
            var point = new Point({ x: gridCluster.x, y: gridCluster.y });
            if (!point.spatialReference.isWebMercator) {
                point = webMercatorUtils.geographicToWebMercator(point);
            }
            var attributes = {
                x: gridCluster.x,
                y: gridCluster.y,
                clusterCount: gridCluster.clusterCount,
                isCluster: true,
                clusterObject: gridCluster
            };
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
            var textSymbol = this.textSymbol.clone();
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
                var mp = new Multipoint();
                mp.points = gridCluster.points;
                var area = geometryEngine.convexHull(mp, true); // use convex hull on the points to get the boundary
                var areaAttr = {
                    x: gridCluster.x,
                    y: gridCluster.y,
                    clusterCount: gridCluster.clusterCount,
                    clusterId: cluster.clusterId,
                    isClusterArea: true
                };
                if (area.rings && area.rings.length > 0) {
                    var areaPoly = new Polygon(); // had to create a new polygon and fill it with the ring of the calculated area for SceneView to work.
                    areaPoly = areaPoly.addRing(area.rings[0]);
                    if (!areaPoly.spatialReference.isWebMercator) {
                        areaPoly = webMercatorUtils.geographicToWebMercator(areaPoly);
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
        };
        FlareClusterLayer.prototype._createClusterGrid = function (webExtent, extentIsUnioned) {
            // get the total amount of grid spaces based on the height and width of the map (divide it by clusterRatio) - then get the degrees for x and y 
            var xCount = Math.round(this._activeView.width / this.clusterRatio);
            var yCount = Math.round(this._activeView.height / this.clusterRatio);
            // if the extent has been unioned due to normalization, double the count of x in the cluster grid as the unioning will halve it.
            if (extentIsUnioned) {
                xCount *= 2;
            }
            var xw = (webExtent.xmax - webExtent.xmin) / xCount;
            var yh = (webExtent.ymax - webExtent.ymin) / yCount;
            var gsxmin, gsxmax, gsymin, gsymax;
            // create an array of clusters that is a grid over the visible extent. Each cluster contains the extent (in web merc) that bounds the grid space for it.
            this._gridClusters = [];
            for (var i = 0; i < xCount; i++) {
                gsxmin = webExtent.xmin + (xw * i);
                gsxmax = gsxmin + xw;
                for (var j = 0; j < yCount; j++) {
                    gsymin = webExtent.ymin + (yh * j);
                    gsymax = gsymin + yh;
                    var ext = { xmin: gsxmin, xmax: gsxmax, ymin: gsymin, ymax: gsymax };
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
        };
        /**
         * Create an svg surface on the view if it doesn't already exist
         * @param view
         */
        FlareClusterLayer.prototype._createSurface = function () {
            if (this._activeView.fclSurface || (this._activeView.type === "2d" && !this._layerView2d.container.element))
                return;
            var surfaceParentElement = undefined;
            if (this._is2d) {
                surfaceParentElement = this._layerView2d.container.element.parentElement || this._layerView2d.container.element.parentNode;
            }
            else {
                surfaceParentElement = this._activeView.canvas.parentElement || this._activeView.canvas.parentNode;
            }
            var surface = gfx.createSurface(surfaceParentElement, "0", "0");
            surface.containerGroup = surface.createGroup();
            domStyle.set(surface.rawNode, { position: "absolute", top: "0", zIndex: -1 });
            domAttr.set(surface.rawNode, "overflow", "visible");
            domAttr.set(surface.rawNode, "class", "fcl-surface");
            this._activeView.fclSurface = surface;
        };
        FlareClusterLayer.prototype._viewPointerMove = function (evt) {
            var _this = this;
            var mousePos = this._getMousePos(evt);
            // if there's an active cluster and the current screen pos is within the bounds of that cluster's group container, don't do anything more. 
            // TODO: would probably be better to check if the point is in the actual circle of the cluster group and it's flares instead of using the rectanglar bounding box.
            if (this._activeCluster && this._activeCluster.clusterGroup) {
                var bbox = this._activeCluster.clusterGroup.rawNode.getBoundingClientRect();
                if (bbox) {
                    if (mousePos.x >= bbox.left && mousePos.x <= bbox.right && mousePos.y >= bbox.top && mousePos.y <= bbox.bottom)
                        return;
                }
            }
            if (!this._activeView.ready)
                return;
            var hitTest = this._activeView.hitTest(mousePos);
            if (!hitTest)
                return;
            hitTest.then(function (response) {
                var graphics = response.results;
                if (graphics.length === 0) {
                    _this._deactivateCluster();
                    return;
                }
                for (var i = 0, len = graphics.length; i < len; i++) {
                    var g = graphics[i].graphic;
                    if (g && (g.attributes.clusterId != null && !g.attributes.isClusterArea)) {
                        var cluster = _this._clusters[g.attributes.clusterId];
                        _this._activateCluster(cluster);
                        return;
                    }
                    else {
                        _this._deactivateCluster();
                    }
                }
            });
        };
        FlareClusterLayer.prototype._activateCluster = function (cluster) {
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
        };
        FlareClusterLayer.prototype._deactivateCluster = function () {
            if (!this._activeCluster || !this._activeCluster.clusterGroup)
                return;
            this._showGraphic([this._activeCluster.clusterGraphic, this._activeCluster.textGraphic]);
            this._removeClassFromElement(this._activeCluster.clusterGroup.rawNode, "activated");
            if (this.clusterAreaDisplay === "activated") {
                this._hideGraphic(this._activeCluster.areaGraphic);
            }
            this._clearSurface();
            this._activeCluster = undefined;
            //console.log("DE-activate cluster");
        };
        FlareClusterLayer.prototype._initSurface = function () {
            if (!this._activeCluster)
                return;
            var surface = this._activeView.fclSurface;
            if (!surface)
                return;
            var sp = this._activeView.toScreen(this._activeCluster.clusterGraphic.geometry);
            // toScreen() returns the wrong value for x if a 2d map has been wrapped around the globe. Need to check and cater for this. I think this a bug in the api.
            if (this._is2d) {
                var wsw = this._activeView.state.worldScreenWidth;
                var ratio = parseInt((sp.x / wsw).toFixed(0)); // get a ratio to determine how many times the map has been wrapped around.
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
        };
        FlareClusterLayer.prototype._clearSurface = function () {
            var surface = this._activeView.fclSurface;
            query(".cluster-group", surface.containerGroup.rawNode).forEach(domConstruct.destroy);
            domStyle.set(surface.rawNode, { zIndex: -1, overflow: "hidden", top: "0px", left: "0px" });
            domAttr.set(surface.rawNode, "overflow", "hidden");
        };
        FlareClusterLayer.prototype._initCluster = function () {
            if (!this._activeCluster)
                return;
            var surface = this._activeView.fclSurface;
            if (!surface)
                return;
            // we're going to replicate a cluster graphic in the svg element we added to the layer view. Just so it can be styled easily. Native WebGL for Scene Views would probably be better, but at least this way css can still be used to style/animate things.
            this._activeCluster.clusterGroup = surface.containerGroup.createGroup();
            this._addClassToElement(this._activeCluster.clusterGroup.rawNode, "cluster-group");
            // create the cluster shape
            var clonedClusterElement = this._createClonedElementFromGraphic(this._activeCluster.clusterGraphic, this._activeCluster.clusterGroup);
            this._addClassToElement(clonedClusterElement, "cluster");
            // create the cluster text shape
            var clonedTextElement = this._createClonedElementFromGraphic(this._activeCluster.textGraphic, this._activeCluster.clusterGroup);
            this._addClassToElement(clonedTextElement, "cluster-text");
            clonedTextElement.setAttribute("pointer-events", "none");
            this._activeCluster.clusterGroup.rawNode.appendChild(clonedClusterElement);
            this._activeCluster.clusterGroup.rawNode.appendChild(clonedTextElement);
            // set the group elements class     
            this._addClassToElement(this._activeCluster.clusterGroup.rawNode, "activated", 10);
        };
        FlareClusterLayer.prototype._initFlares = function () {
            var _this = this;
            if (!this._activeCluster || !this.displayFlares)
                return;
            var gridCluster = this._activeCluster.gridCluster;
            // check if we need to create flares for the cluster
            var singleFlares = (gridCluster.singles && gridCluster.singles.length > 0) && (gridCluster.clusterCount <= this.maxSingleFlareCount);
            var subTypeFlares = !singleFlares && (gridCluster.subTypeCounts && gridCluster.subTypeCounts.length > 0);
            if (!singleFlares && !subTypeFlares) {
                return; // no flares required
            }
            var flares = [];
            if (singleFlares) {
                for (var i = 0, len = gridCluster.singles.length; i < len; i++) {
                    var f = new Flare();
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
                    var f = new Flare();
                    f.tooltipText = subTypes[i].name + " (" + subTypes[i].count + ")";
                    f.flareText = subTypes[i].count;
                    flares.push(f);
                }
            }
            // if there are more flare objects to create than the maxFlareCount and this is one of those - create a summary flare that contains '...' as the text.
            var willContainSummaryFlare = flares.length > this.maxFlareCount;
            var flareCount = willContainSummaryFlare ? this.maxFlareCount : flares.length;
            // if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
            // for an add amount position the first flare on top, -90 to do this. Looks nicer this way.
            var degreeVariance = (flareCount % 2 === 0) ? -180 : -90;
            var viewRotation = this._is2d ? this._activeView.rotation : 0;
            var clusterScreenPoint = this._activeView.toScreen(this._activeCluster.clusterGraphic.geometry);
            var clusterSymbolSize = this._activeCluster.clusterGraphic.symbol.get("size");
            for (var i_1 = 0; i_1 < flareCount; i_1++) {
                var flare = flares[i_1];
                // set some attribute data
                var flareAttributes = {
                    isFlare: true,
                    isSummaryFlare: false,
                    tooltipText: "",
                    flareTextGraphic: undefined,
                    clusterGraphicId: this._activeCluster.clusterId,
                    clusterCount: gridCluster.clusterCount
                };
                var flareTextAttributes = {};
                // do a couple of things differently if this is a summary flare or not
                var isSummaryFlare = willContainSummaryFlare && i_1 >= this.maxFlareCount - 1;
                if (isSummaryFlare) {
                    flare.isSummary = true;
                    flareAttributes.isSummaryFlare = true;
                    var tooltipText = "";
                    // multiline tooltip for summary flares, ie: greater than this.maxFlareCount flares per cluster
                    for (var j = this.maxFlareCount - 1, jlen = flares.length; j < jlen; j++) {
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
                    var textSymbol = this.flareTextSymbol.clone();
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
            var _loop_1 = function (i_2, len_1) {
                var f = flares[i_2];
                if (!f.graphic)
                    return "continue";
                // create a group to hold flare object and text if needed. 
                f.flareGroup = this_1._activeCluster.clusterGroup.createGroup();
                var position = this_1._setFlarePosition(f.flareGroup, clusterSymbolSize, flareCount, i_2, degreeVariance, viewRotation);
                this_1._addClassToElement(f.flareGroup.rawNode, "flare-group");
                var flareElement = this_1._createClonedElementFromGraphic(f.graphic, f.flareGroup);
                f.flareGroup.rawNode.appendChild(flareElement);
                if (f.textGraphic) {
                    var flareTextElement = this_1._createClonedElementFromGraphic(f.textGraphic, f.flareGroup);
                    flareTextElement.setAttribute("pointer-events", "none");
                    f.flareGroup.rawNode.appendChild(flareTextElement);
                }
                this_1._addClassToElement(f.flareGroup.rawNode, "activated", 10);
                // assign some event handlers for the tooltips
                f.flareGroup.mouseEnter = on.pausable(f.flareGroup.rawNode, "mouseenter", function () { return _this._createTooltip(f); });
                f.flareGroup.mouseLeave = on.pausable(f.flareGroup.rawNode, "mouseleave", function () { return _this._destroyTooltip(); });
            };
            var this_1 = this;
            // flares have been created so add them to the dom
            for (var i_2 = 0, len_1 = flares.length; i_2 < len_1; i_2++) {
                _loop_1(i_2, len_1);
            }
        };
        FlareClusterLayer.prototype._setFlarePosition = function (flareGroup, clusterSymbolSize, flareCount, flareIndex, degreeVariance, viewRotation) {
            // get the position of the flare to be placed around the container circle.
            var degree = parseInt(((360 / flareCount) * flareIndex).toFixed());
            degree = degree + degreeVariance;
            // take into account any rotation on the view
            if (viewRotation !== 0) {
                degree -= viewRotation;
            }
            var radian = degree * (Math.PI / 180);
            var buffer = this.flareBufferPixels;
            // position the flare group around the cluster
            var position = {
                x: (buffer + clusterSymbolSize) * Math.cos(radian),
                y: (buffer + clusterSymbolSize) * Math.sin(radian)
            };
            flareGroup.setTransform({ dx: position.x, dy: position.y });
            return position;
        };
        FlareClusterLayer.prototype._getFlareSymbol = function (flareGraphic) {
            return !this.flareRenderer ? this.flareSymbol : this.flareRenderer.getClassBreakInfo(flareGraphic).symbol;
        };
        FlareClusterLayer.prototype._createTooltip = function (flare) {
            var flareGroup = flare.flareGroup;
            this._destroyTooltip();
            var tooltipLength = query(".tooltip-text", flareGroup.rawNode).length;
            if (tooltipLength > 0) {
                return;
            }
            // get the text from the data-tooltip attribute of the shape object
            var text = flare.tooltipText;
            if (!text) {
                console.log("no tooltip text for flare.");
                return;
            }
            // split on \n character that should be in tooltip to signify multiple lines
            var lines = text.split("\n");
            // create a group to hold the tooltip elements
            var tooltipGroup = flareGroup.createGroup();
            // get the flare symbol, we'll use this to style the tooltip box
            var flareSymbol = this._getFlareSymbol(flare.graphic);
            // align on top for normal flare, align on bottom for summary flares.
            var height = flareSymbol.size;
            var xPos = 1;
            var yPos = !flare.isSummary ? ((height) * -1) : height + 5;
            tooltipGroup.rawNode.setAttribute("class", "tooltip-text");
            var textShapes = [];
            for (var i = 0, len = lines.length; i < len; i++) {
                var textShape = tooltipGroup.createText({ x: xPos, y: yPos + (i * 10), text: lines[i], align: 'middle' })
                    .setFill(this.flareTextSymbol.color)
                    .setFont({ size: 10, family: this.flareTextSymbol.font.get("family"), weight: this.flareTextSymbol.font.get("weight") });
                textShapes.push(textShape);
                textShape.rawNode.setAttribute("pointer-events", "none");
            }
            var rectPadding = 2;
            var textBox = tooltipGroup.getBoundingBox();
            var rectShape = tooltipGroup.createRect({ x: textBox.x - rectPadding, y: textBox.y - rectPadding, width: textBox.width + (rectPadding * 2), height: textBox.height + (rectPadding * 2), r: 0 })
                .setFill(flareSymbol.color);
            if (flareSymbol.outline) {
                rectShape.setStroke({ color: flareSymbol.outline.color, width: 0.5 });
            }
            rectShape.rawNode.setAttribute("pointer-events", "none");
            flareGroup.moveToFront();
            for (var i = 0, len = textShapes.length; i < len; i++) {
                textShapes[i].moveToFront();
            }
        };
        FlareClusterLayer.prototype._destroyTooltip = function () {
            query(".tooltip-text", this._activeView.fclSurface.rawNode).forEach(domConstruct.destroy);
        };
        // #region helper functions
        FlareClusterLayer.prototype._createClonedElementFromGraphic = function (graphic, surface) {
            // fake out a GFXObject so we can generate an svg shape that the passed in graphics shape
            var g = new GFXObject();
            g.graphic = graphic;
            g.renderingInfo = { symbol: graphic.symbol };
            // set up parameters for the call to render
            // set the transform of the projector to 0's as we're just placing the generated cluster shape at exactly 0,0.
            var projector = new Projector();
            projector._transform = [0, 0, 0, 0, 0, 0];
            projector._resolution = 0;
            var state = undefined;
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
            var par = {
                surface: surface,
                state: state,
                projector: projector
            };
            g.doRender(par);
            // need to fix up the transform of the new shape. Text symbols seem to get a bit out of whack.
            var yoffset = graphic.symbol["yoffset"] ? graphic.symbol["yoffset"] * -1 : 0;
            var xoffset = graphic.symbol["xoffset"] ? graphic.symbol["xoffset"] * -1 : 0;
            g._shape.setTransform({ xx: 1, yy: 1, dy: yoffset, dx: xoffset });
            return g._shape.rawNode;
        };
        FlareClusterLayer.prototype._extent = function () {
            return this._activeView ? this._activeView.extent : undefined;
        };
        FlareClusterLayer.prototype._scale = function () {
            return this._activeView ? this._activeView.scale : undefined;
        };
        /**
         * IE / Edge don't have the classList property on svg elements, so we can't use that add / remove classes - probably why dojo domClass doesn't work either.
           so the following two functions are dodgy string hacks to add / remove classes. Uses a timeout so you can make css transitions work if desired.
         * @param element
         * @param className
         * @param timeoutMs
         * @param callback
         */
        FlareClusterLayer.prototype._addClassToElement = function (element, className, timeoutMs, callback) {
            var addClass = function (_element, _className) {
                var currentClass = _element.getAttribute("class");
                if (!currentClass)
                    currentClass = "";
                if (currentClass.indexOf(" " + _className) !== -1)
                    return;
                var newClass = (currentClass + " " + _className).trim();
                _element.setAttribute("class", newClass);
            };
            if (timeoutMs) {
                setTimeout(function () {
                    addClass(element, className);
                    if (callback) {
                        callback();
                    }
                }, timeoutMs);
            }
            else {
                addClass(element, className);
            }
        };
        FlareClusterLayer.prototype._removeClassFromElement = function (element, className, timeoutMs, callback) {
            var removeClass = function (_element, _className) {
                var currentClass = _element.getAttribute("class");
                if (!currentClass)
                    return;
                if (currentClass.indexOf(" " + _className) === -1)
                    return;
                _element.setAttribute("class", currentClass.replace(" " + _className, ""));
            };
            if (timeoutMs) {
                setTimeout(function () {
                    removeClass(element, className);
                    if (callback) {
                        callback();
                    }
                }, timeoutMs);
            }
            else {
                removeClass(element, className);
            }
        };
        FlareClusterLayer.prototype._getMousePos = function (evt) {
            // container on the view is actually a html element at this point, not a string as the typings suggest.
            var container = this._activeView.container;
            if (!container) {
                return { x: 0, y: 0 };
            }
            ;
            var rect = container.getBoundingClientRect();
            return {
                x: evt.x - rect.left,
                y: evt.y - rect.top
            };
        };
        /**
         * Setting visible to false on a graphic doesn't work in 4.2 for some reason. Removing the graphic to hide it instead. I think visible property should probably work though.
         * @param graphic
         */
        FlareClusterLayer.prototype._hideGraphic = function (graphic) {
            if (!graphic)
                return;
            if (graphic.hasOwnProperty("length")) {
                this.removeMany(graphic);
            }
            else {
                this.remove(graphic);
            }
        };
        FlareClusterLayer.prototype._showGraphic = function (graphic) {
            if (!graphic)
                return;
            if (graphic.hasOwnProperty("length")) {
                this.addMany(graphic);
            }
            else {
                this.add(graphic);
            }
        };
        FlareClusterLayer = __decorate([
            asd.subclass("FlareClusterLayer"),
            __metadata("design:paramtypes", [Object])
        ], FlareClusterLayer);
        return FlareClusterLayer;
    }(asd.declared(GraphicsLayer)));
    exports.FlareClusterLayer = FlareClusterLayer;
    var GridCluster = /** @class */ (function () {
        function GridCluster() {
            this.subTypeCounts = [];
            this.singles = [];
            this.points = [];
        }
        return GridCluster;
    }());
    var Cluster = /** @class */ (function () {
        function Cluster() {
        }
        return Cluster;
    }());
    var Flare = /** @class */ (function () {
        function Flare() {
        }
        return Flare;
    }());
    var PointFilter = /** @class */ (function () {
        function PointFilter(filterName, propertyName, values, keepOnlyIfValueExists) {
            if (keepOnlyIfValueExists === void 0) { keepOnlyIfValueExists = false; }
            this.filterName = filterName;
            this.propertyName = propertyName;
            this.propertyValues = values;
            this.keepOnlyIfValueExists = keepOnlyIfValueExists;
        }
        return PointFilter;
    }());
    exports.PointFilter = PointFilter;
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvRmxhcmVDbHVzdGVyTGF5ZXJfdjQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOENBQThDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQTZFOUM7UUFBdUMscUNBQTJCO1FBb0Q5RCwyQkFBWSxPQUFvQztZQUFoRCxZQUVJLGtCQUFNLE9BQU8sQ0FBQyxTQTJFakI7WUExRk8sb0JBQWMsR0FBVyxDQUFDLENBQUM7WUFPM0IsZUFBUyxHQUFzQyxFQUFFLENBQUM7WUFVdEQsbUJBQW1CO1lBQ25CLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDWCw4QkFBOEI7Z0JBQzlCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQzs7WUFFckYsQ0FBQztZQUVELEtBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUM7WUFFdkQsbUNBQW1DO1lBRW5DLEtBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUMsQ0FBQyx3Q0FBd0M7WUFDeEYsS0FBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxJQUFJLE9BQU8sQ0FBQyxDQUFDLGlFQUFpRTtZQUMxSCxLQUFJLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQyxlQUFlLElBQUksQ0FBQyxDQUFDLENBQUMsc0ZBQXNGO1lBQzNJLEtBQUksQ0FBQywwQkFBMEIsR0FBRyxPQUFPLENBQUMsMEJBQTBCLElBQUksTUFBTSxDQUFDLENBQUMsZ0hBQWdIO1lBQ2hNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLEtBQUksQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLENBQUMsa0JBQWtCLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLDZFQUE2RTtZQUMzTCxD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QWhCWSxrQ0FBVyIsImZpbGUiOiJGbGFyZUNsdXN0ZXJMYXllcl92NC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxyXG5cclxuaW1wb3J0ICogYXMgR3JhcGhpY3NMYXllciBmcm9tIFwiZXNyaS9sYXllcnMvR3JhcGhpY3NMYXllclwiO1xyXG5pbXBvcnQgKiBhcyBDbGFzc0JyZWFrc1JlbmRlcmVyIGZyb20gXCJlc3JpL3JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyXCI7XHJcbmltcG9ydCAqIGFzIFBvcHVwVGVtcGxhdGUgZnJvbSBcImVzcmkvUG9wdXBUZW1wbGF0ZVwiO1xyXG5pbXBvcnQgKiBhcyBTaW1wbGVNYXJrZXJTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9TaW1wbGVNYXJrZXJTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgVGV4dFN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1RleHRTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgU2ltcGxlTGluZVN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1NpbXBsZUxpbmVTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgQ29sb3IgZnJvbSBcImVzcmkvQ29sb3JcIjtcclxuaW1wb3J0ICogYXMgd2F0Y2hVdGlscyBmcm9tICdlc3JpL2NvcmUvd2F0Y2hVdGlscyc7XHJcbmltcG9ydCAqIGFzIFZpZXcgZnJvbSAnZXNyaS92aWV3cy9WaWV3JztcclxuaW1wb3J0ICogYXMgd2ViTWVyY2F0b3JVdGlscyBmcm9tIFwiZXNyaS9nZW9tZXRyeS9zdXBwb3J0L3dlYk1lcmNhdG9yVXRpbHNcIjtcclxuaW1wb3J0ICogYXMgR3JhcGhpYyBmcm9tIFwiZXNyaS9HcmFwaGljXCI7XHJcbmltcG9ydCAqIGFzIFBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvaW50XCI7IFxyXG5pbXBvcnQgKiBhcyBTY3JlZW5Qb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TY3JlZW5Qb2ludFwiO1xyXG5pbXBvcnQgKiBhcyBNdWx0aXBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L011bHRpcG9pbnRcIjtcclxuaW1wb3J0ICogYXMgUG9seWdvbiBmcm9tIFwiZXNyaS9nZW9tZXRyeS9Qb2x5Z29uXCI7XHJcbmltcG9ydCAqIGFzIGdlb21ldHJ5RW5naW5lIGZyb20gJ2VzcmkvZ2VvbWV0cnkvZ2VvbWV0cnlFbmdpbmUnO1xyXG5pbXBvcnQgKiBhcyBTcGF0aWFsUmVmZXJlbmNlIGZyb20gXCJlc3JpL2dlb21ldHJ5L1NwYXRpYWxSZWZlcmVuY2VcIjtcclxuaW1wb3J0ICogYXMgRXh0ZW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L0V4dGVudFwiO1xyXG5pbXBvcnQgKiBhcyBNYXBWaWV3IGZyb20gJ2Vzcmkvdmlld3MvTWFwVmlldyc7XHJcbmltcG9ydCAqIGFzIFNjZW5lVmlldyBmcm9tICdlc3JpL3ZpZXdzL1NjZW5lVmlldyc7XHJcbiBcclxuaW1wb3J0ICogYXMgR0ZYT2JqZWN0IGZyb20gXCJlc3JpL3ZpZXdzLzJkL2VuZ2luZS9ncmFwaGljcy9HRlhPYmplY3RcIjtcclxuaW1wb3J0ICogYXMgUHJvamVjdG9yIGZyb20gXCJlc3JpL3ZpZXdzLzJkL2VuZ2luZS9ncmFwaGljcy9Qcm9qZWN0b3JcIjtcclxuIFxyXG5pbXBvcnQgKiBhcyBhc2QgZnJvbSBcImVzcmkvY29yZS9hY2Nlc3NvclN1cHBvcnQvZGVjb3JhdG9yc1wiO1xyXG5cclxuaW1wb3J0ICogYXMgb24gZnJvbSAnZG9qby9vbic7XHJcbmltcG9ydCAqIGFzIGdmeCBmcm9tICdkb2pveC9nZngnO1xyXG5pbXBvcnQgKiBhcyBkb21Db25zdHJ1Y3QgZnJvbSAnZG9qby9kb20tY29uc3RydWN0JztcclxuaW1wb3J0ICogYXMgcXVlcnkgZnJvbSAnZG9qby9xdWVyeSc7XHJcbmltcG9ydCAqIGFzIGRvbUF0dHIgZnJvbSAnZG9qby9kb20tYXR0cic7XHJcbmltcG9ydCAqIGFzIGRvbVN0eWxlIGZyb20gJ2Rvam8vZG9tLXN0eWxlJztcclxuIFxyXG5cclxuaW50ZXJmYWNlIEZsYXJlQ2x1c3RlckxheWVyUHJvcGVydGllcyBleHRlbmRzIF9fZXNyaS5HcmFwaGljc0xheWVyUHJvcGVydGllcyB7XHJcblxyXG4gICAgY2x1c3RlclJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVSZW5kZXJlcj86IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbD86IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIGFyZWFSZW5kZXJlcj86IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVQb3B1cFRlbXBsYXRlPzogUG9wdXBUZW1wbGF0ZTtcclxuICAgIHNwYXRpYWxSZWZlcmVuY2U/OiBTcGF0aWFsUmVmZXJlbmNlO1xyXG5cclxuICAgIGNsdXN0ZXJSYXRpbz86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJUb1NjYWxlPzogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50PzogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5Pzogc3RyaW5nO1xyXG5cclxuICAgIGRpc3BsYXlGbGFyZXM/OiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ/OiBudW1iZXI7XHJcbiAgICBzaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eT86IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sPzogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM/OiBudW1iZXI7XHJcbiAgICB0ZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbD86IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBzdWJUeXBlRmxhcmVQcm9wZXJ0eT86IHN0cmluZztcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgeVByb3BlcnR5TmFtZT86IHN0cmluZztcclxuICAgIHpQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcblxyXG4gICAgcmVmcmVzaE9uU3RhdGlvbmFyeT86IGJvb2xlYW47XHJcblxyXG4gICAgZmlsdGVycz86IFBvaW50RmlsdGVyW107XHJcblxyXG4gICAgZGF0YT86IGFueVtdO1xyXG5cclxufVxyXG5cclxuQGFzZC5zdWJjbGFzcyhcIkZsYXJlQ2x1c3RlckxheWVyXCIpXHJcbmV4cG9ydCBjbGFzcyBGbGFyZUNsdXN0ZXJMYXllciBleHRlbmRzIGFzZC5kZWNsYXJlZChHcmFwaGljc0xheWVyKSB7XHJcblxyXG4gICAgc2luZ2xlUmVuZGVyZXI6IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbDogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgc2luZ2xlUG9wdXBUZW1wbGF0ZTogUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICBjbHVzdGVyUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBhcmVhUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNwYXRpYWxSZWZlcmVuY2U6IFNwYXRpYWxSZWZlcmVuY2U7XHJcblxyXG4gICAgY2x1c3RlclJhdGlvOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyVG9TY2FsZTogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyQXJlYURpc3BsYXk6IHN0cmluZztcclxuXHJcbiAgICBkaXNwbGF5RmxhcmVzOiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudDogbnVtYmVyO1xyXG4gICAgbWF4U2luZ2xlRmxhcmVDb3VudDogbnVtYmVyO1xyXG4gICAgc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHk6IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sOiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBmbGFyZUJ1ZmZlclBpeGVsczogbnVtYmVyO1xyXG4gICAgdGV4dFN5bWJvbDogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbDogVGV4dFN5bWJvbDtcclxuICAgIGRpc3BsYXlTdWJUeXBlRmxhcmVzOiBib29sZWFuO1xyXG4gICAgc3ViVHlwZUZsYXJlUHJvcGVydHk6IHN0cmluZztcclxuXHJcbiAgICByZWZyZXNoT25TdGF0aW9uYXJ5OiBib29sZWFuO1xyXG5cclxuICAgIHhQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHlQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHpQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuXHJcbiAgICBmaWx0ZXJzOiBQb2ludEZpbHRlcltdO1xyXG5cclxuICAgIHByaXZhdGUgX2dyaWRDbHVzdGVyczogR3JpZENsdXN0ZXJbXTtcclxuICAgIHByaXZhdGUgX2lzQ2x1c3RlcmVkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfYWN0aXZlVmlldzogQWN0aXZlVmlldztcclxuICAgIHByaXZhdGUgX3ZpZXdMb2FkQ291bnQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgcHJpdmF0ZSBfcmVhZHlUb0RyYXc6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9xdWV1ZWRJbml0aWFsRHJhdzogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX2RhdGE6IGFueVtdO1xyXG4gICAgcHJpdmF0ZSBfaXMyZDogYm9vbGVhbjtcclxuXHJcbiAgICBwcml2YXRlIF9jbHVzdGVyczogeyBbY2x1c3RlcklkOiBudW1iZXJdOiBDbHVzdGVyOyB9ID0ge307XHJcbiAgICBwcml2YXRlIF9hY3RpdmVDbHVzdGVyOiBDbHVzdGVyO1xyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlldzJkOiBhbnk7XHJcbiAgICBwcml2YXRlIF9sYXllclZpZXczZDogYW55O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEZsYXJlQ2x1c3RlckxheWVyUHJvcGVydGllcykge1xyXG5cclxuICAgICAgICBzdXBlcihvcHRpb25zKTtcclxuXHJcbiAgICAgICAgLy8gc2V0IHRoZSBkZWZhdWx0c1xyXG4gICAgICAgIGlmICghb3B0aW9ucykge1xyXG4gICAgICAgICAgICAvLyBtaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnNcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIk1pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVycyB0byBmbGFyZSBjbHVzdGVyIGxheWVyIGNvbnN0cnVjdG9yLlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zaW5nbGVQb3B1cFRlbXBsYXRlID0gb3B0aW9ucy5zaW5nbGVQb3B1cFRlbXBsYXRlO1xyXG5cclxuICAgICAgICAvLyBzZXQgdXAgdGhlIGNsdXN0ZXJpbmcgcHJvcGVydGllc1xyXG5cclxuICAgICAgICB0aGlzLmNsdXN0ZXJSYXRpbyA9IG9wdGlvbnMuY2x1c3RlclJhdGlvIHx8IDc1OyAvLyBzZXRzIHRoZSBzaXplIG9mIGVhY2ggY2x1c3RlcnMgYm91bmRzXHJcbiAgICAgICAgdGhpcy5jbHVzdGVyVG9TY2FsZSA9IG9wdGlvbnMuY2x1c3RlclRvU2NhbGUgfHwgMjAwMDAwMDsgLy8gdGhlIHNjYWxlIHRvIHN0b3AgY2x1c3RlcmluZyBhdCBhbmQganVzdCBkaXNwbGF5IHNpbmdsZSBwb2ludHNcclxuICAgICAgICB0aGlzLmNsdXN0ZXJNaW5Db3VudCA9IG9wdGlvbnMuY2x1c3Rlck1pbkNvdW50IHx8IDI7IC8vIHRoZSBtaW4gYW1vdW50IG9mIHBvaW50cyByZXF1aXJlZCBpbiBhIGNsdXN0ZXIgYm91bmRzIHRvIGp1c3RpZnkgY3JlYXRpbmcgYSBjbHVzdGVyXHJcbiAgICAgICAgdGhpcy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eSA9IG9wdGlvbnMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHkgfHwgXCJuYW1lXCI7IC8vIFRoZSBwcm9wZXJ0eSBuYW1lIG9mIHRoZSBkYXRhc2V0IHRvIGRpc3BsYXkgaW4gYSB0b29sdGlwIGZvciBhIGZsYXJlIHdoZW4gYSBmbGFyZSByZXByZXNlbnRzIGEgc2luZ2xlIG9iamVjdC5cclxuICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXkpIHtcclxuICAgICAgICAgICAgdGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPSBvcHRpb25zLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJub25lXCIgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNsdXN0ZXJBcmVhRGlzcGxheTsgLy8gd2hlbiB0byBkaXNwbGF5IHRoZSBhcmVhIChjb252ZXggaHVsbCkgb2YgdGhlIHBvaW50cyBmb3IgZWFjaCBlYWNoIGNsdXN0ZXJcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5tYXhGbGFyZUNvdW50ID0gb3B0aW9ucy5tYXhGbGFyZUNvdW50IHx8IDg7IC8vIG1heGltdW0gbnVtYmVyIG9mIGZsYXJlcyBmb3IgZWFjaCBjbHVzdGVyXHJcbiAgICAgICAgdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50ID0gb3B0aW9ucy5tYXhTaW5nbGVGbGFyZUNvdW50IHx8IDg7IC8vIG1heGltdW0gbnVtYmVyIG9mIHNpbmdsZSBvYmplY3QgZmxhcmVzIGJlZm9yZSBjb252ZXJ0aW5nIHRvIGFnZ3JlZ2F0ZWQgZmxhcmVzXHJcbiAgICAgICAgdGhpcy5kaXNwbGF5RmxhcmVzID0gb3B0aW9ucy5kaXNwbGF5RmxhcmVzID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZTsgLy8gd2hldGhlciB0byBkaXNwbGF5IGZsYXJlcywgZGVmYXVsdCB0byB0cnVlIFxyXG4gICAgICAgIHRoaXMuZGlzcGxheVN1YlR5cGVGbGFyZXMgPSBvcHRpb25zLmRpc3BsYXlTdWJUeXBlRmxhcmVzID09PSB0cnVlOyAvLyB3aGV0aGVyIHRvIGRpc3BsYXkgc3ViIHR5cGUgZmxhcmVzLCBpZTogZmxhcmVzIHRoYXQgcmVwcmVzZW50IHRoZSBjb3VudHMgb2YgYSBjZXJ0YWluIHByb3BlcnR5IG9mIHRoZSBkYXRhIHRoYXQgaXMgY2x1c3RlcmVkXHJcbiAgICAgICAgdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eSA9IG9wdGlvbnMuc3ViVHlwZUZsYXJlUHJvcGVydHkgfHwgdW5kZWZpbmVkOyAvLyB0aGUgcHJvcGVydHkgbmFtZSB0aGF0IHRoZSBzdWJ0eXBlIGZsYXJlIHdpbGwgdXNlIHRvIGNvdW50IG9uXHJcbiAgICAgICAgdGhpcy5mbGFyZUJ1ZmZlclBpeGVscyA9IG9wdGlvbnMuZmxhcmVCdWZmZXJQaXhlbHMgfHwgNjsgLy8gYnVmZmVyIGJldHdlZW4gZmxhcmVzIGFuZCBjbHVzdGVyXHJcblxyXG4gICAgICAgIC8vIGRhdGEgc2V0IHByb3BlcnR5IG5hbWVzXHJcbiAgICAgICAgdGhpcy54UHJvcGVydHlOYW1lID0gb3B0aW9ucy54UHJvcGVydHlOYW1lIHx8IFwieFwiO1xyXG4gICAgICAgIHRoaXMueVByb3BlcnR5TmFtZSA9IG9wdGlvbnMueVByb3BlcnR5TmFtZSB8fCBcInlcIjtcclxuICAgICAgICB0aGlzLnpQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnpQcm9wZXJ0eU5hbWUgfHwgXCJ6XCI7XHJcblxyXG4gICAgICAgIC8vIHNldCB1cCB0aGUgc3ltYm9sb2d5L3JlbmRlcmVyIHByb3BlcnRpZXNcclxuICAgICAgICB0aGlzLmNsdXN0ZXJSZW5kZXJlciA9IG9wdGlvbnMuY2x1c3RlclJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuYXJlYVJlbmRlcmVyID0gb3B0aW9ucy5hcmVhUmVuZGVyZXI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVSZW5kZXJlciA9IG9wdGlvbnMuc2luZ2xlUmVuZGVyZXI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVTeW1ib2wgPSBvcHRpb25zLnNpbmdsZVN5bWJvbDtcclxuICAgICAgICB0aGlzLmZsYXJlUmVuZGVyZXIgPSBvcHRpb25zLmZsYXJlUmVuZGVyZXI7XHJcblxyXG4gICAgICAgIHRoaXMucmVmcmVzaE9uU3RhdGlvbmFyeSA9IG9wdGlvbnMucmVmcmVzaE9uU3RhdGlvbmFyeSA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vIHdoZXRoZXIgdGhpcyBsYXllciBzaG91bGQgcmVmcmVzaCB0aGUgY2x1c3RlcnMgYW5kIHJlZHJhdyB3aGVuIHN0YXRpb25hcnkgaXMgdHJ1ZSwgZGVmYXVsdCB0byB0cnVlXHJcblxyXG4gICAgICAgIC8vIGFkZCBzb21lIGRlZmF1bHQgc3ltYm9scyBvciB1c2UgdGhlIG9wdGlvbnMgdmFsdWVzLlxyXG4gICAgICAgIHRoaXMuZmxhcmVTeW1ib2wgPSBvcHRpb25zLmZsYXJlU3ltYm9sIHx8IG5ldyBTaW1wbGVNYXJrZXJTeW1ib2woe1xyXG4gICAgICAgICAgICBzaXplOiAxNCxcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMCwgMCwgMCwgMC41XSksXHJcbiAgICAgICAgICAgIG91dGxpbmU6IG5ldyBTaW1wbGVMaW5lU3ltYm9sKHsgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NSwgMC41XSksIHdpZHRoOiAxIH0pXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMudGV4dFN5bWJvbCA9IG9wdGlvbnMudGV4dFN5bWJvbCB8fCBuZXcgVGV4dFN5bWJvbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTVdKSxcclxuICAgICAgICAgICAgZm9udDoge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogMTAsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtMyAvLyBzZXR0aW5nIHlvZmZzZXQgYXMgdmVydGljYWwgYWxpZ25tZW50IGRvZXNuJ3Qgd29yayBpbiBJRS9FZGdlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuZmxhcmVUZXh0U3ltYm9sID0gb3B0aW9ucy5mbGFyZVRleHRTeW1ib2wgfHwgbmV3IFRleHRTeW1ib2woe1xyXG4gICAgICAgICAgICBjb2xvcjogbmV3IENvbG9yKFsyNTUsIDI1NSwgMjU1XSksXHJcbiAgICAgICAgICAgIGZvbnQ6IHtcclxuICAgICAgICAgICAgICAgIHNpemU6IDYsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtMiAvLyBzZXR0aW5nIHlvZmZzZXQgYXMgdmVydGljYWwgYWxpZ25tZW50IGRvZXNuJ3Qgd29yayBpbiBJRS9FZGdlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIGluaXRpYWwgZGF0YVxyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICB0aGlzLm9uKFwibGF5ZXJ2aWV3LWNyZWF0ZVwiLCAoZXZ0KSA9PiB0aGlzLl9sYXllclZpZXdDcmVhdGVkKGV2dCkpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fZGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXdDcmVhdGVkKGV2dCkge1xyXG5cclxuICAgICAgICBpZiAoZXZ0LmxheWVyVmlldy52aWV3LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXcyZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXczZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBhZGQgYSBzdGF0aW9uYXJ5IHdhdGNoIG9uIHRoZSB2aWV3IHRvIHJlZnJlc2ggaWYgc3BlY2lmaWVkIGluIG9wdGlvbnMuXHJcbiAgICAgICAgaWYgKHRoaXMucmVmcmVzaE9uU3RhdGlvbmFyeSkge1xyXG4gICAgICAgICAgICB3YXRjaFV0aWxzLnBhdXNhYmxlKGV2dC5sYXllclZpZXcudmlldywgXCJzdGF0aW9uYXJ5XCIsIChpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpID0+IHRoaXMuX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX3ZpZXdMb2FkQ291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy5fYWN0aXZlVmlldyA9IGV2dC5sYXllclZpZXcudmlldztcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX3JlYWR5VG9EcmF3ID0gdHJ1ZTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3KSB7XHJcbiAgICAgICAgICAgICAgICAvLyB3ZSd2ZSBiZWVuIHdhaXRpbmcgZm9yIHRoaXMgdG8gaGFwcGVuIHRvIGRyYXdcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkSW5pdGlhbERyYXcgPSBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl92aWV3TG9hZENvdW50Kys7XHJcblxyXG5cclxuICAgICAgICBpZiAoZXZ0LmxheWVyVmlldy52aWV3LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICAvLyBmb3IgbWFwIHZpZXdzLCB3YWl0IGZvciB0aGUgbGF5ZXJ2aWV3IG90IGJlIGF0dGFjaGVkLCBiZWZvcmUgYWRkaW5nIGV2ZW50c1xyXG4gICAgICAgICAgICB3YXRjaFV0aWxzLndoZW5UcnVlT25jZShldnQubGF5ZXJWaWV3LCBcImF0dGFjaGVkXCIsICgpID0+IHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy8gZm9yIHNjZW5lIHZpZXdzIGp1c3QgYWRkIHRoZSBldmVudHMgc3RyYWlnaHQgYXdheVxyXG4gICAgICAgICAgICB0aGlzLl9hZGRWaWV3RXZlbnRzKGV2dC5sYXllclZpZXcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfYWRkVmlld0V2ZW50cyhsYXllclZpZXc6IGFueSkge1xyXG4gICAgICAgIGxldCB2OiBBY3RpdmVWaWV3ID0gbGF5ZXJWaWV3LnZpZXc7XHJcbiAgICAgICAgaWYgKCF2LmZjbFBvaW50ZXJNb3ZlKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29udGFpbmVyOiBIVE1MRWxlbWVudCA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYgKHYudHlwZSA9PT0gXCIyZFwiKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBmb3IgYSBtYXAgdmlldyBnZXQgdGhlIGNvbnRhaW5lciBlbGVtZW50IG9mIHRoZSBsYXllciB2aWV3IHRvIGFkZCBtb3VzZW1vdmUgZXZlbnQgdG8uXHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIgPSBsYXllclZpZXcuY29udGFpbmVyLmVsZW1lbnQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBmb3Igc2NlbmUgdmlldyBnZXQgdGhlIGNhbnZhcyBlbGVtZW50IHVuZGVyIHRoZSB2aWV3IGNvbnRhaW5lciB0byBhZGQgbW91c2Vtb3ZlIHRvLlxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gPEhUTUxFbGVtZW50PnF1ZXJ5KFwiY2FudmFzXCIsIHYuY29udGFpbmVyKVswXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQWRkIHBvaW50ZXIgbW92ZSBhbmQgcG9pbnRlciBkb3duLiBQb2ludGVyIGRvd24gdG8gaGFuZGxlIHRvdWNoIGRldmljZXMuXHJcbiAgICAgICAgICAgIHYuZmNsUG9pbnRlck1vdmUgPSB2Lm9uKFwicG9pbnRlci1tb3ZlXCIsIChldnQpID0+IHRoaXMuX3ZpZXdQb2ludGVyTW92ZShldnQpKTtcclxuICAgICAgICAgICAgdi5mY2xQb2ludGVyRG93biA9IHYub24oXCJwb2ludGVyLWRvd25cIiwgKGV2dCkgPT4gdGhpcy5fdmlld1BvaW50ZXJNb3ZlKGV2dCkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSB7XHJcblxyXG4gICAgICAgIGlmIChpc1N0YXRpb25hcnkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIWlzU3RhdGlvbmFyeSAmJiB0aGlzLl9hY3RpdmVDbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIC8vIGlmIG1vdmluZyBkZWFjdGl2YXRlIGNsdXN0ZXI7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBjbGVhcigpIHtcclxuICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzID0ge307XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHNldERhdGEoZGF0YTogYW55W10sIGRyYXdEYXRhOiBib29sZWFuID0gdHJ1ZSkge1xyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xyXG4gICAgICAgIGlmIChkcmF3RGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZHJhdyhhY3RpdmVWaWV3PzogYW55KSB7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVWaWV3KSB7XHJcbiAgICAgICAgICAgIC8vIGlmIHdlJ3JlIHN3YXBwaW5nIHZpZXdzIGZyb20gdGhlIGN1cnJlbnRseSBhY3RpdmUgb25lLCBjbGVhciB0aGUgc3VyZmFjZSBvYmplY3Qgc28gaXQgZ2V0J3MgcmVjcmVhdGVkIGZyZXNoIGFmdGVyIHRoZSBmaXJzdCBkcmF3XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9hY3RpdmVWaWV3ICYmIGFjdGl2ZVZpZXcgIT09IHRoaXMuX2FjdGl2ZVZpZXcpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZSA9IG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5fYWN0aXZlVmlldyA9IGFjdGl2ZVZpZXc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBOb3QgcmVhZHkgdG8gZHJhdyB5ZXQgc28gcXVldWUgb25lIHVwXHJcbiAgICAgICAgaWYgKCF0aGlzLl9yZWFkeVRvRHJhdykge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBjdXJyZW50RXh0ZW50ID0gdGhpcy5fZXh0ZW50KCk7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVWaWV3IHx8ICF0aGlzLl9kYXRhIHx8ICFjdXJyZW50RXh0ZW50KSByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMuX2lzMmQgPSB0aGlzLl9hY3RpdmVWaWV3LnR5cGUgPT09IFwiMmRcIjtcclxuXHJcbiAgICAgICAgLy8gY2hlY2sgZm9yIHJlcXVpcmVkIHJlbmRlcmVyXHJcbiAgICAgICAgaWYgKCF0aGlzLmNsdXN0ZXJSZW5kZXJlcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRmxhcmVDbHVzdGVyTGF5ZXI6IGNsdXN0ZXJSZW5kZXJlciBtdXN0IGJlIHNldC5cIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBjaGVjayB0byBtYWtlIHN1cmUgd2UgaGF2ZSBhbiBhcmVhIHJlbmRlcmVyIHNldCBpZiBvbmUgbmVlZHMgdG8gYmVcclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgJiYgIXRoaXMuYXJlYVJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGbGFyZUNsdXN0ZXJMYXllcjogYXJlYVJlbmRlcmVyIG11c3QgYmUgc2V0IGlmIGNsdXN0ZXJBcmVhRGlzcGxheSBpcyBzZXQuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgY29uc29sZS50aW1lKFwiZHJhdy1kYXRhLVwiICsgdGhpcy5fYWN0aXZlVmlldy50eXBlKTtcclxuXHJcbiAgICAgICAgdGhpcy5faXNDbHVzdGVyZWQgPSB0aGlzLmNsdXN0ZXJUb1NjYWxlIDwgdGhpcy5fc2NhbGUoKTtcclxuXHJcbiAgICAgICAgbGV0IGdyYXBoaWNzOiBHcmFwaGljW10gPSBbXTtcclxuXHJcbiAgICAgICAgLy8gR2V0IGFuIGV4dGVudCB0aGF0IGlzIGluIHdlYiBtZXJjYXRvciB0byBtYWtlIHN1cmUgaXQncyBmbGF0IGZvciBleHRlbnQgY2hlY2tpbmdcclxuICAgICAgICAvLyBUaGUgd2ViZXh0ZW50IHdpbGwgbmVlZCB0byBiZSBub3JtYWxpemVkIHNpbmNlIHBhbm5pbmcgb3ZlciB0aGUgaW50ZXJuYXRpb25hbCBkYXRlbGluZSB3aWxsIGNhdXNlXHJcbiAgICAgICAgLy8gY2F1c2UgdGhlIGV4dGVudCB0byBzaGlmdCBvdXRzaWRlIHRoZSAtMTgwIHRvIDE4MCBkZWdyZWUgd2luZG93LiAgSWYgd2UgZG9uJ3Qgbm9ybWFsaXplIHRoZW4gdGhlXHJcbiAgICAgICAgLy8gY2x1c3RlcnMgd2lsbCBub3QgYmUgZHJhd24gaWYgdGhlIG1hcCBwYW5zIG92ZXIgdGhlIGludGVybmF0aW9uYWwgZGF0ZWxpbmUuXHJcbiAgICAgICAgbGV0IHdlYkV4dGVudDogYW55ID0gIWN1cnJlbnRFeHRlbnQuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yID8gPEV4dGVudD53ZWJNZXJjYXRvclV0aWxzLnByb2plY3QoY3VycmVudEV4dGVudCwgbmV3IFNwYXRpYWxSZWZlcmVuY2UoeyBcIndraWRcIjogMTAyMTAwIH0pKSA6IGN1cnJlbnRFeHRlbnQ7XHJcbiAgICAgICAgbGV0IGV4dGVudElzVW5pb25lZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBsZXQgbm9ybWFsaXplZFdlYkV4dGVudCA9IHdlYkV4dGVudC5ub3JtYWxpemUoKTtcclxuICAgICAgICB3ZWJFeHRlbnQgPSBub3JtYWxpemVkV2ViRXh0ZW50WzBdO1xyXG4gICAgICAgIGlmIChub3JtYWxpemVkV2ViRXh0ZW50Lmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgd2ViRXh0ZW50ID0gd2ViRXh0ZW50LnVuaW9uKG5vcm1hbGl6ZWRXZWJFeHRlbnRbMV0pO1xyXG4gICAgICAgICAgICBleHRlbnRJc1VuaW9uZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudCwgZXh0ZW50SXNVbmlvbmVkKTtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBsZXQgd2ViOiBudW1iZXJbXSwgb2JqOiBhbnksIGRhdGFMZW5ndGggPSB0aGlzLl9kYXRhLmxlbmd0aCwgeFZhbDogbnVtYmVyLCB5VmFsOiBudW1iZXI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhTGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgb2JqID0gdGhpcy5fZGF0YVtpXTtcclxuXHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIGZpbHRlcnMgYXJlIHNwZWNpZmllZCBhbmQgY29udGludWUgaWYgdGhpcyBvYmplY3QgZG9lc24ndCBwYXNzXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fcGFzc2VzRmlsdGVyKG9iaikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB4VmFsID0gb2JqW3RoaXMueFByb3BlcnR5TmFtZV07XHJcbiAgICAgICAgICAgIHlWYWwgPSBvYmpbdGhpcy55UHJvcGVydHlOYW1lXTtcclxuXHJcbiAgICAgICAgICAgIC8vIGdldCBhIHdlYiBtZXJjIGxuZy9sYXQgZm9yIGV4dGVudCBjaGVja2luZy4gVXNlIHdlYiBtZXJjIGFzIGl0J3MgZmxhdCB0byBjYXRlciBmb3IgbG9uZ2l0dWRlIHBvbGVcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgICAgICB3ZWIgPSBbeFZhbCwgeVZhbF07XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB3ZWIgPSB3ZWJNZXJjYXRvclV0aWxzLmxuZ0xhdFRvWFkoeFZhbCwgeVZhbCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRoZSBvYmogaXMgdmlzaWJsZSBpbiB0aGUgZXh0ZW50IGJlZm9yZSBwcm9jZWVkaW5nXHJcbiAgICAgICAgICAgIGlmICgod2ViWzBdIDw9IHdlYkV4dGVudC54bWluIHx8IHdlYlswXSA+IHdlYkV4dGVudC54bWF4KSB8fCAod2ViWzFdIDw9IHdlYkV4dGVudC55bWluIHx8IHdlYlsxXSA+IHdlYkV4dGVudC55bWF4KSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGxvb3AgY2x1c3RlciBncmlkIHRvIHNlZSBpZiBpdCBzaG91bGQgYmUgYWRkZWQgdG8gb25lXHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgakxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGogPCBqTGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2wgPSB0aGlzLl9ncmlkQ2x1c3RlcnNbal07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh3ZWJbMF0gPD0gY2wuZXh0ZW50LnhtaW4gfHwgd2ViWzBdID4gY2wuZXh0ZW50LnhtYXggfHwgd2ViWzFdIDw9IGNsLmV4dGVudC55bWluIHx8IHdlYlsxXSA+IGNsLmV4dGVudC55bWF4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvL25vdCBoZXJlIHNvIGNhcnJ5IG9uXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyByZWNhbGMgdGhlIHggYW5kIHkgb2YgdGhlIGNsdXN0ZXIgYnkgYXZlcmFnaW5nIHRoZSBwb2ludHMgYWdhaW5cclxuICAgICAgICAgICAgICAgICAgICBjbC54ID0gY2wuY2x1c3RlckNvdW50ID4gMCA/ICh4VmFsICsgKGNsLnggKiBjbC5jbHVzdGVyQ291bnQpKSAvIChjbC5jbHVzdGVyQ291bnQgKyAxKSA6IHhWYWw7XHJcbiAgICAgICAgICAgICAgICAgICAgY2wueSA9IGNsLmNsdXN0ZXJDb3VudCA+IDAgPyAoeVZhbCArIChjbC55ICogY2wuY2x1c3RlckNvdW50KSkgLyAoY2wuY2x1c3RlckNvdW50ICsgMSkgOiB5VmFsO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBwdXNoIGV2ZXJ5IHBvaW50IGludG8gdGhlIGNsdXN0ZXIgc28gd2UgaGF2ZSBpdCBmb3IgYXJlYSBkaXNwbGF5IGlmIHJlcXVpcmVkLiBUaGlzIGNvdWxkIGJlIG9taXR0ZWQgaWYgbmV2ZXIgY2hlY2tpbmcgYXJlYXMsIG9yIG9uIGRlbWFuZCBhdCBsZWFzdFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5wb2ludHMucHVzaChbeFZhbCwgeVZhbF0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY2wuY2x1c3RlckNvdW50Kys7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzdWJUeXBlRXhpc3RzID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcyA9IDAsIHNMZW4gPSBjbC5zdWJUeXBlQ291bnRzLmxlbmd0aDsgcyA8IHNMZW47IHMrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2wuc3ViVHlwZUNvdW50c1tzXS5uYW1lID09PSBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsLnN1YlR5cGVDb3VudHNbc10uY291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YlR5cGVFeGlzdHMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghc3ViVHlwZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzLnB1c2goeyBuYW1lOiBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0sIGNvdW50OiAxIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBzaW5nbGUgZml4IHJlY29yZCBpZiBzdGlsbCB1bmRlciB0aGUgbWF4U2luZ2xlRmxhcmVDb3VudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbC5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnNpbmdsZXMucHVzaChvYmopO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc2luZ2xlcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBub3QgY2x1c3RlcmVkIHNvIGp1c3QgYWRkIGV2ZXJ5IG9ialxyXG4gICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlU2luZ2xlKG9iaik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLmNsdXN0ZXJDb3VudCA8IHRoaXMuY2x1c3Rlck1pbkNvdW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDAsIGpsZW4gPSB0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uc2luZ2xlcy5sZW5ndGg7IGogPCBqbGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlU2luZ2xlKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5zaW5nbGVzW2pdKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uY2x1c3RlckNvdW50ID4gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNsdXN0ZXIodGhpcy5fZ3JpZENsdXN0ZXJzW2ldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZW1pdCBhbiBldmVudCB0byBzaWduYWwgZHJhd2luZyBpcyBjb21wbGV0ZS4gZW1pdCBpcyBub3QgaW4gdHlwaW5ncyBmb3IgZ3JhcGhpY3MgbGF5ZXJzLCBzbyB1c2UgW10ncyB0byBhY2Nlc3MuXHJcbiAgICAgICAgdGhpcy5lbWl0KFwiZHJhdy1jb21wbGV0ZVwiLCB7fSk7XHJcbiAgICAgICAgY29uc29sZS50aW1lRW5kKGBkcmF3LWRhdGEtJHt0aGlzLl9hY3RpdmVWaWV3LnR5cGV9YCk7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlKSB7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlU3VyZmFjZSgpO1xyXG4gICAgICAgICAgICB9LCAxMCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Bhc3Nlc0ZpbHRlcihvYmo6IGFueSk6IGJvb2xlYW4ge1xyXG4gICAgICAgIGlmICghdGhpcy5maWx0ZXJzIHx8IHRoaXMuZmlsdGVycy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgICAgIGxldCBwYXNzZXMgPSB0cnVlO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmZpbHRlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRoaXMuZmlsdGVyc1tpXTtcclxuICAgICAgICAgICAgaWYgKG9ialtmaWx0ZXIucHJvcGVydHlOYW1lXSA9PSBudWxsKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGxldCB2YWxFeGlzdHMgPSBmaWx0ZXIucHJvcGVydHlWYWx1ZXMuaW5kZXhPZihvYmpbZmlsdGVyLnByb3BlcnR5TmFtZV0pICE9PSAtMTtcclxuICAgICAgICAgICAgaWYgKHZhbEV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcGFzc2VzID0gZmlsdGVyLmtlZXBPbmx5SWZWYWx1ZUV4aXN0czsgLy8gdGhlIHZhbHVlIGV4aXN0cyBzbyByZXR1cm4gd2hldGhlciB3ZSBzaG91bGQgYmUga2VlcGluZyBpdCBvciBub3QuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoIXZhbEV4aXN0cyAmJiBmaWx0ZXIua2VlcE9ubHlJZlZhbHVlRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBwYXNzZXMgPSBmYWxzZTsgLy8gcmV0dXJuIGZhbHNlIGFzIHRoZSB2YWx1ZSBkb2Vzbid0IGV4aXN0LCBhbmQgd2Ugc2hvdWxkIG9ubHkgYmUga2VlcGluZyBwb2ludCBvYmplY3RzIHdoZXJlIGl0IGRvZXMgZXhpc3QuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghcGFzc2VzKSByZXR1cm4gZmFsc2U7IC8vIGlmIGl0IGhhc24ndCBwYXNzZWQgYW55IG9mIHRoZSBmaWx0ZXJzIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBwYXNzZXM7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlU2luZ2xlKG9iaikge1xyXG4gICAgICAgIGxldCBwb2ludCA9IG5ldyBQb2ludCh7XHJcbiAgICAgICAgICAgIHg6IG9ialt0aGlzLnhQcm9wZXJ0eU5hbWVdLCB5OiBvYmpbdGhpcy55UHJvcGVydHlOYW1lXSwgejogb2JqW3RoaXMuelByb3BlcnR5TmFtZV1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKCFwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHBvaW50LFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBvYmpcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgZ3JhcGhpYy5wb3B1cFRlbXBsYXRlID0gdGhpcy5zaW5nbGVQb3B1cFRlbXBsYXRlO1xyXG4gICAgICAgIGlmICh0aGlzLnNpbmdsZVJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIGxldCBzeW1ib2wgPSB0aGlzLnNpbmdsZVJlbmRlcmVyLmdldFN5bWJvbChncmFwaGljLCB0aGlzLl9hY3RpdmVWaWV3KTtcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSBzeW1ib2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHRoaXMuc2luZ2xlU3ltYm9sKSB7XHJcbiAgICAgICAgICAgIGdyYXBoaWMuc3ltYm9sID0gdGhpcy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBubyBzeW1ib2xvZ3kgZm9yIHNpbmdsZXMgZGVmaW5lZCwgdXNlIHRoZSBkZWZhdWx0IHN5bWJvbCBmcm9tIHRoZSBjbHVzdGVyIHJlbmRlcmVyXHJcbiAgICAgICAgICAgIGdyYXBoaWMuc3ltYm9sID0gdGhpcy5jbHVzdGVyUmVuZGVyZXIuZGVmYXVsdFN5bWJvbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuYWRkKGdyYXBoaWMpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDbHVzdGVyKGdyaWRDbHVzdGVyOiBHcmlkQ2x1c3Rlcikge1xyXG5cclxuICAgICAgICBsZXQgY2x1c3RlciA9IG5ldyBDbHVzdGVyKCk7XHJcbiAgICAgICAgY2x1c3Rlci5ncmlkQ2x1c3RlciA9IGdyaWRDbHVzdGVyO1xyXG5cclxuICAgICAgICAvLyBtYWtlIHN1cmUgYWxsIGdlb21ldHJpZXMgYWRkZWQgdG8gR3JhcGhpYyBvYmplY3RzIGFyZSBpbiB3ZWIgbWVyY2F0b3Igb3RoZXJ3aXNlIHdyYXAgYXJvdW5kIGRvZXNuJ3Qgd29yay5cclxuICAgICAgICBsZXQgcG9pbnQgPSBuZXcgUG9pbnQoeyB4OiBncmlkQ2x1c3Rlci54LCB5OiBncmlkQ2x1c3Rlci55IH0pO1xyXG4gICAgICAgIGlmICghcG9pbnQuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgIHBvaW50ID0gPFBvaW50PndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IocG9pbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGF0dHJpYnV0ZXM6IGFueSA9IHtcclxuICAgICAgICAgICAgeDogZ3JpZENsdXN0ZXIueCxcclxuICAgICAgICAgICAgeTogZ3JpZENsdXN0ZXIueSxcclxuICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQsXHJcbiAgICAgICAgICAgIGlzQ2x1c3RlcjogdHJ1ZSxcclxuICAgICAgICAgICAgY2x1c3Rlck9iamVjdDogZ3JpZENsdXN0ZXJcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGF0dHJpYnV0ZXMsXHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sID0gdGhpcy5jbHVzdGVyUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oY2x1c3Rlci5jbHVzdGVyR3JhcGhpYykuc3ltYm9sO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJJZCA9IGNsdXN0ZXIuY2x1c3RlckdyYXBoaWNbXCJ1aWRcIl07XHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZCA9IGNsdXN0ZXIuY2x1c3RlcklkO1xyXG5cclxuICAgICAgICAvLyBhbHNvIGNyZWF0ZSBhIHRleHQgc3ltYm9sIHRvIGRpc3BsYXkgdGhlIGNsdXN0ZXIgY291bnRcclxuICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMudGV4dFN5bWJvbC5jbG9uZSgpO1xyXG4gICAgICAgIHRleHRTeW1ib2wudGV4dCA9IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudC50b1N0cmluZygpO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgdGV4dFN5bWJvbC5hbmdsZSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnQsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgIGlzQ2x1c3RlclRleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBpc1RleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVySWQ6IGNsdXN0ZXIuY2x1c3RlcklkXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN5bWJvbDogdGV4dFN5bWJvbFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBhZGQgYW4gYXJlYSBncmFwaGljIHRvIGRpc3BsYXkgdGhlIGJvdW5kcyBvZiB0aGUgY2x1c3RlciBpZiBjb25maWd1cmVkIHRvXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ICYmIGdyaWRDbHVzdGVyLnBvaW50cyAmJiBncmlkQ2x1c3Rlci5wb2ludHMubGVuZ3RoID4gMCkge1xyXG5cclxuICAgICAgICAgICAgbGV0IG1wID0gbmV3IE11bHRpcG9pbnQoKTtcclxuICAgICAgICAgICAgbXAucG9pbnRzID0gZ3JpZENsdXN0ZXIucG9pbnRzO1xyXG4gICAgICAgICAgICBsZXQgYXJlYTogYW55ID0gZ2VvbWV0cnlFbmdpbmUuY29udmV4SHVsbChtcCwgdHJ1ZSk7IC8vIHVzZSBjb252ZXggaHVsbCBvbiB0aGUgcG9pbnRzIHRvIGdldCB0aGUgYm91bmRhcnlcclxuXHJcbiAgICAgICAgICAgIGxldCBhcmVhQXR0cjogYW55ID0ge1xyXG4gICAgICAgICAgICAgICAgeDogZ3JpZENsdXN0ZXIueCxcclxuICAgICAgICAgICAgICAgIHk6IGdyaWRDbHVzdGVyLnksXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJJZDogY2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBpc0NsdXN0ZXJBcmVhOiB0cnVlXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChhcmVhLnJpbmdzICYmIGFyZWEucmluZ3MubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGFyZWFQb2x5ID0gbmV3IFBvbHlnb24oKTsgLy8gaGFkIHRvIGNyZWF0ZSBhIG5ldyBwb2x5Z29uIGFuZCBmaWxsIGl0IHdpdGggdGhlIHJpbmcgb2YgdGhlIGNhbGN1bGF0ZWQgYXJlYSBmb3IgU2NlbmVWaWV3IHRvIHdvcmsuXHJcbiAgICAgICAgICAgICAgICBhcmVhUG9seSA9IGFyZWFQb2x5LmFkZFJpbmcoYXJlYS5yaW5nc1swXSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFhcmVhUG9seS5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcmVhUG9seSA9IDxQb2x5Z29uPndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IoYXJlYVBvbHkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNsdXN0ZXIuYXJlYUdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7IGdlb21ldHJ5OiBhcmVhUG9seSwgYXR0cmlidXRlczogYXJlYUF0dHIgfSk7XHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyLmFyZWFHcmFwaGljLnN5bWJvbCA9IHRoaXMuYXJlYVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGNsdXN0ZXIuYXJlYUdyYXBoaWMpLnN5bWJvbDtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGFkZCB0aGUgZ3JhcGhpY3MgaW4gb3JkZXIgICAgICAgIFxyXG4gICAgICAgIGlmIChjbHVzdGVyLmFyZWFHcmFwaGljICYmIHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFsd2F5c1wiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmFkZChjbHVzdGVyLmNsdXN0ZXJHcmFwaGljKTtcclxuICAgICAgICB0aGlzLmFkZChjbHVzdGVyLnRleHRHcmFwaGljKTtcclxuXHJcbiAgICAgICAgdGhpcy5fY2x1c3RlcnNbY2x1c3Rlci5jbHVzdGVySWRdID0gY2x1c3RlcjtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2x1c3RlckdyaWQod2ViRXh0ZW50OiBFeHRlbnQsIGV4dGVudElzVW5pb25lZDogYm9vbGVhbikge1xyXG5cclxuICAgICAgICAvLyBnZXQgdGhlIHRvdGFsIGFtb3VudCBvZiBncmlkIHNwYWNlcyBiYXNlZCBvbiB0aGUgaGVpZ2h0IGFuZCB3aWR0aCBvZiB0aGUgbWFwIChkaXZpZGUgaXQgYnkgY2x1c3RlclJhdGlvKSAtIHRoZW4gZ2V0IHRoZSBkZWdyZWVzIGZvciB4IGFuZCB5IFxyXG4gICAgICAgIGxldCB4Q291bnQgPSBNYXRoLnJvdW5kKHRoaXMuX2FjdGl2ZVZpZXcud2lkdGggLyB0aGlzLmNsdXN0ZXJSYXRpbyk7XHJcbiAgICAgICAgbGV0IHlDb3VudCA9IE1hdGgucm91bmQodGhpcy5fYWN0aXZlVmlldy5oZWlnaHQgLyB0aGlzLmNsdXN0ZXJSYXRpbyk7XHJcblxyXG4gICAgICAgIC8vIGlmIHRoZSBleHRlbnQgaGFzIGJlZW4gdW5pb25lZCBkdWUgdG8gbm9ybWFsaXphdGlvbiwgZG91YmxlIHRoZSBjb3VudCBvZiB4IGluIHRoZSBjbHVzdGVyIGdyaWQgYXMgdGhlIHVuaW9uaW5nIHdpbGwgaGFsdmUgaXQuXHJcbiAgICAgICAgaWYgKGV4dGVudElzVW5pb25lZCkge1xyXG4gICAgICAgICAgICB4Q291bnQgKj0gMjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB4dyA9ICh3ZWJFeHRlbnQueG1heCAtIHdlYkV4dGVudC54bWluKSAvIHhDb3VudDtcclxuICAgICAgICBsZXQgeWggPSAod2ViRXh0ZW50LnltYXggLSB3ZWJFeHRlbnQueW1pbikgLyB5Q291bnQ7XHJcblxyXG4gICAgICAgIGxldCBnc3htaW4sIGdzeG1heCwgZ3N5bWluLCBnc3ltYXg7XHJcblxyXG4gICAgICAgIC8vIGNyZWF0ZSBhbiBhcnJheSBvZiBjbHVzdGVycyB0aGF0IGlzIGEgZ3JpZCBvdmVyIHRoZSB2aXNpYmxlIGV4dGVudC4gRWFjaCBjbHVzdGVyIGNvbnRhaW5zIHRoZSBleHRlbnQgKGluIHdlYiBtZXJjKSB0aGF0IGJvdW5kcyB0aGUgZ3JpZCBzcGFjZSBmb3IgaXQuXHJcbiAgICAgICAgdGhpcy5fZ3JpZENsdXN0ZXJzID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB4Q291bnQ7IGkrKykge1xyXG4gICAgICAgICAgICBnc3htaW4gPSB3ZWJFeHRlbnQueG1pbiArICh4dyAqIGkpO1xyXG4gICAgICAgICAgICBnc3htYXggPSBnc3htaW4gKyB4dztcclxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB5Q291bnQ7IGorKykge1xyXG4gICAgICAgICAgICAgICAgZ3N5bWluID0gd2ViRXh0ZW50LnltaW4gKyAoeWggKiBqKTtcclxuICAgICAgICAgICAgICAgIGdzeW1heCA9IGdzeW1pbiArIHloO1xyXG4gICAgICAgICAgICAgICAgbGV0IGV4dCA9IHsgeG1pbjogZ3N4bWluLCB4bWF4OiBnc3htYXgsIHltaW46IGdzeW1pbiwgeW1heDogZ3N5bWF4IH07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9ncmlkQ2x1c3RlcnMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgZXh0ZW50OiBleHQsXHJcbiAgICAgICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIHN1YlR5cGVDb3VudHM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHNpbmdsZXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHBvaW50czogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgeDogMCxcclxuICAgICAgICAgICAgICAgICAgICB5OiAwXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhbiBzdmcgc3VyZmFjZSBvbiB0aGUgdmlldyBpZiBpdCBkb2Vzbid0IGFscmVhZHkgZXhpc3RcclxuICAgICAqIEBwYXJhbSB2aWV3XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2NyZWF0ZVN1cmZhY2UoKSB7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UgfHwgKHRoaXMuX2FjdGl2ZVZpZXcudHlwZSA9PT0gXCIyZFwiICYmICF0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudCkpIHJldHVybjtcclxuICAgICAgICBsZXQgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2xheWVyVmlldzJkLmNvbnRhaW5lci5lbGVtZW50LnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBzdXJmYWNlUGFyZW50RWxlbWVudCA9IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudEVsZW1lbnQgfHwgdGhpcy5fYWN0aXZlVmlldy5jYW52YXMucGFyZW50Tm9kZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlOiBhbnkgPSBnZnguY3JlYXRlU3VyZmFjZShzdXJmYWNlUGFyZW50RWxlbWVudCwgXCIwXCIsIFwiMFwiKTtcclxuICAgICAgICBzdXJmYWNlLmNvbnRhaW5lckdyb3VwID0gc3VyZmFjZS5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHBvc2l0aW9uOiBcImFic29sdXRlXCIsIHRvcDogXCIwXCIsIHpJbmRleDogLTEgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwidmlzaWJsZVwiKTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwiY2xhc3NcIiwgXCJmY2wtc3VyZmFjZVwiKTtcclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UgPSBzdXJmYWNlO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF92aWV3UG9pbnRlck1vdmUoZXZ0KSB7XHJcblxyXG4gICAgICAgIGxldCBtb3VzZVBvcyA9IHRoaXMuX2dldE1vdXNlUG9zKGV2dCk7XHJcblxyXG4gICAgICAgIC8vIGlmIHRoZXJlJ3MgYW4gYWN0aXZlIGNsdXN0ZXIgYW5kIHRoZSBjdXJyZW50IHNjcmVlbiBwb3MgaXMgd2l0aGluIHRoZSBib3VuZHMgb2YgdGhhdCBjbHVzdGVyJ3MgZ3JvdXAgY29udGFpbmVyLCBkb24ndCBkbyBhbnl0aGluZyBtb3JlLiBcclxuICAgICAgICAvLyBUT0RPOiB3b3VsZCBwcm9iYWJseSBiZSBiZXR0ZXIgdG8gY2hlY2sgaWYgdGhlIHBvaW50IGlzIGluIHRoZSBhY3R1YWwgY2lyY2xlIG9mIHRoZSBjbHVzdGVyIGdyb3VwIGFuZCBpdCdzIGZsYXJlcyBpbnN0ZWFkIG9mIHVzaW5nIHRoZSByZWN0YW5nbGFyIGJvdW5kaW5nIGJveC5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ2x1c3RlciAmJiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCkge1xyXG4gICAgICAgICAgICBsZXQgYmJveCA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgICAgIGlmIChiYm94KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobW91c2VQb3MueCA+PSBiYm94LmxlZnQgJiYgbW91c2VQb3MueCA8PSBiYm94LnJpZ2h0ICYmIG1vdXNlUG9zLnkgPj0gYmJveC50b3AgJiYgbW91c2VQb3MueSA8PSBiYm94LmJvdHRvbSkgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZVZpZXcucmVhZHkpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IGhpdFRlc3QgPSB0aGlzLl9hY3RpdmVWaWV3LmhpdFRlc3QobW91c2VQb3MpO1xyXG4gICAgICAgIGlmICghaGl0VGVzdCkgcmV0dXJuO1xyXG4gICAgICAgIGhpdFRlc3QudGhlbigocmVzcG9uc2UpID0+IHtcclxuXHJcbiAgICAgICAgICAgIGxldCBncmFwaGljcyA9IHJlc3BvbnNlLnJlc3VsdHM7XHJcbiAgICAgICAgICAgIGlmIChncmFwaGljcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBncmFwaGljcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGcgPSBncmFwaGljc1tpXS5ncmFwaGljO1xyXG4gICAgICAgICAgICAgICAgaWYgKGcgJiYgKGcuYXR0cmlidXRlcy5jbHVzdGVySWQgIT0gbnVsbCAmJiAhZy5hdHRyaWJ1dGVzLmlzQ2x1c3RlckFyZWEpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsdXN0ZXIgPSB0aGlzLl9jbHVzdGVyc1tnLmF0dHJpYnV0ZXMuY2x1c3RlcklkXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hY3RpdmF0ZUNsdXN0ZXIoY2x1c3Rlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2FjdGl2YXRlQ2x1c3RlcihjbHVzdGVyOiBDbHVzdGVyKSB7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVDbHVzdGVyID09PSBjbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybjsgLy8gYWxyZWFkeSBhY3RpdmVcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVN1cmZhY2UoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPSBjbHVzdGVyO1xyXG4gICAgICAgIHRoaXMuX2luaXRTdXJmYWNlKCk7XHJcbiAgICAgICAgdGhpcy5faW5pdENsdXN0ZXIoKTtcclxuICAgICAgICB0aGlzLl9pbml0RmxhcmVzKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2hpZGVHcmFwaGljKFt0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljXSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhY3RpdmF0ZWRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9zaG93R3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJhY3RpdmF0ZSBjbHVzdGVyXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2RlYWN0aXZhdGVDbHVzdGVyKCkge1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIgfHwgIXRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwKSByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKFt0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljXSk7XHJcbiAgICAgICAgdGhpcy5fcmVtb3ZlQ2xhc3NGcm9tRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hpZGVHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fY2xlYXJTdXJmYWNlKCk7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIkRFLWFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0U3VyZmFjZSgpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgaWYgKCFzdXJmYWNlKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBzcDogU2NyZWVuUG9pbnQgPSB0aGlzLl9hY3RpdmVWaWV3LnRvU2NyZWVuKDxQb2ludD50aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5KTtcclxuXHJcbiAgICAgICAgLy8gdG9TY3JlZW4oKSByZXR1cm5zIHRoZSB3cm9uZyB2YWx1ZSBmb3IgeCBpZiBhIDJkIG1hcCBoYXMgYmVlbiB3cmFwcGVkIGFyb3VuZCB0aGUgZ2xvYmUuIE5lZWQgdG8gY2hlY2sgYW5kIGNhdGVyIGZvciB0aGlzLiBJIHRoaW5rIHRoaXMgYSBidWcgaW4gdGhlIGFwaS5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICB2YXIgd3N3ID0gdGhpcy5fYWN0aXZlVmlldy5zdGF0ZS53b3JsZFNjcmVlbldpZHRoO1xyXG4gICAgICAgICAgICBsZXQgcmF0aW8gPSBwYXJzZUludCgoc3AueCAvIHdzdykudG9GaXhlZCgwKSk7IC8vIGdldCBhIHJhdGlvIHRvIGRldGVybWluZSBob3cgbWFueSB0aW1lcyB0aGUgbWFwIGhhcyBiZWVuIHdyYXBwZWQgYXJvdW5kLlxyXG4gICAgICAgICAgICBpZiAoc3AueCA8IDApIHtcclxuICAgICAgICAgICAgICAgIC8vIHggaXMgbGVzcyB0aGFuIDAsIFdURi4gTmVlZCB0byBhZGp1c3QgYnkgdGhlIHdvcmxkIHNjcmVlbiB3aWR0aC5cclxuICAgICAgICAgICAgICAgIHNwLnggKz0gd3N3ICogKHJhdGlvICogLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHNwLnggPiB3c3cpIHtcclxuICAgICAgICAgICAgICAgIC8vIHggaXMgdG9vIGJpZywgV1RGIGFzIHdlbGwsIGNhdGVyIGZvciBpdC5cclxuICAgICAgICAgICAgICAgIHNwLnggLT0gd3N3ICogcmF0aW87XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAxMSwgb3ZlcmZsb3c6IFwidmlzaWJsZVwiLCB3aWR0aDogXCIxcHhcIiwgaGVpZ2h0OiBcIjFweFwiLCBsZWZ0OiBzcC54ICsgXCJweFwiLCB0b3A6IHNwLnkgKyBcInB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwidmlzaWJsZVwiKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY2xlYXJTdXJmYWNlKCkge1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIHF1ZXJ5KFwiLmNsdXN0ZXItZ3JvdXBcIiwgc3VyZmFjZS5jb250YWluZXJHcm91cC5yYXdOb2RlKS5mb3JFYWNoKGRvbUNvbnN0cnVjdC5kZXN0cm95KTtcclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHpJbmRleDogLTEsIG92ZXJmbG93OiBcImhpZGRlblwiLCB0b3A6IFwiMHB4XCIsIGxlZnQ6IFwiMHB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwiaGlkZGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2luaXRDbHVzdGVyKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyB3ZSdyZSBnb2luZyB0byByZXBsaWNhdGUgYSBjbHVzdGVyIGdyYXBoaWMgaW4gdGhlIHN2ZyBlbGVtZW50IHdlIGFkZGVkIHRvIHRoZSBsYXllciB2aWV3LiBKdXN0IHNvIGl0IGNhbiBiZSBzdHlsZWQgZWFzaWx5LiBOYXRpdmUgV2ViR0wgZm9yIFNjZW5lIFZpZXdzIHdvdWxkIHByb2JhYmx5IGJlIGJldHRlciwgYnV0IGF0IGxlYXN0IHRoaXMgd2F5IGNzcyBjYW4gc3RpbGwgYmUgdXNlZCB0byBzdHlsZS9hbmltYXRlIHRoaW5ncy5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCA9IHN1cmZhY2UuY29udGFpbmVyR3JvdXAuY3JlYXRlR3JvdXAoKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImNsdXN0ZXItZ3JvdXBcIik7XHJcblxyXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgY2x1c3RlciBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRDbHVzdGVyRWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkQ2x1c3RlckVsZW1lbnQsIFwiY2x1c3RlclwiKTtcclxuXHJcbiAgICAgICAgLy8gY3JlYXRlIHRoZSBjbHVzdGVyIHRleHQgc2hhcGVcclxuICAgICAgICBsZXQgY2xvbmVkVGV4dEVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXApO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGNsb25lZFRleHRFbGVtZW50LCBcImNsdXN0ZXItdGV4dFwiKTtcclxuICAgICAgICBjbG9uZWRUZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoY2xvbmVkQ2x1c3RlckVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoY2xvbmVkVGV4dEVsZW1lbnQpO1xyXG5cclxuICAgICAgICAvLyBzZXQgdGhlIGdyb3VwIGVsZW1lbnRzIGNsYXNzICAgICBcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0RmxhcmVzKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlciB8fCAhdGhpcy5kaXNwbGF5RmxhcmVzKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBncmlkQ2x1c3RlciA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vIGNoZWNrIGlmIHdlIG5lZWQgdG8gY3JlYXRlIGZsYXJlcyBmb3IgdGhlIGNsdXN0ZXJcclxuICAgICAgICBsZXQgc2luZ2xlRmxhcmVzID0gKGdyaWRDbHVzdGVyLnNpbmdsZXMgJiYgZ3JpZENsdXN0ZXIuc2luZ2xlcy5sZW5ndGggPiAwKSAmJiAoZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50IDw9IHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCk7XHJcbiAgICAgICAgbGV0IHN1YlR5cGVGbGFyZXMgPSAhc2luZ2xlRmxhcmVzICYmIChncmlkQ2x1c3Rlci5zdWJUeXBlQ291bnRzICYmIGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMubGVuZ3RoID4gMCk7XHJcblxyXG4gICAgICAgIGlmICghc2luZ2xlRmxhcmVzICYmICFzdWJUeXBlRmxhcmVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybjsgLy8gbm8gZmxhcmVzIHJlcXVpcmVkXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZmxhcmVzOiBGbGFyZVtdID0gW107XHJcbiAgICAgICAgaWYgKHNpbmdsZUZsYXJlcykge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZ3JpZENsdXN0ZXIuc2luZ2xlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGYgPSBuZXcgRmxhcmUoKTtcclxuICAgICAgICAgICAgICAgIGYudG9vbHRpcFRleHQgPSBncmlkQ2x1c3Rlci5zaW5nbGVzW2ldW3RoaXMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHldO1xyXG4gICAgICAgICAgICAgICAgZi5zaW5nbGVEYXRhID0gZ3JpZENsdXN0ZXIuc2luZ2xlc1tpXTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHN1YlR5cGVGbGFyZXMpIHtcclxuXHJcbiAgICAgICAgICAgIC8vIHNvcnQgc3ViIHR5cGVzIGJ5IGhpZ2hlc3QgY291bnQgZmlyc3RcclxuICAgICAgICAgICAgdmFyIHN1YlR5cGVzID0gZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5jb3VudCAtIGEuY291bnQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN1YlR5cGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZiA9IG5ldyBGbGFyZSgpO1xyXG4gICAgICAgICAgICAgICAgZi50b29sdGlwVGV4dCA9IGAke3N1YlR5cGVzW2ldLm5hbWV9ICgke3N1YlR5cGVzW2ldLmNvdW50fSlgO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZVRleHQgPSBzdWJUeXBlc1tpXS5jb3VudDtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBpZiB0aGVyZSBhcmUgbW9yZSBmbGFyZSBvYmplY3RzIHRvIGNyZWF0ZSB0aGFuIHRoZSBtYXhGbGFyZUNvdW50IGFuZCB0aGlzIGlzIG9uZSBvZiB0aG9zZSAtIGNyZWF0ZSBhIHN1bW1hcnkgZmxhcmUgdGhhdCBjb250YWlucyAnLi4uJyBhcyB0aGUgdGV4dC5cclxuICAgICAgICBsZXQgd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPSBmbGFyZXMubGVuZ3RoID4gdGhpcy5tYXhGbGFyZUNvdW50O1xyXG4gICAgICAgIGxldCBmbGFyZUNvdW50ID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPyB0aGlzLm1heEZsYXJlQ291bnQgOiBmbGFyZXMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvLyBpZiB0aGVyZSdzIGFuIGV2ZW4gYW1vdW50IG9mIGZsYXJlcywgcG9zaXRpb24gdGhlIGZpcnN0IGZsYXJlIHRvIHRoZSBsZWZ0LCBtaW51cyAxODAgZnJvbSBkZWdyZWUgdG8gZG8gdGhpcy5cclxuICAgICAgICAvLyBmb3IgYW4gYWRkIGFtb3VudCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgb24gdG9wLCAtOTAgdG8gZG8gdGhpcy4gTG9va3MgbmljZXIgdGhpcyB3YXkuXHJcbiAgICAgICAgbGV0IGRlZ3JlZVZhcmlhbmNlID0gKGZsYXJlQ291bnQgJSAyID09PSAwKSA/IC0xODAgOiAtOTA7XHJcbiAgICAgICAgbGV0IHZpZXdSb3RhdGlvbiA9IHRoaXMuX2lzMmQgPyB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uIDogMDtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTY3JlZW5Qb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9TY3JlZW4oPFBvaW50PnRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnkpO1xyXG4gICAgICAgIGxldCBjbHVzdGVyU3ltYm9sU2l6ZSA9IDxudW1iZXI+dGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2wuZ2V0KFwic2l6ZVwiKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZsYXJlQ291bnQ7IGkrKykge1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlID0gZmxhcmVzW2ldO1xyXG5cclxuICAgICAgICAgICAgLy8gc2V0IHNvbWUgYXR0cmlidXRlIGRhdGFcclxuICAgICAgICAgICAgbGV0IGZsYXJlQXR0cmlidXRlcyA9IHtcclxuICAgICAgICAgICAgICAgIGlzRmxhcmU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBpc1N1bW1hcnlGbGFyZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICB0b29sdGlwVGV4dDogXCJcIixcclxuICAgICAgICAgICAgICAgIGZsYXJlVGV4dEdyYXBoaWM6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJHcmFwaGljSWQ6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlcklkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnRcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGxldCBmbGFyZVRleHRBdHRyaWJ1dGVzID0ge307XHJcblxyXG4gICAgICAgICAgICAvLyBkbyBhIGNvdXBsZSBvZiB0aGluZ3MgZGlmZmVyZW50bHkgaWYgdGhpcyBpcyBhIHN1bW1hcnkgZmxhcmUgb3Igbm90XHJcbiAgICAgICAgICAgIGxldCBpc1N1bW1hcnlGbGFyZSA9IHdpbGxDb250YWluU3VtbWFyeUZsYXJlICYmIGkgPj0gdGhpcy5tYXhGbGFyZUNvdW50IC0gMTtcclxuICAgICAgICAgICAgaWYgKGlzU3VtbWFyeUZsYXJlKSB7XHJcbiAgICAgICAgICAgICAgICBmbGFyZS5pc1N1bW1hcnkgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgZmxhcmVBdHRyaWJ1dGVzLmlzU3VtbWFyeUZsYXJlID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGxldCB0b29sdGlwVGV4dCA9IFwiXCI7XHJcbiAgICAgICAgICAgICAgICAvLyBtdWx0aWxpbmUgdG9vbHRpcCBmb3Igc3VtbWFyeSBmbGFyZXMsIGllOiBncmVhdGVyIHRoYW4gdGhpcy5tYXhGbGFyZUNvdW50IGZsYXJlcyBwZXIgY2x1c3RlclxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IHRoaXMubWF4RmxhcmVDb3VudCAtIDEsIGpsZW4gPSBmbGFyZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHRpcFRleHQgKz0gaiA+ICh0aGlzLm1heEZsYXJlQ291bnQgLSAxKSA/IFwiXFxuXCIgOiBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGZsYXJlc1tqXS50b29sdGlwVGV4dDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRvb2x0aXBUZXh0ID0gdG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy50b29sdGlwVGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG5cclxuICAgICAgICAgICAgLy8gY3JlYXRlIGEgZ3JhcGhpYyBmb3IgdGhlIGZsYXJlIGFuZCBmb3IgdGhlIGZsYXJlIHRleHRcclxuICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGZsYXJlQXR0cmlidXRlcyxcclxuICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5LFxyXG4gICAgICAgICAgICAgICAgcG9wdXBUZW1wbGF0ZTogbnVsbFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sID0gdGhpcy5fZ2V0RmxhcmVTeW1ib2woZmxhcmUuZ3JhcGhpYyk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgICAgICBpZiAoZmxhcmUuZmxhcmVUZXh0KSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgICAgICAgICB0ZXh0U3ltYm9sLnRleHQgPSAhaXNTdW1tYXJ5RmxhcmUgPyBmbGFyZS5mbGFyZVRleHQudG9TdHJpbmcoKSA6IFwiLi4uXCI7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHRTeW1ib2wuYW5nbGUgPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyR3JhcGhpY0lkOiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJJZFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sLFxyXG4gICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZmxhcmVzIGhhdmUgYmVlbiBjcmVhdGVkIHNvIGFkZCB0aGVtIHRvIHRoZSBkb21cclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZmxhcmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBmID0gZmxhcmVzW2ldO1xyXG4gICAgICAgICAgICBpZiAoIWYuZ3JhcGhpYykgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICAvLyBjcmVhdGUgYSBncm91cCB0byBob2xkIGZsYXJlIG9iamVjdCBhbmQgdGV4dCBpZiBuZWVkZWQuIFxyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICAgICAgbGV0IHBvc2l0aW9uID0gdGhpcy5fc2V0RmxhcmVQb3NpdGlvbihmLmZsYXJlR3JvdXAsIGNsdXN0ZXJTeW1ib2xTaXplLCBmbGFyZUNvdW50LCBpLCBkZWdyZWVWYXJpYW5jZSwgdmlld1JvdGF0aW9uKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImZsYXJlLWdyb3VwXCIpO1xyXG4gICAgICAgICAgICBsZXQgZmxhcmVFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYuZ3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVFbGVtZW50KTtcclxuICAgICAgICAgICAgaWYgKGYudGV4dEdyYXBoaWMpIHtcclxuICAgICAgICAgICAgICAgIGxldCBmbGFyZVRleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYudGV4dEdyYXBoaWMsIGYuZmxhcmVHcm91cCk7XHJcbiAgICAgICAgICAgICAgICBmbGFyZVRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGZsYXJlVGV4dEVsZW1lbnQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIiwgMTApO1xyXG5cclxuICAgICAgICAgICAgLy8gYXNzaWduIHNvbWUgZXZlbnQgaGFuZGxlcnMgZm9yIHRoZSB0b29sdGlwc1xyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAubW91c2VFbnRlciA9IG9uLnBhdXNhYmxlKGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcIm1vdXNlZW50ZXJcIiwgKCkgPT4gdGhpcy5fY3JlYXRlVG9vbHRpcChmKSk7XHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5tb3VzZUxlYXZlID0gb24ucGF1c2FibGUoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwibW91c2VsZWF2ZVwiLCAoKSA9PiB0aGlzLl9kZXN0cm95VG9vbHRpcCgpKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zZXRGbGFyZVBvc2l0aW9uKGZsYXJlR3JvdXA6IGFueSwgY2x1c3RlclN5bWJvbFNpemU6IG51bWJlciwgZmxhcmVDb3VudDogbnVtYmVyLCBmbGFyZUluZGV4OiBudW1iZXIsIGRlZ3JlZVZhcmlhbmNlOiBudW1iZXIsIHZpZXdSb3RhdGlvbjogbnVtYmVyKSB7XHJcblxyXG4gICAgICAgIC8vIGdldCB0aGUgcG9zaXRpb24gb2YgdGhlIGZsYXJlIHRvIGJlIHBsYWNlZCBhcm91bmQgdGhlIGNvbnRhaW5lciBjaXJjbGUuXHJcbiAgICAgICAgbGV0IGRlZ3JlZSA9IHBhcnNlSW50KCgoMzYwIC8gZmxhcmVDb3VudCkgKiBmbGFyZUluZGV4KS50b0ZpeGVkKCkpO1xyXG4gICAgICAgIGRlZ3JlZSA9IGRlZ3JlZSArIGRlZ3JlZVZhcmlhbmNlO1xyXG5cclxuICAgICAgICAvLyB0YWtlIGludG8gYWNjb3VudCBhbnkgcm90YXRpb24gb24gdGhlIHZpZXdcclxuICAgICAgICBpZiAodmlld1JvdGF0aW9uICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGRlZ3JlZSAtPSB2aWV3Um90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmFkaWFuID0gZGVncmVlICogKE1hdGguUEkgLyAxODApO1xyXG4gICAgICAgIGxldCBidWZmZXIgPSB0aGlzLmZsYXJlQnVmZmVyUGl4ZWxzO1xyXG5cclxuICAgICAgICAvLyBwb3NpdGlvbiB0aGUgZmxhcmUgZ3JvdXAgYXJvdW5kIHRoZSBjbHVzdGVyXHJcbiAgICAgICAgbGV0IHBvc2l0aW9uID0ge1xyXG4gICAgICAgICAgICB4OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5jb3MocmFkaWFuKSxcclxuICAgICAgICAgICAgeTogKGJ1ZmZlciArIGNsdXN0ZXJTeW1ib2xTaXplKSAqIE1hdGguc2luKHJhZGlhbilcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAuc2V0VHJhbnNmb3JtKHsgZHg6IHBvc2l0aW9uLngsIGR5OiBwb3NpdGlvbi55IH0pO1xyXG4gICAgICAgIHJldHVybiBwb3NpdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9nZXRGbGFyZVN5bWJvbChmbGFyZUdyYXBoaWM6IEdyYXBoaWMpOiBTaW1wbGVNYXJrZXJTeW1ib2wge1xyXG4gICAgICAgIHJldHVybiAhdGhpcy5mbGFyZVJlbmRlcmVyID8gdGhpcy5mbGFyZVN5bWJvbCA6IHRoaXMuZmxhcmVSZW5kZXJlci5nZXRDbGFzc0JyZWFrSW5mbyhmbGFyZUdyYXBoaWMpLnN5bWJvbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVUb29sdGlwKGZsYXJlOiBGbGFyZSkge1xyXG5cclxuICAgICAgICBsZXQgZmxhcmVHcm91cCA9IGZsYXJlLmZsYXJlR3JvdXA7XHJcbiAgICAgICAgdGhpcy5fZGVzdHJveVRvb2x0aXAoKTtcclxuXHJcbiAgICAgICAgbGV0IHRvb2x0aXBMZW5ndGggPSBxdWVyeShcIi50b29sdGlwLXRleHRcIiwgZmxhcmVHcm91cC5yYXdOb2RlKS5sZW5ndGg7XHJcbiAgICAgICAgaWYgKHRvb2x0aXBMZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGdldCB0aGUgdGV4dCBmcm9tIHRoZSBkYXRhLXRvb2x0aXAgYXR0cmlidXRlIG9mIHRoZSBzaGFwZSBvYmplY3RcclxuICAgICAgICBsZXQgdGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG4gICAgICAgIGlmICghdGV4dCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm5vIHRvb2x0aXAgdGV4dCBmb3IgZmxhcmUuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBzcGxpdCBvbiBcXG4gY2hhcmFjdGVyIHRoYXQgc2hvdWxkIGJlIGluIHRvb2x0aXAgdG8gc2lnbmlmeSBtdWx0aXBsZSBsaW5lc1xyXG4gICAgICAgIGxldCBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIik7XHJcblxyXG4gICAgICAgIC8vIGNyZWF0ZSBhIGdyb3VwIHRvIGhvbGQgdGhlIHRvb2x0aXAgZWxlbWVudHNcclxuICAgICAgICBsZXQgdG9vbHRpcEdyb3VwID0gZmxhcmVHcm91cC5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICAvLyBnZXQgdGhlIGZsYXJlIHN5bWJvbCwgd2UnbGwgdXNlIHRoaXMgdG8gc3R5bGUgdGhlIHRvb2x0aXAgYm94XHJcbiAgICAgICAgbGV0IGZsYXJlU3ltYm9sID0gdGhpcy5fZ2V0RmxhcmVTeW1ib2woZmxhcmUuZ3JhcGhpYyk7XHJcblxyXG4gICAgICAgIC8vIGFsaWduIG9uIHRvcCBmb3Igbm9ybWFsIGZsYXJlLCBhbGlnbiBvbiBib3R0b20gZm9yIHN1bW1hcnkgZmxhcmVzLlxyXG4gICAgICAgIGxldCBoZWlnaHQgPSBmbGFyZVN5bWJvbC5zaXplO1xyXG5cclxuICAgICAgICBsZXQgeFBvcyA9IDE7XHJcbiAgICAgICAgbGV0IHlQb3MgPSAhZmxhcmUuaXNTdW1tYXJ5ID8gKChoZWlnaHQpICogLTEpIDogaGVpZ2h0ICsgNTtcclxuXHJcbiAgICAgICAgdG9vbHRpcEdyb3VwLnJhd05vZGUuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJ0b29sdGlwLXRleHRcIik7XHJcbiAgICAgICAgbGV0IHRleHRTaGFwZXMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHJcbiAgICAgICAgICAgIGxldCB0ZXh0U2hhcGUgPSB0b29sdGlwR3JvdXAuY3JlYXRlVGV4dCh7IHg6IHhQb3MsIHk6IHlQb3MgKyAoaSAqIDEwKSwgdGV4dDogbGluZXNbaV0sIGFsaWduOiAnbWlkZGxlJyB9KVxyXG4gICAgICAgICAgICAgICAgLnNldEZpbGwodGhpcy5mbGFyZVRleHRTeW1ib2wuY29sb3IpXHJcbiAgICAgICAgICAgICAgICAuc2V0Rm9udCh7IHNpemU6IDEwLCBmYW1pbHk6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwiZmFtaWx5XCIpLCB3ZWlnaHQ6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwid2VpZ2h0XCIpIH0pO1xyXG5cclxuICAgICAgICAgICAgdGV4dFNoYXBlcy5wdXNoKHRleHRTaGFwZSk7XHJcbiAgICAgICAgICAgIHRleHRTaGFwZS5yYXdOb2RlLnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByZWN0UGFkZGluZyA9IDI7XHJcbiAgICAgICAgbGV0IHRleHRCb3ggPSB0b29sdGlwR3JvdXAuZ2V0Qm91bmRpbmdCb3goKTtcclxuXHJcbiAgICAgICAgbGV0IHJlY3RTaGFwZSA9IHRvb2x0aXBHcm91cC5jcmVhdGVSZWN0KHsgeDogdGV4dEJveC54IC0gcmVjdFBhZGRpbmcsIHk6IHRleHRCb3gueSAtIHJlY3RQYWRkaW5nLCB3aWR0aDogdGV4dEJveC53aWR0aCArIChyZWN0UGFkZGluZyAqIDIpLCBoZWlnaHQ6IHRleHRCb3guaGVpZ2h0ICsgKHJlY3RQYWRkaW5nICogMiksIHI6IDAgfSlcclxuICAgICAgICAgICAgLnNldEZpbGwoZmxhcmVTeW1ib2wuY29sb3IpO1xyXG5cclxuICAgICAgICBpZiAoZmxhcmVTeW1ib2wub3V0bGluZSkge1xyXG4gICAgICAgICAgICByZWN0U2hhcGUuc2V0U3Ryb2tlKHsgY29sb3I6IGZsYXJlU3ltYm9sLm91dGxpbmUuY29sb3IsIHdpZHRoOiAwLjUgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWN0U2hhcGUucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAubW92ZVRvRnJvbnQoKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGV4dFNoYXBlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICB0ZXh0U2hhcGVzW2ldLm1vdmVUb0Zyb250KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9kZXN0cm95VG9vbHRpcCgpIHtcclxuICAgICAgICBxdWVyeShcIi50b29sdGlwLXRleHRcIiwgdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlLnJhd05vZGUpLmZvckVhY2goZG9tQ29uc3RydWN0LmRlc3Ryb3kpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvLyAjcmVnaW9uIGhlbHBlciBmdW5jdGlvbnNcclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYywgc3VyZmFjZTogYW55KTogSFRNTEVsZW1lbnQge1xyXG5cclxuICAgICAgICAvLyBmYWtlIG91dCBhIEdGWE9iamVjdCBzbyB3ZSBjYW4gZ2VuZXJhdGUgYW4gc3ZnIHNoYXBlIHRoYXQgdGhlIHBhc3NlZCBpbiBncmFwaGljcyBzaGFwZVxyXG4gICAgICAgIGxldCBnID0gbmV3IEdGWE9iamVjdCgpO1xyXG4gICAgICAgIGcuZ3JhcGhpYyA9IGdyYXBoaWM7XHJcbiAgICAgICAgZy5yZW5kZXJpbmdJbmZvID0geyBzeW1ib2w6IGdyYXBoaWMuc3ltYm9sIH07XHJcblxyXG4gICAgICAgIC8vIHNldCB1cCBwYXJhbWV0ZXJzIGZvciB0aGUgY2FsbCB0byByZW5kZXJcclxuICAgICAgICAvLyBzZXQgdGhlIHRyYW5zZm9ybSBvZiB0aGUgcHJvamVjdG9yIHRvIDAncyBhcyB3ZSdyZSBqdXN0IHBsYWNpbmcgdGhlIGdlbmVyYXRlZCBjbHVzdGVyIHNoYXBlIGF0IGV4YWN0bHkgMCwwLlxyXG4gICAgICAgIGxldCBwcm9qZWN0b3IgPSBuZXcgUHJvamVjdG9yKCk7XHJcbiAgICAgICAgcHJvamVjdG9yLl90cmFuc2Zvcm0gPSBbMCwgMCwgMCwgMCwgMCwgMF07XHJcbiAgICAgICAgcHJvamVjdG9yLl9yZXNvbHV0aW9uID0gMDtcclxuXHJcbiAgICAgICAgbGV0IHN0YXRlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHN0YXRlID0gdGhpcy5fYWN0aXZlVmlldy5zdGF0ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIGZha2Ugb3V0IGEgc3RhdGUgb2JqZWN0IGZvciAzZCB2aWV3cy5cclxuICAgICAgICAgICAgc3RhdGUgPSB7XHJcbiAgICAgICAgICAgICAgICBjbGlwcGVkRXh0ZW50OiB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCxcclxuICAgICAgICAgICAgICAgIHJvdGF0aW9uOiAwLFxyXG4gICAgICAgICAgICAgICAgc3BhdGlhbFJlZmVyZW5jZTogdGhpcy5fYWN0aXZlVmlldy5zcGF0aWFsUmVmZXJlbmNlLFxyXG4gICAgICAgICAgICAgICAgd29ybGRTY3JlZW5XaWR0aDogMVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHBhciA9IHtcclxuICAgICAgICAgICAgc3VyZmFjZTogc3VyZmFjZSxcclxuICAgICAgICAgICAgc3RhdGU6IHN0YXRlLFxyXG4gICAgICAgICAgICBwcm9qZWN0b3I6IHByb2plY3RvclxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGcuZG9SZW5kZXIocGFyKTtcclxuXHJcbiAgICAgICAgLy8gbmVlZCB0byBmaXggdXAgdGhlIHRyYW5zZm9ybSBvZiB0aGUgbmV3IHNoYXBlLiBUZXh0IHN5bWJvbHMgc2VlbSB0byBnZXQgYSBiaXQgb3V0IG9mIHdoYWNrLlxyXG4gICAgICAgIGxldCB5b2Zmc2V0ID0gZ3JhcGhpYy5zeW1ib2xbXCJ5b2Zmc2V0XCJdID8gZ3JhcGhpYy5zeW1ib2xbXCJ5b2Zmc2V0XCJdICogLTEgOiAwO1xyXG4gICAgICAgIGxldCB4b2Zmc2V0ID0gZ3JhcGhpYy5zeW1ib2xbXCJ4b2Zmc2V0XCJdID8gZ3JhcGhpYy5zeW1ib2xbXCJ4b2Zmc2V0XCJdICogLTEgOiAwO1xyXG4gICAgICAgIGcuX3NoYXBlLnNldFRyYW5zZm9ybSh7IHh4OiAxLCB5eTogMSwgZHk6IHlvZmZzZXQsIGR4OiB4b2Zmc2V0IH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gZy5fc2hhcGUucmF3Tm9kZTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfZXh0ZW50KCk6IEV4dGVudCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVZpZXcgPyB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zY2FsZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5zY2FsZSA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIElFIC8gRWRnZSBkb24ndCBoYXZlIHRoZSBjbGFzc0xpc3QgcHJvcGVydHkgb24gc3ZnIGVsZW1lbnRzLCBzbyB3ZSBjYW4ndCB1c2UgdGhhdCBhZGQgLyByZW1vdmUgY2xhc3NlcyAtIHByb2JhYmx5IHdoeSBkb2pvIGRvbUNsYXNzIGRvZXNuJ3Qgd29yayBlaXRoZXIuXHJcbiAgICAgICBzbyB0aGUgZm9sbG93aW5nIHR3byBmdW5jdGlvbnMgYXJlIGRvZGd5IHN0cmluZyBoYWNrcyB0byBhZGQgLyByZW1vdmUgY2xhc3Nlcy4gVXNlcyBhIHRpbWVvdXQgc28geW91IGNhbiBtYWtlIGNzcyB0cmFuc2l0aW9ucyB3b3JrIGlmIGRlc2lyZWQuXHJcbiAgICAgKiBAcGFyYW0gZWxlbWVudFxyXG4gICAgICogQHBhcmFtIGNsYXNzTmFtZVxyXG4gICAgICogQHBhcmFtIHRpbWVvdXRNc1xyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2FkZENsYXNzVG9FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCBhZGRDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgY3VycmVudENsYXNzID0gXCJcIjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgIT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIGxldCBuZXdDbGFzcyA9IChjdXJyZW50Q2xhc3MgKyBcIiBcIiArIF9jbGFzc05hbWUpLnRyaW0oKTtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgbmV3Q2xhc3MpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGFkZENsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9yZW1vdmVDbGFzc0Zyb21FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCByZW1vdmVDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgcmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudENsYXNzLmluZGV4T2YoXCIgXCIgKyBfY2xhc3NOYW1lKSA9PT0gLTEpIHJldHVybjtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgY3VycmVudENsYXNzLnJlcGxhY2UoXCIgXCIgKyBfY2xhc3NOYW1lLCBcIlwiKSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKHRpbWVvdXRNcykge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCB0aW1lb3V0TXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmVtb3ZlQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldE1vdXNlUG9zKGV2dCkge1xyXG4gICAgICAgIC8vIGNvbnRhaW5lciBvbiB0aGUgdmlldyBpcyBhY3R1YWxseSBhIGh0bWwgZWxlbWVudCBhdCB0aGlzIHBvaW50LCBub3QgYSBzdHJpbmcgYXMgdGhlIHR5cGluZ3Mgc3VnZ2VzdC5cclxuICAgICAgICBsZXQgY29udGFpbmVyOiBhbnkgPSB0aGlzLl9hY3RpdmVWaWV3LmNvbnRhaW5lcjtcclxuICAgICAgICBpZiAoIWNvbnRhaW5lcikgeyByZXR1cm4geyB4OiAwLCB5OiAwIH0gfTtcclxuICAgICAgICBsZXQgcmVjdCA9IGNvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB4OiBldnQueCAtIHJlY3QubGVmdCxcclxuICAgICAgICAgICAgeTogZXZ0LnkgLSByZWN0LnRvcFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0dGluZyB2aXNpYmxlIHRvIGZhbHNlIG9uIGEgZ3JhcGhpYyBkb2Vzbid0IHdvcmsgaW4gNC4yIGZvciBzb21lIHJlYXNvbi4gUmVtb3ZpbmcgdGhlIGdyYXBoaWMgdG8gaGlkZSBpdCBpbnN0ZWFkLiBJIHRoaW5rIHZpc2libGUgcHJvcGVydHkgc2hvdWxkIHByb2JhYmx5IHdvcmsgdGhvdWdoLlxyXG4gICAgICogQHBhcmFtIGdyYXBoaWNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfaGlkZUdyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYyB8IEdyYXBoaWNbXSkge1xyXG4gICAgICAgIGlmICghZ3JhcGhpYykgcmV0dXJuO1xyXG4gICAgICAgIGlmIChncmFwaGljLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTWFueSg8R3JhcGhpY1tdPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmUoPEdyYXBoaWM+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Nob3dHcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMgfCBHcmFwaGljW10pIHtcclxuICAgICAgICBpZiAoIWdyYXBoaWMpIHJldHVybjtcclxuICAgICAgICBpZiAoZ3JhcGhpYy5oYXNPd25Qcm9wZXJ0eShcImxlbmd0aFwiKSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZE1hbnkoPEdyYXBoaWNbXT5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKDxHcmFwaGljPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyNlbmRyZWdpb25cclxuXHJcbn1cclxuXHJcblxyXG4vLyBpbnRlcmZhY2UgQWN0aXZlVmlldyBleHRlbmRzIE1hcFZpZXcgYW5kIFNjZW5lVmlldyB0byBhZGQgc29tZSBwcm9wZXJ0aWVzIHtcclxuaW50ZXJmYWNlIEFjdGl2ZVZpZXcgZXh0ZW5kcyBNYXBWaWV3LCBTY2VuZVZpZXcge1xyXG4gICAgY2FudmFzOiBhbnk7XHJcbiAgICBzdGF0ZTogYW55O1xyXG4gICAgZmNsU3VyZmFjZTogYW55O1xyXG4gICAgZmNsUG9pbnRlck1vdmU6IElIYW5kbGU7XHJcbiAgICBmY2xQb2ludGVyRG93bjogSUhhbmRsZTtcclxuXHJcbiAgICBjb25zdHJhaW50czogYW55O1xyXG4gICAgZ29UbzogKHRhcmdldDogYW55LCBvcHRpb25zOiBfX2VzcmkuTWFwVmlld0dvVG9PcHRpb25zKSA9PiBJUHJvbWlzZTxhbnk+O1xyXG4gICAgdG9NYXA6IChzY3JlZW5Qb2ludDogU2NyZWVuUG9pbnQpID0+IFBvaW50O1xyXG59XHJcblxyXG5jbGFzcyBHcmlkQ2x1c3RlciB7XHJcbiAgICBleHRlbnQ6IGFueTtcclxuICAgIGNsdXN0ZXJDb3VudDogbnVtYmVyO1xyXG4gICAgc3ViVHlwZUNvdW50czogYW55W10gPSBbXTtcclxuICAgIHNpbmdsZXM6IGFueVtdID0gW107XHJcbiAgICBwb2ludHM6IGFueVtdID0gW107XHJcbiAgICB4OiBudW1iZXI7XHJcbiAgICB5OiBudW1iZXI7XHJcbn1cclxuXHJcblxyXG5jbGFzcyBDbHVzdGVyIHtcclxuICAgIGNsdXN0ZXJHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgdGV4dEdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICBhcmVhR3JhcGhpYzogR3JhcGhpYztcclxuICAgIGNsdXN0ZXJJZDogbnVtYmVyO1xyXG4gICAgY2x1c3Rlckdyb3VwOiBhbnk7XHJcbiAgICBncmlkQ2x1c3RlcjogR3JpZENsdXN0ZXI7XHJcbn1cclxuXHJcbmNsYXNzIEZsYXJlIHtcclxuICAgIGdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0ZXh0R3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRvb2x0aXBUZXh0OiBzdHJpbmc7XHJcbiAgICBmbGFyZVRleHQ6IHN0cmluZztcclxuICAgIHNpbmdsZURhdGE6IGFueVtdO1xyXG4gICAgZmxhcmVHcm91cDogYW55O1xyXG4gICAgaXNTdW1tYXJ5OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUG9pbnRGaWx0ZXIge1xyXG4gICAgZmlsdGVyTmFtZTogc3RyaW5nO1xyXG4gICAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICBwcm9wZXJ0eVZhbHVlczogYW55W107XHJcblxyXG4gICAgLy8gZGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBmaWx0ZXIgaW5jbHVkZXMgb3IgZXhjbHVkZXMgdGhlIHBvaW50IGRlcGVuZGluZyBvbiB3aGV0aGVyIGl0IGNvbnRhaW5zIHRoZSBwcm9wZXJ0eSB2YWx1ZS5cclxuICAgIC8vIGZhbHNlIG1lYW5zIHRoZSBwb2ludCB3aWxsIGJlIGV4Y2x1ZGVkIGlmIHRoZSB2YWx1ZSBkb2VzIGV4aXN0IGluIHRoZSBvYmplY3QsIHRydWUgbWVhbnMgaXQgd2lsbCBiZSBleGNsdWRlZCBpZiBpdCBkb2Vzbid0LlxyXG4gICAga2VlcE9ubHlJZlZhbHVlRXhpc3RzOiBib29sZWFuO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGZpbHRlck5hbWU6IHN0cmluZywgcHJvcGVydHlOYW1lOiBzdHJpbmcsIHZhbHVlczogYW55W10sIGtlZXBPbmx5SWZWYWx1ZUV4aXN0czogYm9vbGVhbiA9IGZhbHNlKSB7XHJcbiAgICAgICAgdGhpcy5maWx0ZXJOYW1lID0gZmlsdGVyTmFtZTtcclxuICAgICAgICB0aGlzLnByb3BlcnR5TmFtZSA9IHByb3BlcnR5TmFtZTtcclxuICAgICAgICB0aGlzLnByb3BlcnR5VmFsdWVzID0gdmFsdWVzO1xyXG4gICAgICAgIHRoaXMua2VlcE9ubHlJZlZhbHVlRXhpc3RzID0ga2VlcE9ubHlJZlZhbHVlRXhpc3RzO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxuIl19
