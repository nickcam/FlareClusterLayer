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
    // extend GraphicsLayer using 'accessorSupport/decorators'
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
            _this.clusterRatio = options.clusterRatio || 75;
            _this.clusterToScale = options.clusterToScale || 2000000;
            _this.clusterMinCount = options.clusterMinCount || 2;
            _this.singleFlareTooltipProperty = options.singleFlareTooltipProperty || "name";
            if (options.clusterAreaDisplay) {
                _this.clusterAreaDisplay = options.clusterAreaDisplay === "none" ? undefined : options.clusterAreaDisplay;
            }
            _this.maxFlareCount = options.maxFlareCount || 8;
            _this.maxSingleFlareCount = options.maxSingleFlareCount || 8;
            _this.displayFlares = options.displayFlares === false ? false : true; // default to true
            _this.displaySubTypeFlares = options.displaySubTypeFlares === true;
            _this.subTypeFlareProperty = options.subTypeFlareProperty || undefined;
            _this.flareBufferPixels = options.flareBufferPixels || 6;
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
            _this.refreshOnStationary = options.refreshOnStationary === false ? false : true; // default to true
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
                this._activeView = activeView;
            }
            // Not ready to draw yet so queue one up
            if (!this._readyToDraw) {
                this._queuedInitialDraw = true;
                return;
            }
            if (!this._activeView || !this._data)
                return;
            this._is2d = this._activeView.type === "2d";
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
            var webExtent = !this._extent().spatialReference.isWebMercator ? webMercatorUtils.project(this._extent(), new SpatialReference({ "wkid": 102100 })) : this._extent();
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
            this["emit"]("draw-complete", {});
            console.timeEnd("draw-data-" + this._activeView.type);
            setTimeout(function () {
                _this._createSurface();
            }, 10);
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
            if (this._activeView.fclSurface)
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
            if (this._activeCluster) {
                var bbox = this._activeCluster.clusterGroup.rawNode.getBoundingClientRect();
                if (bbox) {
                    if (mousePos.x >= bbox.left && mousePos.x <= bbox.right && mousePos.y >= bbox.top && mousePos.y <= bbox.bottom)
                        return;
                }
            }
            var v = this._activeView;
            this._activeView.hitTest(mousePos).then(function (response) {
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
            if (!this._activeCluster)
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
            query(">", surface.containerGroup.rawNode).forEach(domConstruct.destroy);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvRmxhcmVDbHVzdGVyTGF5ZXJfdjQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOENBQThDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQTJFOUMsMERBQTBEO0lBRTFEO1FBQXVDLHFDQUEyQjtRQW9EOUQsMkJBQVksT0FBb0M7WUFBaEQsWUFFSSxrQkFBTSxPQUFPLENBQUMsU0EyRWpCO1lBMUZPLG9CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBTzNCLGVBQVMsR0FBc0MsRUFBRSxDQUFDO1lBVXRELG1CQUFtQjtZQUNuQixFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsOEJBQThCO2dCQUM5QixPQUFPLENBQUMsS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7O1lBRXJGLENBQUM7WUFFRCxLQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1lBRXZELG1DQUFtQztZQUNuQyxLQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO1lBQy9DLEtBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUM7WUFDeEQsS0FBSSxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxJQUFJLENBQUMsQ0FBQztZQUNwRCxLQUFJLENBQUMsMEJBQTBCLEdBQUcsT0FBTyxDQUFDLDBCQUEwQixJQUFJLE1BQU0sQ0FBQztZQUMvRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixLQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUM7WUFDN0csQ0FBQztZQUNELEtBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFB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QyxDQUFDLENBQUM7Z0JBQ25DLElBQUksQ0FBQyxPQUFPLENBQVksT0FBTyxDQUFDLENBQUM7WUFDckMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLElBQUksQ0FBQyxHQUFHLENBQVUsT0FBTyxDQUFDLENBQUM7WUFDL0IsQ0FBQztRQUNMLENBQUM7UUFwa0NRLGlCQUFpQjtZQUQ3QixHQUFHLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDOztXQUNyQixpQkFBaUIsQ0F3a0M3QjtRQUFELHdCQUFDO0tBeGtDRCxBQXdrQ0MsQ0F4a0NzQyxHQUFHLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQXdrQ2pFO0lBeGtDWSw4Q0FBaUI7SUF3bEM5QjtRQUFBO1lBR0ksa0JBQWEsR0FBVSxFQUFFLENBQUM7WUFDMUIsWUFBTyxHQUFVLEVBQUUsQ0FBQztZQUNwQixXQUFNLEdBQVUsRUFBRSxDQUFDO1FBR3ZCLENBQUM7UUFBRCxrQkFBQztJQUFELENBUkEsQUFRQyxJQUFBO0lBR0Q7UUFBQTtRQU9BLENBQUM7UUFBRCxjQUFDO0lBQUQsQ0FQQSxBQU9DLElBQUE7SUFFRDtRQUFBO1FBUUEsQ0FBQztRQUFELFlBQUM7SUFBRCxDQVJBLEFBUUMsSUFBQTtJQUVEO1FBU0kscUJBQVksVUFBa0IsRUFBRSxZQUFvQixFQUFFLE1BQWEsRUFBRSxxQkFBc0M7WUFBdEMsc0NBQUEsRUFBQSw2QkFBc0M7WUFDdkcsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7WUFDN0IsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7WUFDakMsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUM7WUFDN0IsSUFBSSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQixDQUFDO1FBQ3ZELENBQUM7UUFFTCxrQkFBQztJQUFELENBaEJBLEFBZ0JDLElBQUE7SUFoQlksa0NBQVciLCJmaWxlIjoiRmxhcmVDbHVzdGVyTGF5ZXJfdjQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cclxuXHJcbmltcG9ydCAqIGFzIEdyYXBoaWNzTGF5ZXIgZnJvbSBcImVzcmkvbGF5ZXJzL0dyYXBoaWNzTGF5ZXJcIjtcclxuaW1wb3J0ICogYXMgQ2xhc3NCcmVha3NSZW5kZXJlciBmcm9tIFwiZXNyaS9yZW5kZXJlcnMvQ2xhc3NCcmVha3NSZW5kZXJlclwiO1xyXG5pbXBvcnQgKiBhcyBQb3B1cFRlbXBsYXRlIGZyb20gXCJlc3JpL1BvcHVwVGVtcGxhdGVcIjtcclxuaW1wb3J0ICogYXMgU2ltcGxlTWFya2VyU3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvU2ltcGxlTWFya2VyU3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIFRleHRTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9UZXh0U3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIFNpbXBsZUxpbmVTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9TaW1wbGVMaW5lU3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIENvbG9yIGZyb20gXCJlc3JpL0NvbG9yXCI7XHJcbmltcG9ydCAqIGFzIHdhdGNoVXRpbHMgZnJvbSAnZXNyaS9jb3JlL3dhdGNoVXRpbHMnO1xyXG5pbXBvcnQgKiBhcyBWaWV3IGZyb20gJ2Vzcmkvdmlld3MvVmlldyc7XHJcbmltcG9ydCAqIGFzIHdlYk1lcmNhdG9yVXRpbHMgZnJvbSBcImVzcmkvZ2VvbWV0cnkvc3VwcG9ydC93ZWJNZXJjYXRvclV0aWxzXCI7XHJcbmltcG9ydCAqIGFzIEdyYXBoaWMgZnJvbSBcImVzcmkvR3JhcGhpY1wiO1xyXG5pbXBvcnQgKiBhcyBQb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9Qb2ludFwiOyBcclxuaW1wb3J0ICogYXMgU2NyZWVuUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU2NyZWVuUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgTXVsdGlwb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9NdWx0aXBvaW50XCI7XHJcbmltcG9ydCAqIGFzIFBvbHlnb24gZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9seWdvblwiO1xyXG5pbXBvcnQgKiBhcyBnZW9tZXRyeUVuZ2luZSBmcm9tICdlc3JpL2dlb21ldHJ5L2dlb21ldHJ5RW5naW5lJztcclxuaW1wb3J0ICogYXMgU3BhdGlhbFJlZmVyZW5jZSBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TcGF0aWFsUmVmZXJlbmNlXCI7XHJcbmltcG9ydCAqIGFzIEV4dGVudCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9FeHRlbnRcIjtcclxuaW1wb3J0ICogYXMgTWFwVmlldyBmcm9tICdlc3JpL3ZpZXdzL01hcFZpZXcnO1xyXG5pbXBvcnQgKiBhcyBTY2VuZVZpZXcgZnJvbSAnZXNyaS92aWV3cy9TY2VuZVZpZXcnO1xyXG4gXHJcbmltcG9ydCAqIGFzIEdGWE9iamVjdCBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvR0ZYT2JqZWN0XCI7XHJcbmltcG9ydCAqIGFzIFByb2plY3RvciBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvUHJvamVjdG9yXCI7XHJcbiBcclxuaW1wb3J0ICogYXMgYXNkIGZyb20gXCJlc3JpL2NvcmUvYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnNcIjtcclxuXHJcbmltcG9ydCAqIGFzIG9uIGZyb20gJ2Rvam8vb24nO1xyXG5pbXBvcnQgKiBhcyBnZnggZnJvbSAnZG9qb3gvZ2Z4JztcclxuaW1wb3J0ICogYXMgZG9tQ29uc3RydWN0IGZyb20gJ2Rvam8vZG9tLWNvbnN0cnVjdCc7XHJcbmltcG9ydCAqIGFzIHF1ZXJ5IGZyb20gJ2Rvam8vcXVlcnknO1xyXG5pbXBvcnQgKiBhcyBkb21BdHRyIGZyb20gJ2Rvam8vZG9tLWF0dHInO1xyXG5pbXBvcnQgKiBhcyBkb21TdHlsZSBmcm9tICdkb2pvL2RvbS1zdHlsZSc7XHJcbiBcclxuaW50ZXJmYWNlIEZsYXJlQ2x1c3RlckxheWVyUHJvcGVydGllcyBleHRlbmRzIF9fZXNyaS5HcmFwaGljc0xheWVyUHJvcGVydGllcyB7XHJcblxyXG4gICAgY2x1c3RlclJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNpbmdsZVJlbmRlcmVyPzogYW55O1xyXG4gICAgc2luZ2xlU3ltYm9sPzogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgYXJlYVJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuICAgIGZsYXJlUmVuZGVyZXI/OiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNpbmdsZVBvcHVwVGVtcGxhdGU/OiBQb3B1cFRlbXBsYXRlO1xyXG4gICAgc3BhdGlhbFJlZmVyZW5jZT86IFNwYXRpYWxSZWZlcmVuY2U7XHJcblxyXG4gICAgY2x1c3RlclJhdGlvPzogbnVtYmVyO1xyXG4gICAgY2x1c3RlclRvU2NhbGU/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyTWluQ291bnQ/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyQXJlYURpc3BsYXk/OiBzdHJpbmc7XHJcblxyXG4gICAgZGlzcGxheUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBtYXhGbGFyZUNvdW50PzogbnVtYmVyO1xyXG4gICAgbWF4U2luZ2xlRmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIHNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5Pzogc3RyaW5nO1xyXG4gICAgZmxhcmVTeW1ib2w/OiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBmbGFyZUJ1ZmZlclBpeGVscz86IG51bWJlcjtcclxuICAgIHRleHRTeW1ib2w/OiBUZXh0U3ltYm9sO1xyXG4gICAgZmxhcmVUZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGRpc3BsYXlTdWJUeXBlRmxhcmVzPzogYm9vbGVhbjtcclxuICAgIHN1YlR5cGVGbGFyZVByb3BlcnR5Pzogc3RyaW5nO1xyXG5cclxuICAgIHhQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgelByb3BlcnR5TmFtZT86IHN0cmluZztcclxuXHJcbiAgICByZWZyZXNoT25TdGF0aW9uYXJ5PzogYm9vbGVhbjtcclxuXHJcbiAgICBmaWx0ZXJzPzogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBkYXRhPzogYW55W107XHJcblxyXG59XHJcblxyXG4vLyBleHRlbmQgR3JhcGhpY3NMYXllciB1c2luZyAnYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnMnXHJcbkBhc2Quc3ViY2xhc3MoXCJGbGFyZUNsdXN0ZXJMYXllclwiKVxyXG5leHBvcnQgY2xhc3MgRmxhcmVDbHVzdGVyTGF5ZXIgZXh0ZW5kcyBhc2QuZGVjbGFyZWQoR3JhcGhpY3NMYXllcikge1xyXG5cclxuICAgIHNpbmdsZVJlbmRlcmVyOiBhbnk7XHJcbiAgICBzaW5nbGVTeW1ib2w6IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIHNpbmdsZVBvcHVwVGVtcGxhdGU6IFBvcHVwVGVtcGxhdGU7XHJcblxyXG4gICAgY2x1c3RlclJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgYXJlYVJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgZmxhcmVSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzcGF0aWFsUmVmZXJlbmNlOiBTcGF0aWFsUmVmZXJlbmNlO1xyXG5cclxuICAgIGNsdXN0ZXJSYXRpbzogbnVtYmVyO1xyXG4gICAgY2x1c3RlclRvU2NhbGU6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJNaW5Db3VudDogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5OiBzdHJpbmc7XHJcblxyXG4gICAgZGlzcGxheUZsYXJlczogYm9vbGVhbjtcclxuICAgIG1heEZsYXJlQ291bnQ6IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ6IG51bWJlcjtcclxuICAgIHNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5OiBzdHJpbmc7XHJcbiAgICBmbGFyZVN5bWJvbDogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM6IG51bWJlcjtcclxuICAgIHRleHRTeW1ib2w6IFRleHRTeW1ib2w7XHJcbiAgICBmbGFyZVRleHRTeW1ib2w6IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlczogYm9vbGVhbjtcclxuICAgIHN1YlR5cGVGbGFyZVByb3BlcnR5OiBzdHJpbmc7XHJcblxyXG4gICAgcmVmcmVzaE9uU3RhdGlvbmFyeTogYm9vbGVhbjtcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB6UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcblxyXG4gICAgZmlsdGVyczogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBwcml2YXRlIF9ncmlkQ2x1c3RlcnM6IEdyaWRDbHVzdGVyW107XHJcbiAgICBwcml2YXRlIF9pc0NsdXN0ZXJlZDogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX2FjdGl2ZVZpZXc6IEFjdGl2ZVZpZXc7XHJcbiAgICBwcml2YXRlIF92aWV3TG9hZENvdW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIHByaXZhdGUgX3JlYWR5VG9EcmF3OiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkSW5pdGlhbERyYXc6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9kYXRhOiBhbnlbXTtcclxuICAgIHByaXZhdGUgX2lzMmQ6IGJvb2xlYW47XHJcblxyXG4gICAgcHJpdmF0ZSBfY2x1c3RlcnM6IHsgW2NsdXN0ZXJJZDogbnVtYmVyXTogQ2x1c3RlcjsgfSA9IHt9O1xyXG4gICAgcHJpdmF0ZSBfYWN0aXZlQ2x1c3RlcjogQ2x1c3RlcjtcclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXcyZDogYW55O1xyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3M2Q6IGFueTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zOiBGbGFyZUNsdXN0ZXJMYXllclByb3BlcnRpZXMpIHtcclxuXHJcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vIHNldCB0aGUgZGVmYXVsdHNcclxuICAgICAgICBpZiAoIW9wdGlvbnMpIHtcclxuICAgICAgICAgICAgLy8gbWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzXHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJNaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnMgdG8gZmxhcmUgY2x1c3RlciBsYXllciBjb25zdHJ1Y3Rvci5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5zaW5nbGVQb3B1cFRlbXBsYXRlID0gb3B0aW9ucy5zaW5nbGVQb3B1cFRlbXBsYXRlO1xyXG5cclxuICAgICAgICAvLyBzZXQgdXAgdGhlIGNsdXN0ZXJpbmcgcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclJhdGlvID0gb3B0aW9ucy5jbHVzdGVyUmF0aW8gfHwgNzU7XHJcbiAgICAgICAgdGhpcy5jbHVzdGVyVG9TY2FsZSA9IG9wdGlvbnMuY2x1c3RlclRvU2NhbGUgfHwgMjAwMDAwMDtcclxuICAgICAgICB0aGlzLmNsdXN0ZXJNaW5Db3VudCA9IG9wdGlvbnMuY2x1c3Rlck1pbkNvdW50IHx8IDI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eSA9IG9wdGlvbnMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHkgfHwgXCJuYW1lXCI7XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID0gb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwibm9uZVwiID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubWF4RmxhcmVDb3VudCA9IG9wdGlvbnMubWF4RmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCA9IG9wdGlvbnMubWF4U2luZ2xlRmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMuZGlzcGxheUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheUZsYXJlcyA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vIGRlZmF1bHQgdG8gdHJ1ZVxyXG4gICAgICAgIHRoaXMuZGlzcGxheVN1YlR5cGVGbGFyZXMgPSBvcHRpb25zLmRpc3BsYXlTdWJUeXBlRmxhcmVzID09PSB0cnVlO1xyXG4gICAgICAgIHRoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHkgPSBvcHRpb25zLnN1YlR5cGVGbGFyZVByb3BlcnR5IHx8IHVuZGVmaW5lZDtcclxuICAgICAgICB0aGlzLmZsYXJlQnVmZmVyUGl4ZWxzID0gb3B0aW9ucy5mbGFyZUJ1ZmZlclBpeGVscyB8fCA2O1xyXG5cclxuICAgICAgICAvLyBkYXRhIHNldCBwcm9wZXJ0eSBuYW1lc1xyXG4gICAgICAgIHRoaXMueFByb3BlcnR5TmFtZSA9IG9wdGlvbnMueFByb3BlcnR5TmFtZSB8fCBcInhcIjtcclxuICAgICAgICB0aGlzLnlQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnlQcm9wZXJ0eU5hbWUgfHwgXCJ5XCI7XHJcbiAgICAgICAgdGhpcy56UHJvcGVydHlOYW1lID0gb3B0aW9ucy56UHJvcGVydHlOYW1lIHx8IFwielwiO1xyXG5cclxuICAgICAgICAvLyBzZXQgdXAgdGhlIHN5bWJvbG9neS9yZW5kZXJlciBwcm9wZXJ0aWVzXHJcbiAgICAgICAgdGhpcy5jbHVzdGVyUmVuZGVyZXIgPSBvcHRpb25zLmNsdXN0ZXJSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLmFyZWFSZW5kZXJlciA9IG9wdGlvbnMuYXJlYVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlUmVuZGVyZXIgPSBvcHRpb25zLnNpbmdsZVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlU3ltYm9sID0gb3B0aW9ucy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgdGhpcy5mbGFyZVJlbmRlcmVyID0gb3B0aW9ucy5mbGFyZVJlbmRlcmVyO1xyXG5cclxuICAgICAgICB0aGlzLnJlZnJlc2hPblN0YXRpb25hcnkgPSBvcHRpb25zLnJlZnJlc2hPblN0YXRpb25hcnkgPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlOyAvLyBkZWZhdWx0IHRvIHRydWVcclxuXHJcbiAgICAgICAgLy8gYWRkIHNvbWUgZGVmYXVsdCBzeW1ib2xzIG9yIHVzZSB0aGUgb3B0aW9ucyB2YWx1ZXMuXHJcbiAgICAgICAgdGhpcy5mbGFyZVN5bWJvbCA9IG9wdGlvbnMuZmxhcmVTeW1ib2wgfHwgbmV3IFNpbXBsZU1hcmtlclN5bWJvbCh7XHJcbiAgICAgICAgICAgIHNpemU6IDE0LFxyXG4gICAgICAgICAgICBjb2xvcjogbmV3IENvbG9yKFswLCAwLCAwLCAwLjVdKSxcclxuICAgICAgICAgICAgb3V0bGluZTogbmV3IFNpbXBsZUxpbmVTeW1ib2woeyBjb2xvcjogbmV3IENvbG9yKFsyNTUsIDI1NSwgMjU1LCAwLjVdKSwgd2lkdGg6IDEgfSlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy50ZXh0U3ltYm9sID0gb3B0aW9ucy50ZXh0U3ltYm9sIHx8IG5ldyBUZXh0U3ltYm9sKHtcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NV0pLFxyXG4gICAgICAgICAgICBmb250OiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiAxMCxcclxuICAgICAgICAgICAgICAgIGZhbWlseTogXCJhcmlhbFwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHlvZmZzZXQ6IC0zIC8vIHNldHRpbmcgeW9mZnNldCBhcyB2ZXJ0aWNhbCBhbGlnbm1lbnQgZG9lc24ndCB3b3JrIGluIElFL0VkZ2VcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5mbGFyZVRleHRTeW1ib2wgPSBvcHRpb25zLmZsYXJlVGV4dFN5bWJvbCB8fCBuZXcgVGV4dFN5bWJvbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTVdKSxcclxuICAgICAgICAgICAgZm9udDoge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogNixcclxuICAgICAgICAgICAgICAgIGZhbWlseTogXCJhcmlhbFwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHlvZmZzZXQ6IC0yIC8vIHNldHRpbmcgeW9mZnNldCBhcyB2ZXJ0aWNhbCBhbGlnbm1lbnQgZG9lc24ndCB3b3JrIGluIElFL0VkZ2VcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gaW5pdGlhbCBkYXRhXHJcbiAgICAgICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIHRoaXMub24oXCJsYXllcnZpZXctY3JlYXRlXCIsIChldnQpID0+IHRoaXMuX2xheWVyVmlld0NyZWF0ZWQoZXZ0KSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9kYXRhKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3Q3JlYXRlZChldnQpIHtcclxuXHJcbiAgICAgICAgaWYgKGV2dC5sYXllclZpZXcudmlldy50eXBlID09PSBcIjJkXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGF5ZXJWaWV3MmQgPSBldnQubGF5ZXJWaWV3O1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fbGF5ZXJWaWV3M2QgPSBldnQubGF5ZXJWaWV3O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gYWRkIGEgc3RhdGlvbmFyeSB3YXRjaCBvbiB0aGUgdmlldyB0byByZWZyZXNoIGlmIHNwZWNpZmllZCBpbiBvcHRpb25zLlxyXG4gICAgICAgIGlmICh0aGlzLnJlZnJlc2hPblN0YXRpb25hcnkpIHtcclxuICAgICAgICAgICAgd2F0Y2hVdGlscy5wYXVzYWJsZShldnQubGF5ZXJWaWV3LnZpZXcsIFwic3RhdGlvbmFyeVwiLCAoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSA9PiB0aGlzLl92aWV3U3RhdGlvbmFyeShpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl92aWV3TG9hZENvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBldnQubGF5ZXJWaWV3LnZpZXc7XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9yZWFkeVRvRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdykge1xyXG4gICAgICAgICAgICAgICAgLy8gd2UndmUgYmVlbiB3YWl0aW5nIGZvciB0aGlzIHRvIGhhcHBlbiB0byBkcmF3XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdmlld0xvYWRDb3VudCsrO1xyXG5cclxuXHJcbiAgICAgICAgaWYgKGV2dC5sYXllclZpZXcudmlldy50eXBlID09PSBcIjJkXCIpIHtcclxuICAgICAgICAgICAgLy8gZm9yIG1hcCB2aWV3cywgd2FpdCBmb3IgdGhlIGxheWVydmlldyBvdCBiZSBhdHRhY2hlZCwgYmVmb3JlIGFkZGluZyBldmVudHNcclxuICAgICAgICAgICAgd2F0Y2hVdGlscy53aGVuVHJ1ZU9uY2UoZXZ0LmxheWVyVmlldywgXCJhdHRhY2hlZFwiLCAoKSA9PiB0aGlzLl9hZGRWaWV3RXZlbnRzKGV2dC5sYXllclZpZXcpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIGZvciBzY2VuZSB2aWV3cyBqdXN0IGFkZCB0aGUgZXZlbnRzIHN0cmFpZ2h0IGF3YXlcclxuICAgICAgICAgICAgdGhpcy5fYWRkVmlld0V2ZW50cyhldnQubGF5ZXJWaWV3KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG4gICAgIFxyXG4gICAgcHJpdmF0ZSBfYWRkVmlld0V2ZW50cyhsYXllclZpZXc6IGFueSkge1xyXG4gICAgICAgIGxldCB2OiBBY3RpdmVWaWV3ID0gbGF5ZXJWaWV3LnZpZXc7XHJcbiAgICAgICAgaWYgKCF2LmZjbFBvaW50ZXJNb3ZlKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29udGFpbmVyOiBIVE1MRWxlbWVudCA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYgKHYudHlwZSA9PT0gXCIyZFwiKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBmb3IgYSBtYXAgdmlldyBnZXQgdGhlIGNvbnRhaW5lciBlbGVtZW50IG9mIHRoZSBsYXllciB2aWV3IHRvIGFkZCBtb3VzZW1vdmUgZXZlbnQgdG8uXHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIgPSBsYXllclZpZXcuY29udGFpbmVyLmVsZW1lbnQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBmb3Igc2NlbmUgdmlldyBnZXQgdGhlIGNhbnZhcyBlbGVtZW50IHVuZGVyIHRoZSB2aWV3IGNvbnRhaW5lciB0byBhZGQgbW91c2Vtb3ZlIHRvLlxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gPEhUTUxFbGVtZW50PnF1ZXJ5KFwiY2FudmFzXCIsIHYuY29udGFpbmVyKVswXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQWRkIHBvaW50ZXIgbW92ZSBhbmQgcG9pbnRlciBkb3duLiBQb2ludGVyIGRvd24gdG8gaGFuZGxlIHRvdWNoIGRldmljZXMuXHJcbiAgICAgICAgICAgIHYuZmNsUG9pbnRlck1vdmUgPSB2Lm9uKFwicG9pbnRlci1tb3ZlXCIsIChldnQpID0+IHRoaXMuX3ZpZXdQb2ludGVyTW92ZShldnQpKTtcclxuICAgICAgICAgICAgdi5mY2xQb2ludGVyRG93biA9IHYub24oXCJwb2ludGVyLWRvd25cIiwgKGV2dCkgPT4gdGhpcy5fdmlld1BvaW50ZXJNb3ZlKGV2dCkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSB7XHJcblxyXG4gICAgICAgIGlmIChpc1N0YXRpb25hcnkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIWlzU3RhdGlvbmFyeSAmJiB0aGlzLl9hY3RpdmVDbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIC8vIGlmIG1vdmluZyBkZWFjdGl2YXRlIGNsdXN0ZXI7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBjbGVhcigpIHtcclxuICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzID0ge307XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHNldERhdGEoZGF0YTogYW55W10sIGRyYXdEYXRhOiBib29sZWFuID0gdHJ1ZSkge1xyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xyXG4gICAgICAgIGlmIChkcmF3RGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZHJhdyhhY3RpdmVWaWV3PzogYW55KSB7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVWaWV3KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBhY3RpdmVWaWV3O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gTm90IHJlYWR5IHRvIGRyYXcgeWV0IHNvIHF1ZXVlIG9uZSB1cFxyXG4gICAgICAgIGlmICghdGhpcy5fcmVhZHlUb0RyYXcpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkSW5pdGlhbERyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZVZpZXcgfHwgIXRoaXMuX2RhdGEpIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5faXMyZCA9IHRoaXMuX2FjdGl2ZVZpZXcudHlwZSA9PT0gXCIyZFwiO1xyXG5cclxuICAgICAgICAvLyBjaGVjayB0byBtYWtlIHN1cmUgd2UgaGF2ZSBhbiBhcmVhIHJlbmRlcmVyIHNldCBpZiBvbmUgbmVlZHMgdG8gYmVcclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgJiYgIXRoaXMuYXJlYVJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGbGFyZUNsdXN0ZXJMYXllcjogYXJlYVJlbmRlcmVyIG11c3QgYmUgc2V0IGlmIGNsdXN0ZXJBcmVhRGlzcGxheSBpcyBzZXQuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgY29uc29sZS50aW1lKFwiZHJhdy1kYXRhLVwiICsgdGhpcy5fYWN0aXZlVmlldy50eXBlKTtcclxuXHJcbiAgICAgICAgdGhpcy5faXNDbHVzdGVyZWQgPSB0aGlzLmNsdXN0ZXJUb1NjYWxlIDwgdGhpcy5fc2NhbGUoKTtcclxuXHJcbiAgICAgICAgbGV0IGdyYXBoaWNzOiBHcmFwaGljW10gPSBbXTtcclxuXHJcbiAgICAgICAgLy8gR2V0IGFuIGV4dGVudCB0aGF0IGlzIGluIHdlYiBtZXJjYXRvciB0byBtYWtlIHN1cmUgaXQncyBmbGF0IGZvciBleHRlbnQgY2hlY2tpbmdcclxuICAgICAgICAvLyBUaGUgd2ViZXh0ZW50IHdpbGwgbmVlZCB0byBiZSBub3JtYWxpemVkIHNpbmNlIHBhbm5pbmcgb3ZlciB0aGUgaW50ZXJuYXRpb25hbCBkYXRlbGluZSB3aWxsIGNhdXNlXHJcbiAgICAgICAgLy8gY2F1c2UgdGhlIGV4dGVudCB0byBzaGlmdCBvdXRzaWRlIHRoZSAtMTgwIHRvIDE4MCBkZWdyZWUgd2luZG93LiAgSWYgd2UgZG9uJ3Qgbm9ybWFsaXplIHRoZW4gdGhlXHJcbiAgICAgICAgLy8gY2x1c3RlcnMgd2lsbCBub3QgYmUgZHJhd24gaWYgdGhlIG1hcCBwYW5zIG92ZXIgdGhlIGludGVybmF0aW9uYWwgZGF0ZWxpbmUuXHJcbiAgICAgICAgbGV0IHdlYkV4dGVudDogYW55ID0gIXRoaXMuX2V4dGVudCgpLnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvciA/IDxFeHRlbnQ+d2ViTWVyY2F0b3JVdGlscy5wcm9qZWN0KHRoaXMuX2V4dGVudCgpLCBuZXcgU3BhdGlhbFJlZmVyZW5jZSh7IFwid2tpZFwiOiAxMDIxMDAgfSkpIDogdGhpcy5fZXh0ZW50KCk7XHJcbiAgICAgICAgbGV0IGV4dGVudElzVW5pb25lZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBsZXQgbm9ybWFsaXplZFdlYkV4dGVudCA9IHdlYkV4dGVudC5ub3JtYWxpemUoKTtcclxuICAgICAgICB3ZWJFeHRlbnQgPSBub3JtYWxpemVkV2ViRXh0ZW50WzBdO1xyXG4gICAgICAgIGlmIChub3JtYWxpemVkV2ViRXh0ZW50Lmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgd2ViRXh0ZW50ID0gd2ViRXh0ZW50LnVuaW9uKG5vcm1hbGl6ZWRXZWJFeHRlbnRbMV0pO1xyXG4gICAgICAgICAgICBleHRlbnRJc1VuaW9uZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudCwgZXh0ZW50SXNVbmlvbmVkKTtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBsZXQgd2ViOiBudW1iZXJbXSwgb2JqOiBhbnksIGRhdGFMZW5ndGggPSB0aGlzLl9kYXRhLmxlbmd0aCwgeFZhbDogbnVtYmVyLCB5VmFsOiBudW1iZXI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhTGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgb2JqID0gdGhpcy5fZGF0YVtpXTtcclxuXHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIGZpbHRlcnMgYXJlIHNwZWNpZmllZCBhbmQgY29udGludWUgaWYgdGhpcyBvYmplY3QgZG9lc24ndCBwYXNzXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fcGFzc2VzRmlsdGVyKG9iaikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB4VmFsID0gb2JqW3RoaXMueFByb3BlcnR5TmFtZV07XHJcbiAgICAgICAgICAgIHlWYWwgPSBvYmpbdGhpcy55UHJvcGVydHlOYW1lXTtcclxuXHJcbiAgICAgICAgICAgIC8vIGdldCBhIHdlYiBtZXJjIGxuZy9sYXQgZm9yIGV4dGVudCBjaGVja2luZy4gVXNlIHdlYiBtZXJjIGFzIGl0J3MgZmxhdCB0byBjYXRlciBmb3IgbG9uZ2l0dWRlIHBvbGVcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgICAgICB3ZWIgPSBbeFZhbCwgeVZhbF07XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB3ZWIgPSB3ZWJNZXJjYXRvclV0aWxzLmxuZ0xhdFRvWFkoeFZhbCwgeVZhbCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRoZSBvYmogaXMgdmlzaWJsZSBpbiB0aGUgZXh0ZW50IGJlZm9yZSBwcm9jZWVkaW5nXHJcbiAgICAgICAgICAgIGlmICgod2ViWzBdIDw9IHdlYkV4dGVudC54bWluIHx8IHdlYlswXSA+IHdlYkV4dGVudC54bWF4KSB8fCAod2ViWzFdIDw9IHdlYkV4dGVudC55bWluIHx8IHdlYlsxXSA+IHdlYkV4dGVudC55bWF4KSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGxvb3AgY2x1c3RlciBncmlkIHRvIHNlZSBpZiBpdCBzaG91bGQgYmUgYWRkZWQgdG8gb25lXHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgakxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGogPCBqTGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2wgPSB0aGlzLl9ncmlkQ2x1c3RlcnNbal07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh3ZWJbMF0gPD0gY2wuZXh0ZW50LnhtaW4gfHwgd2ViWzBdID4gY2wuZXh0ZW50LnhtYXggfHwgd2ViWzFdIDw9IGNsLmV4dGVudC55bWluIHx8IHdlYlsxXSA+IGNsLmV4dGVudC55bWF4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvL25vdCBoZXJlIHNvIGNhcnJ5IG9uXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyByZWNhbGMgdGhlIHggYW5kIHkgb2YgdGhlIGNsdXN0ZXIgYnkgYXZlcmFnaW5nIHRoZSBwb2ludHMgYWdhaW5cclxuICAgICAgICAgICAgICAgICAgICBjbC54ID0gY2wuY2x1c3RlckNvdW50ID4gMCA/ICh4VmFsICsgKGNsLnggKiBjbC5jbHVzdGVyQ291bnQpKSAvIChjbC5jbHVzdGVyQ291bnQgKyAxKSA6IHhWYWw7XHJcbiAgICAgICAgICAgICAgICAgICAgY2wueSA9IGNsLmNsdXN0ZXJDb3VudCA+IDAgPyAoeVZhbCArIChjbC55ICogY2wuY2x1c3RlckNvdW50KSkgLyAoY2wuY2x1c3RlckNvdW50ICsgMSkgOiB5VmFsO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBwdXNoIGV2ZXJ5IHBvaW50IGludG8gdGhlIGNsdXN0ZXIgc28gd2UgaGF2ZSBpdCBmb3IgYXJlYSBkaXNwbGF5IGlmIHJlcXVpcmVkLiBUaGlzIGNvdWxkIGJlIG9taXR0ZWQgaWYgbmV2ZXIgY2hlY2tpbmcgYXJlYXMsIG9yIG9uIGRlbWFuZCBhdCBsZWFzdFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5wb2ludHMucHVzaChbeFZhbCwgeVZhbF0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY2wuY2x1c3RlckNvdW50Kys7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzdWJUeXBlRXhpc3RzID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcyA9IDAsIHNMZW4gPSBjbC5zdWJUeXBlQ291bnRzLmxlbmd0aDsgcyA8IHNMZW47IHMrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2wuc3ViVHlwZUNvdW50c1tzXS5uYW1lID09PSBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsLnN1YlR5cGVDb3VudHNbc10uY291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YlR5cGVFeGlzdHMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghc3ViVHlwZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzLnB1c2goeyBuYW1lOiBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0sIGNvdW50OiAxIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBzaW5nbGUgZml4IHJlY29yZCBpZiBzdGlsbCB1bmRlciB0aGUgbWF4U2luZ2xlRmxhcmVDb3VudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbC5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnNpbmdsZXMucHVzaChvYmopO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc2luZ2xlcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBub3QgY2x1c3RlcmVkIHNvIGp1c3QgYWRkIGV2ZXJ5IG9ialxyXG4gICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlU2luZ2xlKG9iaik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLmNsdXN0ZXJDb3VudCA8IHRoaXMuY2x1c3Rlck1pbkNvdW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDAsIGpsZW4gPSB0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uc2luZ2xlcy5sZW5ndGg7IGogPCBqbGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlU2luZ2xlKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5zaW5nbGVzW2pdKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uY2x1c3RlckNvdW50ID4gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNsdXN0ZXIodGhpcy5fZ3JpZENsdXN0ZXJzW2ldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZW1pdCBhbiBldmVudCB0byBzaWduYWwgZHJhd2luZyBpcyBjb21wbGV0ZS4gZW1pdCBpcyBub3QgaW4gdHlwaW5ncyBmb3IgZ3JhcGhpY3MgbGF5ZXJzLCBzbyB1c2UgW10ncyB0byBhY2Nlc3MuXHJcbiAgICAgICAgdGhpc1tcImVtaXRcIl0oXCJkcmF3LWNvbXBsZXRlXCIsIHt9KTtcclxuICAgICAgICBjb25zb2xlLnRpbWVFbmQoYGRyYXctZGF0YS0ke3RoaXMuX2FjdGl2ZVZpZXcudHlwZX1gKTtcclxuICAgICAgICBcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU3VyZmFjZSgpO1xyXG4gICAgICAgIH0sIDEwKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9wYXNzZXNGaWx0ZXIob2JqOiBhbnkpOiBib29sZWFuIHtcclxuICAgICAgICBpZiAoIXRoaXMuZmlsdGVycyB8fCB0aGlzLmZpbHRlcnMubGVuZ3RoID09PSAwKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgICBsZXQgcGFzc2VzID0gdHJ1ZTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5maWx0ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBmaWx0ZXIgPSB0aGlzLmZpbHRlcnNbaV07XHJcbiAgICAgICAgICAgIGlmIChvYmpbZmlsdGVyLnByb3BlcnR5TmFtZV0gPT0gbnVsbCkgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBsZXQgdmFsRXhpc3RzID0gZmlsdGVyLnByb3BlcnR5VmFsdWVzLmluZGV4T2Yob2JqW2ZpbHRlci5wcm9wZXJ0eU5hbWVdKSAhPT0gLTE7XHJcbiAgICAgICAgICAgIGlmICh2YWxFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIHBhc3NlcyA9IGZpbHRlci5rZWVwT25seUlmVmFsdWVFeGlzdHM7IC8vIHRoZSB2YWx1ZSBleGlzdHMgc28gcmV0dXJuIHdoZXRoZXIgd2Ugc2hvdWxkIGJlIGtlZXBpbmcgaXQgb3Igbm90LlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKCF2YWxFeGlzdHMgJiYgZmlsdGVyLmtlZXBPbmx5SWZWYWx1ZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcGFzc2VzID0gZmFsc2U7IC8vIHJldHVybiBmYWxzZSBhcyB0aGUgdmFsdWUgZG9lc24ndCBleGlzdCwgYW5kIHdlIHNob3VsZCBvbmx5IGJlIGtlZXBpbmcgcG9pbnQgb2JqZWN0cyB3aGVyZSBpdCBkb2VzIGV4aXN0LlxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIXBhc3NlcykgcmV0dXJuIGZhbHNlOyAvLyBpZiBpdCBoYXNuJ3QgcGFzc2VkIGFueSBvZiB0aGUgZmlsdGVycyByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcGFzc2VzO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZVNpbmdsZShvYmopIHtcclxuICAgICAgICBsZXQgcG9pbnQgPSBuZXcgUG9pbnQoe1xyXG4gICAgICAgICAgICB4OiBvYmpbdGhpcy54UHJvcGVydHlOYW1lXSwgeTogb2JqW3RoaXMueVByb3BlcnR5TmFtZV0sIHo6IG9ialt0aGlzLnpQcm9wZXJ0eU5hbWVdXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICghcG9pbnQuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgIHBvaW50ID0gPFBvaW50PndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IocG9pbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludCxcclxuICAgICAgICAgICAgYXR0cmlidXRlczogb2JqXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGdyYXBoaWMucG9wdXBUZW1wbGF0ZSA9IHRoaXMuc2luZ2xlUG9wdXBUZW1wbGF0ZTtcclxuICAgICAgICBpZiAodGhpcy5zaW5nbGVSZW5kZXJlcikge1xyXG4gICAgICAgICAgICBsZXQgc3ltYm9sID0gdGhpcy5zaW5nbGVSZW5kZXJlci5nZXRTeW1ib2woZ3JhcGhpYywgdGhpcy5fYWN0aXZlVmlldyk7XHJcbiAgICAgICAgICAgIGdyYXBoaWMuc3ltYm9sID0gc3ltYm9sO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0aGlzLnNpbmdsZVN5bWJvbCkge1xyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHRoaXMuc2luZ2xlU3ltYm9sO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy8gbm8gc3ltYm9sb2d5IGZvciBzaW5nbGVzIGRlZmluZWQsIHVzZSB0aGUgZGVmYXVsdCBzeW1ib2wgZnJvbSB0aGUgY2x1c3RlciByZW5kZXJlclxyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHRoaXMuY2x1c3RlclJlbmRlcmVyLmRlZmF1bHRTeW1ib2w7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFkZChncmFwaGljKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2x1c3RlcihncmlkQ2x1c3RlcjogR3JpZENsdXN0ZXIpIHtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXIgPSBuZXcgQ2x1c3RlcigpO1xyXG4gICAgICAgIGNsdXN0ZXIuZ3JpZENsdXN0ZXIgPSBncmlkQ2x1c3RlcjtcclxuXHJcbiAgICAgICAgLy8gbWFrZSBzdXJlIGFsbCBnZW9tZXRyaWVzIGFkZGVkIHRvIEdyYXBoaWMgb2JqZWN0cyBhcmUgaW4gd2ViIG1lcmNhdG9yIG90aGVyd2lzZSB3cmFwIGFyb3VuZCBkb2Vzbid0IHdvcmsuXHJcbiAgICAgICAgbGV0IHBvaW50ID0gbmV3IFBvaW50KHsgeDogZ3JpZENsdXN0ZXIueCwgeTogZ3JpZENsdXN0ZXIueSB9KTtcclxuICAgICAgICBpZiAoIXBvaW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBwb2ludCA9IDxQb2ludD53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKHBvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBhdHRyaWJ1dGVzOiBhbnkgPSB7XHJcbiAgICAgICAgICAgIHg6IGdyaWRDbHVzdGVyLngsXHJcbiAgICAgICAgICAgIHk6IGdyaWRDbHVzdGVyLnksXHJcbiAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LFxyXG4gICAgICAgICAgICBpc0NsdXN0ZXI6IHRydWUsXHJcbiAgICAgICAgICAgIGNsdXN0ZXJPYmplY3Q6IGdyaWRDbHVzdGVyXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBhdHRyaWJ1dGVzLFxyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnRcclxuICAgICAgICB9KTtcclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbCA9IHRoaXMuY2x1c3RlclJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMpLnN5bWJvbDtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAwO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVySWQgPSBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljW1widWlkXCJdO1xyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuYXR0cmlidXRlcy5jbHVzdGVySWQgPSBjbHVzdGVyLmNsdXN0ZXJJZDtcclxuXHJcbiAgICAgICAgLy8gYWxzbyBjcmVhdGUgYSB0ZXh0IHN5bWJvbCB0byBkaXNwbGF5IHRoZSBjbHVzdGVyIGNvdW50XHJcbiAgICAgICAgbGV0IHRleHRTeW1ib2wgPSB0aGlzLnRleHRTeW1ib2wuY2xvbmUoKTtcclxuICAgICAgICB0ZXh0U3ltYm9sLnRleHQgPSBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQudG9TdHJpbmcoKTtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgIHRleHRTeW1ib2wuYW5nbGUgPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2x1c3Rlci50ZXh0R3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHBvaW50LFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgICAgICAgICBpc0NsdXN0ZXJUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaXNUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlcklkOiBjbHVzdGVyLmNsdXN0ZXJJZFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzeW1ib2w6IHRleHRTeW1ib2xcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gYWRkIGFuIGFyZWEgZ3JhcGhpYyB0byBkaXNwbGF5IHRoZSBib3VuZHMgb2YgdGhlIGNsdXN0ZXIgaWYgY29uZmlndXJlZCB0b1xyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSAmJiBncmlkQ2x1c3Rlci5wb2ludHMgJiYgZ3JpZENsdXN0ZXIucG9pbnRzLmxlbmd0aCA+IDApIHtcclxuXHJcbiAgICAgICAgICAgIGxldCBtcCA9IG5ldyBNdWx0aXBvaW50KCk7XHJcbiAgICAgICAgICAgIG1wLnBvaW50cyA9IGdyaWRDbHVzdGVyLnBvaW50cztcclxuICAgICAgICAgICAgbGV0IGFyZWE6IGFueSA9IGdlb21ldHJ5RW5naW5lLmNvbnZleEh1bGwobXAsIHRydWUpOyAvLyB1c2UgY29udmV4IGh1bGwgb24gdGhlIHBvaW50cyB0byBnZXQgdGhlIGJvdW5kYXJ5XHJcblxyXG4gICAgICAgICAgICBsZXQgYXJlYUF0dHI6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgIHg6IGdyaWRDbHVzdGVyLngsXHJcbiAgICAgICAgICAgICAgICB5OiBncmlkQ2x1c3Rlci55LFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVySWQ6IGNsdXN0ZXIuY2x1c3RlcklkLFxyXG4gICAgICAgICAgICAgICAgaXNDbHVzdGVyQXJlYTogdHJ1ZVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoYXJlYS5yaW5ncyAmJiBhcmVhLnJpbmdzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGxldCBhcmVhUG9seSA9IG5ldyBQb2x5Z29uKCk7IC8vIGhhZCB0byBjcmVhdGUgYSBuZXcgcG9seWdvbiBhbmQgZmlsbCBpdCB3aXRoIHRoZSByaW5nIG9mIHRoZSBjYWxjdWxhdGVkIGFyZWEgZm9yIFNjZW5lVmlldyB0byB3b3JrLlxyXG4gICAgICAgICAgICAgICAgYXJlYVBvbHkgPSBhcmVhUG9seS5hZGRSaW5nKGFyZWEucmluZ3NbMF0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghYXJlYVBvbHkuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJlYVBvbHkgPSA8UG9seWdvbj53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKGFyZWFQb2x5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyLmFyZWFHcmFwaGljID0gbmV3IEdyYXBoaWMoeyBnZW9tZXRyeTogYXJlYVBvbHksIGF0dHJpYnV0ZXM6IGFyZWFBdHRyIH0pO1xyXG4gICAgICAgICAgICAgICAgY2x1c3Rlci5hcmVhR3JhcGhpYy5zeW1ib2wgPSB0aGlzLmFyZWFSZW5kZXJlci5nZXRDbGFzc0JyZWFrSW5mbyhjbHVzdGVyLmFyZWFHcmFwaGljKS5zeW1ib2w7XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBhZGQgdGhlIGdyYXBoaWNzIGluIG9yZGVyICAgICAgICBcclxuICAgICAgICBpZiAoY2x1c3Rlci5hcmVhR3JhcGhpYyAmJiB0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhbHdheXNcIikge1xyXG4gICAgICAgICAgICB0aGlzLmFkZChjbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci5jbHVzdGVyR3JhcGhpYyk7XHJcbiAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci50ZXh0R3JhcGhpYyk7XHJcblxyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzW2NsdXN0ZXIuY2x1c3RlcklkXSA9IGNsdXN0ZXI7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudDogRXh0ZW50LCBleHRlbnRJc1VuaW9uZWQ6IGJvb2xlYW4pIHtcclxuXHJcbiAgICAgICAgLy8gZ2V0IHRoZSB0b3RhbCBhbW91bnQgb2YgZ3JpZCBzcGFjZXMgYmFzZWQgb24gdGhlIGhlaWdodCBhbmQgd2lkdGggb2YgdGhlIG1hcCAoZGl2aWRlIGl0IGJ5IGNsdXN0ZXJSYXRpbykgLSB0aGVuIGdldCB0aGUgZGVncmVlcyBmb3IgeCBhbmQgeSBcclxuICAgICAgICBsZXQgeENvdW50ID0gTWF0aC5yb3VuZCh0aGlzLl9hY3RpdmVWaWV3LndpZHRoIC8gdGhpcy5jbHVzdGVyUmF0aW8pO1xyXG4gICAgICAgIGxldCB5Q291bnQgPSBNYXRoLnJvdW5kKHRoaXMuX2FjdGl2ZVZpZXcuaGVpZ2h0IC8gdGhpcy5jbHVzdGVyUmF0aW8pO1xyXG5cclxuICAgICAgICAvLyBpZiB0aGUgZXh0ZW50IGhhcyBiZWVuIHVuaW9uZWQgZHVlIHRvIG5vcm1hbGl6YXRpb24sIGRvdWJsZSB0aGUgY291bnQgb2YgeCBpbiB0aGUgY2x1c3RlciBncmlkIGFzIHRoZSB1bmlvbmluZyB3aWxsIGhhbHZlIGl0LlxyXG4gICAgICAgIGlmIChleHRlbnRJc1VuaW9uZWQpIHtcclxuICAgICAgICAgICAgeENvdW50ICo9IDI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgeHcgPSAod2ViRXh0ZW50LnhtYXggLSB3ZWJFeHRlbnQueG1pbikgLyB4Q291bnQ7XHJcbiAgICAgICAgbGV0IHloID0gKHdlYkV4dGVudC55bWF4IC0gd2ViRXh0ZW50LnltaW4pIC8geUNvdW50O1xyXG5cclxuICAgICAgICBsZXQgZ3N4bWluLCBnc3htYXgsIGdzeW1pbiwgZ3N5bWF4O1xyXG5cclxuICAgICAgICAvLyBjcmVhdGUgYW4gYXJyYXkgb2YgY2x1c3RlcnMgdGhhdCBpcyBhIGdyaWQgb3ZlciB0aGUgdmlzaWJsZSBleHRlbnQuIEVhY2ggY2x1c3RlciBjb250YWlucyB0aGUgZXh0ZW50IChpbiB3ZWIgbWVyYykgdGhhdCBib3VuZHMgdGhlIGdyaWQgc3BhY2UgZm9yIGl0LlxyXG4gICAgICAgIHRoaXMuX2dyaWRDbHVzdGVycyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgeENvdW50OyBpKyspIHtcclxuICAgICAgICAgICAgZ3N4bWluID0gd2ViRXh0ZW50LnhtaW4gKyAoeHcgKiBpKTtcclxuICAgICAgICAgICAgZ3N4bWF4ID0gZ3N4bWluICsgeHc7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgeUNvdW50OyBqKyspIHtcclxuICAgICAgICAgICAgICAgIGdzeW1pbiA9IHdlYkV4dGVudC55bWluICsgKHloICogaik7XHJcbiAgICAgICAgICAgICAgICBnc3ltYXggPSBnc3ltaW4gKyB5aDtcclxuICAgICAgICAgICAgICAgIGxldCBleHQgPSB7IHhtaW46IGdzeG1pbiwgeG1heDogZ3N4bWF4LCB5bWluOiBnc3ltaW4sIHltYXg6IGdzeW1heCB9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ3JpZENsdXN0ZXJzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIGV4dGVudDogZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogMCxcclxuICAgICAgICAgICAgICAgICAgICBzdWJUeXBlQ291bnRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICBzaW5nbGVzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludHM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHg6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgeTogMFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICAgXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhbiBzdmcgc3VyZmFjZSBvbiB0aGUgdmlldyBpZiBpdCBkb2Vzbid0IGFscmVhZHkgZXhpc3RcclxuICAgICAqIEBwYXJhbSB2aWV3XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2NyZWF0ZVN1cmZhY2UoKSB7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UpIHJldHVybjtcclxuICAgICAgICBsZXQgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2xheWVyVmlldzJkLmNvbnRhaW5lci5lbGVtZW50LnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBzdXJmYWNlUGFyZW50RWxlbWVudCA9IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudEVsZW1lbnQgfHwgdGhpcy5fYWN0aXZlVmlldy5jYW52YXMucGFyZW50Tm9kZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlOiBhbnkgPSBnZnguY3JlYXRlU3VyZmFjZShzdXJmYWNlUGFyZW50RWxlbWVudCwgXCIwXCIsIFwiMFwiKTtcclxuICAgICAgICBzdXJmYWNlLmNvbnRhaW5lckdyb3VwID0gc3VyZmFjZS5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHBvc2l0aW9uOiBcImFic29sdXRlXCIsIHRvcDogXCIwXCIsIHpJbmRleDogLTEgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwidmlzaWJsZVwiKTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwiY2xhc3NcIiwgXCJmY2wtc3VyZmFjZVwiKTtcclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UgPSBzdXJmYWNlO1xyXG4gICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1BvaW50ZXJNb3ZlKGV2dCkge1xyXG5cclxuICAgICAgICBsZXQgbW91c2VQb3MgPSB0aGlzLl9nZXRNb3VzZVBvcyhldnQpO1xyXG4gICAgICAgXHJcbiAgICAgICAgLy8gaWYgdGhlcmUncyBhbiBhY3RpdmUgY2x1c3RlciBhbmQgdGhlIGN1cnJlbnQgc2NyZWVuIHBvcyBpcyB3aXRoaW4gdGhlIGJvdW5kcyBvZiB0aGF0IGNsdXN0ZXIncyBncm91cCBjb250YWluZXIsIGRvbid0IGRvIGFueXRoaW5nIG1vcmUuIFxyXG4gICAgICAgIC8vIFRPRE86IHdvdWxkIHByb2JhYmx5IGJlIGJldHRlciB0byBjaGVjayBpZiB0aGUgcG9pbnQgaXMgaW4gdGhlIGFjdHVhbCBjaXJjbGUgb2YgdGhlIGNsdXN0ZXIgZ3JvdXAgYW5kIGl0J3MgZmxhcmVzIGluc3RlYWQgb2YgdXNpbmcgdGhlIHJlY3RhbmdsYXIgYm91bmRpbmcgYm94LlxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVDbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIGxldCBiYm94ID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICAgICAgaWYgKGJib3gpIHtcclxuICAgICAgICAgICAgICAgIGlmIChtb3VzZVBvcy54ID49IGJib3gubGVmdCAmJiBtb3VzZVBvcy54IDw9IGJib3gucmlnaHQgJiYgbW91c2VQb3MueSA+PSBiYm94LnRvcCAmJiBtb3VzZVBvcy55IDw9IGJib3guYm90dG9tKSByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB2OiBNYXBWaWV3ID0gdGhpcy5fYWN0aXZlVmlldztcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlVmlldy5oaXRUZXN0KG1vdXNlUG9zKS50aGVuKChyZXNwb25zZSkgPT4ge1xyXG5cclxuICAgICAgICAgICAgbGV0IGdyYXBoaWNzID0gcmVzcG9uc2UucmVzdWx0cztcclxuICAgICAgICAgICAgaWYgKGdyYXBoaWNzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGdyYXBoaWNzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZyA9IGdyYXBoaWNzW2ldLmdyYXBoaWM7XHJcbiAgICAgICAgICAgICAgICBpZiAoZyAmJiAoZy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZCAhPSBudWxsICYmICFnLmF0dHJpYnV0ZXMuaXNDbHVzdGVyQXJlYSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2x1c3RlciA9IHRoaXMuX2NsdXN0ZXJzW2cuYXR0cmlidXRlcy5jbHVzdGVySWRdO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FjdGl2YXRlQ2x1c3RlcihjbHVzdGVyKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfYWN0aXZhdGVDbHVzdGVyKGNsdXN0ZXI6IENsdXN0ZXIpIHtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPT09IGNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuOyAvLyBhbHJlYWR5IGFjdGl2ZVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyID0gY2x1c3RlcjtcclxuICAgICAgICB0aGlzLl9pbml0U3VyZmFjZSgpO1xyXG4gICAgICAgIHRoaXMuX2luaXRDbHVzdGVyKCk7XHJcbiAgICAgICAgdGhpcy5faW5pdEZsYXJlcygpO1xyXG5cclxuICAgICAgICB0aGlzLl9oaWRlR3JhcGhpYyhbdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpY10pO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwiYWN0aXZhdGVkXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5fc2hvd0dyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci5hcmVhR3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiYWN0aXZhdGUgY2x1c3RlclwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9kZWFjdGl2YXRlQ2x1c3RlcigpIHtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKFt0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljXSk7XHJcbiAgICAgICAgdGhpcy5fcmVtb3ZlQ2xhc3NGcm9tRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hpZGVHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fY2xlYXJTdXJmYWNlKCk7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIkRFLWFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0U3VyZmFjZSgpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgaWYgKCFzdXJmYWNlKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBzcDogU2NyZWVuUG9pbnQgPSB0aGlzLl9hY3RpdmVWaWV3LnRvU2NyZWVuKDxQb2ludD50aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5KTtcclxuXHJcbiAgICAgICAgLy8gdG9TY3JlZW4oKSByZXR1cm5zIHRoZSB3cm9uZyB2YWx1ZSBmb3IgeCBpZiBhIDJkIG1hcCBoYXMgYmVlbiB3cmFwcGVkIGFyb3VuZCB0aGUgZ2xvYmUuIE5lZWQgdG8gY2hlY2sgYW5kIGNhdGVyIGZvciB0aGlzLiBJIHRoaW5rIHRoaXMgYSBidWcgaW4gdGhlIGFwaS5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICB2YXIgd3N3ID0gdGhpcy5fYWN0aXZlVmlldy5zdGF0ZS53b3JsZFNjcmVlbldpZHRoO1xyXG4gICAgICAgICAgICBsZXQgcmF0aW8gPSBwYXJzZUludCgoc3AueCAvIHdzdykudG9GaXhlZCgwKSk7IC8vIGdldCBhIHJhdGlvIHRvIGRldGVybWluZSBob3cgbWFueSB0aW1lcyB0aGUgbWFwIGhhcyBiZWVuIHdyYXBwZWQgYXJvdW5kLlxyXG4gICAgICAgICAgICBpZiAoc3AueCA8IDApIHtcclxuICAgICAgICAgICAgICAgIC8vIHggaXMgbGVzcyB0aGFuIDAsIFdURi4gTmVlZCB0byBhZGp1c3QgYnkgdGhlIHdvcmxkIHNjcmVlbiB3aWR0aC5cclxuICAgICAgICAgICAgICAgIHNwLnggKz0gd3N3ICogKHJhdGlvICogLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHNwLnggPiB3c3cpIHtcclxuICAgICAgICAgICAgICAgIC8vIHggaXMgdG9vIGJpZywgV1RGIGFzIHdlbGwsIGNhdGVyIGZvciBpdC5cclxuICAgICAgICAgICAgICAgIHNwLnggLT0gd3N3ICogcmF0aW87XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAxMSwgb3ZlcmZsb3c6IFwidmlzaWJsZVwiLCB3aWR0aDogXCIxcHhcIiwgaGVpZ2h0OiBcIjFweFwiLCBsZWZ0OiBzcC54ICsgXCJweFwiLCB0b3A6IHNwLnkgKyBcInB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwidmlzaWJsZVwiKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY2xlYXJTdXJmYWNlKCkge1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIHF1ZXJ5KFwiPlwiLCBzdXJmYWNlLmNvbnRhaW5lckdyb3VwLnJhd05vZGUpLmZvckVhY2goZG9tQ29uc3RydWN0LmRlc3Ryb3kpO1xyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAtMSwgb3ZlcmZsb3c6IFwiaGlkZGVuXCIsIHRvcDogXCIwcHhcIiwgbGVmdDogXCIwcHhcIiB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJoaWRkZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdENsdXN0ZXIoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgaWYgKCFzdXJmYWNlKSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vIHdlJ3JlIGdvaW5nIHRvIHJlcGxpY2F0ZSBhIGNsdXN0ZXIgZ3JhcGhpYyBpbiB0aGUgc3ZnIGVsZW1lbnQgd2UgYWRkZWQgdG8gdGhlIGxheWVyIHZpZXcuIEp1c3Qgc28gaXQgY2FuIGJlIHN0eWxlZCBlYXNpbHkuIE5hdGl2ZSBXZWJHTCBmb3IgU2NlbmUgVmlld3Mgd291bGQgcHJvYmFibHkgYmUgYmV0dGVyLCBidXQgYXQgbGVhc3QgdGhpcyB3YXkgY3NzIGNhbiBzdGlsbCBiZSB1c2VkIHRvIHN0eWxlL2FuaW1hdGUgdGhpbmdzLlxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwID0gc3VyZmFjZS5jb250YWluZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUsIFwiY2x1c3Rlci1ncm91cFwiKTtcclxuXHJcbiAgICAgICAgLy8gY3JlYXRlIHRoZSBjbHVzdGVyIHNoYXBlXHJcbiAgICAgICAgbGV0IGNsb25lZENsdXN0ZXJFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChjbG9uZWRDbHVzdGVyRWxlbWVudCwgXCJjbHVzdGVyXCIpO1xyXG5cclxuICAgICAgICAvLyBjcmVhdGUgdGhlIGNsdXN0ZXIgdGV4dCBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRUZXh0RWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkVGV4dEVsZW1lbnQsIFwiY2x1c3Rlci10ZXh0XCIpO1xyXG4gICAgICAgIGNsb25lZFRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChjbG9uZWRDbHVzdGVyRWxlbWVudCk7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChjbG9uZWRUZXh0RWxlbWVudCk7XHJcblxyXG4gICAgICAgIC8vIHNldCB0aGUgZ3JvdXAgZWxlbWVudHMgY2xhc3MgICAgIFxyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUsIFwiYWN0aXZhdGVkXCIsIDEwKTtcclxuXHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2luaXRGbGFyZXMoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyIHx8ICF0aGlzLmRpc3BsYXlGbGFyZXMpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IGdyaWRDbHVzdGVyID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5ncmlkQ2x1c3RlcjtcclxuXHJcbiAgICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBjcmVhdGUgZmxhcmVzIGZvciB0aGUgY2x1c3RlclxyXG4gICAgICAgIGxldCBzaW5nbGVGbGFyZXMgPSAoZ3JpZENsdXN0ZXIuc2luZ2xlcyAmJiBncmlkQ2x1c3Rlci5zaW5nbGVzLmxlbmd0aCA+IDApICYmIChncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KTtcclxuICAgICAgICBsZXQgc3ViVHlwZUZsYXJlcyA9ICFzaW5nbGVGbGFyZXMgJiYgKGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMgJiYgZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5sZW5ndGggPiAwKTtcclxuXHJcbiAgICAgICAgaWYgKCFzaW5nbGVGbGFyZXMgJiYgIXN1YlR5cGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuOyAvLyBubyBmbGFyZXMgcmVxdWlyZWRcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBmbGFyZXM6IEZsYXJlW10gPSBbXTtcclxuICAgICAgICBpZiAoc2luZ2xlRmxhcmVzKSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBncmlkQ2x1c3Rlci5zaW5nbGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZiA9IG5ldyBGbGFyZSgpO1xyXG4gICAgICAgICAgICAgICAgZi50b29sdGlwVGV4dCA9IGdyaWRDbHVzdGVyLnNpbmdsZXNbaV1bdGhpcy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eV07XHJcbiAgICAgICAgICAgICAgICBmLnNpbmdsZURhdGEgPSBncmlkQ2x1c3Rlci5zaW5nbGVzW2ldO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZVRleHQgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgZmxhcmVzLnB1c2goZik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoc3ViVHlwZUZsYXJlcykge1xyXG5cclxuICAgICAgICAgICAgLy8gc29ydCBzdWIgdHlwZXMgYnkgaGlnaGVzdCBjb3VudCBmaXJzdFxyXG4gICAgICAgICAgICB2YXIgc3ViVHlwZXMgPSBncmlkQ2x1c3Rlci5zdWJUeXBlQ291bnRzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBiLmNvdW50IC0gYS5jb3VudDtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gc3ViVHlwZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBmID0gbmV3IEZsYXJlKCk7XHJcbiAgICAgICAgICAgICAgICBmLnRvb2x0aXBUZXh0ID0gYCR7c3ViVHlwZXNbaV0ubmFtZX0gKCR7c3ViVHlwZXNbaV0uY291bnR9KWA7XHJcbiAgICAgICAgICAgICAgICBmLmZsYXJlVGV4dCA9IHN1YlR5cGVzW2ldLmNvdW50O1xyXG4gICAgICAgICAgICAgICAgZmxhcmVzLnB1c2goZik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGlmIHRoZXJlIGFyZSBtb3JlIGZsYXJlIG9iamVjdHMgdG8gY3JlYXRlIHRoYW4gdGhlIG1heEZsYXJlQ291bnQgYW5kIHRoaXMgaXMgb25lIG9mIHRob3NlIC0gY3JlYXRlIGEgc3VtbWFyeSBmbGFyZSB0aGF0IGNvbnRhaW5zICcuLi4nIGFzIHRoZSB0ZXh0LlxyXG4gICAgICAgIGxldCB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSA9IGZsYXJlcy5sZW5ndGggPiB0aGlzLm1heEZsYXJlQ291bnQ7XHJcbiAgICAgICAgbGV0IGZsYXJlQ291bnQgPSB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSA/IHRoaXMubWF4RmxhcmVDb3VudCA6IGZsYXJlcy5sZW5ndGg7XHJcblxyXG4gICAgICAgIC8vIGlmIHRoZXJlJ3MgYW4gZXZlbiBhbW91bnQgb2YgZmxhcmVzLCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgdG8gdGhlIGxlZnQsIG1pbnVzIDE4MCBmcm9tIGRlZ3JlZSB0byBkbyB0aGlzLlxyXG4gICAgICAgIC8vIGZvciBhbiBhZGQgYW1vdW50IHBvc2l0aW9uIHRoZSBmaXJzdCBmbGFyZSBvbiB0b3AsIC05MCB0byBkbyB0aGlzLiBMb29rcyBuaWNlciB0aGlzIHdheS5cclxuICAgICAgICBsZXQgZGVncmVlVmFyaWFuY2UgPSAoZmxhcmVDb3VudCAlIDIgPT09IDApID8gLTE4MCA6IC05MDtcclxuICAgICAgICBsZXQgdmlld1JvdGF0aW9uID0gdGhpcy5faXMyZCA/IHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24gOiAwO1xyXG5cclxuICAgICAgICBsZXQgY2x1c3RlclNjcmVlblBvaW50ID0gdGhpcy5fYWN0aXZlVmlldy50b1NjcmVlbig8UG9pbnQ+dGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSk7XHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTeW1ib2xTaXplID0gPG51bWJlcj50aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbC5nZXQoXCJzaXplXCIpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmxhcmVDb3VudDsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgZmxhcmUgPSBmbGFyZXNbaV07XHJcblxyXG4gICAgICAgICAgICAvLyBzZXQgc29tZSBhdHRyaWJ1dGUgZGF0YVxyXG4gICAgICAgICAgICBsZXQgZmxhcmVBdHRyaWJ1dGVzID0ge1xyXG4gICAgICAgICAgICAgICAgaXNGbGFyZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzU3VtbWFyeUZsYXJlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0OiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgZmxhcmVUZXh0R3JhcGhpYzogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckdyYXBoaWNJZDogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudFxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlVGV4dEF0dHJpYnV0ZXMgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIC8vIGRvIGEgY291cGxlIG9mIHRoaW5ncyBkaWZmZXJlbnRseSBpZiB0aGlzIGlzIGEgc3VtbWFyeSBmbGFyZSBvciBub3RcclxuICAgICAgICAgICAgbGV0IGlzU3VtbWFyeUZsYXJlID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgJiYgaSA+PSB0aGlzLm1heEZsYXJlQ291bnQgLSAxO1xyXG4gICAgICAgICAgICBpZiAoaXNTdW1tYXJ5RmxhcmUpIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmlzU3VtbWFyeSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBmbGFyZUF0dHJpYnV0ZXMuaXNTdW1tYXJ5RmxhcmUgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgbGV0IHRvb2x0aXBUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIC8vIG11bHRpbGluZSB0b29sdGlwIGZvciBzdW1tYXJ5IGZsYXJlcywgaWU6IGdyZWF0ZXIgdGhhbiB0aGlzLm1heEZsYXJlQ291bnQgZmxhcmVzIHBlciBjbHVzdGVyXHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gdGhpcy5tYXhGbGFyZUNvdW50IC0gMSwgamxlbiA9IGZsYXJlcy5sZW5ndGg7IGogPCBqbGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB0b29sdGlwVGV4dCArPSBqID4gKHRoaXMubWF4RmxhcmVDb3VudCAtIDEpID8gXCJcXG5cIiA6IFwiXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHRpcFRleHQgKz0gZmxhcmVzW2pdLnRvb2x0aXBUZXh0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZmxhcmUudG9vbHRpcFRleHQgPSB0b29sdGlwVGV4dDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZmxhcmVBdHRyaWJ1dGVzLnRvb2x0aXBUZXh0ID0gZmxhcmUudG9vbHRpcFRleHQ7XHJcblxyXG4gICAgICAgICAgICAvLyBjcmVhdGUgYSBncmFwaGljIGZvciB0aGUgZmxhcmUgYW5kIGZvciB0aGUgZmxhcmUgdGV4dFxyXG4gICAgICAgICAgICBmbGFyZS5ncmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlczogZmxhcmVBdHRyaWJ1dGVzLFxyXG4gICAgICAgICAgICAgICAgZ2VvbWV0cnk6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnksXHJcbiAgICAgICAgICAgICAgICBwb3B1cFRlbXBsYXRlOiBudWxsXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLl9nZXRGbGFyZVN5bWJvbChmbGFyZS5ncmFwaGljKTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBmbGFyZS5ncmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMDtcclxuICAgICAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgICAgIGlmIChmbGFyZS5mbGFyZVRleHQpIHtcclxuICAgICAgICAgICAgICAgIGxldCB0ZXh0U3ltYm9sID0gdGhpcy5mbGFyZVRleHRTeW1ib2wuY2xvbmUoKTtcclxuICAgICAgICAgICAgICAgIHRleHRTeW1ib2wudGV4dCA9ICFpc1N1bW1hcnlGbGFyZSA/IGZsYXJlLmZsYXJlVGV4dC50b1N0cmluZygpIDogXCIuLi5cIjtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dFN5bWJvbC5hbmdsZSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgZmxhcmUudGV4dEdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1RleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJHcmFwaGljSWQ6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlcklkXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzeW1ib2w6IHRleHRTeW1ib2wsXHJcbiAgICAgICAgICAgICAgICAgICAgZ2VvbWV0cnk6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnlcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBmbGFyZXMgaGF2ZSBiZWVuIGNyZWF0ZWQgc28gYWRkIHRoZW0gdG8gdGhlIGRvbVxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBmbGFyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGYgPSBmbGFyZXNbaV07XHJcbiAgICAgICAgICAgIGlmICghZi5ncmFwaGljKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZSBhIGdyb3VwIHRvIGhvbGQgZmxhcmUgb2JqZWN0IGFuZCB0ZXh0IGlmIG5lZWRlZC4gXHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cCA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgICAgICBsZXQgcG9zaXRpb24gPSB0aGlzLl9zZXRGbGFyZVBvc2l0aW9uKGYuZmxhcmVHcm91cCwgY2x1c3RlclN5bWJvbFNpemUsIGZsYXJlQ291bnQsIGksIGRlZ3JlZVZhcmlhbmNlLCB2aWV3Um90YXRpb24pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwiZmxhcmUtZ3JvdXBcIik7XHJcbiAgICAgICAgICAgIGxldCBmbGFyZUVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWMoZi5ncmFwaGljLCBmLmZsYXJlR3JvdXApO1xyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChmbGFyZUVsZW1lbnQpO1xyXG4gICAgICAgICAgICBpZiAoZi50ZXh0R3JhcGhpYykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGZsYXJlVGV4dEVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWMoZi50ZXh0R3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgICAgIGZsYXJlVGV4dEVsZW1lbnQuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVUZXh0RWxlbWVudCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgICAgICAgICAvLyBhc3NpZ24gc29tZSBldmVudCBoYW5kbGVycyBmb3IgdGhlIHRvb2x0aXBzXHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5tb3VzZUVudGVyID0gb24ucGF1c2FibGUoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwibW91c2VlbnRlclwiLCAoKSA9PiB0aGlzLl9jcmVhdGVUb29sdGlwKGYpKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLm1vdXNlTGVhdmUgPSBvbi5wYXVzYWJsZShmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJtb3VzZWxlYXZlXCIsICgpID0+IHRoaXMuX2Rlc3Ryb3lUb29sdGlwKCkpO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NldEZsYXJlUG9zaXRpb24oZmxhcmVHcm91cDogYW55LCBjbHVzdGVyU3ltYm9sU2l6ZTogbnVtYmVyLCBmbGFyZUNvdW50OiBudW1iZXIsIGZsYXJlSW5kZXg6IG51bWJlciwgZGVncmVlVmFyaWFuY2U6IG51bWJlciwgdmlld1JvdGF0aW9uOiBudW1iZXIpIHtcclxuXHJcbiAgICAgICAgLy8gZ2V0IHRoZSBwb3NpdGlvbiBvZiB0aGUgZmxhcmUgdG8gYmUgcGxhY2VkIGFyb3VuZCB0aGUgY29udGFpbmVyIGNpcmNsZS5cclxuICAgICAgICBsZXQgZGVncmVlID0gcGFyc2VJbnQoKCgzNjAgLyBmbGFyZUNvdW50KSAqIGZsYXJlSW5kZXgpLnRvRml4ZWQoKSk7XHJcbiAgICAgICAgZGVncmVlID0gZGVncmVlICsgZGVncmVlVmFyaWFuY2U7XHJcblxyXG4gICAgICAgIC8vIHRha2UgaW50byBhY2NvdW50IGFueSByb3RhdGlvbiBvbiB0aGUgdmlld1xyXG4gICAgICAgIGlmICh2aWV3Um90YXRpb24gIT09IDApIHtcclxuICAgICAgICAgICAgZGVncmVlIC09IHZpZXdSb3RhdGlvbjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciByYWRpYW4gPSBkZWdyZWUgKiAoTWF0aC5QSSAvIDE4MCk7XHJcbiAgICAgICAgbGV0IGJ1ZmZlciA9IHRoaXMuZmxhcmVCdWZmZXJQaXhlbHM7XHJcblxyXG4gICAgICAgIC8vIHBvc2l0aW9uIHRoZSBmbGFyZSBncm91cCBhcm91bmQgdGhlIGNsdXN0ZXJcclxuICAgICAgICBsZXQgcG9zaXRpb24gPSB7XHJcbiAgICAgICAgICAgIHg6IChidWZmZXIgKyBjbHVzdGVyU3ltYm9sU2l6ZSkgKiBNYXRoLmNvcyhyYWRpYW4pLFxyXG4gICAgICAgICAgICB5OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5zaW4ocmFkaWFuKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmxhcmVHcm91cC5zZXRUcmFuc2Zvcm0oeyBkeDogcG9zaXRpb24ueCwgZHk6IHBvc2l0aW9uLnkgfSk7XHJcbiAgICAgICAgcmV0dXJuIHBvc2l0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldEZsYXJlU3ltYm9sKGZsYXJlR3JhcGhpYzogR3JhcGhpYyk6IFNpbXBsZU1hcmtlclN5bWJvbCB7XHJcbiAgICAgICAgcmV0dXJuICF0aGlzLmZsYXJlUmVuZGVyZXIgPyB0aGlzLmZsYXJlU3ltYm9sIDogdGhpcy5mbGFyZVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGZsYXJlR3JhcGhpYykuc3ltYm9sO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZVRvb2x0aXAoZmxhcmU6IEZsYXJlKSB7XHJcblxyXG4gICAgICAgIGxldCBmbGFyZUdyb3VwID0gZmxhcmUuZmxhcmVHcm91cDtcclxuICAgICAgICB0aGlzLl9kZXN0cm95VG9vbHRpcCgpO1xyXG5cclxuICAgICAgICBsZXQgdG9vbHRpcExlbmd0aCA9IHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCBmbGFyZUdyb3VwLnJhd05vZGUpLmxlbmd0aDtcclxuICAgICAgICBpZiAodG9vbHRpcExlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZ2V0IHRoZSB0ZXh0IGZyb20gdGhlIGRhdGEtdG9vbHRpcCBhdHRyaWJ1dGUgb2YgdGhlIHNoYXBlIG9iamVjdFxyXG4gICAgICAgIGxldCB0ZXh0ID0gZmxhcmUudG9vbHRpcFRleHQ7XHJcbiAgICAgICAgaWYgKCF0ZXh0KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibm8gdG9vbHRpcCB0ZXh0IGZvciBmbGFyZS5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHNwbGl0IG9uIFxcbiBjaGFyYWN0ZXIgdGhhdCBzaG91bGQgYmUgaW4gdG9vbHRpcCB0byBzaWduaWZ5IG11bHRpcGxlIGxpbmVzXHJcbiAgICAgICAgbGV0IGxpbmVzID0gdGV4dC5zcGxpdChcIlxcblwiKTtcclxuXHJcbiAgICAgICAgLy8gY3JlYXRlIGEgZ3JvdXAgdG8gaG9sZCB0aGUgdG9vbHRpcCBlbGVtZW50c1xyXG4gICAgICAgIGxldCB0b29sdGlwR3JvdXAgPSBmbGFyZUdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIC8vIGdldCB0aGUgZmxhcmUgc3ltYm9sLCB3ZSdsbCB1c2UgdGhpcyB0byBzdHlsZSB0aGUgdG9vbHRpcCBib3hcclxuICAgICAgICBsZXQgZmxhcmVTeW1ib2wgPSB0aGlzLl9nZXRGbGFyZVN5bWJvbChmbGFyZS5ncmFwaGljKTtcclxuXHJcbiAgICAgICAgLy8gYWxpZ24gb24gdG9wIGZvciBub3JtYWwgZmxhcmUsIGFsaWduIG9uIGJvdHRvbSBmb3Igc3VtbWFyeSBmbGFyZXMuXHJcbiAgICAgICAgbGV0IGhlaWdodCA9IGZsYXJlU3ltYm9sLnNpemU7XHJcblxyXG4gICAgICAgIGxldCB4UG9zID0gMTtcclxuICAgICAgICBsZXQgeVBvcyA9ICFmbGFyZS5pc1N1bW1hcnkgPyAoKGhlaWdodCkgKiAtMSkgOiBoZWlnaHQgKyA1O1xyXG5cclxuICAgICAgICB0b29sdGlwR3JvdXAucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcInRvb2x0aXAtdGV4dFwiKTtcclxuICAgICAgICBsZXQgdGV4dFNoYXBlcyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cclxuICAgICAgICAgICAgbGV0IHRleHRTaGFwZSA9IHRvb2x0aXBHcm91cC5jcmVhdGVUZXh0KHsgeDogeFBvcywgeTogeVBvcyArIChpICogMTApLCB0ZXh0OiBsaW5lc1tpXSwgYWxpZ246ICdtaWRkbGUnIH0pXHJcbiAgICAgICAgICAgICAgICAuc2V0RmlsbCh0aGlzLmZsYXJlVGV4dFN5bWJvbC5jb2xvcilcclxuICAgICAgICAgICAgICAgIC5zZXRGb250KHsgc2l6ZTogMTAsIGZhbWlseTogdGhpcy5mbGFyZVRleHRTeW1ib2wuZm9udC5nZXQoXCJmYW1pbHlcIiksIHdlaWdodDogdGhpcy5mbGFyZVRleHRTeW1ib2wuZm9udC5nZXQoXCJ3ZWlnaHRcIikgfSk7XHJcblxyXG4gICAgICAgICAgICB0ZXh0U2hhcGVzLnB1c2godGV4dFNoYXBlKTtcclxuICAgICAgICAgICAgdGV4dFNoYXBlLnJhd05vZGUuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHJlY3RQYWRkaW5nID0gMjtcclxuICAgICAgICBsZXQgdGV4dEJveCA9IHRvb2x0aXBHcm91cC5nZXRCb3VuZGluZ0JveCgpO1xyXG5cclxuICAgICAgICBsZXQgcmVjdFNoYXBlID0gdG9vbHRpcEdyb3VwLmNyZWF0ZVJlY3QoeyB4OiB0ZXh0Qm94LnggLSByZWN0UGFkZGluZywgeTogdGV4dEJveC55IC0gcmVjdFBhZGRpbmcsIHdpZHRoOiB0ZXh0Qm94LndpZHRoICsgKHJlY3RQYWRkaW5nICogMiksIGhlaWdodDogdGV4dEJveC5oZWlnaHQgKyAocmVjdFBhZGRpbmcgKiAyKSwgcjogMCB9KVxyXG4gICAgICAgICAgICAuc2V0RmlsbChmbGFyZVN5bWJvbC5jb2xvcik7XHJcblxyXG4gICAgICAgIGlmIChmbGFyZVN5bWJvbC5vdXRsaW5lKSB7XHJcbiAgICAgICAgICAgIHJlY3RTaGFwZS5zZXRTdHJva2UoeyBjb2xvcjogZmxhcmVTeW1ib2wub3V0bGluZS5jb2xvciwgd2lkdGg6IDAuNSB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlY3RTaGFwZS5yYXdOb2RlLnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuXHJcbiAgICAgICAgZmxhcmVHcm91cC5tb3ZlVG9Gcm9udCgpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0ZXh0U2hhcGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRleHRTaGFwZXNbaV0ubW92ZVRvRnJvbnQoKTtcclxuICAgICAgICB9ICAgICAgICBcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGVzdHJveVRvb2x0aXAoKSB7XHJcbiAgICAgICAgcXVlcnkoXCIudG9vbHRpcC10ZXh0XCIsIHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZS5yYXdOb2RlKS5mb3JFYWNoKGRvbUNvbnN0cnVjdC5kZXN0cm95KTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLy8gI3JlZ2lvbiBoZWxwZXIgZnVuY3Rpb25zXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMsIHN1cmZhY2U6IGFueSk6IEhUTUxFbGVtZW50IHtcclxuXHJcbiAgICAgICAgLy8gZmFrZSBvdXQgYSBHRlhPYmplY3Qgc28gd2UgY2FuIGdlbmVyYXRlIGFuIHN2ZyBzaGFwZSB0aGF0IHRoZSBwYXNzZWQgaW4gZ3JhcGhpY3Mgc2hhcGVcclxuICAgICAgICBsZXQgZyA9IG5ldyBHRlhPYmplY3QoKTtcclxuICAgICAgICBnLmdyYXBoaWMgPSBncmFwaGljO1xyXG4gICAgICAgIGcucmVuZGVyaW5nSW5mbyA9IHsgc3ltYm9sOiBncmFwaGljLnN5bWJvbCB9O1xyXG5cclxuICAgICAgICAvLyBzZXQgdXAgcGFyYW1ldGVycyBmb3IgdGhlIGNhbGwgdG8gcmVuZGVyXHJcbiAgICAgICAgLy8gc2V0IHRoZSB0cmFuc2Zvcm0gb2YgdGhlIHByb2plY3RvciB0byAwJ3MgYXMgd2UncmUganVzdCBwbGFjaW5nIHRoZSBnZW5lcmF0ZWQgY2x1c3RlciBzaGFwZSBhdCBleGFjdGx5IDAsMC5cclxuICAgICAgICBsZXQgcHJvamVjdG9yID0gbmV3IFByb2plY3RvcigpO1xyXG4gICAgICAgIHByb2plY3Rvci5fdHJhbnNmb3JtID0gWzAsIDAsIDAsIDAsIDAsIDBdO1xyXG4gICAgICAgIHByb2plY3Rvci5fcmVzb2x1dGlvbiA9IDA7XHJcblxyXG4gICAgICAgIGxldCBzdGF0ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICBzdGF0ZSA9IHRoaXMuX2FjdGl2ZVZpZXcuc3RhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBmYWtlIG91dCBhIHN0YXRlIG9iamVjdCBmb3IgM2Qgdmlld3MuXHJcbiAgICAgICAgICAgIHN0YXRlID0ge1xyXG4gICAgICAgICAgICAgICAgY2xpcHBlZEV4dGVudDogdGhpcy5fYWN0aXZlVmlldy5leHRlbnQsXHJcbiAgICAgICAgICAgICAgICByb3RhdGlvbjogMCxcclxuICAgICAgICAgICAgICAgIHNwYXRpYWxSZWZlcmVuY2U6IHRoaXMuX2FjdGl2ZVZpZXcuc3BhdGlhbFJlZmVyZW5jZSxcclxuICAgICAgICAgICAgICAgIHdvcmxkU2NyZWVuV2lkdGg6IDFcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBwYXIgPSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2U6IHN1cmZhY2UsXHJcbiAgICAgICAgICAgIHN0YXRlOiBzdGF0ZSxcclxuICAgICAgICAgICAgcHJvamVjdG9yOiBwcm9qZWN0b3JcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBnLmRvUmVuZGVyKHBhcik7XHJcblxyXG4gICAgICAgIC8vIG5lZWQgdG8gZml4IHVwIHRoZSB0cmFuc2Zvcm0gb2YgdGhlIG5ldyBzaGFwZS4gVGV4dCBzeW1ib2xzIHNlZW0gdG8gZ2V0IGEgYml0IG91dCBvZiB3aGFjay5cclxuICAgICAgICBsZXQgeW9mZnNldCA9IGdyYXBoaWMuc3ltYm9sW1wieW9mZnNldFwiXSA/IGdyYXBoaWMuc3ltYm9sW1wieW9mZnNldFwiXSAqIC0xIDogMDtcclxuICAgICAgICBsZXQgeG9mZnNldCA9IGdyYXBoaWMuc3ltYm9sW1wieG9mZnNldFwiXSA/IGdyYXBoaWMuc3ltYm9sW1wieG9mZnNldFwiXSAqIC0xIDogMDtcclxuICAgICAgICBnLl9zaGFwZS5zZXRUcmFuc2Zvcm0oeyB4eDogMSwgeXk6IDEsIGR5OiB5b2Zmc2V0LCBkeDogeG9mZnNldCB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZy5fc2hhcGUucmF3Tm9kZTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfZXh0ZW50KCk6IEV4dGVudCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVZpZXcgPyB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zY2FsZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5zY2FsZSA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIElFIC8gRWRnZSBkb24ndCBoYXZlIHRoZSBjbGFzc0xpc3QgcHJvcGVydHkgb24gc3ZnIGVsZW1lbnRzLCBzbyB3ZSBjYW4ndCB1c2UgdGhhdCBhZGQgLyByZW1vdmUgY2xhc3NlcyAtIHByb2JhYmx5IHdoeSBkb2pvIGRvbUNsYXNzIGRvZXNuJ3Qgd29yayBlaXRoZXIuXHJcbiAgICAgICBzbyB0aGUgZm9sbG93aW5nIHR3byBmdW5jdGlvbnMgYXJlIGRvZGd5IHN0cmluZyBoYWNrcyB0byBhZGQgLyByZW1vdmUgY2xhc3Nlcy4gVXNlcyBhIHRpbWVvdXQgc28geW91IGNhbiBtYWtlIGNzcyB0cmFuc2l0aW9ucyB3b3JrIGlmIGRlc2lyZWQuXHJcbiAgICAgKiBAcGFyYW0gZWxlbWVudFxyXG4gICAgICogQHBhcmFtIGNsYXNzTmFtZVxyXG4gICAgICogQHBhcmFtIHRpbWVvdXRNc1xyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2FkZENsYXNzVG9FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCBhZGRDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgY3VycmVudENsYXNzID0gXCJcIjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgIT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIGxldCBuZXdDbGFzcyA9IChjdXJyZW50Q2xhc3MgKyBcIiBcIiArIF9jbGFzc05hbWUpLnRyaW0oKTtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgbmV3Q2xhc3MpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGFkZENsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9yZW1vdmVDbGFzc0Zyb21FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCByZW1vdmVDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgcmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudENsYXNzLmluZGV4T2YoXCIgXCIgKyBfY2xhc3NOYW1lKSA9PT0gLTEpIHJldHVybjtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgY3VycmVudENsYXNzLnJlcGxhY2UoXCIgXCIgKyBfY2xhc3NOYW1lLCBcIlwiKSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKHRpbWVvdXRNcykge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCB0aW1lb3V0TXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmVtb3ZlQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldE1vdXNlUG9zKGV2dCkge1xyXG4gICAgICAgIC8vIGNvbnRhaW5lciBvbiB0aGUgdmlldyBpcyBhY3R1YWxseSBhIGh0bWwgZWxlbWVudCBhdCB0aGlzIHBvaW50LCBub3QgYSBzdHJpbmcgYXMgdGhlIHR5cGluZ3Mgc3VnZ2VzdC5cclxuICAgICAgICBsZXQgY29udGFpbmVyOiBhbnkgPSB0aGlzLl9hY3RpdmVWaWV3LmNvbnRhaW5lcjtcclxuICAgICAgICBsZXQgcmVjdCA9IGNvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB4OiBldnQueCAtIHJlY3QubGVmdCxcclxuICAgICAgICAgICAgeTogZXZ0LnkgLSByZWN0LnRvcFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0dGluZyB2aXNpYmxlIHRvIGZhbHNlIG9uIGEgZ3JhcGhpYyBkb2Vzbid0IHdvcmsgaW4gNC4yIGZvciBzb21lIHJlYXNvbi4gUmVtb3ZpbmcgdGhlIGdyYXBoaWMgdG8gaGlkZSBpdCBpbnN0ZWFkLiBJIHRoaW5rIHZpc2libGUgcHJvcGVydHkgc2hvdWxkIHByb2JhYmx5IHdvcmsgdGhvdWdoLlxyXG4gICAgICogQHBhcmFtIGdyYXBoaWNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfaGlkZUdyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYyB8IEdyYXBoaWNbXSkge1xyXG4gICAgICAgIGlmICghZ3JhcGhpYykgcmV0dXJuO1xyXG4gICAgICAgIGlmIChncmFwaGljLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTWFueSg8R3JhcGhpY1tdPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmUoPEdyYXBoaWM+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Nob3dHcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMgfCBHcmFwaGljW10pIHtcclxuICAgICAgICBpZiAoIWdyYXBoaWMpIHJldHVybjtcclxuICAgICAgICBpZiAoZ3JhcGhpYy5oYXNPd25Qcm9wZXJ0eShcImxlbmd0aFwiKSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZE1hbnkoPEdyYXBoaWNbXT5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKDxHcmFwaGljPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyNlbmRyZWdpb25cclxuXHJcbn1cclxuXHJcblxyXG4vLyBpbnRlcmZhY2UgQWN0aXZlVmlldyBleHRlbmRzIE1hcFZpZXcgYW5kIFNjZW5lVmlldyB0byBhZGQgc29tZSBwcm9wZXJ0aWVzIHtcclxuaW50ZXJmYWNlIEFjdGl2ZVZpZXcgZXh0ZW5kcyBNYXBWaWV3LCBTY2VuZVZpZXcge1xyXG4gICAgY2FudmFzOiBhbnk7XHJcbiAgICBzdGF0ZTogYW55O1xyXG4gICAgZmNsU3VyZmFjZTogYW55O1xyXG4gICAgZmNsUG9pbnRlck1vdmU6IElIYW5kbGU7XHJcbiAgICBmY2xQb2ludGVyRG93bjogSUhhbmRsZTtcclxuXHJcbiAgICBjb25zdHJhaW50czogYW55O1xyXG4gICAgZ29UbzogKHRhcmdldDogYW55LCBvcHRpb25zOiBfX2VzcmkuTWFwVmlld0dvVG9PcHRpb25zKSA9PiBJUHJvbWlzZTxhbnk+O1xyXG4gICAgdG9NYXA6IChzY3JlZW5Qb2ludDogU2NyZWVuUG9pbnQpID0+IFBvaW50O1xyXG59XHJcblxyXG5jbGFzcyBHcmlkQ2x1c3RlciB7XHJcbiAgICBleHRlbnQ6IGFueTtcclxuICAgIGNsdXN0ZXJDb3VudDogbnVtYmVyO1xyXG4gICAgc3ViVHlwZUNvdW50czogYW55W10gPSBbXTtcclxuICAgIHNpbmdsZXM6IGFueVtdID0gW107XHJcbiAgICBwb2ludHM6IGFueVtdID0gW107XHJcbiAgICB4OiBudW1iZXI7XHJcbiAgICB5OiBudW1iZXI7XHJcbn1cclxuXHJcblxyXG5jbGFzcyBDbHVzdGVyIHtcclxuICAgIGNsdXN0ZXJHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgdGV4dEdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICBhcmVhR3JhcGhpYzogR3JhcGhpYztcclxuICAgIGNsdXN0ZXJJZDogbnVtYmVyO1xyXG4gICAgY2x1c3Rlckdyb3VwOiBhbnk7XHJcbiAgICBncmlkQ2x1c3RlcjogR3JpZENsdXN0ZXI7XHJcbn1cclxuXHJcbmNsYXNzIEZsYXJlIHtcclxuICAgIGdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0ZXh0R3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRvb2x0aXBUZXh0OiBzdHJpbmc7XHJcbiAgICBmbGFyZVRleHQ6IHN0cmluZzsgXHJcbiAgICBzaW5nbGVEYXRhOiBhbnlbXTtcclxuICAgIGZsYXJlR3JvdXA6IGFueTtcclxuICAgIGlzU3VtbWFyeTogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFBvaW50RmlsdGVyIHtcclxuICAgIGZpbHRlck5hbWU6IHN0cmluZztcclxuICAgIHByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG4gICAgcHJvcGVydHlWYWx1ZXM6IGFueVtdO1xyXG5cclxuICAgIC8vIGRldGVybWluZXMgd2hldGhlciB0aGUgZmlsdGVyIGluY2x1ZGVzIG9yIGV4Y2x1ZGVzIHRoZSBwb2ludCBkZXBlbmRpbmcgb24gd2hldGhlciBpdCBjb250YWlucyB0aGUgcHJvcGVydHkgdmFsdWUuXHJcbiAgICAvLyBmYWxzZSBtZWFucyB0aGUgcG9pbnQgd2lsbCBiZSBleGNsdWRlZCBpZiB0aGUgdmFsdWUgZG9lcyBleGlzdCBpbiB0aGUgb2JqZWN0LCB0cnVlIG1lYW5zIGl0IHdpbGwgYmUgZXhjbHVkZWQgaWYgaXQgZG9lc24ndC5cclxuICAgIGtlZXBPbmx5SWZWYWx1ZUV4aXN0czogYm9vbGVhbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihmaWx0ZXJOYW1lOiBzdHJpbmcsIHByb3BlcnR5TmFtZTogc3RyaW5nLCB2YWx1ZXM6IGFueVtdLCBrZWVwT25seUlmVmFsdWVFeGlzdHM6IGJvb2xlYW4gPSBmYWxzZSkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVyTmFtZSA9IGZpbHRlck5hbWU7XHJcbiAgICAgICAgdGhpcy5wcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eU5hbWU7XHJcbiAgICAgICAgdGhpcy5wcm9wZXJ0eVZhbHVlcyA9IHZhbHVlcztcclxuICAgICAgICB0aGlzLmtlZXBPbmx5SWZWYWx1ZUV4aXN0cyA9IGtlZXBPbmx5SWZWYWx1ZUV4aXN0cztcclxuICAgIH1cclxuXHJcbn1cclxuXHJcbiJdfQ==
