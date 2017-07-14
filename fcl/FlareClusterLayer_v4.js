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
    var FlareClusterLayer = (function (_super) {
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
    var GridCluster = (function () {
        function GridCluster() {
            this.subTypeCounts = [];
            this.singles = [];
            this.points = [];
        }
        return GridCluster;
    }());
    var Cluster = (function () {
        function Cluster() {
        }
        return Cluster;
    }());
    var Flare = (function () {
        function Flare() {
        }
        return Flare;
    }());
    var PointFilter = (function () {
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvRmxhcmVDbHVzdGVyTGF5ZXJfdjQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOENBQThDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQTJFOUMsMERBQTBEO0lBRTFEO1FBQXVDLHFDQUEyQjtRQW9EOUQsMkJBQVksT0FBb0M7WUFBaEQsWUFFSSxrQkFBTSxPQUFPLENBQUMsU0EyRWpCO1lBMUZPLG9CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBTzNCLGVBQVMsR0FBc0MsRUFBRSxDQUFDO1lBVXRELG1CQUFtQjtZQUNuQixFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsOEJBQThCO2dCQUM5QixPQUFPLENBQUMsS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7O1lBRXJGLENBQUM7WUFFRCxLQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1lBRXZELG1DQUFtQztZQUNuQyxLQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO1lBQy9DLEtBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUM7WUFDeEQsS0FBSSxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxJQUFJLENBQUMsQ0FBQztZQUNwRCxLQUFJLENBQUMsMEJBQTBCLEdBQUcsT0FBTyxDQUFDLDBCQUEwQixJQUFJLE1BQU0sQ0FBQztZQUMvRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixLQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixLQUFLLE1BQU0sR0FBRyxTQUFTLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDO1lBQzdHLENBQUM7WUFDRCxLQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO1lBQ2hELEtBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsbUJBQW1CLElBQUksQ0FBQyxDQUFDO1lBQzVELEtBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsS0FBSyxLQUFLLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLGtCQUFrQjtZQUN2RixLQUFJLENBQUMsb0JBQW9CLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixLQUFLLElBQUksQ0FBQztZQUNsRSxLQUFJLENBQUMsb0JBQW9CLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixJQUFJLFNBQVMsQ0FBQztZQUN0RSxLQUFJLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixJQUFJLENBQUMsQ0FBQztZQUV4RCwwQkFBMEI7WUFDMUIsS0FBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxJQUFJLEdBQUcsQ0FBQztZQUNsRCxLQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDO1lBQ2xELEtBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxHQUFHLENBQUM7WUFFbEQsMkNBQTJDO1lBQzNDLEtBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQztZQUMvQyxLQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUM7WUFDekMsS0FBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDO1lBQzdDLEtBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQztZQUN6QyxLQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7WUFFM0MsS0FBSSxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsS0FBSyxLQUFLLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLGtCQUFrQjtZQUVuRyxzREFBc0Q7WUFDdEQsS0FBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxJQUFJLElBQUksa0JBQWtCLENBQUM7Z0JBQzdELElBQUksRUFBRSxFQUFFO2dCQUNSLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNoQyxPQUFPLEVBQUUsSUFBSSxnQkFBZ0IsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO2FBQ3RGLENBQUMsQ0FBQztZQUVILEtBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsSUFBSSxJQUFJLFVBQVUsQ0FBQztnQkFDbkQsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDakMsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxFQUFFO29CQUNSLE1BQU0sRUFBRSxPQUFPO2lCQUNsQjtnQkFDRCxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsZ0VBQWdFO2FBQy9FLENBQUMsQ0FBQztZQUVILEtBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsSUFBSSxJQUFJLFVBQVUsQ0FBQztnQkFDN0QsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDakMsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxDQUFDO29CQUNQLE1BQU0sRUFBRSxPQUFPO2lCQUNsQjtnQkFDRCxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsZ0VBQWdFO2FBQy9FLENBQUMsQ0FBQztZQUVILGVBQWU7WUFDZixLQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDO1lBRXZDLEtBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsVUFBQyxHQUFHLElBQUssT0FBQSxLQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQTNCLENBQTJCLENBQUMsQ0FBQztZQUVsRSxFQUFFLENBQUMsQ0FBQyxLQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixLQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsQ0FBQzs7UUFHTCxDQUFDO1FBR08sNkNBQWlCLEdBQXpCLFVBQTBCLEdBQUc7WUFBN0IsaUJBb0NDO1lBbENHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7WUFDdEMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLElBQUksQ0FBQyxZQUFZLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQztZQUN0QyxDQUFDO1lBRUQseUVBQXlFO1lBQ3pFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7Z0JBQzNCLFVBQVUsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLFVBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxJQUFLLE9BQUEsS0FBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBOUMsQ0FBOEMsQ0FBQyxDQUFDO1lBQ3hJLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7Z0JBRXRDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO29CQUMxQixnREFBZ0Q7b0JBQ2hELElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDWixJQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO2dCQUNwQyxDQUFDO1lBQ0wsQ0FBQztZQUNELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUd0QixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDbkMsNkVBQTZFO2dCQUM3RSxVQUFVLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsVUFBVSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBbEMsQ0FBa0MsQ0FBQyxDQUFDO1lBQ2pHLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixvREFBb0Q7Z0JBQ3BELElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7UUFFTCxDQUFDO1FBRU8sMENBQWMsR0FBdEIsVUFBdUIsU0FBYztZQUFyQyxpQkFrQkM7WUFqQkcsSUFBSSxDQUFDLEdBQWUsU0FBUyxDQUFDLElBQUksQ0FBQztZQUNuQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUVwQixJQUFJLFNBQVMsR0FBZ0IsU0FBUyxDQUFDO2dCQUN2QyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2xCLHdGQUF3RjtvQkFDeEYsU0FBUyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDO2dCQUM1QyxDQUFDO2dCQUNELElBQUksQ0FBQyxDQUFDO29CQUNGLHNGQUFzRjtvQkFDdEYsU0FBUyxHQUFnQixLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0QsQ0FBQztnQkFFRCwyRUFBMkU7Z0JBQzNFLENBQUMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxjQUFjLEVBQUUsVUFBQyxHQUFHLElBQUssT0FBQSxLQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQTFCLENBQTBCLENBQUMsQ0FBQztnQkFDN0UsQ0FBQyxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLGNBQWMsRUFBRSxVQUFDLEdBQUcsSUFBSyxPQUFBLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBMUIsQ0FBMEIsQ0FBQyxDQUFDO1lBQ2pGLENBQUM7UUFDTCxDQUFDO1FBR08sMkNBQWUsR0FBdkIsVUFBd0IsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSTtZQUU1QyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNiLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsQ0FBQztZQUNMLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsZ0NBQWdDO2dCQUNoQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM5QixDQUFDO1FBQ0wsQ0FBQztRQUdELGlDQUFLLEdBQUw7WUFDSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDeEIsQ0FBQztRQUdELG1DQUFPLEdBQVAsVUFBUSxJQUFXLEVBQUUsUUFBd0I7WUFBeEIseUJBQUEsRUFBQSxlQUF3QjtZQUN6QyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNsQixFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNYLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoQixDQUFDO1FBQ0wsQ0FBQztRQUVELGdDQUFJLEdBQUosVUFBSyxVQUFnQjtZQUFyQixpQkErSUM7WUE3SUcsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDYixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztZQUNsQyxDQUFDO1lBRUQsd0NBQXdDO1lBQ3hDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUU3QyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQztZQUU1QyxxRUFBcUU7WUFDckUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ2hELE9BQU8sQ0FBQyxLQUFLLENBQUMsMkVBQTJFLENBQUMsQ0FBQztnQkFDM0YsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFbkQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUV4RCxJQUFJLFFBQVEsR0FBYyxFQUFFLENBQUM7WUFFN0IsbUZBQW1GO1lBQ25GLG9HQUFvRztZQUNwRyxtR0FBbUc7WUFDbkcsOEVBQThFO1lBQzlFLElBQUksU0FBUyxHQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsR0FBVyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksZ0JBQWdCLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsTCxJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUM7WUFFNUIsSUFBSSxtQkFBbUIsR0FBRyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEQsU0FBUyxHQUFHLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNwRCxlQUFlLEdBQUcsSUFBSSxDQUFDO1lBQzNCLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDcEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN4RCxDQUFDO1lBR0QsSUFBSSxHQUFhLEVBQUUsR0FBUSxFQUFFLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFZLEVBQUUsSUFBWSxDQUFDO1lBQ3hGLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ2xDLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVwQiwwRUFBMEU7Z0JBQzFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzNCLFFBQVEsQ0FBQztnQkFDYixDQUFDO2dCQUVELElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUMvQixJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFFL0Isb0dBQW9HO2dCQUNwRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztvQkFDdEMsR0FBRyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN2QixDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNKLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNsRCxDQUFDO2dCQUVELDhEQUE4RDtnQkFDOUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2pILFFBQVEsQ0FBQztnQkFDYixDQUFDO2dCQUVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUVwQix3REFBd0Q7b0JBQ3hELEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUM5RCxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUUvQixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDOzRCQUM3RyxRQUFRLENBQUMsQ0FBQyxzQkFBc0I7d0JBQ3BDLENBQUM7d0JBRUQsa0VBQWtFO3dCQUNsRSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO3dCQUM5RixFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO3dCQUU5RixxSkFBcUo7d0JBQ3JKLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7NEJBQzFCLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQ2pDLENBQUM7d0JBRUQsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDO3dCQUVsQixJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7d0JBQzFCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDOzRCQUM1RCxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO2dDQUM5RCxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO2dDQUM1QixhQUFhLEdBQUcsSUFBSSxDQUFDO2dDQUNyQixLQUFLLENBQUM7NEJBQ1YsQ0FBQzt3QkFDTCxDQUFDO3dCQUVELEVBQUUsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzs0QkFDakIsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO3dCQUM5RSxDQUFDO3dCQUVELG1FQUFtRTt3QkFDbkUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDOzRCQUM5QyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDekIsQ0FBQzt3QkFDRCxJQUFJLENBQUMsQ0FBQzs0QkFDRixFQUFFLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQzt3QkFDcEIsQ0FBQzt3QkFFRCxLQUFLLENBQUM7b0JBQ1YsQ0FBQztnQkFDTCxDQUFDO2dCQUNELElBQUksQ0FBQyxDQUFDO29CQUNGLHNDQUFzQztvQkFDdEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDNUIsQ0FBQztZQUNMLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDcEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQzVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO3dCQUM1RCxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7NEJBQ3pFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDekQsQ0FBQztvQkFDTCxDQUFDO29CQUNELElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM5QyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQztZQUVELGtIQUFrSDtZQUNsSCxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ2xDLE9BQU8sQ0FBQyxPQUFPLENBQUMsZUFBYSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQU0sQ0FBQyxDQUFDO1lBRXRELFVBQVUsQ0FBQztnQkFDUCxLQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDMUIsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztRQUVPLHlDQUFhLEdBQXJCLFVBQXNCLEdBQVE7WUFDMUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztnQkFBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1lBQzVELElBQUksTUFBTSxHQUFHLElBQUksQ0FBQztZQUNsQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDdEQsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0IsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxJQUFJLENBQUM7b0JBQUMsUUFBUSxDQUFDO2dCQUUvQyxJQUFJLFNBQVMsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQy9FLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7b0JBQ1osTUFBTSxHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLHFFQUFxRTtnQkFDaEgsQ0FBQztnQkFDRCxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztvQkFDbEQsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLDRHQUE0RztnQkFDaEksQ0FBQztnQkFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztvQkFBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsdURBQXVEO1lBQ3RGLENBQUM7WUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ2xCLENBQUM7UUFFTyx5Q0FBYSxHQUFyQixVQUFzQixHQUFHO1lBQ3JCLElBQUksS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDO2dCQUNsQixDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7YUFDckYsQ0FBQyxDQUFDO1lBRUgsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztnQkFDeEMsS0FBSyxHQUFVLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25FLENBQUM7WUFFRCxJQUFJLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDdEIsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsVUFBVSxFQUFFLEdBQUc7YUFDbEIsQ0FBQyxDQUFDO1lBRUgsT0FBTyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUM7WUFDakQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3RFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQzVCLENBQUM7WUFDRCxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ3pCLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUN2QyxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUM7Z0JBQ0YscUZBQXFGO2dCQUNyRixPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDO1lBQ3hELENBQUM7WUFFRCxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3RCLENBQUM7UUFHTywwQ0FBYyxHQUF0QixVQUF1QixXQUF3QjtZQUUzQyxJQUFJLE9BQU8sR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQzVCLE9BQU8sQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1lBRWxDLDRHQUE0RztZQUM1RyxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM5RCxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUN4QyxLQUFLLEdBQVUsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkUsQ0FBQztZQUVELElBQUksVUFBVSxHQUFRO2dCQUNsQixDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBQ2hCLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQztnQkFDaEIsWUFBWSxFQUFFLFdBQVcsQ0FBQyxZQUFZO2dCQUN0QyxTQUFTLEVBQUUsSUFBSTtnQkFDZixhQUFhLEVBQUUsV0FBVzthQUM3QixDQUFBO1lBRUQsT0FBTyxDQUFDLGNBQWMsR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDakMsVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLFFBQVEsRUFBRSxLQUFLO2FBQ2xCLENBQUMsQ0FBQztZQUNILE9BQU8sQ0FBQyxjQUFjLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUV0RyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDMUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDO1lBQzdFLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDL0MsQ0FBQztZQUVELE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNsRCxPQUFPLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQztZQUVoRSx5REFBeUQ7WUFDekQsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN6QyxVQUFVLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDO1lBQ3ZELENBQUM7WUFFRCxPQUFPLENBQUMsV0FBVyxHQUFHLElBQUksT0FBTyxDQUFDO2dCQUM5QixRQUFRLEVBQUUsS0FBSztnQkFDZixVQUFVLEVBQUU7b0JBQ1IsYUFBYSxFQUFFLElBQUk7b0JBQ25CLE1BQU0sRUFBRSxJQUFJO29CQUNaLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztpQkFDL0I7Z0JBQ0QsTUFBTSxFQUFFLFVBQVU7YUFDckIsQ0FBQyxDQUFDO1lBRUgsNEVBQTRFO1lBQzVFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRWpGLElBQUksRUFBRSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQzFCLEVBQUUsQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztnQkFDL0IsSUFBSSxJQUFJLEdBQVEsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxvREFBb0Q7Z0JBRXpHLElBQUksUUFBUSxHQUFRO29CQUNoQixDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7b0JBQ2hCLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFDaEIsWUFBWSxFQUFFLFdBQVcsQ0FBQyxZQUFZO29CQUN0QyxTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7b0JBQzVCLGFBQWEsRUFBRSxJQUFJO2lCQUN0QixDQUFBO2dCQUVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEMsSUFBSSxRQUFRLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDLHNHQUFzRztvQkFDcEksUUFBUSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUUzQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO3dCQUMzQyxRQUFRLEdBQVksZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQzNFLENBQUM7b0JBRUQsT0FBTyxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7b0JBQ2hGLE9BQU8sQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFFakcsQ0FBQztZQUNMLENBQUM7WUFFRCxvQ0FBb0M7WUFDcEMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDOUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUNELElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBRTlCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLE9BQU8sQ0FBQztRQUNoRCxDQUFDO1FBR08sOENBQWtCLEdBQTFCLFVBQTJCLFNBQWlCLEVBQUUsZUFBd0I7WUFFbEUsK0lBQStJO1lBQy9JLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3BFLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRXJFLGdJQUFnSTtZQUNoSSxFQUFFLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO2dCQUNsQixNQUFNLElBQUksQ0FBQyxDQUFDO1lBQ2hCLENBQUM7WUFFRCxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUNwRCxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUVwRCxJQUFJLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQztZQUVuQyx3SkFBd0o7WUFDeEosSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7WUFDeEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ25DLE1BQU0sR0FBRyxNQUFNLEdBQUcsRUFBRSxDQUFDO2dCQUNyQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUM5QixNQUFNLEdBQUcsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDbkMsTUFBTSxHQUFHLE1BQU0sR0FBRyxFQUFFLENBQUM7b0JBQ3JCLElBQUksR0FBRyxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO29CQUNyRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQzt3QkFDcEIsTUFBTSxFQUFFLEdBQUc7d0JBQ1gsWUFBWSxFQUFFLENBQUM7d0JBQ2YsYUFBYSxFQUFFLEVBQUU7d0JBQ2pCLE9BQU8sRUFBRSxFQUFFO3dCQUNYLE1BQU0sRUFBRSxFQUFFO3dCQUNWLENBQUMsRUFBRSxDQUFDO3dCQUNKLENBQUMsRUFBRSxDQUFDO3FCQUNQLENBQUMsQ0FBQztnQkFDUCxDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUM7UUFFRDs7O1dBR0c7UUFDSywwQ0FBYyxHQUF0QjtZQUVJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUN4QyxJQUFJLG9CQUFvQixHQUFHLFNBQVMsQ0FBQztZQUNyQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixvQkFBb0IsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7WUFDL0gsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLG9CQUFvQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7WUFDdkcsQ0FBQztZQUVELElBQUksT0FBTyxHQUFRLEdBQUcsQ0FBQyxhQUFhLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3JFLE9BQU8sQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBRS9DLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzlFLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUM7UUFFMUMsQ0FBQztRQUVPLDRDQUFnQixHQUF4QixVQUF5QixHQUFHO1lBQTVCLGlCQW1DQztZQWpDRyxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRXRDLDJJQUEySTtZQUMzSSxrS0FBa0s7WUFDbEssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO2dCQUM1RSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNQLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksUUFBUSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQzt3QkFBQyxNQUFNLENBQUM7Z0JBQzNILENBQUM7WUFDTCxDQUFDO1lBRUQsSUFBSSxDQUFDLEdBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVsQyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBQyxRQUFRO2dCQUU3QyxJQUFJLFFBQVEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDO2dCQUNoQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3hCLEtBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO29CQUMxQixNQUFNLENBQUM7Z0JBQ1gsQ0FBQztnQkFFRCxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUNsRCxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO29CQUM1QixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDdkUsSUFBSSxPQUFPLEdBQUcsS0FBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUNyRCxLQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUM7d0JBQy9CLE1BQU0sQ0FBQztvQkFDWCxDQUFDO29CQUNELElBQUksQ0FBQyxDQUFDO3dCQUNGLEtBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO29CQUM5QixDQUFDO2dCQUNMLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7UUFFTyw0Q0FBZ0IsR0FBeEIsVUFBeUIsT0FBZ0I7WUFFckMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLENBQUMsQ0FBQyxpQkFBaUI7WUFDN0IsQ0FBQztZQUNELElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBRTFCLElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDO1lBQzlCLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNwQixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBRW5CLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFFekYsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBRUQsa0NBQWtDO1FBQ3RDLENBQUM7UUFFTyw4Q0FBa0IsR0FBMUI7WUFFSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBRWpDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDekYsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztZQUVwRixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQztnQkFDMUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFFRCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLGNBQWMsR0FBRyxTQUFTLENBQUM7WUFFaEMscUNBQXFDO1FBRXpDLENBQUM7UUFHTyx3Q0FBWSxHQUFwQjtZQUNJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQztnQkFBQyxNQUFNLENBQUM7WUFFakMsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUM7WUFDMUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBRXJCLElBQUksRUFBRSxHQUFnQixJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBUSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUVwRywySkFBMko7WUFDM0osRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ2xELElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQywyRUFBMkU7Z0JBQzFILEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDWCxtRUFBbUU7b0JBQ25FLEVBQUUsQ0FBQyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9CLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDbEIsMkNBQTJDO29CQUMzQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUM7Z0JBQ3hCLENBQUM7WUFDTCxDQUFDO1lBRUQsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNySSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXhELENBQUM7UUFFTyx5Q0FBYSxHQUFyQjtZQUNJLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3pFLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDM0YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBRU8sd0NBQVksR0FBcEI7WUFDSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ2pDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVyQix5UEFBeVA7WUFDelAsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN4RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBRW5GLDJCQUEyQjtZQUMzQixJQUFJLG9CQUFvQixHQUFHLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3RJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUV6RCxnQ0FBZ0M7WUFDaEMsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNoSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDM0QsaUJBQWlCLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUMzRSxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFFeEUsb0NBQW9DO1lBQ3BDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXZGLENBQUM7UUFHTyx1Q0FBVyxHQUFuQjtZQUFBLGlCQStJQztZQTlJRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUV4RCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQztZQUVsRCxvREFBb0Q7WUFDcEQsSUFBSSxZQUFZLEdBQUcsQ0FBQyxXQUFXLENBQUMsT0FBTyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUNySSxJQUFJLGFBQWEsR0FBRyxDQUFDLFlBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLElBQUksV0FBVyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFFekcsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLENBQUMsQ0FBQyxxQkFBcUI7WUFDakMsQ0FBQztZQUVELElBQUksTUFBTSxHQUFZLEVBQUUsQ0FBQztZQUN6QixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUM3RCxJQUFJLENBQUMsR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNwQixDQUFDLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7b0JBQ3hFLENBQUMsQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7b0JBQ2pCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25CLENBQUM7WUFDTCxDQUFDO1lBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBRXJCLHdDQUF3QztnQkFDeEMsSUFBSSxRQUFRLEdBQUcsV0FBVyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFDN0IsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDcEIsQ0FBQyxDQUFDLFdBQVcsR0FBTSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQUcsQ0FBQztvQkFDN0QsQ0FBQyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO29CQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQixDQUFDO1lBQ0wsQ0FBQztZQUVELHNKQUFzSjtZQUN0SixJQUFJLHVCQUF1QixHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUNqRSxJQUFJLFVBQVUsR0FBRyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFFOUUsK0dBQStHO1lBQy9HLDJGQUEyRjtZQUMzRixJQUFJLGNBQWMsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDekQsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7WUFFOUQsSUFBSSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBUSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN2RyxJQUFJLGlCQUFpQixHQUFXLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEYsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUMsR0FBRyxVQUFVLEVBQUUsR0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFFbEMsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUMsQ0FBQyxDQUFDO2dCQUV0QiwwQkFBMEI7Z0JBQzFCLElBQUksZUFBZSxHQUFHO29CQUNsQixPQUFPLEVBQUUsSUFBSTtvQkFDYixjQUFjLEVBQUUsS0FBSztvQkFDckIsV0FBVyxFQUFFLEVBQUU7b0JBQ2YsZ0JBQWdCLEVBQUUsU0FBUztvQkFDM0IsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTO29CQUMvQyxZQUFZLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQ3pDLENBQUM7Z0JBRUYsSUFBSSxtQkFBbUIsR0FBRyxFQUFFLENBQUM7Z0JBRTdCLHNFQUFzRTtnQkFDdEUsSUFBSSxjQUFjLEdBQUcsdUJBQXVCLElBQUksR0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO2dCQUM1RSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO29CQUNqQixLQUFLLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztvQkFDdkIsZUFBZSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7b0JBQ3RDLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztvQkFDckIsK0ZBQStGO29CQUMvRixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQ3ZFLFdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7d0JBQ3hELFdBQVcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO29CQUN6QyxDQUFDO29CQUNELEtBQUssQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO2dCQUNwQyxDQUFDO2dCQUVELGVBQWUsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztnQkFFaEQsd0RBQXdEO2dCQUN4RCxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDO29CQUN4QixVQUFVLEVBQUUsZUFBZTtvQkFDM0IsUUFBUSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLFFBQVE7b0JBQ3JELGFBQWEsRUFBRSxJQUFJO2lCQUN0QixDQUFDLENBQUM7Z0JBRUgsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzNELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUMxQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7Z0JBQ3BFLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLENBQUM7b0JBQ0YsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QyxDQUFDO2dCQUdELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUNsQixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUM5QyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDO29CQUV2RSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzt3QkFDMUMsVUFBVSxDQUFDLEtBQUssR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7b0JBQ3ZELENBQUM7b0JBRUQsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQzt3QkFDNUIsVUFBVSxFQUFFOzRCQUNSLE1BQU0sRUFBRSxJQUFJOzRCQUNaLGdCQUFnQixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUzt5QkFDbEQ7d0JBQ0QsTUFBTSxFQUFFLFVBQVU7d0JBQ2xCLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRO3FCQUN4RCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7b0NBR1EsR0FBQyxFQUFNLEtBQUc7Z0JBQ2YsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUMsQ0FBQyxDQUFDO2dCQUNsQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7c0NBQVU7Z0JBRXpCLDJEQUEyRDtnQkFDM0QsQ0FBQyxDQUFDLFVBQVUsR0FBRyxPQUFLLGNBQWMsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBRTlELElBQUksUUFBUSxHQUFHLE9BQUssaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxVQUFVLEVBQUUsR0FBQyxFQUFFLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFFcEgsT0FBSyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztnQkFDN0QsSUFBSSxZQUFZLEdBQUcsT0FBSywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDakYsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUMvQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztvQkFDaEIsSUFBSSxnQkFBZ0IsR0FBRyxPQUFLLCtCQUErQixDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUN6RixnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUM7b0JBQ3hELENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUN2RCxDQUFDO2dCQUVELE9BQUssa0JBQWtCLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUUvRCw4Q0FBOEM7Z0JBQzlDLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUF0QixDQUFzQixDQUFDLENBQUM7Z0JBQ3hHLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsZUFBZSxFQUFFLEVBQXRCLENBQXNCLENBQUMsQ0FBQztZQUU1RyxDQUFDOztZQXpCRCxrREFBa0Q7WUFDbEQsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUMsR0FBRyxLQUFHLEVBQUUsR0FBQyxFQUFFO3dCQUF4QyxHQUFDLEVBQU0sS0FBRzthQXdCbEI7UUFFTCxDQUFDO1FBRU8sNkNBQWlCLEdBQXpCLFVBQTBCLFVBQWUsRUFBRSxpQkFBeUIsRUFBRSxVQUFrQixFQUFFLFVBQWtCLEVBQUUsY0FBc0IsRUFBRSxZQUFvQjtZQUV0SiwwRUFBMEU7WUFDMUUsSUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNuRSxNQUFNLEdBQUcsTUFBTSxHQUFHLGNBQWMsQ0FBQztZQUVqQyw2Q0FBNkM7WUFDN0MsRUFBRSxDQUFDLENBQUMsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLE1BQU0sSUFBSSxZQUFZLENBQUM7WUFDM0IsQ0FBQztZQUVELElBQUksTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDdEMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1lBRXBDLDhDQUE4QztZQUM5QyxJQUFJLFFBQVEsR0FBRztnQkFDWCxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztnQkFDbEQsQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7YUFDckQsQ0FBQTtZQUVELFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUQsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNwQixDQUFDO1FBRU8sMkNBQWUsR0FBdkIsVUFBd0IsWUFBcUI7WUFDekMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQzlHLENBQUM7UUFFTywwQ0FBYyxHQUF0QixVQUF1QixLQUFZO1lBRS9CLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7WUFDbEMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBRXZCLElBQUksYUFBYSxHQUFHLEtBQUssQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUN0RSxFQUFFLENBQUMsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEIsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELG1FQUFtRTtZQUNuRSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO1lBQzdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDUixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7Z0JBQzFDLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCw0RUFBNEU7WUFDNUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU3Qiw4Q0FBOEM7WUFDOUMsSUFBSSxZQUFZLEdBQUcsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBRTVDLGdFQUFnRTtZQUNoRSxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUV0RCxxRUFBcUU7WUFDckUsSUFBSSxNQUFNLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztZQUU5QixJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7WUFDYixJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUUzRCxZQUFZLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDM0QsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBRS9DLElBQUksU0FBUyxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUM7cUJBQ3BHLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztxQkFDbkMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUU3SCxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQixTQUFTLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM3RCxDQUFDO1lBRUQsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBQ3BCLElBQUksT0FBTyxHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUU1QyxJQUFJLFNBQVMsR0FBRyxZQUFZLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxHQUFHLFdBQVcsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7aUJBQzFMLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFaEMsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDMUUsQ0FBQztZQUVELFNBQVMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN6QixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNwRCxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDaEMsQ0FBQztRQUVMLENBQUM7UUFFTywyQ0FBZSxHQUF2QjtZQUNJLEtBQUssQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5RixDQUFDO1FBR0QsMkJBQTJCO1FBRW5CLDJEQUErQixHQUF2QyxVQUF3QyxPQUFnQixFQUFFLE9BQVk7WUFFbEUseUZBQXlGO1lBQ3pGLElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7WUFDeEIsQ0FBQyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7WUFDcEIsQ0FBQyxDQUFDLGFBQWEsR0FBRyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFFN0MsMkNBQTJDO1lBQzNDLDhHQUE4RztZQUM5RyxJQUFJLFNBQVMsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBRTFCLElBQUksS0FBSyxHQUFHLFNBQVMsQ0FBQztZQUN0QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUM7WUFDbkMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLHdDQUF3QztnQkFDeEMsS0FBSyxHQUFHO29CQUNKLGFBQWEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU07b0JBQ3RDLFFBQVEsRUFBRSxDQUFDO29CQUNYLGdCQUFnQixFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCO29CQUNuRCxnQkFBZ0IsRUFBRSxDQUFDO2lCQUN0QixDQUFDO1lBQ04sQ0FBQztZQUVELElBQUksR0FBRyxHQUFHO2dCQUNOLE9BQU8sRUFBRSxPQUFPO2dCQUNoQixLQUFLLEVBQUUsS0FBSztnQkFDWixTQUFTLEVBQUUsU0FBUzthQUN2QixDQUFDO1lBRUYsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUVoQiw4RkFBOEY7WUFDOUYsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM3RSxJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzdFLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFFbEUsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1FBQzVCLENBQUM7UUFHTyxtQ0FBTyxHQUFmO1lBQ0ksTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO1FBQ2xFLENBQUM7UUFFTyxrQ0FBTSxHQUFkO1lBQ0ksTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDO1FBQ2pFLENBQUM7UUFFRDs7Ozs7OztXQU9HO1FBQ0ssOENBQWtCLEdBQTFCLFVBQTJCLE9BQW9CLEVBQUUsU0FBaUIsRUFBRSxTQUFrQixFQUFFLFFBQW1CO1lBRXZHLElBQUksUUFBUSxHQUFhLFVBQUMsUUFBUSxFQUFFLFVBQVU7Z0JBQzFDLElBQUksWUFBWSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ2xELEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDO29CQUFDLFlBQVksR0FBRyxFQUFFLENBQUM7Z0JBQ3JDLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUFDLE1BQU0sQ0FBQztnQkFDMUQsSUFBSSxRQUFRLEdBQUcsQ0FBQyxZQUFZLEdBQUcsR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN4RCxRQUFRLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUM3QyxDQUFDLENBQUM7WUFFRixFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUNaLFVBQVUsQ0FBQztvQkFDUCxRQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUM3QixFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO3dCQUNYLFFBQVEsRUFBRSxDQUFDO29CQUNmLENBQUM7Z0JBQ0wsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ2xCLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixRQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ2pDLENBQUM7UUFDTCxDQUFDO1FBR08sbURBQXVCLEdBQS9CLFVBQWdDLE9BQW9CLEVBQUUsU0FBaUIsRUFBRSxTQUFrQixFQUFFLFFBQW1CO1lBRTVHLElBQUksV0FBVyxHQUFhLFVBQUMsUUFBUSxFQUFFLFVBQVU7Z0JBQzdDLElBQUksWUFBWSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ2xELEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDO29CQUFDLE1BQU0sQ0FBQztnQkFDMUIsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQUMsTUFBTSxDQUFDO2dCQUMxRCxRQUFRLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMvRSxDQUFDLENBQUM7WUFFRixFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUNaLFVBQVUsQ0FBQztvQkFDUCxXQUFXLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUNoQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO3dCQUNYLFFBQVEsRUFBRSxDQUFDO29CQUNmLENBQUM7Z0JBQ0wsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ2xCLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixXQUFXLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3BDLENBQUM7UUFFTCxDQUFDO1FBRU8sd0NBQVksR0FBcEIsVUFBcUIsR0FBRztZQUNwQix1R0FBdUc7WUFDdkcsSUFBSSxTQUFTLEdBQVEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7WUFDaEQsSUFBSSxJQUFJLEdBQUcsU0FBUyxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDN0MsTUFBTSxDQUFDO2dCQUNILENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJO2dCQUNwQixDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRzthQUN0QixDQUFDO1FBQ04sQ0FBQztRQUdEOzs7V0FHRztRQUNLLHdDQUFZLEdBQXBCLFVBQXFCLE9BQTRCO1lBQzdDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUNyQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLFVBQVUsQ0FBWSxPQUFPLENBQUMsQ0FBQztZQUN4QyxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUM7Z0JBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBVSxPQUFPLENBQUMsQ0FBQztZQUNsQyxDQUFDO1FBQ0wsQ0FBQztRQUVPLHdDQUFZLEdBQXBCLFVBQXFCLE9BQTRCO1lBQzdDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUNyQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBWSxPQUFPLENBQUMsQ0FBQztZQUNyQyxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUM7Z0JBQ0YsSUFBSSxDQUFDLEdBQUcsQ0FBVSxPQUFPLENBQUMsQ0FBQztZQUMvQixDQUFDO1FBQ0wsQ0FBQztRQXBrQ1EsaUJBQWlCO1lBRDdCLEdBQUcsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUM7O1dBQ3JCLGlCQUFpQixDQXdrQzdCO1FBQUQsd0JBQUM7S0F4a0NELEFBd2tDQyxDQXhrQ3NDLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBd2tDakU7SUF4a0NZLDhDQUFpQjtJQXdsQzlCO1FBQUE7WUFHSSxrQkFBYSxHQUFVLEVBQUUsQ0FBQztZQUMxQixZQUFPLEdBQVUsRUFBRSxDQUFDO1lBQ3BCLFdBQU0sR0FBVSxFQUFFLENBQUM7UUFHdkIsQ0FBQztRQUFELGtCQUFDO0lBQUQsQ0FSQSxBQVFDLElBQUE7SUFHRDtRQUFBO1FBT0EsQ0FBQztRQUFELGNBQUM7SUFBRCxDQVBBLEFBT0MsSUFBQTtJQUVEO1FBQUE7UUFRQSxDQUFDO1FBQUQsWUFBQztJQUFELENBUkEsQUFRQyxJQUFBO0lBRUQ7UUFTSSxxQkFBWSxVQUFrQixFQUFFLFlBQW9CLEVBQUUsTUFBYSxFQUFFLHFCQUFzQztZQUF0QyxzQ0FBQSxFQUFBLDZCQUFzQztZQUN2RyxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztZQUM3QixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztZQUNqQyxJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQztZQUM3QixJQUFJLENBQUMscUJBQXFCLEdBQUcscUJBQXFCLENBQUM7UUFDdkQsQ0FBQztRQUVMLGtCQUFDO0lBQUQsQ0FoQkEsQUFnQkMsSUFBQTtJQWhCWSxrQ0FBVyIsImZpbGUiOiJGbGFyZUNsdXN0ZXJMYXllcl92NC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxyXG5cclxuaW1wb3J0ICogYXMgR3JhcGhpY3NMYXllciBmcm9tIFwiZXNyaS9sYXllcnMvR3JhcGhpY3NMYXllclwiO1xyXG5pbXBvcnQgKiBhcyBDbGFzc0JyZWFrc1JlbmRlcmVyIGZyb20gXCJlc3JpL3JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyXCI7XHJcbmltcG9ydCAqIGFzIFBvcHVwVGVtcGxhdGUgZnJvbSBcImVzcmkvUG9wdXBUZW1wbGF0ZVwiO1xyXG5pbXBvcnQgKiBhcyBTaW1wbGVNYXJrZXJTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9TaW1wbGVNYXJrZXJTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgVGV4dFN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1RleHRTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgU2ltcGxlTGluZVN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1NpbXBsZUxpbmVTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgQ29sb3IgZnJvbSBcImVzcmkvQ29sb3JcIjtcclxuaW1wb3J0ICogYXMgd2F0Y2hVdGlscyBmcm9tICdlc3JpL2NvcmUvd2F0Y2hVdGlscyc7XHJcbmltcG9ydCAqIGFzIFZpZXcgZnJvbSAnZXNyaS92aWV3cy9WaWV3JztcclxuaW1wb3J0ICogYXMgd2ViTWVyY2F0b3JVdGlscyBmcm9tIFwiZXNyaS9nZW9tZXRyeS9zdXBwb3J0L3dlYk1lcmNhdG9yVXRpbHNcIjtcclxuaW1wb3J0ICogYXMgR3JhcGhpYyBmcm9tIFwiZXNyaS9HcmFwaGljXCI7XHJcbmltcG9ydCAqIGFzIFBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvaW50XCI7IFxyXG5pbXBvcnQgKiBhcyBTY3JlZW5Qb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TY3JlZW5Qb2ludFwiO1xyXG5pbXBvcnQgKiBhcyBNdWx0aXBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L011bHRpcG9pbnRcIjtcclxuaW1wb3J0ICogYXMgUG9seWdvbiBmcm9tIFwiZXNyaS9nZW9tZXRyeS9Qb2x5Z29uXCI7XHJcbmltcG9ydCAqIGFzIGdlb21ldHJ5RW5naW5lIGZyb20gJ2VzcmkvZ2VvbWV0cnkvZ2VvbWV0cnlFbmdpbmUnO1xyXG5pbXBvcnQgKiBhcyBTcGF0aWFsUmVmZXJlbmNlIGZyb20gXCJlc3JpL2dlb21ldHJ5L1NwYXRpYWxSZWZlcmVuY2VcIjtcclxuaW1wb3J0ICogYXMgRXh0ZW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L0V4dGVudFwiO1xyXG5pbXBvcnQgKiBhcyBNYXBWaWV3IGZyb20gJ2Vzcmkvdmlld3MvTWFwVmlldyc7XHJcbmltcG9ydCAqIGFzIFNjZW5lVmlldyBmcm9tICdlc3JpL3ZpZXdzL1NjZW5lVmlldyc7XHJcblxyXG5pbXBvcnQgKiBhcyBHRlhPYmplY3QgZnJvbSBcImVzcmkvdmlld3MvMmQvZW5naW5lL2dyYXBoaWNzL0dGWE9iamVjdFwiO1xyXG5pbXBvcnQgKiBhcyBQcm9qZWN0b3IgZnJvbSBcImVzcmkvdmlld3MvMmQvZW5naW5lL2dyYXBoaWNzL1Byb2plY3RvclwiO1xyXG4gXHJcbmltcG9ydCAqIGFzIGFzZCBmcm9tIFwiZXNyaS9jb3JlL2FjY2Vzc29yU3VwcG9ydC9kZWNvcmF0b3JzXCI7XHJcblxyXG5pbXBvcnQgKiBhcyBvbiBmcm9tICdkb2pvL29uJztcclxuaW1wb3J0ICogYXMgZ2Z4IGZyb20gJ2Rvam94L2dmeCc7XHJcbmltcG9ydCAqIGFzIGRvbUNvbnN0cnVjdCBmcm9tICdkb2pvL2RvbS1jb25zdHJ1Y3QnO1xyXG5pbXBvcnQgKiBhcyBxdWVyeSBmcm9tICdkb2pvL3F1ZXJ5JztcclxuaW1wb3J0ICogYXMgZG9tQXR0ciBmcm9tICdkb2pvL2RvbS1hdHRyJztcclxuaW1wb3J0ICogYXMgZG9tU3R5bGUgZnJvbSAnZG9qby9kb20tc3R5bGUnO1xyXG4gXHJcbmludGVyZmFjZSBGbGFyZUNsdXN0ZXJMYXllclByb3BlcnRpZXMgZXh0ZW5kcyBfX2VzcmkuR3JhcGhpY3NMYXllclByb3BlcnRpZXMge1xyXG5cclxuICAgIGNsdXN0ZXJSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVSZW5kZXJlcj86IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbD86IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIGFyZWFSZW5kZXJlcj86IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVQb3B1cFRlbXBsYXRlPzogUG9wdXBUZW1wbGF0ZTtcclxuICAgIHNwYXRpYWxSZWZlcmVuY2U/OiBTcGF0aWFsUmVmZXJlbmNlO1xyXG5cclxuICAgIGNsdXN0ZXJSYXRpbz86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJUb1NjYWxlPzogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50PzogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5Pzogc3RyaW5nO1xyXG5cclxuICAgIGRpc3BsYXlGbGFyZXM/OiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ/OiBudW1iZXI7XHJcbiAgICBzaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eT86IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sPzogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM/OiBudW1iZXI7XHJcbiAgICB0ZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbD86IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBzdWJUeXBlRmxhcmVQcm9wZXJ0eT86IHN0cmluZztcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgeVByb3BlcnR5TmFtZT86IHN0cmluZztcclxuICAgIHpQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcblxyXG4gICAgcmVmcmVzaE9uU3RhdGlvbmFyeT86IGJvb2xlYW47XHJcblxyXG4gICAgZmlsdGVycz86IFBvaW50RmlsdGVyW107XHJcblxyXG4gICAgZGF0YT86IGFueVtdO1xyXG5cclxufVxyXG5cclxuLy8gZXh0ZW5kIEdyYXBoaWNzTGF5ZXIgdXNpbmcgJ2FjY2Vzc29yU3VwcG9ydC9kZWNvcmF0b3JzJ1xyXG5AYXNkLnN1YmNsYXNzKFwiRmxhcmVDbHVzdGVyTGF5ZXJcIilcclxuZXhwb3J0IGNsYXNzIEZsYXJlQ2x1c3RlckxheWVyIGV4dGVuZHMgYXNkLmRlY2xhcmVkKEdyYXBoaWNzTGF5ZXIpIHtcclxuXHJcbiAgICBzaW5nbGVSZW5kZXJlcjogYW55O1xyXG4gICAgc2luZ2xlU3ltYm9sOiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBzaW5nbGVQb3B1cFRlbXBsYXRlOiBQb3B1cFRlbXBsYXRlO1xyXG5cclxuICAgIGNsdXN0ZXJSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuICAgIGFyZWFSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuICAgIGZsYXJlUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcblxyXG4gICAgc3BhdGlhbFJlZmVyZW5jZTogU3BhdGlhbFJlZmVyZW5jZTtcclxuXHJcbiAgICBjbHVzdGVyUmF0aW86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJUb1NjYWxlOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyTWluQ291bnQ6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJBcmVhRGlzcGxheTogc3RyaW5nO1xyXG5cclxuICAgIGRpc3BsYXlGbGFyZXM6IGJvb2xlYW47XHJcbiAgICBtYXhGbGFyZUNvdW50OiBudW1iZXI7XHJcbiAgICBtYXhTaW5nbGVGbGFyZUNvdW50OiBudW1iZXI7XHJcbiAgICBzaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eTogc3RyaW5nO1xyXG4gICAgZmxhcmVTeW1ib2w6IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIGZsYXJlQnVmZmVyUGl4ZWxzOiBudW1iZXI7XHJcbiAgICB0ZXh0U3ltYm9sOiBUZXh0U3ltYm9sO1xyXG4gICAgZmxhcmVUZXh0U3ltYm9sOiBUZXh0U3ltYm9sO1xyXG4gICAgZGlzcGxheVN1YlR5cGVGbGFyZXM6IGJvb2xlYW47XHJcbiAgICBzdWJUeXBlRmxhcmVQcm9wZXJ0eTogc3RyaW5nO1xyXG5cclxuICAgIHJlZnJlc2hPblN0YXRpb25hcnk6IGJvb2xlYW47XHJcblxyXG4gICAgeFByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG4gICAgeVByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG4gICAgelByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG5cclxuICAgIGZpbHRlcnM6IFBvaW50RmlsdGVyW107XHJcblxyXG4gICAgcHJpdmF0ZSBfZ3JpZENsdXN0ZXJzOiBHcmlkQ2x1c3RlcltdO1xyXG4gICAgcHJpdmF0ZSBfaXNDbHVzdGVyZWQ6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9hY3RpdmVWaWV3OiBBY3RpdmVWaWV3O1xyXG4gICAgcHJpdmF0ZSBfdmlld0xvYWRDb3VudDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBwcml2YXRlIF9yZWFkeVRvRHJhdzogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX3F1ZXVlZEluaXRpYWxEcmF3OiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfZGF0YTogYW55W107XHJcbiAgICBwcml2YXRlIF9pczJkOiBib29sZWFuO1xyXG5cclxuICAgIHByaXZhdGUgX2NsdXN0ZXJzOiB7IFtjbHVzdGVySWQ6IG51bWJlcl06IENsdXN0ZXI7IH0gPSB7fTtcclxuICAgIHByaXZhdGUgX2FjdGl2ZUNsdXN0ZXI6IENsdXN0ZXI7XHJcblxyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3MmQ6IGFueTtcclxuICAgIHByaXZhdGUgX2xheWVyVmlldzNkOiBhbnk7XHJcblxyXG4gICAgY29uc3RydWN0b3Iob3B0aW9uczogRmxhcmVDbHVzdGVyTGF5ZXJQcm9wZXJ0aWVzKSB7XHJcblxyXG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAvLyBzZXQgdGhlIGRlZmF1bHRzXHJcbiAgICAgICAgaWYgKCFvcHRpb25zKSB7XHJcbiAgICAgICAgICAgIC8vIG1pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyc1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiTWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzIHRvIGZsYXJlIGNsdXN0ZXIgbGF5ZXIgY29uc3RydWN0b3IuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuc2luZ2xlUG9wdXBUZW1wbGF0ZSA9IG9wdGlvbnMuc2luZ2xlUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICAgICAgLy8gc2V0IHVwIHRoZSBjbHVzdGVyaW5nIHByb3BlcnRpZXNcclxuICAgICAgICB0aGlzLmNsdXN0ZXJSYXRpbyA9IG9wdGlvbnMuY2x1c3RlclJhdGlvIHx8IDc1O1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclRvU2NhbGUgPSBvcHRpb25zLmNsdXN0ZXJUb1NjYWxlIHx8IDIwMDAwMDA7XHJcbiAgICAgICAgdGhpcy5jbHVzdGVyTWluQ291bnQgPSBvcHRpb25zLmNsdXN0ZXJNaW5Db3VudCB8fCAyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHkgPSBvcHRpb25zLnNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5IHx8IFwibmFtZVwiO1xyXG4gICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJBcmVhRGlzcGxheSkge1xyXG4gICAgICAgICAgICB0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9IG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcIm5vbmVcIiA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5O1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLm1heEZsYXJlQ291bnQgPSBvcHRpb25zLm1heEZsYXJlQ291bnQgfHwgODtcclxuICAgICAgICB0aGlzLm1heFNpbmdsZUZsYXJlQ291bnQgPSBvcHRpb25zLm1heFNpbmdsZUZsYXJlQ291bnQgfHwgODtcclxuICAgICAgICB0aGlzLmRpc3BsYXlGbGFyZXMgPSBvcHRpb25zLmRpc3BsYXlGbGFyZXMgPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlOyAvLyBkZWZhdWx0IHRvIHRydWVcclxuICAgICAgICB0aGlzLmRpc3BsYXlTdWJUeXBlRmxhcmVzID0gb3B0aW9ucy5kaXNwbGF5U3ViVHlwZUZsYXJlcyA9PT0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnN1YlR5cGVGbGFyZVByb3BlcnR5ID0gb3B0aW9ucy5zdWJUeXBlRmxhcmVQcm9wZXJ0eSB8fCB1bmRlZmluZWQ7XHJcbiAgICAgICAgdGhpcy5mbGFyZUJ1ZmZlclBpeGVscyA9IG9wdGlvbnMuZmxhcmVCdWZmZXJQaXhlbHMgfHwgNjtcclxuXHJcbiAgICAgICAgLy8gZGF0YSBzZXQgcHJvcGVydHkgbmFtZXNcclxuICAgICAgICB0aGlzLnhQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnhQcm9wZXJ0eU5hbWUgfHwgXCJ4XCI7XHJcbiAgICAgICAgdGhpcy55UHJvcGVydHlOYW1lID0gb3B0aW9ucy55UHJvcGVydHlOYW1lIHx8IFwieVwiO1xyXG4gICAgICAgIHRoaXMuelByb3BlcnR5TmFtZSA9IG9wdGlvbnMuelByb3BlcnR5TmFtZSB8fCBcInpcIjtcclxuXHJcbiAgICAgICAgLy8gc2V0IHVwIHRoZSBzeW1ib2xvZ3kvcmVuZGVyZXIgcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclJlbmRlcmVyID0gb3B0aW9ucy5jbHVzdGVyUmVuZGVyZXI7XHJcbiAgICAgICAgdGhpcy5hcmVhUmVuZGVyZXIgPSBvcHRpb25zLmFyZWFSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLnNpbmdsZVJlbmRlcmVyID0gb3B0aW9ucy5zaW5nbGVSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLnNpbmdsZVN5bWJvbCA9IG9wdGlvbnMuc2luZ2xlU3ltYm9sO1xyXG4gICAgICAgIHRoaXMuZmxhcmVSZW5kZXJlciA9IG9wdGlvbnMuZmxhcmVSZW5kZXJlcjtcclxuXHJcbiAgICAgICAgdGhpcy5yZWZyZXNoT25TdGF0aW9uYXJ5ID0gb3B0aW9ucy5yZWZyZXNoT25TdGF0aW9uYXJ5ID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZTsgLy8gZGVmYXVsdCB0byB0cnVlXHJcblxyXG4gICAgICAgIC8vIGFkZCBzb21lIGRlZmF1bHQgc3ltYm9scyBvciB1c2UgdGhlIG9wdGlvbnMgdmFsdWVzLlxyXG4gICAgICAgIHRoaXMuZmxhcmVTeW1ib2wgPSBvcHRpb25zLmZsYXJlU3ltYm9sIHx8IG5ldyBTaW1wbGVNYXJrZXJTeW1ib2woe1xyXG4gICAgICAgICAgICBzaXplOiAxNCxcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMCwgMCwgMCwgMC41XSksXHJcbiAgICAgICAgICAgIG91dGxpbmU6IG5ldyBTaW1wbGVMaW5lU3ltYm9sKHsgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NSwgMC41XSksIHdpZHRoOiAxIH0pXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMudGV4dFN5bWJvbCA9IG9wdGlvbnMudGV4dFN5bWJvbCB8fCBuZXcgVGV4dFN5bWJvbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTVdKSxcclxuICAgICAgICAgICAgZm9udDoge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogMTAsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtMyAvLyBzZXR0aW5nIHlvZmZzZXQgYXMgdmVydGljYWwgYWxpZ25tZW50IGRvZXNuJ3Qgd29yayBpbiBJRS9FZGdlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuZmxhcmVUZXh0U3ltYm9sID0gb3B0aW9ucy5mbGFyZVRleHRTeW1ib2wgfHwgbmV3IFRleHRTeW1ib2woe1xyXG4gICAgICAgICAgICBjb2xvcjogbmV3IENvbG9yKFsyNTUsIDI1NSwgMjU1XSksXHJcbiAgICAgICAgICAgIGZvbnQ6IHtcclxuICAgICAgICAgICAgICAgIHNpemU6IDYsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtMiAvLyBzZXR0aW5nIHlvZmZzZXQgYXMgdmVydGljYWwgYWxpZ25tZW50IGRvZXNuJ3Qgd29yayBpbiBJRS9FZGdlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIGluaXRpYWwgZGF0YVxyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICB0aGlzLm9uKFwibGF5ZXJ2aWV3LWNyZWF0ZVwiLCAoZXZ0KSA9PiB0aGlzLl9sYXllclZpZXdDcmVhdGVkKGV2dCkpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fZGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlld0NyZWF0ZWQoZXZ0KSB7XHJcblxyXG4gICAgICAgIGlmIChldnQubGF5ZXJWaWV3LnZpZXcudHlwZSA9PT0gXCIyZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzJkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzNkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGFkZCBhIHN0YXRpb25hcnkgd2F0Y2ggb24gdGhlIHZpZXcgdG8gcmVmcmVzaCBpZiBzcGVjaWZpZWQgaW4gb3B0aW9ucy5cclxuICAgICAgICBpZiAodGhpcy5yZWZyZXNoT25TdGF0aW9uYXJ5KSB7XHJcbiAgICAgICAgICAgIHdhdGNoVXRpbHMucGF1c2FibGUoZXZ0LmxheWVyVmlldy52aWV3LCBcInN0YXRpb25hcnlcIiwgKGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykgPT4gdGhpcy5fdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5fdmlld0xvYWRDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gZXZ0LmxheWVyVmlldy52aWV3O1xyXG5cclxuICAgICAgICAgICAgdGhpcy5fcmVhZHlUb0RyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkSW5pdGlhbERyYXcpIHtcclxuICAgICAgICAgICAgICAgIC8vIHdlJ3ZlIGJlZW4gd2FpdGluZyBmb3IgdGhpcyB0byBoYXBwZW4gdG8gZHJhd1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3ZpZXdMb2FkQ291bnQrKztcclxuXHJcblxyXG4gICAgICAgIGlmIChldnQubGF5ZXJWaWV3LnZpZXcudHlwZSA9PT0gXCIyZFwiKSB7XHJcbiAgICAgICAgICAgIC8vIGZvciBtYXAgdmlld3MsIHdhaXQgZm9yIHRoZSBsYXllcnZpZXcgb3QgYmUgYXR0YWNoZWQsIGJlZm9yZSBhZGRpbmcgZXZlbnRzXHJcbiAgICAgICAgICAgIHdhdGNoVXRpbHMud2hlblRydWVPbmNlKGV2dC5sYXllclZpZXcsIFwiYXR0YWNoZWRcIiwgKCkgPT4gdGhpcy5fYWRkVmlld0V2ZW50cyhldnQubGF5ZXJWaWV3KSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBmb3Igc2NlbmUgdmlld3MganVzdCBhZGQgdGhlIGV2ZW50cyBzdHJhaWdodCBhd2F5XHJcbiAgICAgICAgICAgIHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuICAgICBcclxuICAgIHByaXZhdGUgX2FkZFZpZXdFdmVudHMobGF5ZXJWaWV3OiBhbnkpIHtcclxuICAgICAgICBsZXQgdjogQWN0aXZlVmlldyA9IGxheWVyVmlldy52aWV3O1xyXG4gICAgICAgIGlmICghdi5mY2xQb2ludGVyTW92ZSkge1xyXG5cclxuICAgICAgICAgICAgbGV0IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGlmICh2LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICAgICAgLy8gZm9yIGEgbWFwIHZpZXcgZ2V0IHRoZSBjb250YWluZXIgZWxlbWVudCBvZiB0aGUgbGF5ZXIgdmlldyB0byBhZGQgbW91c2Vtb3ZlIGV2ZW50IHRvLlxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gbGF5ZXJWaWV3LmNvbnRhaW5lci5lbGVtZW50O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gZm9yIHNjZW5lIHZpZXcgZ2V0IHRoZSBjYW52YXMgZWxlbWVudCB1bmRlciB0aGUgdmlldyBjb250YWluZXIgdG8gYWRkIG1vdXNlbW92ZSB0by5cclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lciA9IDxIVE1MRWxlbWVudD5xdWVyeShcImNhbnZhc1wiLCB2LmNvbnRhaW5lcilbMF07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEFkZCBwb2ludGVyIG1vdmUgYW5kIHBvaW50ZXIgZG93bi4gUG9pbnRlciBkb3duIHRvIGhhbmRsZSB0b3VjaCBkZXZpY2VzLlxyXG4gICAgICAgICAgICB2LmZjbFBvaW50ZXJNb3ZlID0gdi5vbihcInBvaW50ZXItbW92ZVwiLCAoZXZ0KSA9PiB0aGlzLl92aWV3UG9pbnRlck1vdmUoZXZ0KSk7XHJcbiAgICAgICAgICAgIHYuZmNsUG9pbnRlckRvd24gPSB2Lm9uKFwicG9pbnRlci1kb3duXCIsIChldnQpID0+IHRoaXMuX3ZpZXdQb2ludGVyTW92ZShldnQpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykge1xyXG5cclxuICAgICAgICBpZiAoaXNTdGF0aW9uYXJ5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9kYXRhKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCFpc1N0YXRpb25hcnkgJiYgdGhpcy5fYWN0aXZlQ2x1c3Rlcikge1xyXG4gICAgICAgICAgICAvLyBpZiBtb3ZpbmcgZGVhY3RpdmF0ZSBjbHVzdGVyO1xyXG4gICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgY2xlYXIoKSB7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVBbGwoKTtcclxuICAgICAgICB0aGlzLl9jbHVzdGVycyA9IHt9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBzZXREYXRhKGRhdGE6IGFueVtdLCBkcmF3RGF0YTogYm9vbGVhbiA9IHRydWUpIHtcclxuICAgICAgICB0aGlzLl9kYXRhID0gZGF0YTtcclxuICAgICAgICBpZiAoZHJhd0RhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGRyYXcoYWN0aXZlVmlldz86IGFueSkge1xyXG5cclxuICAgICAgICBpZiAoYWN0aXZlVmlldykge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gYWN0aXZlVmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE5vdCByZWFkeSB0byBkcmF3IHlldCBzbyBxdWV1ZSBvbmUgdXBcclxuICAgICAgICBpZiAoIXRoaXMuX3JlYWR5VG9EcmF3KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3ID0gdHJ1ZTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVWaWV3IHx8ICF0aGlzLl9kYXRhKSByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMuX2lzMmQgPSB0aGlzLl9hY3RpdmVWaWV3LnR5cGUgPT09IFwiMmRcIjtcclxuXHJcbiAgICAgICAgLy8gY2hlY2sgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYW4gYXJlYSByZW5kZXJlciBzZXQgaWYgb25lIG5lZWRzIHRvIGJlXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ICYmICF0aGlzLmFyZWFSZW5kZXJlcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRmxhcmVDbHVzdGVyTGF5ZXI6IGFyZWFSZW5kZXJlciBtdXN0IGJlIHNldCBpZiBjbHVzdGVyQXJlYURpc3BsYXkgaXMgc2V0LlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIGNvbnNvbGUudGltZShcImRyYXctZGF0YS1cIiArIHRoaXMuX2FjdGl2ZVZpZXcudHlwZSk7XHJcblxyXG4gICAgICAgIHRoaXMuX2lzQ2x1c3RlcmVkID0gdGhpcy5jbHVzdGVyVG9TY2FsZSA8IHRoaXMuX3NjYWxlKCk7XHJcblxyXG4gICAgICAgIGxldCBncmFwaGljczogR3JhcGhpY1tdID0gW107XHJcblxyXG4gICAgICAgIC8vIEdldCBhbiBleHRlbnQgdGhhdCBpcyBpbiB3ZWIgbWVyY2F0b3IgdG8gbWFrZSBzdXJlIGl0J3MgZmxhdCBmb3IgZXh0ZW50IGNoZWNraW5nXHJcbiAgICAgICAgLy8gVGhlIHdlYmV4dGVudCB3aWxsIG5lZWQgdG8gYmUgbm9ybWFsaXplZCBzaW5jZSBwYW5uaW5nIG92ZXIgdGhlIGludGVybmF0aW9uYWwgZGF0ZWxpbmUgd2lsbCBjYXVzZVxyXG4gICAgICAgIC8vIGNhdXNlIHRoZSBleHRlbnQgdG8gc2hpZnQgb3V0c2lkZSB0aGUgLTE4MCB0byAxODAgZGVncmVlIHdpbmRvdy4gIElmIHdlIGRvbid0IG5vcm1hbGl6ZSB0aGVuIHRoZVxyXG4gICAgICAgIC8vIGNsdXN0ZXJzIHdpbGwgbm90IGJlIGRyYXduIGlmIHRoZSBtYXAgcGFucyBvdmVyIHRoZSBpbnRlcm5hdGlvbmFsIGRhdGVsaW5lLlxyXG4gICAgICAgIGxldCB3ZWJFeHRlbnQ6IGFueSA9ICF0aGlzLl9leHRlbnQoKS5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IgPyA8RXh0ZW50PndlYk1lcmNhdG9yVXRpbHMucHJvamVjdCh0aGlzLl9leHRlbnQoKSwgbmV3IFNwYXRpYWxSZWZlcmVuY2UoeyBcIndraWRcIjogMTAyMTAwIH0pKSA6IHRoaXMuX2V4dGVudCgpO1xyXG4gICAgICAgIGxldCBleHRlbnRJc1VuaW9uZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgbGV0IG5vcm1hbGl6ZWRXZWJFeHRlbnQgPSB3ZWJFeHRlbnQubm9ybWFsaXplKCk7XHJcbiAgICAgICAgd2ViRXh0ZW50ID0gbm9ybWFsaXplZFdlYkV4dGVudFswXTtcclxuICAgICAgICBpZiAobm9ybWFsaXplZFdlYkV4dGVudC5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgIHdlYkV4dGVudCA9IHdlYkV4dGVudC51bmlvbihub3JtYWxpemVkV2ViRXh0ZW50WzFdKTtcclxuICAgICAgICAgICAgZXh0ZW50SXNVbmlvbmVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVDbHVzdGVyR3JpZCh3ZWJFeHRlbnQsIGV4dGVudElzVW5pb25lZCk7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgbGV0IHdlYjogbnVtYmVyW10sIG9iajogYW55LCBkYXRhTGVuZ3RoID0gdGhpcy5fZGF0YS5sZW5ndGgsIHhWYWw6IG51bWJlciwgeVZhbDogbnVtYmVyO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YUxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG9iaiA9IHRoaXMuX2RhdGFbaV07XHJcblxyXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBmaWx0ZXJzIGFyZSBzcGVjaWZpZWQgYW5kIGNvbnRpbnVlIGlmIHRoaXMgb2JqZWN0IGRvZXNuJ3QgcGFzc1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3Bhc3Nlc0ZpbHRlcihvYmopKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgeFZhbCA9IG9ialt0aGlzLnhQcm9wZXJ0eU5hbWVdO1xyXG4gICAgICAgICAgICB5VmFsID0gb2JqW3RoaXMueVByb3BlcnR5TmFtZV07XHJcblxyXG4gICAgICAgICAgICAvLyBnZXQgYSB3ZWIgbWVyYyBsbmcvbGF0IGZvciBleHRlbnQgY2hlY2tpbmcuIFVzZSB3ZWIgbWVyYyBhcyBpdCdzIGZsYXQgdG8gY2F0ZXIgZm9yIGxvbmdpdHVkZSBwb2xlXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICAgICAgd2ViID0gW3hWYWwsIHlWYWxdO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgd2ViID0gd2ViTWVyY2F0b3JVdGlscy5sbmdMYXRUb1hZKHhWYWwsIHlWYWwpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBjaGVjayBpZiB0aGUgb2JqIGlzIHZpc2libGUgaW4gdGhlIGV4dGVudCBiZWZvcmUgcHJvY2VlZGluZ1xyXG4gICAgICAgICAgICBpZiAoKHdlYlswXSA8PSB3ZWJFeHRlbnQueG1pbiB8fCB3ZWJbMF0gPiB3ZWJFeHRlbnQueG1heCkgfHwgKHdlYlsxXSA8PSB3ZWJFeHRlbnQueW1pbiB8fCB3ZWJbMV0gPiB3ZWJFeHRlbnQueW1heCkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBsb29wIGNsdXN0ZXIgZ3JpZCB0byBzZWUgaWYgaXQgc2hvdWxkIGJlIGFkZGVkIHRvIG9uZVxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDAsIGpMZW4gPSB0aGlzLl9ncmlkQ2x1c3RlcnMubGVuZ3RoOyBqIDwgakxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsID0gdGhpcy5fZ3JpZENsdXN0ZXJzW2pdO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAod2ViWzBdIDw9IGNsLmV4dGVudC54bWluIHx8IHdlYlswXSA+IGNsLmV4dGVudC54bWF4IHx8IHdlYlsxXSA8PSBjbC5leHRlbnQueW1pbiB8fCB3ZWJbMV0gPiBjbC5leHRlbnQueW1heCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTsgLy9ub3QgaGVyZSBzbyBjYXJyeSBvblxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVjYWxjIHRoZSB4IGFuZCB5IG9mIHRoZSBjbHVzdGVyIGJ5IGF2ZXJhZ2luZyB0aGUgcG9pbnRzIGFnYWluXHJcbiAgICAgICAgICAgICAgICAgICAgY2wueCA9IGNsLmNsdXN0ZXJDb3VudCA+IDAgPyAoeFZhbCArIChjbC54ICogY2wuY2x1c3RlckNvdW50KSkgLyAoY2wuY2x1c3RlckNvdW50ICsgMSkgOiB4VmFsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNsLnkgPSBjbC5jbHVzdGVyQ291bnQgPiAwID8gKHlWYWwgKyAoY2wueSAqIGNsLmNsdXN0ZXJDb3VudCkpIC8gKGNsLmNsdXN0ZXJDb3VudCArIDEpIDogeVZhbDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gcHVzaCBldmVyeSBwb2ludCBpbnRvIHRoZSBjbHVzdGVyIHNvIHdlIGhhdmUgaXQgZm9yIGFyZWEgZGlzcGxheSBpZiByZXF1aXJlZC4gVGhpcyBjb3VsZCBiZSBvbWl0dGVkIGlmIG5ldmVyIGNoZWNraW5nIGFyZWFzLCBvciBvbiBkZW1hbmQgYXQgbGVhc3RcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wucG9pbnRzLnB1c2goW3hWYWwsIHlWYWxdKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNsLmNsdXN0ZXJDb3VudCsrO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3ViVHlwZUV4aXN0cyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHMgPSAwLCBzTGVuID0gY2wuc3ViVHlwZUNvdW50cy5sZW5ndGg7IHMgPCBzTGVuOyBzKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsLnN1YlR5cGVDb3VudHNbc10ubmFtZSA9PT0gb2JqW3RoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzW3NdLmNvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJUeXBlRXhpc3RzID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXN1YlR5cGVFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc3ViVHlwZUNvdW50cy5wdXNoKHsgbmFtZTogb2JqW3RoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHldLCBjb3VudDogMSB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgc2luZ2xlIGZpeCByZWNvcmQgaWYgc3RpbGwgdW5kZXIgdGhlIG1heFNpbmdsZUZsYXJlQ291bnRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY2wuY2x1c3RlckNvdW50IDw9IHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zaW5nbGVzLnB1c2gob2JqKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnNpbmdsZXMgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gbm90IGNsdXN0ZXJlZCBzbyBqdXN0IGFkZCBldmVyeSBvYmpcclxuICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNpbmdsZShvYmopO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5jbHVzdGVyQ291bnQgPCB0aGlzLmNsdXN0ZXJNaW5Db3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwLCBqbGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzW2ldLnNpbmdsZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNpbmdsZSh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uc2luZ2xlc1tqXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLmNsdXN0ZXJDb3VudCA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVDbHVzdGVyKHRoaXMuX2dyaWRDbHVzdGVyc1tpXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGVtaXQgYW4gZXZlbnQgdG8gc2lnbmFsIGRyYXdpbmcgaXMgY29tcGxldGUuIGVtaXQgaXMgbm90IGluIHR5cGluZ3MgZm9yIGdyYXBoaWNzIGxheWVycywgc28gdXNlIFtdJ3MgdG8gYWNjZXNzLlxyXG4gICAgICAgIHRoaXNbXCJlbWl0XCJdKFwiZHJhdy1jb21wbGV0ZVwiLCB7fSk7XHJcbiAgICAgICAgY29uc29sZS50aW1lRW5kKGBkcmF3LWRhdGEtJHt0aGlzLl9hY3RpdmVWaWV3LnR5cGV9YCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVN1cmZhY2UoKTtcclxuICAgICAgICB9LCAxMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfcGFzc2VzRmlsdGVyKG9iajogYW55KTogYm9vbGVhbiB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmZpbHRlcnMgfHwgdGhpcy5maWx0ZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgbGV0IHBhc3NlcyA9IHRydWU7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuZmlsdGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgZmlsdGVyID0gdGhpcy5maWx0ZXJzW2ldO1xyXG4gICAgICAgICAgICBpZiAob2JqW2ZpbHRlci5wcm9wZXJ0eU5hbWVdID09IG51bGwpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgbGV0IHZhbEV4aXN0cyA9IGZpbHRlci5wcm9wZXJ0eVZhbHVlcy5pbmRleE9mKG9ialtmaWx0ZXIucHJvcGVydHlOYW1lXSkgIT09IC0xO1xyXG4gICAgICAgICAgICBpZiAodmFsRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBwYXNzZXMgPSBmaWx0ZXIua2VlcE9ubHlJZlZhbHVlRXhpc3RzOyAvLyB0aGUgdmFsdWUgZXhpc3RzIHNvIHJldHVybiB3aGV0aGVyIHdlIHNob3VsZCBiZSBrZWVwaW5nIGl0IG9yIG5vdC5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmICghdmFsRXhpc3RzICYmIGZpbHRlci5rZWVwT25seUlmVmFsdWVFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIHBhc3NlcyA9IGZhbHNlOyAvLyByZXR1cm4gZmFsc2UgYXMgdGhlIHZhbHVlIGRvZXNuJ3QgZXhpc3QsIGFuZCB3ZSBzaG91bGQgb25seSBiZSBrZWVwaW5nIHBvaW50IG9iamVjdHMgd2hlcmUgaXQgZG9lcyBleGlzdC5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFwYXNzZXMpIHJldHVybiBmYWxzZTsgLy8gaWYgaXQgaGFzbid0IHBhc3NlZCBhbnkgb2YgdGhlIGZpbHRlcnMgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHBhc3NlcztcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTaW5nbGUob2JqKSB7XHJcbiAgICAgICAgbGV0IHBvaW50ID0gbmV3IFBvaW50KHtcclxuICAgICAgICAgICAgeDogb2JqW3RoaXMueFByb3BlcnR5TmFtZV0sIHk6IG9ialt0aGlzLnlQcm9wZXJ0eU5hbWVdLCB6OiBvYmpbdGhpcy56UHJvcGVydHlOYW1lXVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoIXBvaW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBwb2ludCA9IDxQb2ludD53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKHBvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBncmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnQsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IG9ialxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBncmFwaGljLnBvcHVwVGVtcGxhdGUgPSB0aGlzLnNpbmdsZVBvcHVwVGVtcGxhdGU7XHJcbiAgICAgICAgaWYgKHRoaXMuc2luZ2xlUmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgbGV0IHN5bWJvbCA9IHRoaXMuc2luZ2xlUmVuZGVyZXIuZ2V0U3ltYm9sKGdyYXBoaWMsIHRoaXMuX2FjdGl2ZVZpZXcpO1xyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHN5bWJvbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodGhpcy5zaW5nbGVTeW1ib2wpIHtcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLnNpbmdsZVN5bWJvbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIG5vIHN5bWJvbG9neSBmb3Igc2luZ2xlcyBkZWZpbmVkLCB1c2UgdGhlIGRlZmF1bHQgc3ltYm9sIGZyb20gdGhlIGNsdXN0ZXIgcmVuZGVyZXJcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLmNsdXN0ZXJSZW5kZXJlci5kZWZhdWx0U3ltYm9sO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5hZGQoZ3JhcGhpYyk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsdXN0ZXIoZ3JpZENsdXN0ZXI6IEdyaWRDbHVzdGVyKSB7XHJcblxyXG4gICAgICAgIGxldCBjbHVzdGVyID0gbmV3IENsdXN0ZXIoKTtcclxuICAgICAgICBjbHVzdGVyLmdyaWRDbHVzdGVyID0gZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vIG1ha2Ugc3VyZSBhbGwgZ2VvbWV0cmllcyBhZGRlZCB0byBHcmFwaGljIG9iamVjdHMgYXJlIGluIHdlYiBtZXJjYXRvciBvdGhlcndpc2Ugd3JhcCBhcm91bmQgZG9lc24ndCB3b3JrLlxyXG4gICAgICAgIGxldCBwb2ludCA9IG5ldyBQb2ludCh7IHg6IGdyaWRDbHVzdGVyLngsIHk6IGdyaWRDbHVzdGVyLnkgfSk7XHJcbiAgICAgICAgaWYgKCFwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgYXR0cmlidXRlczogYW55ID0ge1xyXG4gICAgICAgICAgICB4OiBncmlkQ2x1c3Rlci54LFxyXG4gICAgICAgICAgICB5OiBncmlkQ2x1c3Rlci55LFxyXG4gICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudCxcclxuICAgICAgICAgICAgaXNDbHVzdGVyOiB0cnVlLFxyXG4gICAgICAgICAgICBjbHVzdGVyT2JqZWN0OiBncmlkQ2x1c3RlclxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgYXR0cmlidXRlczogYXR0cmlidXRlcyxcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHBvaW50XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2wgPSB0aGlzLmNsdXN0ZXJSZW5kZXJlci5nZXRDbGFzc0JyZWFrSW5mbyhjbHVzdGVyLmNsdXN0ZXJHcmFwaGljKS5zeW1ib2w7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlcklkID0gY2x1c3Rlci5jbHVzdGVyR3JhcGhpY1tcInVpZFwiXTtcclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmF0dHJpYnV0ZXMuY2x1c3RlcklkID0gY2x1c3Rlci5jbHVzdGVySWQ7XHJcblxyXG4gICAgICAgIC8vIGFsc28gY3JlYXRlIGEgdGV4dCBzeW1ib2wgdG8gZGlzcGxheSB0aGUgY2x1c3RlciBjb3VudFxyXG4gICAgICAgIGxldCB0ZXh0U3ltYm9sID0gdGhpcy50ZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgdGV4dFN5bWJvbC50ZXh0ID0gZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LnRvU3RyaW5nKCk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICB0ZXh0U3ltYm9sLmFuZ2xlID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIudGV4dEdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludCxcclxuICAgICAgICAgICAgYXR0cmlidXRlczoge1xyXG4gICAgICAgICAgICAgICAgaXNDbHVzdGVyVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJJZDogY2x1c3Rlci5jbHVzdGVySWRcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIGFkZCBhbiBhcmVhIGdyYXBoaWMgdG8gZGlzcGxheSB0aGUgYm91bmRzIG9mIHRoZSBjbHVzdGVyIGlmIGNvbmZpZ3VyZWQgdG9cclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgJiYgZ3JpZENsdXN0ZXIucG9pbnRzICYmIGdyaWRDbHVzdGVyLnBvaW50cy5sZW5ndGggPiAwKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgbXAgPSBuZXcgTXVsdGlwb2ludCgpO1xyXG4gICAgICAgICAgICBtcC5wb2ludHMgPSBncmlkQ2x1c3Rlci5wb2ludHM7XHJcbiAgICAgICAgICAgIGxldCBhcmVhOiBhbnkgPSBnZW9tZXRyeUVuZ2luZS5jb252ZXhIdWxsKG1wLCB0cnVlKTsgLy8gdXNlIGNvbnZleCBodWxsIG9uIHRoZSBwb2ludHMgdG8gZ2V0IHRoZSBib3VuZGFyeVxyXG5cclxuICAgICAgICAgICAgbGV0IGFyZWFBdHRyOiBhbnkgPSB7XHJcbiAgICAgICAgICAgICAgICB4OiBncmlkQ2x1c3Rlci54LFxyXG4gICAgICAgICAgICAgICAgeTogZ3JpZENsdXN0ZXIueSxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlcklkOiBjbHVzdGVyLmNsdXN0ZXJJZCxcclxuICAgICAgICAgICAgICAgIGlzQ2x1c3RlckFyZWE6IHRydWVcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGFyZWEucmluZ3MgJiYgYXJlYS5yaW5ncy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgYXJlYVBvbHkgPSBuZXcgUG9seWdvbigpOyAvLyBoYWQgdG8gY3JlYXRlIGEgbmV3IHBvbHlnb24gYW5kIGZpbGwgaXQgd2l0aCB0aGUgcmluZyBvZiB0aGUgY2FsY3VsYXRlZCBhcmVhIGZvciBTY2VuZVZpZXcgdG8gd29yay5cclxuICAgICAgICAgICAgICAgIGFyZWFQb2x5ID0gYXJlYVBvbHkuYWRkUmluZyhhcmVhLnJpbmdzWzBdKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIWFyZWFQb2x5LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGFyZWFQb2x5ID0gPFBvbHlnb24+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihhcmVhUG9seSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY2x1c3Rlci5hcmVhR3JhcGhpYyA9IG5ldyBHcmFwaGljKHsgZ2VvbWV0cnk6IGFyZWFQb2x5LCBhdHRyaWJ1dGVzOiBhcmVhQXR0ciB9KTtcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXIuYXJlYUdyYXBoaWMuc3ltYm9sID0gdGhpcy5hcmVhUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oY2x1c3Rlci5hcmVhR3JhcGhpYykuc3ltYm9sO1xyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gYWRkIHRoZSBncmFwaGljcyBpbiBvcmRlciAgICAgICAgXHJcbiAgICAgICAgaWYgKGNsdXN0ZXIuYXJlYUdyYXBoaWMgJiYgdGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwiYWx3YXlzXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci5hcmVhR3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMpO1xyXG4gICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIudGV4dEdyYXBoaWMpO1xyXG5cclxuICAgICAgICB0aGlzLl9jbHVzdGVyc1tjbHVzdGVyLmNsdXN0ZXJJZF0gPSBjbHVzdGVyO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDbHVzdGVyR3JpZCh3ZWJFeHRlbnQ6IEV4dGVudCwgZXh0ZW50SXNVbmlvbmVkOiBib29sZWFuKSB7XHJcblxyXG4gICAgICAgIC8vIGdldCB0aGUgdG90YWwgYW1vdW50IG9mIGdyaWQgc3BhY2VzIGJhc2VkIG9uIHRoZSBoZWlnaHQgYW5kIHdpZHRoIG9mIHRoZSBtYXAgKGRpdmlkZSBpdCBieSBjbHVzdGVyUmF0aW8pIC0gdGhlbiBnZXQgdGhlIGRlZ3JlZXMgZm9yIHggYW5kIHkgXHJcbiAgICAgICAgbGV0IHhDb3VudCA9IE1hdGgucm91bmQodGhpcy5fYWN0aXZlVmlldy53aWR0aCAvIHRoaXMuY2x1c3RlclJhdGlvKTtcclxuICAgICAgICBsZXQgeUNvdW50ID0gTWF0aC5yb3VuZCh0aGlzLl9hY3RpdmVWaWV3LmhlaWdodCAvIHRoaXMuY2x1c3RlclJhdGlvKTtcclxuXHJcbiAgICAgICAgLy8gaWYgdGhlIGV4dGVudCBoYXMgYmVlbiB1bmlvbmVkIGR1ZSB0byBub3JtYWxpemF0aW9uLCBkb3VibGUgdGhlIGNvdW50IG9mIHggaW4gdGhlIGNsdXN0ZXIgZ3JpZCBhcyB0aGUgdW5pb25pbmcgd2lsbCBoYWx2ZSBpdC5cclxuICAgICAgICBpZiAoZXh0ZW50SXNVbmlvbmVkKSB7XHJcbiAgICAgICAgICAgIHhDb3VudCAqPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHh3ID0gKHdlYkV4dGVudC54bWF4IC0gd2ViRXh0ZW50LnhtaW4pIC8geENvdW50O1xyXG4gICAgICAgIGxldCB5aCA9ICh3ZWJFeHRlbnQueW1heCAtIHdlYkV4dGVudC55bWluKSAvIHlDb3VudDtcclxuXHJcbiAgICAgICAgbGV0IGdzeG1pbiwgZ3N4bWF4LCBnc3ltaW4sIGdzeW1heDtcclxuXHJcbiAgICAgICAgLy8gY3JlYXRlIGFuIGFycmF5IG9mIGNsdXN0ZXJzIHRoYXQgaXMgYSBncmlkIG92ZXIgdGhlIHZpc2libGUgZXh0ZW50LiBFYWNoIGNsdXN0ZXIgY29udGFpbnMgdGhlIGV4dGVudCAoaW4gd2ViIG1lcmMpIHRoYXQgYm91bmRzIHRoZSBncmlkIHNwYWNlIGZvciBpdC5cclxuICAgICAgICB0aGlzLl9ncmlkQ2x1c3RlcnMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHhDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGdzeG1pbiA9IHdlYkV4dGVudC54bWluICsgKHh3ICogaSk7XHJcbiAgICAgICAgICAgIGdzeG1heCA9IGdzeG1pbiArIHh3O1xyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHlDb3VudDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBnc3ltaW4gPSB3ZWJFeHRlbnQueW1pbiArICh5aCAqIGopO1xyXG4gICAgICAgICAgICAgICAgZ3N5bWF4ID0gZ3N5bWluICsgeWg7XHJcbiAgICAgICAgICAgICAgICBsZXQgZXh0ID0geyB4bWluOiBnc3htaW4sIHhtYXg6IGdzeG1heCwgeW1pbjogZ3N5bWluLCB5bWF4OiBnc3ltYXggfTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2dyaWRDbHVzdGVycy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICBleHRlbnQ6IGV4dCxcclxuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgc3ViVHlwZUNvdW50czogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgc2luZ2xlczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICB4OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6IDBcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYW4gc3ZnIHN1cmZhY2Ugb24gdGhlIHZpZXcgaWYgaXQgZG9lc24ndCBhbHJlYWR5IGV4aXN0XHJcbiAgICAgKiBAcGFyYW0gdmlld1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTdXJmYWNlKCkge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQucGFyZW50RWxlbWVudCB8fCB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnROb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9hY3RpdmVWaWV3LmNhbnZhcy5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgc3VyZmFjZTogYW55ID0gZ2Z4LmNyZWF0ZVN1cmZhY2Uoc3VyZmFjZVBhcmVudEVsZW1lbnQsIFwiMFwiLCBcIjBcIik7XHJcbiAgICAgICAgc3VyZmFjZS5jb250YWluZXJHcm91cCA9IHN1cmZhY2UuY3JlYXRlR3JvdXAoKTtcclxuXHJcbiAgICAgICAgZG9tU3R5bGUuc2V0KHN1cmZhY2UucmF3Tm9kZSwgeyBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLCB0b3A6IFwiMFwiLCB6SW5kZXg6IC0xIH0pO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJvdmVyZmxvd1wiLCBcInZpc2libGVcIik7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcImNsYXNzXCIsIFwiZmNsLXN1cmZhY2VcIik7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlID0gc3VyZmFjZTtcclxuICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3ZpZXdQb2ludGVyTW92ZShldnQpIHtcclxuXHJcbiAgICAgICAgbGV0IG1vdXNlUG9zID0gdGhpcy5fZ2V0TW91c2VQb3MoZXZ0KTtcclxuICAgICAgIFxyXG4gICAgICAgIC8vIGlmIHRoZXJlJ3MgYW4gYWN0aXZlIGNsdXN0ZXIgYW5kIHRoZSBjdXJyZW50IHNjcmVlbiBwb3MgaXMgd2l0aGluIHRoZSBib3VuZHMgb2YgdGhhdCBjbHVzdGVyJ3MgZ3JvdXAgY29udGFpbmVyLCBkb24ndCBkbyBhbnl0aGluZyBtb3JlLiBcclxuICAgICAgICAvLyBUT0RPOiB3b3VsZCBwcm9iYWJseSBiZSBiZXR0ZXIgdG8gY2hlY2sgaWYgdGhlIHBvaW50IGlzIGluIHRoZSBhY3R1YWwgY2lyY2xlIG9mIHRoZSBjbHVzdGVyIGdyb3VwIGFuZCBpdCdzIGZsYXJlcyBpbnN0ZWFkIG9mIHVzaW5nIHRoZSByZWN0YW5nbGFyIGJvdW5kaW5nIGJveC5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ2x1c3Rlcikge1xyXG4gICAgICAgICAgICBsZXQgYmJveCA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgICAgIGlmIChiYm94KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobW91c2VQb3MueCA+PSBiYm94LmxlZnQgJiYgbW91c2VQb3MueCA8PSBiYm94LnJpZ2h0ICYmIG1vdXNlUG9zLnkgPj0gYmJveC50b3AgJiYgbW91c2VQb3MueSA8PSBiYm94LmJvdHRvbSkgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgdjogTWFwVmlldyA9IHRoaXMuX2FjdGl2ZVZpZXc7XHJcblxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcuaGl0VGVzdChtb3VzZVBvcykudGhlbigocmVzcG9uc2UpID0+IHtcclxuXHJcbiAgICAgICAgICAgIGxldCBncmFwaGljcyA9IHJlc3BvbnNlLnJlc3VsdHM7XHJcbiAgICAgICAgICAgIGlmIChncmFwaGljcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBncmFwaGljcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGcgPSBncmFwaGljc1tpXS5ncmFwaGljO1xyXG4gICAgICAgICAgICAgICAgaWYgKGcgJiYgKGcuYXR0cmlidXRlcy5jbHVzdGVySWQgIT0gbnVsbCAmJiAhZy5hdHRyaWJ1dGVzLmlzQ2x1c3RlckFyZWEpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsdXN0ZXIgPSB0aGlzLl9jbHVzdGVyc1tnLmF0dHJpYnV0ZXMuY2x1c3RlcklkXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hY3RpdmF0ZUNsdXN0ZXIoY2x1c3Rlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2FjdGl2YXRlQ2x1c3RlcihjbHVzdGVyOiBDbHVzdGVyKSB7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVDbHVzdGVyID09PSBjbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybjsgLy8gYWxyZWFkeSBhY3RpdmVcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IGNsdXN0ZXI7XHJcbiAgICAgICAgdGhpcy5faW5pdFN1cmZhY2UoKTtcclxuICAgICAgICB0aGlzLl9pbml0Q2x1c3RlcigpO1xyXG4gICAgICAgIHRoaXMuX2luaXRGbGFyZXMoKTtcclxuXHJcbiAgICAgICAgdGhpcy5faGlkZUdyYXBoaWMoW3RoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWNdKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGVhY3RpdmF0ZUNsdXN0ZXIoKSB7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLl9zaG93R3JhcGhpYyhbdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpY10pO1xyXG4gICAgICAgIHRoaXMuX3JlbW92ZUNsYXNzRnJvbUVsZW1lbnQodGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIik7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhY3RpdmF0ZWRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9oaWRlR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX2NsZWFyU3VyZmFjZSgpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJERS1hY3RpdmF0ZSBjbHVzdGVyXCIpO1xyXG5cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdFN1cmZhY2UoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgc3A6IFNjcmVlblBvaW50ID0gdGhpcy5fYWN0aXZlVmlldy50b1NjcmVlbig8UG9pbnQ+dGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSk7XHJcblxyXG4gICAgICAgIC8vIHRvU2NyZWVuKCkgcmV0dXJucyB0aGUgd3JvbmcgdmFsdWUgZm9yIHggaWYgYSAyZCBtYXAgaGFzIGJlZW4gd3JhcHBlZCBhcm91bmQgdGhlIGdsb2JlLiBOZWVkIHRvIGNoZWNrIGFuZCBjYXRlciBmb3IgdGhpcy4gSSB0aGluayB0aGlzIGEgYnVnIGluIHRoZSBhcGkuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgdmFyIHdzdyA9IHRoaXMuX2FjdGl2ZVZpZXcuc3RhdGUud29ybGRTY3JlZW5XaWR0aDtcclxuICAgICAgICAgICAgbGV0IHJhdGlvID0gcGFyc2VJbnQoKHNwLnggLyB3c3cpLnRvRml4ZWQoMCkpOyAvLyBnZXQgYSByYXRpbyB0byBkZXRlcm1pbmUgaG93IG1hbnkgdGltZXMgdGhlIG1hcCBoYXMgYmVlbiB3cmFwcGVkIGFyb3VuZC5cclxuICAgICAgICAgICAgaWYgKHNwLnggPCAwKSB7XHJcbiAgICAgICAgICAgICAgICAvLyB4IGlzIGxlc3MgdGhhbiAwLCBXVEYuIE5lZWQgdG8gYWRqdXN0IGJ5IHRoZSB3b3JsZCBzY3JlZW4gd2lkdGguXHJcbiAgICAgICAgICAgICAgICBzcC54ICs9IHdzdyAqIChyYXRpbyAqIC0xKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmIChzcC54ID4gd3N3KSB7XHJcbiAgICAgICAgICAgICAgICAvLyB4IGlzIHRvbyBiaWcsIFdURiBhcyB3ZWxsLCBjYXRlciBmb3IgaXQuXHJcbiAgICAgICAgICAgICAgICBzcC54IC09IHdzdyAqIHJhdGlvO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHpJbmRleDogMTEsIG92ZXJmbG93OiBcInZpc2libGVcIiwgd2lkdGg6IFwiMXB4XCIsIGhlaWdodDogXCIxcHhcIiwgbGVmdDogc3AueCArIFwicHhcIiwgdG9wOiBzcC55ICsgXCJweFwiIH0pO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJvdmVyZmxvd1wiLCBcInZpc2libGVcIik7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NsZWFyU3VyZmFjZSgpIHtcclxuICAgICAgICBsZXQgc3VyZmFjZSA9IHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZTtcclxuICAgICAgICBxdWVyeShcIj5cIiwgc3VyZmFjZS5jb250YWluZXJHcm91cC5yYXdOb2RlKS5mb3JFYWNoKGRvbUNvbnN0cnVjdC5kZXN0cm95KTtcclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHpJbmRleDogLTEsIG92ZXJmbG93OiBcImhpZGRlblwiLCB0b3A6IFwiMHB4XCIsIGxlZnQ6IFwiMHB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwiaGlkZGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2luaXRDbHVzdGVyKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyB3ZSdyZSBnb2luZyB0byByZXBsaWNhdGUgYSBjbHVzdGVyIGdyYXBoaWMgaW4gdGhlIHN2ZyBlbGVtZW50IHdlIGFkZGVkIHRvIHRoZSBsYXllciB2aWV3LiBKdXN0IHNvIGl0IGNhbiBiZSBzdHlsZWQgZWFzaWx5LiBOYXRpdmUgV2ViR0wgZm9yIFNjZW5lIFZpZXdzIHdvdWxkIHByb2JhYmx5IGJlIGJldHRlciwgYnV0IGF0IGxlYXN0IHRoaXMgd2F5IGNzcyBjYW4gc3RpbGwgYmUgdXNlZCB0byBzdHlsZS9hbmltYXRlIHRoaW5ncy5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCA9IHN1cmZhY2UuY29udGFpbmVyR3JvdXAuY3JlYXRlR3JvdXAoKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImNsdXN0ZXItZ3JvdXBcIik7XHJcblxyXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgY2x1c3RlciBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRDbHVzdGVyRWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkQ2x1c3RlckVsZW1lbnQsIFwiY2x1c3RlclwiKTtcclxuXHJcbiAgICAgICAgLy8gY3JlYXRlIHRoZSBjbHVzdGVyIHRleHQgc2hhcGVcclxuICAgICAgICBsZXQgY2xvbmVkVGV4dEVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXApO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGNsb25lZFRleHRFbGVtZW50LCBcImNsdXN0ZXItdGV4dFwiKTtcclxuICAgICAgICBjbG9uZWRUZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoY2xvbmVkQ2x1c3RlckVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoY2xvbmVkVGV4dEVsZW1lbnQpO1xyXG5cclxuICAgICAgICAvLyBzZXQgdGhlIGdyb3VwIGVsZW1lbnRzIGNsYXNzICAgICBcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0RmxhcmVzKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlciB8fCAhdGhpcy5kaXNwbGF5RmxhcmVzKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBncmlkQ2x1c3RlciA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vIGNoZWNrIGlmIHdlIG5lZWQgdG8gY3JlYXRlIGZsYXJlcyBmb3IgdGhlIGNsdXN0ZXJcclxuICAgICAgICBsZXQgc2luZ2xlRmxhcmVzID0gKGdyaWRDbHVzdGVyLnNpbmdsZXMgJiYgZ3JpZENsdXN0ZXIuc2luZ2xlcy5sZW5ndGggPiAwKSAmJiAoZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50IDw9IHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCk7XHJcbiAgICAgICAgbGV0IHN1YlR5cGVGbGFyZXMgPSAhc2luZ2xlRmxhcmVzICYmIChncmlkQ2x1c3Rlci5zdWJUeXBlQ291bnRzICYmIGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMubGVuZ3RoID4gMCk7XHJcblxyXG4gICAgICAgIGlmICghc2luZ2xlRmxhcmVzICYmICFzdWJUeXBlRmxhcmVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybjsgLy8gbm8gZmxhcmVzIHJlcXVpcmVkXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZmxhcmVzOiBGbGFyZVtdID0gW107XHJcbiAgICAgICAgaWYgKHNpbmdsZUZsYXJlcykge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZ3JpZENsdXN0ZXIuc2luZ2xlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGYgPSBuZXcgRmxhcmUoKTtcclxuICAgICAgICAgICAgICAgIGYudG9vbHRpcFRleHQgPSBncmlkQ2x1c3Rlci5zaW5nbGVzW2ldW3RoaXMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHldO1xyXG4gICAgICAgICAgICAgICAgZi5zaW5nbGVEYXRhID0gZ3JpZENsdXN0ZXIuc2luZ2xlc1tpXTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHN1YlR5cGVGbGFyZXMpIHtcclxuXHJcbiAgICAgICAgICAgIC8vIHNvcnQgc3ViIHR5cGVzIGJ5IGhpZ2hlc3QgY291bnQgZmlyc3RcclxuICAgICAgICAgICAgdmFyIHN1YlR5cGVzID0gZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5jb3VudCAtIGEuY291bnQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN1YlR5cGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZiA9IG5ldyBGbGFyZSgpO1xyXG4gICAgICAgICAgICAgICAgZi50b29sdGlwVGV4dCA9IGAke3N1YlR5cGVzW2ldLm5hbWV9ICgke3N1YlR5cGVzW2ldLmNvdW50fSlgO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZVRleHQgPSBzdWJUeXBlc1tpXS5jb3VudDtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBpZiB0aGVyZSBhcmUgbW9yZSBmbGFyZSBvYmplY3RzIHRvIGNyZWF0ZSB0aGFuIHRoZSBtYXhGbGFyZUNvdW50IGFuZCB0aGlzIGlzIG9uZSBvZiB0aG9zZSAtIGNyZWF0ZSBhIHN1bW1hcnkgZmxhcmUgdGhhdCBjb250YWlucyAnLi4uJyBhcyB0aGUgdGV4dC5cclxuICAgICAgICBsZXQgd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPSBmbGFyZXMubGVuZ3RoID4gdGhpcy5tYXhGbGFyZUNvdW50O1xyXG4gICAgICAgIGxldCBmbGFyZUNvdW50ID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPyB0aGlzLm1heEZsYXJlQ291bnQgOiBmbGFyZXMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvLyBpZiB0aGVyZSdzIGFuIGV2ZW4gYW1vdW50IG9mIGZsYXJlcywgcG9zaXRpb24gdGhlIGZpcnN0IGZsYXJlIHRvIHRoZSBsZWZ0LCBtaW51cyAxODAgZnJvbSBkZWdyZWUgdG8gZG8gdGhpcy5cclxuICAgICAgICAvLyBmb3IgYW4gYWRkIGFtb3VudCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgb24gdG9wLCAtOTAgdG8gZG8gdGhpcy4gTG9va3MgbmljZXIgdGhpcyB3YXkuXHJcbiAgICAgICAgbGV0IGRlZ3JlZVZhcmlhbmNlID0gKGZsYXJlQ291bnQgJSAyID09PSAwKSA/IC0xODAgOiAtOTA7XHJcbiAgICAgICAgbGV0IHZpZXdSb3RhdGlvbiA9IHRoaXMuX2lzMmQgPyB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uIDogMDtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTY3JlZW5Qb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9TY3JlZW4oPFBvaW50PnRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnkpO1xyXG4gICAgICAgIGxldCBjbHVzdGVyU3ltYm9sU2l6ZSA9IDxudW1iZXI+dGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2wuZ2V0KFwic2l6ZVwiKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZsYXJlQ291bnQ7IGkrKykge1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlID0gZmxhcmVzW2ldO1xyXG5cclxuICAgICAgICAgICAgLy8gc2V0IHNvbWUgYXR0cmlidXRlIGRhdGFcclxuICAgICAgICAgICAgbGV0IGZsYXJlQXR0cmlidXRlcyA9IHtcclxuICAgICAgICAgICAgICAgIGlzRmxhcmU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBpc1N1bW1hcnlGbGFyZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICB0b29sdGlwVGV4dDogXCJcIixcclxuICAgICAgICAgICAgICAgIGZsYXJlVGV4dEdyYXBoaWM6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJHcmFwaGljSWQ6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlcklkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnRcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGxldCBmbGFyZVRleHRBdHRyaWJ1dGVzID0ge307XHJcblxyXG4gICAgICAgICAgICAvLyBkbyBhIGNvdXBsZSBvZiB0aGluZ3MgZGlmZmVyZW50bHkgaWYgdGhpcyBpcyBhIHN1bW1hcnkgZmxhcmUgb3Igbm90XHJcbiAgICAgICAgICAgIGxldCBpc1N1bW1hcnlGbGFyZSA9IHdpbGxDb250YWluU3VtbWFyeUZsYXJlICYmIGkgPj0gdGhpcy5tYXhGbGFyZUNvdW50IC0gMTtcclxuICAgICAgICAgICAgaWYgKGlzU3VtbWFyeUZsYXJlKSB7XHJcbiAgICAgICAgICAgICAgICBmbGFyZS5pc1N1bW1hcnkgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgZmxhcmVBdHRyaWJ1dGVzLmlzU3VtbWFyeUZsYXJlID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGxldCB0b29sdGlwVGV4dCA9IFwiXCI7XHJcbiAgICAgICAgICAgICAgICAvLyBtdWx0aWxpbmUgdG9vbHRpcCBmb3Igc3VtbWFyeSBmbGFyZXMsIGllOiBncmVhdGVyIHRoYW4gdGhpcy5tYXhGbGFyZUNvdW50IGZsYXJlcyBwZXIgY2x1c3RlclxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IHRoaXMubWF4RmxhcmVDb3VudCAtIDEsIGpsZW4gPSBmbGFyZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHRpcFRleHQgKz0gaiA+ICh0aGlzLm1heEZsYXJlQ291bnQgLSAxKSA/IFwiXFxuXCIgOiBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGZsYXJlc1tqXS50b29sdGlwVGV4dDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRvb2x0aXBUZXh0ID0gdG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy50b29sdGlwVGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG5cclxuICAgICAgICAgICAgLy8gY3JlYXRlIGEgZ3JhcGhpYyBmb3IgdGhlIGZsYXJlIGFuZCBmb3IgdGhlIGZsYXJlIHRleHRcclxuICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGZsYXJlQXR0cmlidXRlcyxcclxuICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5LFxyXG4gICAgICAgICAgICAgICAgcG9wdXBUZW1wbGF0ZTogbnVsbFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sID0gdGhpcy5fZ2V0RmxhcmVTeW1ib2woZmxhcmUuZ3JhcGhpYyk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgICAgICBpZiAoZmxhcmUuZmxhcmVUZXh0KSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgICAgICAgICB0ZXh0U3ltYm9sLnRleHQgPSAhaXNTdW1tYXJ5RmxhcmUgPyBmbGFyZS5mbGFyZVRleHQudG9TdHJpbmcoKSA6IFwiLi4uXCI7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHRTeW1ib2wuYW5nbGUgPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyR3JhcGhpY0lkOiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJJZFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sLFxyXG4gICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZmxhcmVzIGhhdmUgYmVlbiBjcmVhdGVkIHNvIGFkZCB0aGVtIHRvIHRoZSBkb21cclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZmxhcmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBmID0gZmxhcmVzW2ldO1xyXG4gICAgICAgICAgICBpZiAoIWYuZ3JhcGhpYykgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICAvLyBjcmVhdGUgYSBncm91cCB0byBob2xkIGZsYXJlIG9iamVjdCBhbmQgdGV4dCBpZiBuZWVkZWQuIFxyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICAgICAgbGV0IHBvc2l0aW9uID0gdGhpcy5fc2V0RmxhcmVQb3NpdGlvbihmLmZsYXJlR3JvdXAsIGNsdXN0ZXJTeW1ib2xTaXplLCBmbGFyZUNvdW50LCBpLCBkZWdyZWVWYXJpYW5jZSwgdmlld1JvdGF0aW9uKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImZsYXJlLWdyb3VwXCIpO1xyXG4gICAgICAgICAgICBsZXQgZmxhcmVFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYuZ3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVFbGVtZW50KTtcclxuICAgICAgICAgICAgaWYgKGYudGV4dEdyYXBoaWMpIHtcclxuICAgICAgICAgICAgICAgIGxldCBmbGFyZVRleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYudGV4dEdyYXBoaWMsIGYuZmxhcmVHcm91cCk7XHJcbiAgICAgICAgICAgICAgICBmbGFyZVRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGZsYXJlVGV4dEVsZW1lbnQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIiwgMTApO1xyXG5cclxuICAgICAgICAgICAgLy8gYXNzaWduIHNvbWUgZXZlbnQgaGFuZGxlcnMgZm9yIHRoZSB0b29sdGlwc1xyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAubW91c2VFbnRlciA9IG9uLnBhdXNhYmxlKGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcIm1vdXNlZW50ZXJcIiwgKCkgPT4gdGhpcy5fY3JlYXRlVG9vbHRpcChmKSk7XHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5tb3VzZUxlYXZlID0gb24ucGF1c2FibGUoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwibW91c2VsZWF2ZVwiLCAoKSA9PiB0aGlzLl9kZXN0cm95VG9vbHRpcCgpKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zZXRGbGFyZVBvc2l0aW9uKGZsYXJlR3JvdXA6IGFueSwgY2x1c3RlclN5bWJvbFNpemU6IG51bWJlciwgZmxhcmVDb3VudDogbnVtYmVyLCBmbGFyZUluZGV4OiBudW1iZXIsIGRlZ3JlZVZhcmlhbmNlOiBudW1iZXIsIHZpZXdSb3RhdGlvbjogbnVtYmVyKSB7XHJcblxyXG4gICAgICAgIC8vIGdldCB0aGUgcG9zaXRpb24gb2YgdGhlIGZsYXJlIHRvIGJlIHBsYWNlZCBhcm91bmQgdGhlIGNvbnRhaW5lciBjaXJjbGUuXHJcbiAgICAgICAgbGV0IGRlZ3JlZSA9IHBhcnNlSW50KCgoMzYwIC8gZmxhcmVDb3VudCkgKiBmbGFyZUluZGV4KS50b0ZpeGVkKCkpO1xyXG4gICAgICAgIGRlZ3JlZSA9IGRlZ3JlZSArIGRlZ3JlZVZhcmlhbmNlO1xyXG5cclxuICAgICAgICAvLyB0YWtlIGludG8gYWNjb3VudCBhbnkgcm90YXRpb24gb24gdGhlIHZpZXdcclxuICAgICAgICBpZiAodmlld1JvdGF0aW9uICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGRlZ3JlZSAtPSB2aWV3Um90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmFkaWFuID0gZGVncmVlICogKE1hdGguUEkgLyAxODApO1xyXG4gICAgICAgIGxldCBidWZmZXIgPSB0aGlzLmZsYXJlQnVmZmVyUGl4ZWxzO1xyXG5cclxuICAgICAgICAvLyBwb3NpdGlvbiB0aGUgZmxhcmUgZ3JvdXAgYXJvdW5kIHRoZSBjbHVzdGVyXHJcbiAgICAgICAgbGV0IHBvc2l0aW9uID0ge1xyXG4gICAgICAgICAgICB4OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5jb3MocmFkaWFuKSxcclxuICAgICAgICAgICAgeTogKGJ1ZmZlciArIGNsdXN0ZXJTeW1ib2xTaXplKSAqIE1hdGguc2luKHJhZGlhbilcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAuc2V0VHJhbnNmb3JtKHsgZHg6IHBvc2l0aW9uLngsIGR5OiBwb3NpdGlvbi55IH0pO1xyXG4gICAgICAgIHJldHVybiBwb3NpdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9nZXRGbGFyZVN5bWJvbChmbGFyZUdyYXBoaWM6IEdyYXBoaWMpOiBTaW1wbGVNYXJrZXJTeW1ib2wge1xyXG4gICAgICAgIHJldHVybiAhdGhpcy5mbGFyZVJlbmRlcmVyID8gdGhpcy5mbGFyZVN5bWJvbCA6IHRoaXMuZmxhcmVSZW5kZXJlci5nZXRDbGFzc0JyZWFrSW5mbyhmbGFyZUdyYXBoaWMpLnN5bWJvbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVUb29sdGlwKGZsYXJlOiBGbGFyZSkge1xyXG5cclxuICAgICAgICBsZXQgZmxhcmVHcm91cCA9IGZsYXJlLmZsYXJlR3JvdXA7XHJcbiAgICAgICAgdGhpcy5fZGVzdHJveVRvb2x0aXAoKTtcclxuXHJcbiAgICAgICAgbGV0IHRvb2x0aXBMZW5ndGggPSBxdWVyeShcIi50b29sdGlwLXRleHRcIiwgZmxhcmVHcm91cC5yYXdOb2RlKS5sZW5ndGg7XHJcbiAgICAgICAgaWYgKHRvb2x0aXBMZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGdldCB0aGUgdGV4dCBmcm9tIHRoZSBkYXRhLXRvb2x0aXAgYXR0cmlidXRlIG9mIHRoZSBzaGFwZSBvYmplY3RcclxuICAgICAgICBsZXQgdGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG4gICAgICAgIGlmICghdGV4dCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm5vIHRvb2x0aXAgdGV4dCBmb3IgZmxhcmUuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBzcGxpdCBvbiBcXG4gY2hhcmFjdGVyIHRoYXQgc2hvdWxkIGJlIGluIHRvb2x0aXAgdG8gc2lnbmlmeSBtdWx0aXBsZSBsaW5lc1xyXG4gICAgICAgIGxldCBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIik7XHJcblxyXG4gICAgICAgIC8vIGNyZWF0ZSBhIGdyb3VwIHRvIGhvbGQgdGhlIHRvb2x0aXAgZWxlbWVudHNcclxuICAgICAgICBsZXQgdG9vbHRpcEdyb3VwID0gZmxhcmVHcm91cC5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICAvLyBnZXQgdGhlIGZsYXJlIHN5bWJvbCwgd2UnbGwgdXNlIHRoaXMgdG8gc3R5bGUgdGhlIHRvb2x0aXAgYm94XHJcbiAgICAgICAgbGV0IGZsYXJlU3ltYm9sID0gdGhpcy5fZ2V0RmxhcmVTeW1ib2woZmxhcmUuZ3JhcGhpYyk7XHJcblxyXG4gICAgICAgIC8vIGFsaWduIG9uIHRvcCBmb3Igbm9ybWFsIGZsYXJlLCBhbGlnbiBvbiBib3R0b20gZm9yIHN1bW1hcnkgZmxhcmVzLlxyXG4gICAgICAgIGxldCBoZWlnaHQgPSBmbGFyZVN5bWJvbC5zaXplO1xyXG5cclxuICAgICAgICBsZXQgeFBvcyA9IDE7XHJcbiAgICAgICAgbGV0IHlQb3MgPSAhZmxhcmUuaXNTdW1tYXJ5ID8gKChoZWlnaHQpICogLTEpIDogaGVpZ2h0ICsgNTtcclxuXHJcbiAgICAgICAgdG9vbHRpcEdyb3VwLnJhd05vZGUuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJ0b29sdGlwLXRleHRcIik7XHJcbiAgICAgICAgbGV0IHRleHRTaGFwZXMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHJcbiAgICAgICAgICAgIGxldCB0ZXh0U2hhcGUgPSB0b29sdGlwR3JvdXAuY3JlYXRlVGV4dCh7IHg6IHhQb3MsIHk6IHlQb3MgKyAoaSAqIDEwKSwgdGV4dDogbGluZXNbaV0sIGFsaWduOiAnbWlkZGxlJyB9KVxyXG4gICAgICAgICAgICAgICAgLnNldEZpbGwodGhpcy5mbGFyZVRleHRTeW1ib2wuY29sb3IpXHJcbiAgICAgICAgICAgICAgICAuc2V0Rm9udCh7IHNpemU6IDEwLCBmYW1pbHk6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwiZmFtaWx5XCIpLCB3ZWlnaHQ6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwid2VpZ2h0XCIpIH0pO1xyXG5cclxuICAgICAgICAgICAgdGV4dFNoYXBlcy5wdXNoKHRleHRTaGFwZSk7XHJcbiAgICAgICAgICAgIHRleHRTaGFwZS5yYXdOb2RlLnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByZWN0UGFkZGluZyA9IDI7XHJcbiAgICAgICAgbGV0IHRleHRCb3ggPSB0b29sdGlwR3JvdXAuZ2V0Qm91bmRpbmdCb3goKTtcclxuXHJcbiAgICAgICAgbGV0IHJlY3RTaGFwZSA9IHRvb2x0aXBHcm91cC5jcmVhdGVSZWN0KHsgeDogdGV4dEJveC54IC0gcmVjdFBhZGRpbmcsIHk6IHRleHRCb3gueSAtIHJlY3RQYWRkaW5nLCB3aWR0aDogdGV4dEJveC53aWR0aCArIChyZWN0UGFkZGluZyAqIDIpLCBoZWlnaHQ6IHRleHRCb3guaGVpZ2h0ICsgKHJlY3RQYWRkaW5nICogMiksIHI6IDAgfSlcclxuICAgICAgICAgICAgLnNldEZpbGwoZmxhcmVTeW1ib2wuY29sb3IpO1xyXG5cclxuICAgICAgICBpZiAoZmxhcmVTeW1ib2wub3V0bGluZSkge1xyXG4gICAgICAgICAgICByZWN0U2hhcGUuc2V0U3Ryb2tlKHsgY29sb3I6IGZsYXJlU3ltYm9sLm91dGxpbmUuY29sb3IsIHdpZHRoOiAwLjUgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWN0U2hhcGUucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAubW92ZVRvRnJvbnQoKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGV4dFNoYXBlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICB0ZXh0U2hhcGVzW2ldLm1vdmVUb0Zyb250KCk7XHJcbiAgICAgICAgfSAgICAgICAgXHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2Rlc3Ryb3lUb29sdGlwKCkge1xyXG4gICAgICAgIHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UucmF3Tm9kZSkuZm9yRWFjaChkb21Db25zdHJ1Y3QuZGVzdHJveSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vICNyZWdpb24gaGVscGVyIGZ1bmN0aW9uc1xyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyhncmFwaGljOiBHcmFwaGljLCBzdXJmYWNlOiBhbnkpOiBIVE1MRWxlbWVudCB7XHJcblxyXG4gICAgICAgIC8vIGZha2Ugb3V0IGEgR0ZYT2JqZWN0IHNvIHdlIGNhbiBnZW5lcmF0ZSBhbiBzdmcgc2hhcGUgdGhhdCB0aGUgcGFzc2VkIGluIGdyYXBoaWNzIHNoYXBlXHJcbiAgICAgICAgbGV0IGcgPSBuZXcgR0ZYT2JqZWN0KCk7XHJcbiAgICAgICAgZy5ncmFwaGljID0gZ3JhcGhpYztcclxuICAgICAgICBnLnJlbmRlcmluZ0luZm8gPSB7IHN5bWJvbDogZ3JhcGhpYy5zeW1ib2wgfTtcclxuXHJcbiAgICAgICAgLy8gc2V0IHVwIHBhcmFtZXRlcnMgZm9yIHRoZSBjYWxsIHRvIHJlbmRlclxyXG4gICAgICAgIC8vIHNldCB0aGUgdHJhbnNmb3JtIG9mIHRoZSBwcm9qZWN0b3IgdG8gMCdzIGFzIHdlJ3JlIGp1c3QgcGxhY2luZyB0aGUgZ2VuZXJhdGVkIGNsdXN0ZXIgc2hhcGUgYXQgZXhhY3RseSAwLDAuXHJcbiAgICAgICAgbGV0IHByb2plY3RvciA9IG5ldyBQcm9qZWN0b3IoKTtcclxuICAgICAgICBwcm9qZWN0b3IuX3RyYW5zZm9ybSA9IFswLCAwLCAwLCAwLCAwLCAwXTtcclxuICAgICAgICBwcm9qZWN0b3IuX3Jlc29sdXRpb24gPSAwO1xyXG5cclxuICAgICAgICBsZXQgc3RhdGUgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgc3RhdGUgPSB0aGlzLl9hY3RpdmVWaWV3LnN0YXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy8gZmFrZSBvdXQgYSBzdGF0ZSBvYmplY3QgZm9yIDNkIHZpZXdzLlxyXG4gICAgICAgICAgICBzdGF0ZSA9IHtcclxuICAgICAgICAgICAgICAgIGNsaXBwZWRFeHRlbnQ6IHRoaXMuX2FjdGl2ZVZpZXcuZXh0ZW50LFxyXG4gICAgICAgICAgICAgICAgcm90YXRpb246IDAsXHJcbiAgICAgICAgICAgICAgICBzcGF0aWFsUmVmZXJlbmNlOiB0aGlzLl9hY3RpdmVWaWV3LnNwYXRpYWxSZWZlcmVuY2UsXHJcbiAgICAgICAgICAgICAgICB3b3JsZFNjcmVlbldpZHRoOiAxXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcGFyID0ge1xyXG4gICAgICAgICAgICBzdXJmYWNlOiBzdXJmYWNlLFxyXG4gICAgICAgICAgICBzdGF0ZTogc3RhdGUsXHJcbiAgICAgICAgICAgIHByb2plY3RvcjogcHJvamVjdG9yXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZy5kb1JlbmRlcihwYXIpO1xyXG5cclxuICAgICAgICAvLyBuZWVkIHRvIGZpeCB1cCB0aGUgdHJhbnNmb3JtIG9mIHRoZSBuZXcgc2hhcGUuIFRleHQgc3ltYm9scyBzZWVtIHRvIGdldCBhIGJpdCBvdXQgb2Ygd2hhY2suXHJcbiAgICAgICAgbGV0IHlvZmZzZXQgPSBncmFwaGljLnN5bWJvbFtcInlvZmZzZXRcIl0gPyBncmFwaGljLnN5bWJvbFtcInlvZmZzZXRcIl0gKiAtMSA6IDA7XHJcbiAgICAgICAgbGV0IHhvZmZzZXQgPSBncmFwaGljLnN5bWJvbFtcInhvZmZzZXRcIl0gPyBncmFwaGljLnN5bWJvbFtcInhvZmZzZXRcIl0gKiAtMSA6IDA7XHJcbiAgICAgICAgZy5fc2hhcGUuc2V0VHJhbnNmb3JtKHsgeHg6IDEsIHl5OiAxLCBkeTogeW9mZnNldCwgZHg6IHhvZmZzZXQgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGcuX3NoYXBlLnJhd05vZGU7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2V4dGVudCgpOiBFeHRlbnQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5leHRlbnQgOiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2NhbGUoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYWN0aXZlVmlldyA/IHRoaXMuX2FjdGl2ZVZpZXcuc2NhbGUgOiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJRSAvIEVkZ2UgZG9uJ3QgaGF2ZSB0aGUgY2xhc3NMaXN0IHByb3BlcnR5IG9uIHN2ZyBlbGVtZW50cywgc28gd2UgY2FuJ3QgdXNlIHRoYXQgYWRkIC8gcmVtb3ZlIGNsYXNzZXMgLSBwcm9iYWJseSB3aHkgZG9qbyBkb21DbGFzcyBkb2Vzbid0IHdvcmsgZWl0aGVyLlxyXG4gICAgICAgc28gdGhlIGZvbGxvd2luZyB0d28gZnVuY3Rpb25zIGFyZSBkb2RneSBzdHJpbmcgaGFja3MgdG8gYWRkIC8gcmVtb3ZlIGNsYXNzZXMuIFVzZXMgYSB0aW1lb3V0IHNvIHlvdSBjYW4gbWFrZSBjc3MgdHJhbnNpdGlvbnMgd29yayBpZiBkZXNpcmVkLlxyXG4gICAgICogQHBhcmFtIGVsZW1lbnRcclxuICAgICAqIEBwYXJhbSBjbGFzc05hbWVcclxuICAgICAqIEBwYXJhbSB0aW1lb3V0TXNcclxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9hZGRDbGFzc1RvRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCwgY2xhc3NOYW1lOiBzdHJpbmcsIHRpbWVvdXRNcz86IG51bWJlciwgY2FsbGJhY2s/OiBGdW5jdGlvbikge1xyXG5cclxuICAgICAgICBsZXQgYWRkQ2xhc3M6IEZ1bmN0aW9uID0gKF9lbGVtZW50LCBfY2xhc3NOYW1lKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjdXJyZW50Q2xhc3MgPSBfZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKTtcclxuICAgICAgICAgICAgaWYgKCFjdXJyZW50Q2xhc3MpIGN1cnJlbnRDbGFzcyA9IFwiXCI7XHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50Q2xhc3MuaW5kZXhPZihcIiBcIiArIF9jbGFzc05hbWUpICE9PSAtMSkgcmV0dXJuO1xyXG4gICAgICAgICAgICBsZXQgbmV3Q2xhc3MgPSAoY3VycmVudENsYXNzICsgXCIgXCIgKyBfY2xhc3NOYW1lKS50cmltKCk7XHJcbiAgICAgICAgICAgIF9lbGVtZW50LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIG5ld0NsYXNzKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodGltZW91dE1zKSB7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgYWRkQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIHRpbWVvdXRNcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfcmVtb3ZlQ2xhc3NGcm9tRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCwgY2xhc3NOYW1lOiBzdHJpbmcsIHRpbWVvdXRNcz86IG51bWJlciwgY2FsbGJhY2s/OiBGdW5jdGlvbikge1xyXG5cclxuICAgICAgICBsZXQgcmVtb3ZlQ2xhc3M6IEZ1bmN0aW9uID0gKF9lbGVtZW50LCBfY2xhc3NOYW1lKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjdXJyZW50Q2xhc3MgPSBfZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKTtcclxuICAgICAgICAgICAgaWYgKCFjdXJyZW50Q2xhc3MpIHJldHVybjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgPT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIF9lbGVtZW50LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIGN1cnJlbnRDbGFzcy5yZXBsYWNlKFwiIFwiICsgX2NsYXNzTmFtZSwgXCJcIikpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZW1vdmVDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9nZXRNb3VzZVBvcyhldnQpIHtcclxuICAgICAgICAvLyBjb250YWluZXIgb24gdGhlIHZpZXcgaXMgYWN0dWFsbHkgYSBodG1sIGVsZW1lbnQgYXQgdGhpcyBwb2ludCwgbm90IGEgc3RyaW5nIGFzIHRoZSB0eXBpbmdzIHN1Z2dlc3QuXHJcbiAgICAgICAgbGV0IGNvbnRhaW5lcjogYW55ID0gdGhpcy5fYWN0aXZlVmlldy5jb250YWluZXI7XHJcbiAgICAgICAgbGV0IHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgeDogZXZ0LnggLSByZWN0LmxlZnQsXHJcbiAgICAgICAgICAgIHk6IGV2dC55IC0gcmVjdC50b3BcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNldHRpbmcgdmlzaWJsZSB0byBmYWxzZSBvbiBhIGdyYXBoaWMgZG9lc24ndCB3b3JrIGluIDQuMiBmb3Igc29tZSByZWFzb24uIFJlbW92aW5nIHRoZSBncmFwaGljIHRvIGhpZGUgaXQgaW5zdGVhZC4gSSB0aGluayB2aXNpYmxlIHByb3BlcnR5IHNob3VsZCBwcm9iYWJseSB3b3JrIHRob3VnaC5cclxuICAgICAqIEBwYXJhbSBncmFwaGljXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2hpZGVHcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMgfCBHcmFwaGljW10pIHtcclxuICAgICAgICBpZiAoIWdyYXBoaWMpIHJldHVybjtcclxuICAgICAgICBpZiAoZ3JhcGhpYy5oYXNPd25Qcm9wZXJ0eShcImxlbmd0aFwiKSkge1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1hbnkoPEdyYXBoaWNbXT5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKDxHcmFwaGljPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zaG93R3JhcGhpYyhncmFwaGljOiBHcmFwaGljIHwgR3JhcGhpY1tdKSB7XHJcbiAgICAgICAgaWYgKCFncmFwaGljKSByZXR1cm47XHJcbiAgICAgICAgaWYgKGdyYXBoaWMuaGFzT3duUHJvcGVydHkoXCJsZW5ndGhcIikpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGRNYW55KDxHcmFwaGljW10+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmFkZCg8R3JhcGhpYz5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8jZW5kcmVnaW9uXHJcblxyXG59XHJcblxyXG5cclxuLy8gaW50ZXJmYWNlIEFjdGl2ZVZpZXcgZXh0ZW5kcyBNYXBWaWV3IGFuZCBTY2VuZVZpZXcgdG8gYWRkIHNvbWUgcHJvcGVydGllcyB7XHJcbmludGVyZmFjZSBBY3RpdmVWaWV3IGV4dGVuZHMgTWFwVmlldywgU2NlbmVWaWV3IHtcclxuICAgIGNhbnZhczogYW55O1xyXG4gICAgc3RhdGU6IGFueTtcclxuICAgIGZjbFN1cmZhY2U6IGFueTtcclxuICAgIGZjbFBvaW50ZXJNb3ZlOiBJSGFuZGxlO1xyXG4gICAgZmNsUG9pbnRlckRvd246IElIYW5kbGU7XHJcblxyXG4gICAgY29uc3RyYWludHM6IGFueTtcclxuICAgIGdvVG86ICh0YXJnZXQ6IGFueSwgb3B0aW9uczogX19lc3JpLk1hcFZpZXdHb1RvT3B0aW9ucykgPT4gSVByb21pc2U8YW55PjtcclxuICAgIHRvTWFwOiAoc2NyZWVuUG9pbnQ6IFNjcmVlblBvaW50KSA9PiBQb2ludDtcclxufVxyXG5cclxuY2xhc3MgR3JpZENsdXN0ZXIge1xyXG4gICAgZXh0ZW50OiBhbnk7XHJcbiAgICBjbHVzdGVyQ291bnQ6IG51bWJlcjtcclxuICAgIHN1YlR5cGVDb3VudHM6IGFueVtdID0gW107XHJcbiAgICBzaW5nbGVzOiBhbnlbXSA9IFtdO1xyXG4gICAgcG9pbnRzOiBhbnlbXSA9IFtdO1xyXG4gICAgeDogbnVtYmVyO1xyXG4gICAgeTogbnVtYmVyO1xyXG59XHJcblxyXG5cclxuY2xhc3MgQ2x1c3RlciB7XHJcbiAgICBjbHVzdGVyR3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRleHRHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgYXJlYUdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICBjbHVzdGVySWQ6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJHcm91cDogYW55O1xyXG4gICAgZ3JpZENsdXN0ZXI6IEdyaWRDbHVzdGVyO1xyXG59XHJcblxyXG5jbGFzcyBGbGFyZSB7XHJcbiAgICBncmFwaGljOiBHcmFwaGljO1xyXG4gICAgdGV4dEdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0b29sdGlwVGV4dDogc3RyaW5nO1xyXG4gICAgZmxhcmVUZXh0OiBzdHJpbmc7IFxyXG4gICAgc2luZ2xlRGF0YTogYW55W107XHJcbiAgICBmbGFyZUdyb3VwOiBhbnk7XHJcbiAgICBpc1N1bW1hcnk6IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQb2ludEZpbHRlciB7XHJcbiAgICBmaWx0ZXJOYW1lOiBzdHJpbmc7XHJcbiAgICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHByb3BlcnR5VmFsdWVzOiBhbnlbXTtcclxuXHJcbiAgICAvLyBkZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGZpbHRlciBpbmNsdWRlcyBvciBleGNsdWRlcyB0aGUgcG9pbnQgZGVwZW5kaW5nIG9uIHdoZXRoZXIgaXQgY29udGFpbnMgdGhlIHByb3BlcnR5IHZhbHVlLlxyXG4gICAgLy8gZmFsc2UgbWVhbnMgdGhlIHBvaW50IHdpbGwgYmUgZXhjbHVkZWQgaWYgdGhlIHZhbHVlIGRvZXMgZXhpc3QgaW4gdGhlIG9iamVjdCwgdHJ1ZSBtZWFucyBpdCB3aWxsIGJlIGV4Y2x1ZGVkIGlmIGl0IGRvZXNuJ3QuXHJcbiAgICBrZWVwT25seUlmVmFsdWVFeGlzdHM6IGJvb2xlYW47XHJcblxyXG4gICAgY29uc3RydWN0b3IoZmlsdGVyTmFtZTogc3RyaW5nLCBwcm9wZXJ0eU5hbWU6IHN0cmluZywgdmFsdWVzOiBhbnlbXSwga2VlcE9ubHlJZlZhbHVlRXhpc3RzOiBib29sZWFuID0gZmFsc2UpIHtcclxuICAgICAgICB0aGlzLmZpbHRlck5hbWUgPSBmaWx0ZXJOYW1lO1xyXG4gICAgICAgIHRoaXMucHJvcGVydHlOYW1lID0gcHJvcGVydHlOYW1lO1xyXG4gICAgICAgIHRoaXMucHJvcGVydHlWYWx1ZXMgPSB2YWx1ZXM7XHJcbiAgICAgICAgdGhpcy5rZWVwT25seUlmVmFsdWVFeGlzdHMgPSBrZWVwT25seUlmVmFsdWVFeGlzdHM7XHJcbiAgICB9XHJcblxyXG59XHJcblxyXG4iXX0=
