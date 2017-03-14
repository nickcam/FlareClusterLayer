/// <reference path="../typings/index.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
define(["require", "exports", "esri/layers/GraphicsLayer", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/TextSymbol", "esri/symbols/SimpleLineSymbol", "esri/Color", "esri/core/watchUtils", "esri/geometry/support/webMercatorUtils", "esri/Graphic", "esri/geometry/Point", "esri/geometry/Multipoint", "esri/geometry/Polygon", "esri/geometry/geometryEngine", "esri/geometry/SpatialReference", "esri/views/2d/engine/graphics/GFXObject", "esri/views/2d/engine/graphics/Projector", "esri/core/accessorSupport/decorators", "dojo/on", "dojox/gfx", "dojo/dom-construct", "dojo/query", "dojo/dom-attr", "dojo/dom-style", "dojo/sniff"], function (require, exports, GraphicsLayer, SimpleMarkerSymbol, TextSymbol, SimpleLineSymbol, Color, watchUtils, webMercatorUtils, Graphic, Point, Multipoint, Polygon, geometryEngine, SpatialReference, GFXObject, Projector, asd, on, gfx, domConstruct, query, domAttr, domStyle, sniff) {
    "use strict";
    //extend GraphicsLayer using 'accessorSupport/decorators'
    var FlareClusterLayer = (function (_super) {
        __extends(FlareClusterLayer, _super);
        function FlareClusterLayer(options) {
            var _this = _super.call(this, options) || this;
            _this._viewLoadCount = 0;
            _this._clusters = {};
            //set the defaults
            if (!options) {
                //missing required parameters
                console.error("Missing required parameters to flare cluster layer constructor.");
                return _this;
            }
            _this.singlePopupTemplate = options.singlePopupTemplate;
            //set up the clustering properties
            _this.clusterRatio = options.clusterRatio || 75;
            _this.clusterToScale = options.clusterToScale || 2000000;
            _this.clusterMinCount = options.clusterMinCount || 2;
            _this.singleFlareTooltipProperty = options.singleFlareTooltipProperty || "name";
            if (options.clusterAreaDisplay) {
                _this.clusterAreaDisplay = options.clusterAreaDisplay === "none" ? undefined : options.clusterAreaDisplay;
            }
            _this.maxFlareCount = options.maxFlareCount || 8;
            _this.maxSingleFlareCount = options.maxSingleFlareCount || 8;
            _this.displayFlares = options.displayFlares === false ? false : true; //default to true
            _this.displaySubTypeFlares = options.displaySubTypeFlares === true;
            _this.subTypeFlareProperty = options.subTypeFlareProperty || undefined;
            _this.flareBufferPixels = options.flareBufferPixels || 6;
            //data set property names
            _this.xPropertyName = options.xPropertyName || "x";
            _this.yPropertyName = options.yPropertyName || "y";
            _this.zPropertyName = options.zPropertyName || "z";
            //set up the symbology/renderer properties
            _this.clusterRenderer = options.clusterRenderer;
            _this.areaRenderer = options.areaRenderer;
            _this.singleRenderer = options.singleRenderer;
            _this.singleSymbol = options.singleSymbol;
            _this.flareRenderer = options.flareRenderer;
            _this.refreshOnStationary = options.refreshOnStationary === false ? false : true; //default to true
            //add some default symbols or use the options values.
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
                yoffset: -3
            });
            _this.flareTextSymbol = options.flareTextSymbol || new TextSymbol({
                color: new Color([255, 255, 255]),
                font: {
                    size: 6,
                    family: "arial"
                },
                yoffset: -2
            });
            //initial data
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
            //add a stationary watch on the view to refresh if specified in options.
            if (this.refreshOnStationary) {
                watchUtils.pausable(evt.layerView.view, "stationary", function (isStationary, b, c, view) { return _this._viewStationary(isStationary, b, c, view); });
            }
            if (this._viewLoadCount === 0) {
                this._activeView = evt.layerView.view;
                this._readyToDraw = true;
                if (this._queuedInitialDraw) {
                    //we've been waiting for this to happen to draw
                    this.draw();
                    this._queuedInitialDraw = false;
                }
            }
            this._viewLoadCount++;
            if (evt.layerView.view.type === "2d") {
                //for map views, wait for the layerview ot be attached, before adding events
                watchUtils.whenTrueOnce(evt.layerView, "attached", function () { return _this._addViewEvents(evt.layerView); });
            }
            else {
                //for scene views just add the events straight away
                this._addViewEvents(evt.layerView);
            }
        };
        FlareClusterLayer.prototype._addViewEvents = function (layerView) {
            var _this = this;
            var v = layerView.view;
            if (!v.fclPointerMove) {
                var container = undefined;
                if (v.type === "2d") {
                    //for a map view get the container element of the layer view to add mousemove event to.
                    container = layerView.container.element;
                }
                else {
                    //for scene view get the canvas element under the view container to add mousemove to.
                    container = query("canvas", v.container)[0];
                }
                //Add pointer move and pointer down. Pointer down to handle touch devices.
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
                //if moving deactivate cluster;
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
            //Not ready to draw yet so queue one up
            if (!this._readyToDraw) {
                this._queuedInitialDraw = true;
                return;
            }
            if (!this._activeView || !this._data)
                return;
            this._is2d = this._activeView.type === "2d";
            //check to make sure we have an area renderer set if one needs to be
            if (this.clusterAreaDisplay && !this.areaRenderer) {
                console.error("FlareClusterLayer: areaRenderer must be set if clusterAreaDisplay is set.");
                return;
            }
            this.clear();
            console.time("draw-data-" + this._activeView.type);
            this._isClustered = this.clusterToScale < this._scale();
            var graphics = [];
            //get an extent that is in web mercator to make sure it's flat for extent checking
            //The webextent will need to be normalized since panning over the international dateline will cause
            //cause the extent to shift outside the -180 to 180 degree window.  If we don't normalize then the
            //clusters will not be drawn if the map pans over the international dateline.
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
                //check if filters are specified and continue if this object doesn't pass
                if (!this._passesFilter(obj)) {
                    continue;
                }
                xVal = obj[this.xPropertyName];
                yVal = obj[this.yPropertyName];
                //get a web merc lng/lat for extent checking. Use web merc as it's flat to cater for longitude pole
                if (this.spatialReference.isWebMercator) {
                    web = [xVal, yVal];
                }
                else {
                    web = webMercatorUtils.lngLatToXY(xVal, yVal);
                }
                //check if the obj is visible in the extent before proceeding
                if ((web[0] <= webExtent.xmin || web[0] > webExtent.xmax) || (web[1] <= webExtent.ymin || web[1] > webExtent.ymax)) {
                    continue;
                }
                if (this._isClustered) {
                    //loop cluster grid to see if it should be added to one
                    for (var j = 0, jLen = this._gridClusters.length; j < jLen; j++) {
                        var cl = this._gridClusters[j];
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
            //emit an event to signal drawing is complete.
            this.emit("draw-complete", {});
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
                    passes = filter.keepOnlyIfValueExists; //the value exists so return whether we should be keeping it or not.
                }
                else if (!valExists && filter.keepOnlyIfValueExists) {
                    passes = false; //return false as the value doesn't exist, and we should only be keeping point objects where it does exist.
                }
                if (!passes)
                    return false; //if it hasn't passed any of the filters return false;
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
                //no symbology for singles defined, use the default symbol from the cluster renderer
                graphic.symbol = this.clusterRenderer.defaultSymbol;
            }
            this.add(graphic);
        };
        FlareClusterLayer.prototype._createCluster = function (gridCluster) {
            var cluster = new Cluster();
            cluster.gridCluster = gridCluster;
            //make sure all geometries added to Graphic objects are in web mercator otherwise wrap around doesn't work.
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
            //also create a text symbol to display the cluster count
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
            //add an area graphic to display the bounds of the cluster if configured to
            if (this.clusterAreaDisplay && gridCluster.points && gridCluster.points.length > 0) {
                var mp = new Multipoint();
                mp.points = gridCluster.points;
                var area = geometryEngine.convexHull(mp, true); //use convex hull on the points to get the boundary
                var areaAttr = {
                    x: gridCluster.x,
                    y: gridCluster.y,
                    clusterCount: gridCluster.clusterCount,
                    clusterId: cluster.clusterId,
                    isClusterArea: true
                };
                if (area.rings && area.rings.length > 0) {
                    var areaPoly = new Polygon(); //had to create a new polygon and fill it with the ring of the calculated area for SceneView to work.
                    areaPoly = areaPoly.addRing(area.rings[0]);
                    if (!areaPoly.spatialReference.isWebMercator) {
                        areaPoly = webMercatorUtils.geographicToWebMercator(areaPoly);
                    }
                    cluster.areaGraphic = new Graphic({ geometry: areaPoly, attributes: areaAttr });
                    cluster.areaGraphic.symbol = this.areaRenderer.getClassBreakInfo(cluster.areaGraphic).symbol;
                }
            }
            //add the graphics in order        
            if (cluster.areaGraphic && this.clusterAreaDisplay === "always") {
                this.add(cluster.areaGraphic);
            }
            this.add(cluster.clusterGraphic);
            this.add(cluster.textGraphic);
            this._clusters[cluster.clusterId] = cluster;
        };
        FlareClusterLayer.prototype._createClusterGrid = function (webExtent, extentIsUnioned) {
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
            //This is a hack for IE & Edge. hitTest on the view doesn't pick up any results unless the z-index of the layerView container is at least 1. So set it to 1, but also have to set the .esri-ui
            //container to 2 otherwise it can't be clicked on as it's covered by the layer view container. meh!
            //using dojo/sniff to target IE browsers.
            if (this._is2d && (sniff("trident") || sniff("ie") || sniff("edge"))) {
                domStyle.set(this._layerView2d.container.element, "z-index", "1");
                query(".esri-ui").forEach(function (node, index) {
                    domStyle.set(node, "z-index", "2");
                });
            }
        };
        FlareClusterLayer.prototype._viewPointerMove = function (evt) {
            var _this = this;
            var mousePos = this._getMousePos(evt);
            //if there's an active cluster and the current screen pos is within the bounds of that cluster's group container, don't do anything more. 
            //TODO: would probably be better to check if the point is in the actual circle of the cluster group and it's flares instead of using the rectangle bounding box.
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
                return; //already active
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
            var spp;
            var sp = this._activeView.toScreen(this._activeCluster.clusterGraphic.geometry, spp);
            //toScreen() returns the wrong value for x if a 2d map has been wrapped around the globe. Need to check and cater for this. I think this a bug in the api.
            if (this._is2d) {
                var wsw = this._activeView.state.worldScreenWidth;
                var ratio = parseInt((sp.x / wsw).toFixed(0)); //get a ratio to determine how many times the map has been wrapped around.
                if (sp.x < 0) {
                    //x is less than 0, WTF. Need to adjust by the world screen width.
                    sp.x += wsw * (ratio * -1);
                }
                else if (sp.x > wsw) {
                    //x is too big, WTF as well, cater for it.
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
            //we're going to replicate a cluster graphic in the svg element we added to the layer view. Just so it can be styled easily. Native WebGL for Scene Views would probably be better, but at least this way css can still be used to style/animate things.
            this._activeCluster.clusterGroup = surface.containerGroup.createGroup();
            this._addClassToElement(this._activeCluster.clusterGroup.rawNode, "cluster-group");
            //create the cluster shape
            var clonedClusterElement = this._createClonedElementFromGraphic(this._activeCluster.clusterGraphic, this._activeCluster.clusterGroup);
            this._addClassToElement(clonedClusterElement, "cluster");
            //create the cluster text shape
            var clonedTextElement = this._createClonedElementFromGraphic(this._activeCluster.textGraphic, this._activeCluster.clusterGroup);
            this._addClassToElement(clonedTextElement, "cluster-text");
            clonedTextElement.setAttribute("pointer-events", "none");
            this._activeCluster.clusterGroup.rawNode.appendChild(clonedClusterElement);
            this._activeCluster.clusterGroup.rawNode.appendChild(clonedTextElement);
            //set the group class     
            this._addClassToElement(this._activeCluster.clusterGroup.rawNode, "activated", 10);
        };
        FlareClusterLayer.prototype._initFlares = function () {
            var _this = this;
            if (!this._activeCluster || !this.displayFlares)
                return;
            var gridCluster = this._activeCluster.gridCluster;
            //check if we need to create flares for the cluster
            var singleFlares = (gridCluster.singles && gridCluster.singles.length > 0) && (gridCluster.clusterCount <= this.maxSingleFlareCount);
            var subTypeFlares = !singleFlares && (gridCluster.subTypeCounts && gridCluster.subTypeCounts.length > 0);
            if (!singleFlares && !subTypeFlares) {
                return; //no flares required
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
                //sort sub types by highest count first
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
            //if there are more flare objects to create than the maxFlareCount and this is a one of those - create a summary flare that contains '...' as the text and make this one part of it 
            var willContainSummaryFlare = flares.length > this.maxFlareCount;
            var flareCount = willContainSummaryFlare ? this.maxFlareCount : flares.length;
            //if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
            //for an add amount position the first flare on top, -90 to do this. Looks more symmetrical this way.
            var degreeVariance = (flareCount % 2 === 0) ? -180 : -90;
            var viewRotation = this._is2d ? this._activeView.rotation : 0;
            var clusterScreenPoint = this._activeView.toScreen(this._activeCluster.clusterGraphic.geometry);
            var clusterSymbolSize = this._activeCluster.clusterGraphic.symbol.get("size");
            for (var i_1 = 0; i_1 < flareCount; i_1++) {
                var flare = flares[i_1];
                //set some attribute data
                var flareAttributes = {
                    isFlare: true,
                    isSummaryFlare: false,
                    tooltipText: "",
                    flareTextGraphic: undefined,
                    clusterGraphicId: this._activeCluster.clusterId,
                    clusterCount: gridCluster.clusterCount
                };
                var flareTextAttributes = {};
                //Do a couple of things differently if this is a summary flare or not
                var isSummaryFlare = willContainSummaryFlare && i_1 >= this.maxFlareCount - 1;
                if (isSummaryFlare) {
                    flare.isSummary = true;
                    flareAttributes.isSummaryFlare = true;
                    var tooltipText = "";
                    //multiline tooltip for summary flares, ie: greater than this.maxFlareCount flares per cluster
                    for (var j = this.maxFlareCount - 1, jlen = flares.length; j < jlen; j++) {
                        tooltipText += j > (this.maxFlareCount - 1) ? "\n" : "";
                        tooltipText += flares[j].tooltipText;
                    }
                    flare.tooltipText = tooltipText;
                }
                flareAttributes.tooltipText = flare.tooltipText;
                //create a graphic for the flare and for the flare text
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
                //create a group to hold flare object and text if needed. 
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
                //assign some event handlers for the tooltips
                f.flareGroup.mouseEnter = on.pausable(f.flareGroup.rawNode, "mouseenter", function () { return _this._createTooltip(f); });
                f.flareGroup.mouseLeave = on.pausable(f.flareGroup.rawNode, "mouseleave", function () { return _this._destroyTooltip(); });
            };
            var this_1 = this;
            //flares have been created so add them to the dom
            for (var i_2 = 0, len_1 = flares.length; i_2 < len_1; i_2++) {
                _loop_1(i_2, len_1);
            }
        };
        FlareClusterLayer.prototype._setFlarePosition = function (flareGroup, clusterSymbolSize, flareCount, flareIndex, degreeVariance, viewRotation) {
            //get the position of the flare to be placed around the container circle.
            var degree = parseInt(((360 / flareCount) * flareIndex).toFixed());
            degree = degree + degreeVariance;
            //take into account any rotation on the view
            if (viewRotation !== 0) {
                degree -= viewRotation;
            }
            var radian = degree * (Math.PI / 180);
            var buffer = this.flareBufferPixels;
            //position the flare group around the cluster
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
            //get the text from the data-tooltip attribute of the shape object
            var text = flare.tooltipText;
            if (!text) {
                console.log("no tooltip text for flare.");
                return;
            }
            //split on \n character that should be in tooltip to signify multiple lines
            var lines = text.split("\n");
            //create a group to hold the tooltip elements
            var tooltipGroup = flareGroup.createGroup();
            //get the flare symbol, we'll use this to style the tooltip box
            var flareSymbol = this._getFlareSymbol(flare.graphic);
            //align on top for normal flare, align on bottom for summary flares.
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
        //#region helper functions
        FlareClusterLayer.prototype._createClonedElementFromGraphic = function (graphic, surface) {
            //fake out a GFXObject so we can generate an svg shape that the passed in graphics shape
            var g = new GFXObject();
            g.graphic = graphic;
            g.renderingInfo = { symbol: graphic.symbol };
            //set up parameters for the call to render
            //set the transform of the projector to 0's as we're just placing the generated cluster shape at exactly 0,0.
            var projector = new Projector();
            projector._transform = [0, 0, 0, 0, 0, 0];
            projector._resolution = 0;
            var state = undefined;
            if (this._is2d) {
                state = this._activeView.state;
            }
            else {
                //fake out a state object for 3d views.
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
            g.render(par);
            return g._shape.rawNode;
        };
        FlareClusterLayer.prototype._extent = function () {
            return this._activeView ? this._activeView.extent : undefined;
        };
        FlareClusterLayer.prototype._scale = function () {
            return this._activeView ? this._activeView.scale : undefined;
        };
        //IE / Edge don't have the classList property on svg elements, so we can't use that add / remove classes - probably why dojo domClass doesn't work either.
        //so the following two functions are dodgy string hacks to add / remove classes. Uses a timeout so you can make css transitions work if desired.
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
            //container on the view is actually a html element at this point, not a string as the typings suggest.
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
        return FlareClusterLayer;
    }(asd.declared(GraphicsLayer)));
    FlareClusterLayer = __decorate([
        asd.subclass("FlareClusterLayer"),
        __metadata("design:paramtypes", [Object])
    ], FlareClusterLayer);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvRmxhcmVDbHVzdGVyTGF5ZXJfdjQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOENBQThDOzs7Ozs7Ozs7Ozs7Ozs7OztJQTZFOUMseURBQXlEO0lBRXpELElBQWEsaUJBQWlCO1FBQVMscUNBQTJCO1FBb0Q5RCwyQkFBWSxPQUFvQztZQUFoRCxZQUVJLGtCQUFNLE9BQU8sQ0FBQyxTQXlFakI7WUF4Rk8sb0JBQWMsR0FBVyxDQUFDLENBQUM7WUFPM0IsZUFBUyxHQUFzQyxFQUFFLENBQUM7WUFVdEQsa0JBQWtCO1lBQ2xCLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDWCw2QkFBNkI7Z0JBQzdCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQzs7WUFFckYsQ0FBQztZQUVELEtBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUM7WUFFdkQsa0NBQWtDO1lBQ2xDLEtBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUM7WUFDL0MsS0FBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxJQUFJLE9BQU8sQ0FBQztZQUN4RCxLQUFJLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQyxlQUFlLElBQUksQ0FBQyxDQUFDO1lBQ3BELEtBQUksQ0FBQywwQkFBMEIsR0FBRyxPQUFPLENBQUMsMEJBQTBCLElBQUksTUFBTSxDQUFDO1lBQy9FLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLEtBQUksQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLENBQUMsa0JBQWtCLEtBQUssTUFBTSxHQUFHLFNBQVMsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUM7WUFDN0csQ0FBQztZQUNELEtBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7WUFDaEQsS0FBSSxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsSUFBSSxDQUFDLENBQUM7WUFDNUQsS0FBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxLQUFLLEtBQUssR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsaUJBQWlCO1lBQ3RGLEtBQUksQ0FBQyxvQkFBb0IsR0FBRyxPQUFPLENBQUMsb0JBQW9CLEtBQUssSUFBSSxDQUFDO1lBQ2xFLEtBQUksQ0FBQyxvQkFBb0IsR0FBRyxPQUFPLENBQUMsb0JBQW9CLElBQUksU0FBUyxDQUFDO1lBQ3RFLEtBQUksQ0FBQyxpQkFBaUIsR0FBRyxPQUFPLENBQUMsaUJBQWlCLElBQUksQ0FBQyxDQUFDO1lBRXhELHlCQUF5QjtZQUN6QixLQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDO1lBQ2xELEtBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxHQUFHLENBQUM7WUFDbEQsS0FBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxJQUFJLEdBQUcsQ0FBQztZQUVsRCwwQ0FBMEM7WUFDMUMsS0FBSSxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDO1lBQy9DLEtBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQztZQUN6QyxLQUFJLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUM7WUFDN0MsS0FBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDO1lBQ3pDLEtBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztZQUUzQyxLQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixLQUFLLEtBQUssR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsaUJBQWlCO1lBRWxHLHFEQUFxRDtZQUNyRCxLQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLElBQUksSUFBSSxrQkFBa0IsQ0FBQztnQkFDN0QsSUFBSSxFQUFFLEVBQUU7Z0JBQ1IsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ2hDLE9BQU8sRUFBRSxJQUFJLGdCQUFnQixDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUM7YUFDdEYsQ0FBQyxDQUFDO1lBRUgsS0FBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxJQUFJLElBQUksVUFBVSxDQUFDO2dCQUNuRCxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLEVBQUU7b0JBQ1IsTUFBTSxFQUFFLE9BQU87aUJBQ2xCO2dCQUNELE9BQU8sRUFBRSxDQUFDLENBQUM7YUFDZCxDQUFDLENBQUM7WUFFSCxLQUFJLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQyxlQUFlLElBQUksSUFBSSxVQUFVLENBQUM7Z0JBQzdELEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ2pDLElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsQ0FBQztvQkFDUCxNQUFNLEVBQUUsT0FBTztpQkFDbEI7Z0JBQ0QsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUNkLENBQUMsQ0FBQztZQUVILGNBQWM7WUFDZCxLQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDO1lBRXZDLEtBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsVUFBQyxHQUFHLElBQUssT0FBQSxLQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQTNCLENBQTJCLENBQUMsQ0FBQztZQUVsRSxFQUFFLENBQUMsQ0FBQyxLQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixLQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsQ0FBQzs7UUFDTCxDQUFDO1FBR08sNkNBQWlCLEdBQXpCLFVBQTBCLEdBQUc7WUFBN0IsaUJBb0NDO1lBbENHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7WUFDdEMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLElBQUksQ0FBQyxZQUFZLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQztZQUN0QyxDQUFDO1lBRUQsd0VBQXdFO1lBQ3hFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7Z0JBQzNCLFVBQVUsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLFVBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxJQUFLLE9BQUEsS0FBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBOUMsQ0FBOEMsQ0FBQyxDQUFDO1lBQ3hJLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7Z0JBRXRDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO29CQUMxQiwrQ0FBK0M7b0JBQy9DLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDWixJQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO2dCQUNwQyxDQUFDO1lBQ0wsQ0FBQztZQUNELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUd0QixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDbkMsNEVBQTRFO2dCQUM1RSxVQUFVLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsVUFBVSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBbEMsQ0FBa0MsQ0FBQyxDQUFDO1lBQ2pHLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixtREFBbUQ7Z0JBQ25ELElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7UUFFTCxDQUFDO1FBRU8sMENBQWMsR0FBdEIsVUFBdUIsU0FBYztZQUFyQyxpQkFrQkM7WUFqQkcsSUFBSSxDQUFDLEdBQWUsU0FBUyxDQUFDLElBQUksQ0FBQztZQUNuQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUVwQixJQUFJLFNBQVMsR0FBZ0IsU0FBUyxDQUFDO2dCQUN2QyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2xCLHVGQUF1RjtvQkFDdkYsU0FBUyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDO2dCQUM1QyxDQUFDO2dCQUNELElBQUksQ0FBQyxDQUFDO29CQUNGLHFGQUFxRjtvQkFDckYsU0FBUyxHQUFnQixLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0QsQ0FBQztnQkFFRCwwRUFBMEU7Z0JBQzFFLENBQUMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxjQUFjLEVBQUUsVUFBQyxHQUFHLElBQUssT0FBQSxLQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQTFCLENBQTBCLENBQUMsQ0FBQztnQkFDN0UsQ0FBQyxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLGNBQWMsRUFBRSxVQUFDLEdBQUcsSUFBSyxPQUFBLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBMUIsQ0FBMEIsQ0FBQyxDQUFDO1lBQ2pGLENBQUM7UUFDTCxDQUFDO1FBR08sMkNBQWUsR0FBdkIsVUFBd0IsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSTtZQUU1QyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNiLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsQ0FBQztZQUNMLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsK0JBQStCO2dCQUMvQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM5QixDQUFDO1FBQ0wsQ0FBQztRQUdELGlDQUFLLEdBQUw7WUFDSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDeEIsQ0FBQztRQUdELG1DQUFPLEdBQVAsVUFBUSxJQUFXLEVBQUUsUUFBd0I7WUFBeEIseUJBQUEsRUFBQSxlQUF3QjtZQUN6QyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNsQixFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNYLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoQixDQUFDO1FBQ0wsQ0FBQztRQUVELGdDQUFJLEdBQUosVUFBSyxVQUFnQjtZQUFyQixpQkErSUM7WUE3SUcsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDYixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztZQUNsQyxDQUFDO1lBRUQsdUNBQXVDO1lBQ3ZDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUU3QyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQztZQUU1QyxvRUFBb0U7WUFDcEUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ2hELE9BQU8sQ0FBQyxLQUFLLENBQUMsMkVBQTJFLENBQUMsQ0FBQztnQkFDM0YsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFbkQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUV4RCxJQUFJLFFBQVEsR0FBYyxFQUFFLENBQUM7WUFFN0Isa0ZBQWtGO1lBQ2xGLG1HQUFtRztZQUNuRyxrR0FBa0c7WUFDbEcsNkVBQTZFO1lBQzdFLElBQUksU0FBUyxHQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsR0FBVyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksZ0JBQWdCLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsTCxJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUM7WUFFNUIsSUFBSSxtQkFBbUIsR0FBRyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEQsU0FBUyxHQUFHLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNwRCxlQUFlLEdBQUcsSUFBSSxDQUFDO1lBQzNCLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDcEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN4RCxDQUFDO1lBR0QsSUFBSSxHQUFhLEVBQUUsR0FBUSxFQUFFLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFZLEVBQUUsSUFBWSxDQUFDO1lBQ3hGLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ2xDLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVwQix5RUFBeUU7Z0JBQ3pFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzNCLFFBQVEsQ0FBQztnQkFDYixDQUFDO2dCQUVELElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUMvQixJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFFL0IsbUdBQW1HO2dCQUNuRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztvQkFDdEMsR0FBRyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN2QixDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNKLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNsRCxDQUFDO2dCQUVELDZEQUE2RDtnQkFDN0QsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2pILFFBQVEsQ0FBQztnQkFDYixDQUFDO2dCQUVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUVwQix1REFBdUQ7b0JBQ3ZELEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUM5RCxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUUvQixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDOzRCQUM3RyxRQUFRLENBQUMsQ0FBQyxzQkFBc0I7d0JBQ3BDLENBQUM7d0JBRUQsaUVBQWlFO3dCQUNqRSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO3dCQUM5RixFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO3dCQUU5RixvSkFBb0o7d0JBQ3BKLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7NEJBQzFCLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQ2pDLENBQUM7d0JBRUQsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDO3dCQUVsQixJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7d0JBQzFCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDOzRCQUM1RCxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO2dDQUM5RCxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO2dDQUM1QixhQUFhLEdBQUcsSUFBSSxDQUFDO2dDQUNyQixLQUFLLENBQUM7NEJBQ1YsQ0FBQzt3QkFDTCxDQUFDO3dCQUVELEVBQUUsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzs0QkFDakIsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO3dCQUM5RSxDQUFDO3dCQUVELGtFQUFrRTt3QkFDbEUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDOzRCQUM5QyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDekIsQ0FBQzt3QkFDRCxJQUFJLENBQUMsQ0FBQzs0QkFDRixFQUFFLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQzt3QkFDcEIsQ0FBQzt3QkFFRCxLQUFLLENBQUM7b0JBQ1YsQ0FBQztnQkFDTCxDQUFDO2dCQUNELElBQUksQ0FBQyxDQUFDO29CQUNGLHFDQUFxQztvQkFDckMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDNUIsQ0FBQztZQUNMLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDcEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQzVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO3dCQUM1RCxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7NEJBQ3pFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDekQsQ0FBQztvQkFDTCxDQUFDO29CQUNELElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM5QyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQztZQUVELDhDQUE4QztZQUM5QyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMvQixPQUFPLENBQUMsT0FBTyxDQUFDLGVBQWEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFNLENBQUMsQ0FBQztZQUV0RCxVQUFVLENBQUM7Z0JBQ1AsS0FBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQzFCLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNYLENBQUM7UUFFTyx5Q0FBYSxHQUFyQixVQUFzQixHQUFRO1lBQzFCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztZQUM1RCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDbEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3RELElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksSUFBSSxDQUFDO29CQUFDLFFBQVEsQ0FBQztnQkFFL0MsSUFBSSxTQUFTLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUMvRSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUNaLE1BQU0sR0FBRyxNQUFNLENBQUMscUJBQXFCLENBQUMsQ0FBQyxvRUFBb0U7Z0JBQy9HLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7b0JBQ2xELE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQywyR0FBMkc7Z0JBQy9ILENBQUM7Z0JBRUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7b0JBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLHNEQUFzRDtZQUNyRixDQUFDO1lBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNsQixDQUFDO1FBRU8seUNBQWEsR0FBckIsVUFBc0IsR0FBRztZQUNyQixJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQztnQkFDbEIsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO2FBQ3JGLENBQUMsQ0FBQztZQUVILEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLEtBQUssR0FBVSxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNuRSxDQUFDO1lBRUQsSUFBSSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUM7Z0JBQ3RCLFFBQVEsRUFBRSxLQUFLO2dCQUNmLFVBQVUsRUFBRSxHQUFHO2FBQ2xCLENBQUMsQ0FBQztZQUVILE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDO1lBQ2pELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUN0RSxPQUFPLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztZQUM1QixDQUFDO1lBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDdkMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLG9GQUFvRjtnQkFDcEYsT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQztZQUN4RCxDQUFDO1lBRUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0QixDQUFDO1FBR08sMENBQWMsR0FBdEIsVUFBdUIsV0FBd0I7WUFFM0MsSUFBSSxPQUFPLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUM1QixPQUFPLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztZQUVsQywyR0FBMkc7WUFDM0csSUFBSSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDOUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztnQkFDeEMsS0FBSyxHQUFVLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25FLENBQUM7WUFFRCxJQUFJLFVBQVUsR0FBUTtnQkFDbEIsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO2dCQUNoQixDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBQ2hCLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWTtnQkFDdEMsU0FBUyxFQUFFLElBQUk7Z0JBQ2YsYUFBYSxFQUFFLFdBQVc7YUFDN0IsQ0FBQTtZQUVELE9BQU8sQ0FBQyxjQUFjLEdBQUcsSUFBSSxPQUFPLENBQUM7Z0JBQ2pDLFVBQVUsRUFBRSxVQUFVO2dCQUN0QixRQUFRLEVBQUUsS0FBSzthQUNsQixDQUFDLENBQUM7WUFDSCxPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUM7WUFFdEcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztZQUM3RSxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUM7Z0JBQ0YsT0FBTyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQy9DLENBQUM7WUFFRCxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbEQsT0FBTyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7WUFFaEUsd0RBQXdEO1lBQ3hELElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDekMsVUFBVSxDQUFDLElBQUksR0FBRyxXQUFXLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3RELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxVQUFVLENBQUMsS0FBSyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztZQUN2RCxDQUFDO1lBRUQsT0FBTyxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDOUIsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsVUFBVSxFQUFFO29CQUNSLGFBQWEsRUFBRSxJQUFJO29CQUNuQixNQUFNLEVBQUUsSUFBSTtvQkFDWixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7aUJBQy9CO2dCQUNELE1BQU0sRUFBRSxVQUFVO2FBQ3JCLENBQUMsQ0FBQztZQUVILDJFQUEyRTtZQUMzRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLElBQUksV0FBVyxDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVqRixJQUFJLEVBQUUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUMxQixFQUFFLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUM7Z0JBQy9CLElBQUksSUFBSSxHQUFRLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsbURBQW1EO2dCQUV4RyxJQUFJLFFBQVEsR0FBUTtvQkFDaEIsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO29CQUNoQixDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7b0JBQ2hCLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWTtvQkFDdEMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO29CQUM1QixhQUFhLEVBQUUsSUFBSTtpQkFDdEIsQ0FBQTtnQkFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3RDLElBQUksUUFBUSxHQUFHLElBQUksT0FBTyxFQUFFLENBQUMsQ0FBQyxxR0FBcUc7b0JBQ25JLFFBQVEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFFM0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzt3QkFDM0MsUUFBUSxHQUFZLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUMzRSxDQUFDO29CQUVELE9BQU8sQ0FBQyxXQUFXLEdBQUcsSUFBSSxPQUFPLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO29CQUNoRixPQUFPLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUM7Z0JBRWpHLENBQUM7WUFDTCxDQUFDO1lBRUQsbUNBQW1DO1lBQ25DLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLGtCQUFrQixLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzlELElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUU5QixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxPQUFPLENBQUM7UUFDaEQsQ0FBQztRQUdPLDhDQUFrQixHQUExQixVQUEyQixTQUFpQixFQUFFLGVBQXdCO1lBRWxFLDhJQUE4STtZQUM5SSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNwRSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVyRSwrSEFBK0g7WUFDL0gsRUFBRSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztnQkFDbEIsTUFBTSxJQUFJLENBQUMsQ0FBQztZQUNoQixDQUFDO1lBRUQsSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUM7WUFDcEQsSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUM7WUFFcEQsSUFBSSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUM7WUFFbkMsdUpBQXVKO1lBQ3ZKLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRSxDQUFDO1lBQ3hCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sR0FBRyxTQUFTLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxNQUFNLEdBQUcsTUFBTSxHQUFHLEVBQUUsQ0FBQztnQkFDckIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDOUIsTUFBTSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQ25DLE1BQU0sR0FBRyxNQUFNLEdBQUcsRUFBRSxDQUFDO29CQUNyQixJQUFJLEdBQUcsR0FBRyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQztvQkFDckUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7d0JBQ3BCLE1BQU0sRUFBRSxHQUFHO3dCQUNYLFlBQVksRUFBRSxDQUFDO3dCQUNmLGFBQWEsRUFBRSxFQUFFO3dCQUNqQixPQUFPLEVBQUUsRUFBRTt3QkFDWCxNQUFNLEVBQUUsRUFBRTt3QkFDVixDQUFDLEVBQUUsQ0FBQzt3QkFDSixDQUFDLEVBQUUsQ0FBQztxQkFDUCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7UUFDTCxDQUFDO1FBRUQ7OztXQUdHO1FBQ0ssMENBQWMsR0FBdEI7WUFFSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQztnQkFBQyxNQUFNLENBQUM7WUFDeEMsSUFBSSxvQkFBb0IsR0FBRyxTQUFTLENBQUM7WUFDckMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2Isb0JBQW9CLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO1lBQy9ILENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixvQkFBb0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ3ZHLENBQUM7WUFFRCxJQUFJLE9BQU8sR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDLG9CQUFvQixFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNoRSxPQUFPLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUUvQyxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM5RSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3BELE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDckQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDO1lBRXRDLDhMQUE4TDtZQUM5TCxtR0FBbUc7WUFDbkcseUNBQXlDO1lBQ3pDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbkUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNsRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBaUIsRUFBRSxLQUFLO29CQUN4RCxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ3ZDLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztRQUNMLENBQUM7UUFFTyw0Q0FBZ0IsR0FBeEIsVUFBeUIsR0FBRztZQUE1QixpQkFtQ0M7WUFqQ0csSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUV0QywwSUFBMEk7WUFDMUksZ0tBQWdLO1lBQ2hLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDNUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDUCxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUM7d0JBQUMsTUFBTSxDQUFDO2dCQUMzSCxDQUFDO1lBQ0wsQ0FBQztZQUVELElBQUksQ0FBQyxHQUFZLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFbEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQUMsUUFBUTtnQkFFN0MsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQztnQkFDaEMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN4QixLQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDMUIsTUFBTSxDQUFDO2dCQUNYLENBQUM7Z0JBRUQsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztvQkFDNUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3ZFLElBQUksT0FBTyxHQUFHLEtBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDckQsS0FBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO3dCQUMvQixNQUFNLENBQUM7b0JBQ1gsQ0FBQztvQkFDRCxJQUFJLENBQUMsQ0FBQzt3QkFDRixLQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDOUIsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO1FBRU8sNENBQWdCLEdBQXhCLFVBQXlCLE9BQWdCO1lBRXJDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDbEMsTUFBTSxDQUFDLENBQUMsZ0JBQWdCO1lBQzVCLENBQUM7WUFDRCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUUxQixJQUFJLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQztZQUM5QixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUVuQixJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBRXpGLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkQsQ0FBQztZQUVELGtDQUFrQztRQUN0QyxDQUFDO1FBRU8sOENBQWtCLEdBQTFCO1lBRUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVqQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQ3pGLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFFcEYsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBRUQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO1lBRWhDLHFDQUFxQztRQUV6QyxDQUFDO1FBR08sd0NBQVksR0FBcEI7WUFDSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBRWpDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVyQixJQUFJLEdBQWdCLENBQUM7WUFDckIsSUFBSSxFQUFFLEdBQWdCLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFRLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUV6RywwSkFBMEo7WUFDMUosRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ2xELElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQywwRUFBMEU7Z0JBQ3pILEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDWCxrRUFBa0U7b0JBQ2xFLEVBQUUsQ0FBQyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9CLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDbEIsMENBQTBDO29CQUMxQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUM7Z0JBQ3hCLENBQUM7WUFDTCxDQUFDO1lBRUQsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNySSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXhELENBQUM7UUFFTyx5Q0FBYSxHQUFyQjtZQUNJLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3pFLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDM0YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBRU8sd0NBQVksR0FBcEI7WUFDSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ2pDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVyQix3UEFBd1A7WUFDeFAsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN4RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBRW5GLDBCQUEwQjtZQUMxQixJQUFJLG9CQUFvQixHQUFHLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3RJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUV6RCwrQkFBK0I7WUFDL0IsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNoSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDM0QsaUJBQWlCLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUMzRSxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFFeEUsMEJBQTBCO1lBQzFCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXZGLENBQUM7UUFHTyx1Q0FBVyxHQUFuQjtZQUFBLGlCQStJQztZQTlJRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUV4RCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQztZQUVsRCxtREFBbUQ7WUFDbkQsSUFBSSxZQUFZLEdBQUcsQ0FBQyxXQUFXLENBQUMsT0FBTyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUNySSxJQUFJLGFBQWEsR0FBRyxDQUFDLFlBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLElBQUksV0FBVyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFFekcsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLENBQUMsQ0FBQyxvQkFBb0I7WUFDaEMsQ0FBQztZQUVELElBQUksTUFBTSxHQUFZLEVBQUUsQ0FBQztZQUN6QixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUM3RCxJQUFJLENBQUMsR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNwQixDQUFDLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7b0JBQ3hFLENBQUMsQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7b0JBQ2pCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25CLENBQUM7WUFDTCxDQUFDO1lBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBRXJCLHVDQUF1QztnQkFDdkMsSUFBSSxRQUFRLEdBQUcsV0FBVyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFDN0IsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDcEIsQ0FBQyxDQUFDLFdBQVcsR0FBTSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQUcsQ0FBQztvQkFDN0QsQ0FBQyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO29CQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQixDQUFDO1lBQ0wsQ0FBQztZQUVELG9MQUFvTDtZQUNwTCxJQUFJLHVCQUF1QixHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUNqRSxJQUFJLFVBQVUsR0FBRyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFFOUUsOEdBQThHO1lBQzlHLHFHQUFxRztZQUNyRyxJQUFJLGNBQWMsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDekQsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7WUFFOUQsSUFBSSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBUSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN2RyxJQUFJLGlCQUFpQixHQUFXLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEYsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUMsR0FBRyxVQUFVLEVBQUUsR0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFFbEMsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUMsQ0FBQyxDQUFDO2dCQUV0Qix5QkFBeUI7Z0JBQ3pCLElBQUksZUFBZSxHQUFHO29CQUNsQixPQUFPLEVBQUUsSUFBSTtvQkFDYixjQUFjLEVBQUUsS0FBSztvQkFDckIsV0FBVyxFQUFFLEVBQUU7b0JBQ2YsZ0JBQWdCLEVBQUUsU0FBUztvQkFDM0IsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTO29CQUMvQyxZQUFZLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQ3pDLENBQUM7Z0JBRUYsSUFBSSxtQkFBbUIsR0FBRyxFQUFFLENBQUM7Z0JBRTdCLHFFQUFxRTtnQkFDckUsSUFBSSxjQUFjLEdBQUcsdUJBQXVCLElBQUksR0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO2dCQUM1RSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO29CQUNqQixLQUFLLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztvQkFDdkIsZUFBZSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7b0JBQ3RDLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztvQkFDckIsOEZBQThGO29CQUM5RixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQ3ZFLFdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7d0JBQ3hELFdBQVcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO29CQUN6QyxDQUFDO29CQUNELEtBQUssQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO2dCQUNwQyxDQUFDO2dCQUVELGVBQWUsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztnQkFFaEQsdURBQXVEO2dCQUN2RCxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDO29CQUN4QixVQUFVLEVBQUUsZUFBZTtvQkFDM0IsUUFBUSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLFFBQVE7b0JBQ3JELGFBQWEsRUFBRSxJQUFJO2lCQUN0QixDQUFDLENBQUM7Z0JBRUgsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzNELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUMxQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7Z0JBQ3BFLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLENBQUM7b0JBQ0YsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QyxDQUFDO2dCQUdELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUNsQixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUM5QyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDO29CQUV2RSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzt3QkFDMUMsVUFBVSxDQUFDLEtBQUssR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7b0JBQ3ZELENBQUM7b0JBRUQsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQzt3QkFDNUIsVUFBVSxFQUFFOzRCQUNSLE1BQU0sRUFBRSxJQUFJOzRCQUNaLGdCQUFnQixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUzt5QkFDbEQ7d0JBQ0QsTUFBTSxFQUFFLFVBQVU7d0JBQ2xCLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRO3FCQUN4RCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7b0NBR1EsR0FBQyxFQUFNLEtBQUc7Z0JBQ2YsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUMsQ0FBQyxDQUFDO2dCQUNsQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7c0NBQVU7Z0JBRXpCLDBEQUEwRDtnQkFDMUQsQ0FBQyxDQUFDLFVBQVUsR0FBRyxPQUFLLGNBQWMsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBRTlELElBQUksUUFBUSxHQUFHLE9BQUssaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxVQUFVLEVBQUUsR0FBQyxFQUFFLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFFcEgsT0FBSyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztnQkFDN0QsSUFBSSxZQUFZLEdBQUcsT0FBSywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDakYsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUMvQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztvQkFDaEIsSUFBSSxnQkFBZ0IsR0FBRyxPQUFLLCtCQUErQixDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUN6RixnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUM7b0JBQ3hELENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUN2RCxDQUFDO2dCQUVELE9BQUssa0JBQWtCLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUUvRCw2Q0FBNkM7Z0JBQzdDLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUF0QixDQUFzQixDQUFDLENBQUM7Z0JBQ3hHLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsZUFBZSxFQUFFLEVBQXRCLENBQXNCLENBQUMsQ0FBQztZQUU1RyxDQUFDOztZQXpCRCxpREFBaUQ7WUFDakQsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUMsR0FBRyxLQUFHLEVBQUUsR0FBQyxFQUFFO3dCQUF4QyxHQUFDLEVBQU0sS0FBRzthQXdCbEI7UUFFTCxDQUFDO1FBRU8sNkNBQWlCLEdBQXpCLFVBQTBCLFVBQWUsRUFBRSxpQkFBeUIsRUFBRSxVQUFrQixFQUFFLFVBQWtCLEVBQUUsY0FBc0IsRUFBRSxZQUFvQjtZQUV0Six5RUFBeUU7WUFDekUsSUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNuRSxNQUFNLEdBQUcsTUFBTSxHQUFHLGNBQWMsQ0FBQztZQUVqQyw0Q0FBNEM7WUFDNUMsRUFBRSxDQUFDLENBQUMsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLE1BQU0sSUFBSSxZQUFZLENBQUM7WUFDM0IsQ0FBQztZQUVELElBQUksTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDdEMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1lBRXBDLDZDQUE2QztZQUM3QyxJQUFJLFFBQVEsR0FBRztnQkFDWCxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztnQkFDbEQsQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7YUFDckQsQ0FBQTtZQUVELFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUQsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNwQixDQUFDO1FBRU8sMkNBQWUsR0FBdkIsVUFBd0IsWUFBcUI7WUFDekMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQzlHLENBQUM7UUFFTywwQ0FBYyxHQUF0QixVQUF1QixLQUFZO1lBRS9CLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7WUFDbEMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBRXZCLElBQUksYUFBYSxHQUFHLEtBQUssQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUN0RSxFQUFFLENBQUMsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEIsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELGtFQUFrRTtZQUNsRSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO1lBQzdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDUixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7Z0JBQzFDLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCwyRUFBMkU7WUFDM0UsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU3Qiw2Q0FBNkM7WUFDN0MsSUFBSSxZQUFZLEdBQUcsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBRTVDLCtEQUErRDtZQUMvRCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUV0RCxvRUFBb0U7WUFDcEUsSUFBSSxNQUFNLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztZQUU5QixJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7WUFDYixJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUUzRCxZQUFZLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDM0QsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBRS9DLElBQUksU0FBUyxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUM7cUJBQ3BHLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztxQkFDbkMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUU3SCxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQixTQUFTLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM3RCxDQUFDO1lBRUQsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBQ3BCLElBQUksT0FBTyxHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUU1QyxJQUFJLFNBQVMsR0FBRyxZQUFZLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxHQUFHLFdBQVcsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7aUJBQzFMLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFaEMsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDMUUsQ0FBQztZQUVELFNBQVMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN6QixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNwRCxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDaEMsQ0FBQztRQUVMLENBQUM7UUFFTywyQ0FBZSxHQUF2QjtZQUNJLEtBQUssQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5RixDQUFDO1FBR0QsMEJBQTBCO1FBRWxCLDJEQUErQixHQUF2QyxVQUF3QyxPQUFnQixFQUFFLE9BQVk7WUFFbEUsd0ZBQXdGO1lBQ3hGLElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7WUFDeEIsQ0FBQyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7WUFDcEIsQ0FBQyxDQUFDLGFBQWEsR0FBRyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFFN0MsMENBQTBDO1lBQzFDLDZHQUE2RztZQUM3RyxJQUFJLFNBQVMsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBRTFCLElBQUksS0FBSyxHQUFHLFNBQVMsQ0FBQztZQUN0QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUM7WUFDbkMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLHVDQUF1QztnQkFDdkMsS0FBSyxHQUFHO29CQUNKLGFBQWEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU07b0JBQ3RDLFFBQVEsRUFBRSxDQUFDO29CQUNYLGdCQUFnQixFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCO29CQUNuRCxnQkFBZ0IsRUFBRSxDQUFDO2lCQUN0QixDQUFDO1lBQ04sQ0FBQztZQUVELElBQUksR0FBRyxHQUFHO2dCQUNOLE9BQU8sRUFBRSxPQUFPO2dCQUNoQixLQUFLLEVBQUUsS0FBSztnQkFDWixTQUFTLEVBQUUsU0FBUzthQUN2QixDQUFDO1lBQ0YsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNkLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUM1QixDQUFDO1FBR08sbUNBQU8sR0FBZjtZQUNJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztRQUNsRSxDQUFDO1FBRU8sa0NBQU0sR0FBZDtZQUNJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUNqRSxDQUFDO1FBRUQsMEpBQTBKO1FBQzFKLGdKQUFnSjtRQUN4SSw4Q0FBa0IsR0FBMUIsVUFBMkIsT0FBb0IsRUFBRSxTQUFpQixFQUFFLFNBQWtCLEVBQUUsUUFBbUI7WUFFdkcsSUFBSSxRQUFRLEdBQWEsVUFBQyxRQUFRLEVBQUUsVUFBVTtnQkFDMUMsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7b0JBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztnQkFDckMsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQUMsTUFBTSxDQUFDO2dCQUMxRCxJQUFJLFFBQVEsR0FBRyxDQUFDLFlBQVksR0FBRyxHQUFHLEdBQUcsVUFBVSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ3hELFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQzdDLENBQUMsQ0FBQztZQUVGLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1osVUFBVSxDQUFDO29CQUNQLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQzdCLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQ1gsUUFBUSxFQUFFLENBQUM7b0JBQ2YsQ0FBQztnQkFDTCxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEIsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDakMsQ0FBQztRQUNMLENBQUM7UUFHTyxtREFBdUIsR0FBL0IsVUFBZ0MsT0FBb0IsRUFBRSxTQUFpQixFQUFFLFNBQWtCLEVBQUUsUUFBbUI7WUFFNUcsSUFBSSxXQUFXLEdBQWEsVUFBQyxRQUFRLEVBQUUsVUFBVTtnQkFDN0MsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7b0JBQUMsTUFBTSxDQUFDO2dCQUMxQixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFBQyxNQUFNLENBQUM7Z0JBQzFELFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQy9FLENBQUMsQ0FBQztZQUVGLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1osVUFBVSxDQUFDO29CQUNQLFdBQVcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQ2hDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQ1gsUUFBUSxFQUFFLENBQUM7b0JBQ2YsQ0FBQztnQkFDTCxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEIsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLFdBQVcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEMsQ0FBQztRQUVMLENBQUM7UUFFTyx3Q0FBWSxHQUFwQixVQUFxQixHQUFHO1lBQ3BCLHNHQUFzRztZQUN0RyxJQUFJLFNBQVMsR0FBUSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQztZQUNoRCxJQUFJLElBQUksR0FBRyxTQUFTLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUM3QyxNQUFNLENBQUM7Z0JBQ0gsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUk7Z0JBQ3BCLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHO2FBQ3RCLENBQUM7UUFDTixDQUFDO1FBR0Q7OztXQUdHO1FBQ0ssd0NBQVksR0FBcEIsVUFBcUIsT0FBNEI7WUFDN0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ3JCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsVUFBVSxDQUFZLE9BQU8sQ0FBQyxDQUFDO1lBQ3hDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsTUFBTSxDQUFVLE9BQU8sQ0FBQyxDQUFDO1lBQ2xDLENBQUM7UUFDTCxDQUFDO1FBRU8sd0NBQVksR0FBcEIsVUFBcUIsT0FBNEI7WUFDN0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ3JCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsT0FBTyxDQUFZLE9BQU8sQ0FBQyxDQUFDO1lBQ3JDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsR0FBRyxDQUFVLE9BQU8sQ0FBQyxDQUFDO1lBQy9CLENBQUM7UUFDTCxDQUFDO1FBSUwsd0JBQUM7SUFBRCxDQW5rQ0EsQUFta0NDLENBbmtDc0MsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsR0Fta0NqRTtJQW5rQ1ksaUJBQWlCO1FBRDdCLEdBQUcsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUM7O09BQ3JCLGlCQUFpQixDQW1rQzdCO0lBbmtDWSw4Q0FBaUI7SUFrbEM5QjtRQUFBO1lBR0ksa0JBQWEsR0FBVSxFQUFFLENBQUM7WUFDMUIsWUFBTyxHQUFVLEVBQUUsQ0FBQztZQUNwQixXQUFNLEdBQVUsRUFBRSxDQUFDO1FBR3ZCLENBQUM7UUFBRCxrQkFBQztJQUFELENBUkEsQUFRQyxJQUFBO0lBR0Q7UUFBQTtRQU9BLENBQUM7UUFBRCxjQUFDO0lBQUQsQ0FQQSxBQU9DLElBQUE7SUFFRDtRQUFBO1FBUUEsQ0FBQztRQUFELFlBQUM7SUFBRCxDQVJBLEFBUUMsSUFBQTtJQUVEO1FBU0kscUJBQVksVUFBa0IsRUFBRSxZQUFvQixFQUFFLE1BQWEsRUFBRSxxQkFBc0M7WUFBdEMsc0NBQUEsRUFBQSw2QkFBc0M7WUFDdkcsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7WUFDN0IsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7WUFDakMsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUM7WUFDN0IsSUFBSSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQixDQUFDO1FBQ3ZELENBQUM7UUFFTCxrQkFBQztJQUFELENBaEJBLEFBZ0JDLElBQUE7SUFoQlksa0NBQVciLCJmaWxlIjoiRmxhcmVDbHVzdGVyTGF5ZXJfdjQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cclxuXHJcbmltcG9ydCAqIGFzIEdyYXBoaWNzTGF5ZXIgZnJvbSBcImVzcmkvbGF5ZXJzL0dyYXBoaWNzTGF5ZXJcIjtcclxuaW1wb3J0ICogYXMgQ2xhc3NCcmVha3NSZW5kZXJlciBmcm9tIFwiZXNyaS9yZW5kZXJlcnMvQ2xhc3NCcmVha3NSZW5kZXJlclwiO1xyXG5pbXBvcnQgKiBhcyBQb3B1cFRlbXBsYXRlIGZyb20gXCJlc3JpL1BvcHVwVGVtcGxhdGVcIjtcclxuaW1wb3J0ICogYXMgU2ltcGxlTWFya2VyU3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvU2ltcGxlTWFya2VyU3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIFRleHRTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9UZXh0U3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIFNpbXBsZUxpbmVTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9TaW1wbGVMaW5lU3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIENvbG9yIGZyb20gXCJlc3JpL0NvbG9yXCI7XHJcbmltcG9ydCAqIGFzIHdhdGNoVXRpbHMgZnJvbSAnZXNyaS9jb3JlL3dhdGNoVXRpbHMnO1xyXG5pbXBvcnQgKiBhcyBWaWV3IGZyb20gJ2Vzcmkvdmlld3MvVmlldyc7XHJcbmltcG9ydCAqIGFzIHdlYk1lcmNhdG9yVXRpbHMgZnJvbSBcImVzcmkvZ2VvbWV0cnkvc3VwcG9ydC93ZWJNZXJjYXRvclV0aWxzXCI7XHJcbmltcG9ydCAqIGFzIEdyYXBoaWMgZnJvbSBcImVzcmkvR3JhcGhpY1wiO1xyXG5pbXBvcnQgKiBhcyBQb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9Qb2ludFwiOyBcclxuaW1wb3J0ICogYXMgU2NyZWVuUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU2NyZWVuUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgTXVsdGlwb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9NdWx0aXBvaW50XCI7XHJcbmltcG9ydCAqIGFzIFBvbHlnb24gZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9seWdvblwiO1xyXG5pbXBvcnQgKiBhcyBnZW9tZXRyeUVuZ2luZSBmcm9tICdlc3JpL2dlb21ldHJ5L2dlb21ldHJ5RW5naW5lJztcclxuaW1wb3J0ICogYXMgU3BhdGlhbFJlZmVyZW5jZSBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TcGF0aWFsUmVmZXJlbmNlXCI7XHJcbmltcG9ydCAqIGFzIEV4dGVudCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9FeHRlbnRcIjtcclxuaW1wb3J0ICogYXMgTWFwVmlldyBmcm9tICdlc3JpL3ZpZXdzL01hcFZpZXcnO1xyXG5pbXBvcnQgKiBhcyBTY2VuZVZpZXcgZnJvbSAnZXNyaS92aWV3cy9TY2VuZVZpZXcnO1xyXG5cclxuaW1wb3J0ICogYXMgR0ZYT2JqZWN0IGZyb20gXCJlc3JpL3ZpZXdzLzJkL2VuZ2luZS9ncmFwaGljcy9HRlhPYmplY3RcIjtcclxuaW1wb3J0ICogYXMgUHJvamVjdG9yIGZyb20gXCJlc3JpL3ZpZXdzLzJkL2VuZ2luZS9ncmFwaGljcy9Qcm9qZWN0b3JcIjtcclxuIFxyXG5pbXBvcnQgKiBhcyBhc2QgZnJvbSBcImVzcmkvY29yZS9hY2Nlc3NvclN1cHBvcnQvZGVjb3JhdG9yc1wiO1xyXG5cclxuaW1wb3J0ICogYXMgb24gZnJvbSAnZG9qby9vbic7XHJcbmltcG9ydCAqIGFzIGdmeCBmcm9tICdkb2pveC9nZngnO1xyXG5pbXBvcnQgKiBhcyBkb21Db25zdHJ1Y3QgZnJvbSAnZG9qby9kb20tY29uc3RydWN0JztcclxuaW1wb3J0ICogYXMgcXVlcnkgZnJvbSAnZG9qby9xdWVyeSc7XHJcbmltcG9ydCAqIGFzIGRvbSBmcm9tICdkb2pvL2RvbSc7XHJcbmltcG9ydCAqIGFzIGRvbUF0dHIgZnJvbSAnZG9qby9kb20tYXR0cic7XHJcbmltcG9ydCAqIGFzIGRvbVN0eWxlIGZyb20gJ2Rvam8vZG9tLXN0eWxlJztcclxuaW1wb3J0ICogYXMgc25pZmYgZnJvbSAnZG9qby9zbmlmZic7XHJcbiBcclxuaW50ZXJmYWNlIEZsYXJlQ2x1c3RlckxheWVyUHJvcGVydGllcyBleHRlbmRzIF9fZXNyaS5HcmFwaGljc0xheWVyUHJvcGVydGllcyB7XHJcblxyXG4gICAgY2x1c3RlclJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNpbmdsZVJlbmRlcmVyPzogYW55O1xyXG4gICAgc2luZ2xlU3ltYm9sPzogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgYXJlYVJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuICAgIGZsYXJlUmVuZGVyZXI/OiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNpbmdsZVBvcHVwVGVtcGxhdGU/OiBQb3B1cFRlbXBsYXRlO1xyXG4gICAgc3BhdGlhbFJlZmVyZW5jZT86IFNwYXRpYWxSZWZlcmVuY2U7XHJcblxyXG4gICAgY2x1c3RlclJhdGlvPzogbnVtYmVyO1xyXG4gICAgY2x1c3RlclRvU2NhbGU/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyTWluQ291bnQ/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyQXJlYURpc3BsYXk/OiBzdHJpbmc7XHJcblxyXG4gICAgZGlzcGxheUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBtYXhGbGFyZUNvdW50PzogbnVtYmVyO1xyXG4gICAgbWF4U2luZ2xlRmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIHNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5Pzogc3RyaW5nO1xyXG4gICAgZmxhcmVTeW1ib2w/OiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBmbGFyZUJ1ZmZlclBpeGVscz86IG51bWJlcjtcclxuICAgIHRleHRTeW1ib2w/OiBUZXh0U3ltYm9sO1xyXG4gICAgZmxhcmVUZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGRpc3BsYXlTdWJUeXBlRmxhcmVzPzogYm9vbGVhbjtcclxuICAgIHN1YlR5cGVGbGFyZVByb3BlcnR5Pzogc3RyaW5nO1xyXG5cclxuICAgIHhQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgelByb3BlcnR5TmFtZT86IHN0cmluZztcclxuXHJcbiAgICByZWZyZXNoT25TdGF0aW9uYXJ5PzogYm9vbGVhbjtcclxuXHJcbiAgICBmaWx0ZXJzPzogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBkYXRhPzogYW55W107XHJcblxyXG59XHJcblxyXG4vL2V4dGVuZCBHcmFwaGljc0xheWVyIHVzaW5nICdhY2Nlc3NvclN1cHBvcnQvZGVjb3JhdG9ycydcclxuQGFzZC5zdWJjbGFzcyhcIkZsYXJlQ2x1c3RlckxheWVyXCIpXHJcbmV4cG9ydCBjbGFzcyBGbGFyZUNsdXN0ZXJMYXllciBleHRlbmRzIGFzZC5kZWNsYXJlZChHcmFwaGljc0xheWVyKSB7XHJcblxyXG4gICAgc2luZ2xlUmVuZGVyZXI6IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbDogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgc2luZ2xlUG9wdXBUZW1wbGF0ZTogUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICBjbHVzdGVyUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBhcmVhUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNwYXRpYWxSZWZlcmVuY2U6IFNwYXRpYWxSZWZlcmVuY2U7XHJcblxyXG4gICAgY2x1c3RlclJhdGlvOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyVG9TY2FsZTogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyQXJlYURpc3BsYXk6IHN0cmluZztcclxuXHJcbiAgICBkaXNwbGF5RmxhcmVzOiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudDogbnVtYmVyO1xyXG4gICAgbWF4U2luZ2xlRmxhcmVDb3VudDogbnVtYmVyO1xyXG4gICAgc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHk6IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sOiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBmbGFyZUJ1ZmZlclBpeGVsczogbnVtYmVyO1xyXG4gICAgdGV4dFN5bWJvbDogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbDogVGV4dFN5bWJvbDtcclxuICAgIGRpc3BsYXlTdWJUeXBlRmxhcmVzOiBib29sZWFuO1xyXG4gICAgc3ViVHlwZUZsYXJlUHJvcGVydHk6IHN0cmluZztcclxuXHJcbiAgICByZWZyZXNoT25TdGF0aW9uYXJ5OiBib29sZWFuO1xyXG5cclxuICAgIHhQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHlQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHpQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuXHJcbiAgICBmaWx0ZXJzOiBQb2ludEZpbHRlcltdO1xyXG5cclxuICAgIHByaXZhdGUgX2dyaWRDbHVzdGVyczogR3JpZENsdXN0ZXJbXTtcclxuICAgIHByaXZhdGUgX2lzQ2x1c3RlcmVkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfYWN0aXZlVmlldzogQWN0aXZlVmlldztcclxuICAgIHByaXZhdGUgX3ZpZXdMb2FkQ291bnQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgcHJpdmF0ZSBfcmVhZHlUb0RyYXc6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9xdWV1ZWRJbml0aWFsRHJhdzogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX2RhdGE6IGFueVtdO1xyXG4gICAgcHJpdmF0ZSBfaXMyZDogYm9vbGVhbjtcclxuXHJcbiAgICBwcml2YXRlIF9jbHVzdGVyczogeyBbY2x1c3RlcklkOiBudW1iZXJdOiBDbHVzdGVyOyB9ID0ge307XHJcbiAgICBwcml2YXRlIF9hY3RpdmVDbHVzdGVyOiBDbHVzdGVyO1xyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlldzJkOiBhbnk7XHJcbiAgICBwcml2YXRlIF9sYXllclZpZXczZDogYW55O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEZsYXJlQ2x1c3RlckxheWVyUHJvcGVydGllcykge1xyXG5cclxuICAgICAgICBzdXBlcihvcHRpb25zKTtcclxuXHJcbiAgICAgICAgLy9zZXQgdGhlIGRlZmF1bHRzXHJcbiAgICAgICAgaWYgKCFvcHRpb25zKSB7XHJcbiAgICAgICAgICAgIC8vbWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzXHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJNaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnMgdG8gZmxhcmUgY2x1c3RlciBsYXllciBjb25zdHJ1Y3Rvci5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5zaW5nbGVQb3B1cFRlbXBsYXRlID0gb3B0aW9ucy5zaW5nbGVQb3B1cFRlbXBsYXRlO1xyXG5cclxuICAgICAgICAvL3NldCB1cCB0aGUgY2x1c3RlcmluZyBwcm9wZXJ0aWVzXHJcbiAgICAgICAgdGhpcy5jbHVzdGVyUmF0aW8gPSBvcHRpb25zLmNsdXN0ZXJSYXRpbyB8fCA3NTtcclxuICAgICAgICB0aGlzLmNsdXN0ZXJUb1NjYWxlID0gb3B0aW9ucy5jbHVzdGVyVG9TY2FsZSB8fCAyMDAwMDAwO1xyXG4gICAgICAgIHRoaXMuY2x1c3Rlck1pbkNvdW50ID0gb3B0aW9ucy5jbHVzdGVyTWluQ291bnQgfHwgMjtcclxuICAgICAgICB0aGlzLnNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5ID0gb3B0aW9ucy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eSB8fCBcIm5hbWVcIjtcclxuICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXkpIHtcclxuICAgICAgICAgICAgdGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPSBvcHRpb25zLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJub25lXCIgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNsdXN0ZXJBcmVhRGlzcGxheTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5tYXhGbGFyZUNvdW50ID0gb3B0aW9ucy5tYXhGbGFyZUNvdW50IHx8IDg7XHJcbiAgICAgICAgdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50ID0gb3B0aW9ucy5tYXhTaW5nbGVGbGFyZUNvdW50IHx8IDg7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5RmxhcmVzID0gb3B0aW9ucy5kaXNwbGF5RmxhcmVzID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZTsgLy9kZWZhdWx0IHRvIHRydWVcclxuICAgICAgICB0aGlzLmRpc3BsYXlTdWJUeXBlRmxhcmVzID0gb3B0aW9ucy5kaXNwbGF5U3ViVHlwZUZsYXJlcyA9PT0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnN1YlR5cGVGbGFyZVByb3BlcnR5ID0gb3B0aW9ucy5zdWJUeXBlRmxhcmVQcm9wZXJ0eSB8fCB1bmRlZmluZWQ7XHJcbiAgICAgICAgdGhpcy5mbGFyZUJ1ZmZlclBpeGVscyA9IG9wdGlvbnMuZmxhcmVCdWZmZXJQaXhlbHMgfHwgNjtcclxuXHJcbiAgICAgICAgLy9kYXRhIHNldCBwcm9wZXJ0eSBuYW1lc1xyXG4gICAgICAgIHRoaXMueFByb3BlcnR5TmFtZSA9IG9wdGlvbnMueFByb3BlcnR5TmFtZSB8fCBcInhcIjtcclxuICAgICAgICB0aGlzLnlQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnlQcm9wZXJ0eU5hbWUgfHwgXCJ5XCI7XHJcbiAgICAgICAgdGhpcy56UHJvcGVydHlOYW1lID0gb3B0aW9ucy56UHJvcGVydHlOYW1lIHx8IFwielwiO1xyXG5cclxuICAgICAgICAvL3NldCB1cCB0aGUgc3ltYm9sb2d5L3JlbmRlcmVyIHByb3BlcnRpZXNcclxuICAgICAgICB0aGlzLmNsdXN0ZXJSZW5kZXJlciA9IG9wdGlvbnMuY2x1c3RlclJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuYXJlYVJlbmRlcmVyID0gb3B0aW9ucy5hcmVhUmVuZGVyZXI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVSZW5kZXJlciA9IG9wdGlvbnMuc2luZ2xlUmVuZGVyZXI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVTeW1ib2wgPSBvcHRpb25zLnNpbmdsZVN5bWJvbDtcclxuICAgICAgICB0aGlzLmZsYXJlUmVuZGVyZXIgPSBvcHRpb25zLmZsYXJlUmVuZGVyZXI7XHJcblxyXG4gICAgICAgIHRoaXMucmVmcmVzaE9uU3RhdGlvbmFyeSA9IG9wdGlvbnMucmVmcmVzaE9uU3RhdGlvbmFyeSA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vZGVmYXVsdCB0byB0cnVlXHJcblxyXG4gICAgICAgIC8vYWRkIHNvbWUgZGVmYXVsdCBzeW1ib2xzIG9yIHVzZSB0aGUgb3B0aW9ucyB2YWx1ZXMuXHJcbiAgICAgICAgdGhpcy5mbGFyZVN5bWJvbCA9IG9wdGlvbnMuZmxhcmVTeW1ib2wgfHwgbmV3IFNpbXBsZU1hcmtlclN5bWJvbCh7XHJcbiAgICAgICAgICAgIHNpemU6IDE0LFxyXG4gICAgICAgICAgICBjb2xvcjogbmV3IENvbG9yKFswLCAwLCAwLCAwLjVdKSxcclxuICAgICAgICAgICAgb3V0bGluZTogbmV3IFNpbXBsZUxpbmVTeW1ib2woeyBjb2xvcjogbmV3IENvbG9yKFsyNTUsIDI1NSwgMjU1LCAwLjVdKSwgd2lkdGg6IDEgfSlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy50ZXh0U3ltYm9sID0gb3B0aW9ucy50ZXh0U3ltYm9sIHx8IG5ldyBUZXh0U3ltYm9sKHtcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NV0pLFxyXG4gICAgICAgICAgICBmb250OiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiAxMCxcclxuICAgICAgICAgICAgICAgIGZhbWlseTogXCJhcmlhbFwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHlvZmZzZXQ6IC0zXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuZmxhcmVUZXh0U3ltYm9sID0gb3B0aW9ucy5mbGFyZVRleHRTeW1ib2wgfHwgbmV3IFRleHRTeW1ib2woe1xyXG4gICAgICAgICAgICBjb2xvcjogbmV3IENvbG9yKFsyNTUsIDI1NSwgMjU1XSksXHJcbiAgICAgICAgICAgIGZvbnQ6IHtcclxuICAgICAgICAgICAgICAgIHNpemU6IDYsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtMlxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvL2luaXRpYWwgZGF0YVxyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICB0aGlzLm9uKFwibGF5ZXJ2aWV3LWNyZWF0ZVwiLCAoZXZ0KSA9PiB0aGlzLl9sYXllclZpZXdDcmVhdGVkKGV2dCkpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fZGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlld0NyZWF0ZWQoZXZ0KSB7XHJcblxyXG4gICAgICAgIGlmIChldnQubGF5ZXJWaWV3LnZpZXcudHlwZSA9PT0gXCIyZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzJkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzNkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vYWRkIGEgc3RhdGlvbmFyeSB3YXRjaCBvbiB0aGUgdmlldyB0byByZWZyZXNoIGlmIHNwZWNpZmllZCBpbiBvcHRpb25zLlxyXG4gICAgICAgIGlmICh0aGlzLnJlZnJlc2hPblN0YXRpb25hcnkpIHtcclxuICAgICAgICAgICAgd2F0Y2hVdGlscy5wYXVzYWJsZShldnQubGF5ZXJWaWV3LnZpZXcsIFwic3RhdGlvbmFyeVwiLCAoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSA9PiB0aGlzLl92aWV3U3RhdGlvbmFyeShpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl92aWV3TG9hZENvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBldnQubGF5ZXJWaWV3LnZpZXc7XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9yZWFkeVRvRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdykge1xyXG4gICAgICAgICAgICAgICAgLy93ZSd2ZSBiZWVuIHdhaXRpbmcgZm9yIHRoaXMgdG8gaGFwcGVuIHRvIGRyYXdcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkSW5pdGlhbERyYXcgPSBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl92aWV3TG9hZENvdW50Kys7XHJcblxyXG5cclxuICAgICAgICBpZiAoZXZ0LmxheWVyVmlldy52aWV3LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICAvL2ZvciBtYXAgdmlld3MsIHdhaXQgZm9yIHRoZSBsYXllcnZpZXcgb3QgYmUgYXR0YWNoZWQsIGJlZm9yZSBhZGRpbmcgZXZlbnRzXHJcbiAgICAgICAgICAgIHdhdGNoVXRpbHMud2hlblRydWVPbmNlKGV2dC5sYXllclZpZXcsIFwiYXR0YWNoZWRcIiwgKCkgPT4gdGhpcy5fYWRkVmlld0V2ZW50cyhldnQubGF5ZXJWaWV3KSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL2ZvciBzY2VuZSB2aWV3cyBqdXN0IGFkZCB0aGUgZXZlbnRzIHN0cmFpZ2h0IGF3YXlcclxuICAgICAgICAgICAgdGhpcy5fYWRkVmlld0V2ZW50cyhldnQubGF5ZXJWaWV3KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2FkZFZpZXdFdmVudHMobGF5ZXJWaWV3OiBhbnkpIHtcclxuICAgICAgICBsZXQgdjogQWN0aXZlVmlldyA9IGxheWVyVmlldy52aWV3O1xyXG4gICAgICAgIGlmICghdi5mY2xQb2ludGVyTW92ZSkge1xyXG5cclxuICAgICAgICAgICAgbGV0IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGlmICh2LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICAgICAgLy9mb3IgYSBtYXAgdmlldyBnZXQgdGhlIGNvbnRhaW5lciBlbGVtZW50IG9mIHRoZSBsYXllciB2aWV3IHRvIGFkZCBtb3VzZW1vdmUgZXZlbnQgdG8uXHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIgPSBsYXllclZpZXcuY29udGFpbmVyLmVsZW1lbnQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvL2ZvciBzY2VuZSB2aWV3IGdldCB0aGUgY2FudmFzIGVsZW1lbnQgdW5kZXIgdGhlIHZpZXcgY29udGFpbmVyIHRvIGFkZCBtb3VzZW1vdmUgdG8uXHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIgPSA8SFRNTEVsZW1lbnQ+cXVlcnkoXCJjYW52YXNcIiwgdi5jb250YWluZXIpWzBdO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL0FkZCBwb2ludGVyIG1vdmUgYW5kIHBvaW50ZXIgZG93bi4gUG9pbnRlciBkb3duIHRvIGhhbmRsZSB0b3VjaCBkZXZpY2VzLlxyXG4gICAgICAgICAgICB2LmZjbFBvaW50ZXJNb3ZlID0gdi5vbihcInBvaW50ZXItbW92ZVwiLCAoZXZ0KSA9PiB0aGlzLl92aWV3UG9pbnRlck1vdmUoZXZ0KSk7XHJcbiAgICAgICAgICAgIHYuZmNsUG9pbnRlckRvd24gPSB2Lm9uKFwicG9pbnRlci1kb3duXCIsIChldnQpID0+IHRoaXMuX3ZpZXdQb2ludGVyTW92ZShldnQpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykge1xyXG5cclxuICAgICAgICBpZiAoaXNTdGF0aW9uYXJ5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9kYXRhKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCFpc1N0YXRpb25hcnkgJiYgdGhpcy5fYWN0aXZlQ2x1c3Rlcikge1xyXG4gICAgICAgICAgICAvL2lmIG1vdmluZyBkZWFjdGl2YXRlIGNsdXN0ZXI7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBjbGVhcigpIHtcclxuICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzID0ge307XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHNldERhdGEoZGF0YTogYW55W10sIGRyYXdEYXRhOiBib29sZWFuID0gdHJ1ZSkge1xyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xyXG4gICAgICAgIGlmIChkcmF3RGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZHJhdyhhY3RpdmVWaWV3PzogYW55KSB7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVWaWV3KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBhY3RpdmVWaWV3O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9Ob3QgcmVhZHkgdG8gZHJhdyB5ZXQgc28gcXVldWUgb25lIHVwXHJcbiAgICAgICAgaWYgKCF0aGlzLl9yZWFkeVRvRHJhdykge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlVmlldyB8fCAhdGhpcy5fZGF0YSkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLl9pczJkID0gdGhpcy5fYWN0aXZlVmlldy50eXBlID09PSBcIjJkXCI7XHJcblxyXG4gICAgICAgIC8vY2hlY2sgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYW4gYXJlYSByZW5kZXJlciBzZXQgaWYgb25lIG5lZWRzIHRvIGJlXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ICYmICF0aGlzLmFyZWFSZW5kZXJlcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRmxhcmVDbHVzdGVyTGF5ZXI6IGFyZWFSZW5kZXJlciBtdXN0IGJlIHNldCBpZiBjbHVzdGVyQXJlYURpc3BsYXkgaXMgc2V0LlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIGNvbnNvbGUudGltZShcImRyYXctZGF0YS1cIiArIHRoaXMuX2FjdGl2ZVZpZXcudHlwZSk7XHJcblxyXG4gICAgICAgIHRoaXMuX2lzQ2x1c3RlcmVkID0gdGhpcy5jbHVzdGVyVG9TY2FsZSA8IHRoaXMuX3NjYWxlKCk7XHJcblxyXG4gICAgICAgIGxldCBncmFwaGljczogR3JhcGhpY1tdID0gW107XHJcblxyXG4gICAgICAgIC8vZ2V0IGFuIGV4dGVudCB0aGF0IGlzIGluIHdlYiBtZXJjYXRvciB0byBtYWtlIHN1cmUgaXQncyBmbGF0IGZvciBleHRlbnQgY2hlY2tpbmdcclxuICAgICAgICAvL1RoZSB3ZWJleHRlbnQgd2lsbCBuZWVkIHRvIGJlIG5vcm1hbGl6ZWQgc2luY2UgcGFubmluZyBvdmVyIHRoZSBpbnRlcm5hdGlvbmFsIGRhdGVsaW5lIHdpbGwgY2F1c2VcclxuICAgICAgICAvL2NhdXNlIHRoZSBleHRlbnQgdG8gc2hpZnQgb3V0c2lkZSB0aGUgLTE4MCB0byAxODAgZGVncmVlIHdpbmRvdy4gIElmIHdlIGRvbid0IG5vcm1hbGl6ZSB0aGVuIHRoZVxyXG4gICAgICAgIC8vY2x1c3RlcnMgd2lsbCBub3QgYmUgZHJhd24gaWYgdGhlIG1hcCBwYW5zIG92ZXIgdGhlIGludGVybmF0aW9uYWwgZGF0ZWxpbmUuXHJcbiAgICAgICAgbGV0IHdlYkV4dGVudDogYW55ID0gIXRoaXMuX2V4dGVudCgpLnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvciA/IDxFeHRlbnQ+d2ViTWVyY2F0b3JVdGlscy5wcm9qZWN0KHRoaXMuX2V4dGVudCgpLCBuZXcgU3BhdGlhbFJlZmVyZW5jZSh7IFwid2tpZFwiOiAxMDIxMDAgfSkpIDogdGhpcy5fZXh0ZW50KCk7XHJcbiAgICAgICAgbGV0IGV4dGVudElzVW5pb25lZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBsZXQgbm9ybWFsaXplZFdlYkV4dGVudCA9IHdlYkV4dGVudC5ub3JtYWxpemUoKTtcclxuICAgICAgICB3ZWJFeHRlbnQgPSBub3JtYWxpemVkV2ViRXh0ZW50WzBdO1xyXG4gICAgICAgIGlmIChub3JtYWxpemVkV2ViRXh0ZW50Lmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgd2ViRXh0ZW50ID0gd2ViRXh0ZW50LnVuaW9uKG5vcm1hbGl6ZWRXZWJFeHRlbnRbMV0pO1xyXG4gICAgICAgICAgICBleHRlbnRJc1VuaW9uZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudCwgZXh0ZW50SXNVbmlvbmVkKTtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBsZXQgd2ViOiBudW1iZXJbXSwgb2JqOiBhbnksIGRhdGFMZW5ndGggPSB0aGlzLl9kYXRhLmxlbmd0aCwgeFZhbDogbnVtYmVyLCB5VmFsOiBudW1iZXI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhTGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgb2JqID0gdGhpcy5fZGF0YVtpXTtcclxuXHJcbiAgICAgICAgICAgIC8vY2hlY2sgaWYgZmlsdGVycyBhcmUgc3BlY2lmaWVkIGFuZCBjb250aW51ZSBpZiB0aGlzIG9iamVjdCBkb2Vzbid0IHBhc3NcclxuICAgICAgICAgICAgaWYgKCF0aGlzLl9wYXNzZXNGaWx0ZXIob2JqKSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHhWYWwgPSBvYmpbdGhpcy54UHJvcGVydHlOYW1lXTtcclxuICAgICAgICAgICAgeVZhbCA9IG9ialt0aGlzLnlQcm9wZXJ0eU5hbWVdO1xyXG5cclxuICAgICAgICAgICAgLy9nZXQgYSB3ZWIgbWVyYyBsbmcvbGF0IGZvciBleHRlbnQgY2hlY2tpbmcuIFVzZSB3ZWIgbWVyYyBhcyBpdCdzIGZsYXQgdG8gY2F0ZXIgZm9yIGxvbmdpdHVkZSBwb2xlXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICAgICAgd2ViID0gW3hWYWwsIHlWYWxdO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgd2ViID0gd2ViTWVyY2F0b3JVdGlscy5sbmdMYXRUb1hZKHhWYWwsIHlWYWwpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL2NoZWNrIGlmIHRoZSBvYmogaXMgdmlzaWJsZSBpbiB0aGUgZXh0ZW50IGJlZm9yZSBwcm9jZWVkaW5nXHJcbiAgICAgICAgICAgIGlmICgod2ViWzBdIDw9IHdlYkV4dGVudC54bWluIHx8IHdlYlswXSA+IHdlYkV4dGVudC54bWF4KSB8fCAod2ViWzFdIDw9IHdlYkV4dGVudC55bWluIHx8IHdlYlsxXSA+IHdlYkV4dGVudC55bWF4KSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vbG9vcCBjbHVzdGVyIGdyaWQgdG8gc2VlIGlmIGl0IHNob3VsZCBiZSBhZGRlZCB0byBvbmVcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwLCBqTGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzLmxlbmd0aDsgaiA8IGpMZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBjbCA9IHRoaXMuX2dyaWRDbHVzdGVyc1tqXTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHdlYlswXSA8PSBjbC5leHRlbnQueG1pbiB8fCB3ZWJbMF0gPiBjbC5leHRlbnQueG1heCB8fCB3ZWJbMV0gPD0gY2wuZXh0ZW50LnltaW4gfHwgd2ViWzFdID4gY2wuZXh0ZW50LnltYXgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7IC8vbm90IGhlcmUgc28gY2Fycnkgb25cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vcmVjYWxjIHRoZSB4IGFuZCB5IG9mIHRoZSBjbHVzdGVyIGJ5IGF2ZXJhZ2luZyB0aGUgcG9pbnRzIGFnYWluXHJcbiAgICAgICAgICAgICAgICAgICAgY2wueCA9IGNsLmNsdXN0ZXJDb3VudCA+IDAgPyAoeFZhbCArIChjbC54ICogY2wuY2x1c3RlckNvdW50KSkgLyAoY2wuY2x1c3RlckNvdW50ICsgMSkgOiB4VmFsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNsLnkgPSBjbC5jbHVzdGVyQ291bnQgPiAwID8gKHlWYWwgKyAoY2wueSAqIGNsLmNsdXN0ZXJDb3VudCkpIC8gKGNsLmNsdXN0ZXJDb3VudCArIDEpIDogeVZhbDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9wdXNoIGV2ZXJ5IHBvaW50IGludG8gdGhlIGNsdXN0ZXIgc28gd2UgaGF2ZSBpdCBmb3IgYXJlYSBkaXNwbGF5IGlmIHJlcXVpcmVkLiBUaGlzIGNvdWxkIGJlIG9taXR0ZWQgaWYgbmV2ZXIgY2hlY2tpbmcgYXJlYXMsIG9yIG9uIGRlbWFuZCBhdCBsZWFzdFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5wb2ludHMucHVzaChbeFZhbCwgeVZhbF0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY2wuY2x1c3RlckNvdW50Kys7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzdWJUeXBlRXhpc3RzID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcyA9IDAsIHNMZW4gPSBjbC5zdWJUeXBlQ291bnRzLmxlbmd0aDsgcyA8IHNMZW47IHMrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2wuc3ViVHlwZUNvdW50c1tzXS5uYW1lID09PSBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsLnN1YlR5cGVDb3VudHNbc10uY291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YlR5cGVFeGlzdHMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghc3ViVHlwZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzLnB1c2goeyBuYW1lOiBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0sIGNvdW50OiAxIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9hZGQgdGhlIHNpbmdsZSBmaXggcmVjb3JkIGlmIHN0aWxsIHVuZGVyIHRoZSBtYXhTaW5nbGVGbGFyZUNvdW50XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsLmNsdXN0ZXJDb3VudCA8PSB0aGlzLm1heFNpbmdsZUZsYXJlQ291bnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc2luZ2xlcy5wdXNoKG9iaik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zaW5nbGVzID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vbm90IGNsdXN0ZXJlZCBzbyBqdXN0IGFkZCBldmVyeSBvYmpcclxuICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNpbmdsZShvYmopO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5jbHVzdGVyQ291bnQgPCB0aGlzLmNsdXN0ZXJNaW5Db3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwLCBqbGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzW2ldLnNpbmdsZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNpbmdsZSh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uc2luZ2xlc1tqXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLmNsdXN0ZXJDb3VudCA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVDbHVzdGVyKHRoaXMuX2dyaWRDbHVzdGVyc1tpXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vZW1pdCBhbiBldmVudCB0byBzaWduYWwgZHJhd2luZyBpcyBjb21wbGV0ZS5cclxuICAgICAgICB0aGlzLmVtaXQoXCJkcmF3LWNvbXBsZXRlXCIsIHt9KTtcclxuICAgICAgICBjb25zb2xlLnRpbWVFbmQoYGRyYXctZGF0YS0ke3RoaXMuX2FjdGl2ZVZpZXcudHlwZX1gKTtcclxuXHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVN1cmZhY2UoKTtcclxuICAgICAgICB9LCAxMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfcGFzc2VzRmlsdGVyKG9iajogYW55KTogYm9vbGVhbiB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmZpbHRlcnMgfHwgdGhpcy5maWx0ZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgbGV0IHBhc3NlcyA9IHRydWU7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuZmlsdGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgZmlsdGVyID0gdGhpcy5maWx0ZXJzW2ldO1xyXG4gICAgICAgICAgICBpZiAob2JqW2ZpbHRlci5wcm9wZXJ0eU5hbWVdID09IG51bGwpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgbGV0IHZhbEV4aXN0cyA9IGZpbHRlci5wcm9wZXJ0eVZhbHVlcy5pbmRleE9mKG9ialtmaWx0ZXIucHJvcGVydHlOYW1lXSkgIT09IC0xO1xyXG4gICAgICAgICAgICBpZiAodmFsRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBwYXNzZXMgPSBmaWx0ZXIua2VlcE9ubHlJZlZhbHVlRXhpc3RzOyAvL3RoZSB2YWx1ZSBleGlzdHMgc28gcmV0dXJuIHdoZXRoZXIgd2Ugc2hvdWxkIGJlIGtlZXBpbmcgaXQgb3Igbm90LlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKCF2YWxFeGlzdHMgJiYgZmlsdGVyLmtlZXBPbmx5SWZWYWx1ZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcGFzc2VzID0gZmFsc2U7IC8vcmV0dXJuIGZhbHNlIGFzIHRoZSB2YWx1ZSBkb2Vzbid0IGV4aXN0LCBhbmQgd2Ugc2hvdWxkIG9ubHkgYmUga2VlcGluZyBwb2ludCBvYmplY3RzIHdoZXJlIGl0IGRvZXMgZXhpc3QuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghcGFzc2VzKSByZXR1cm4gZmFsc2U7IC8vaWYgaXQgaGFzbid0IHBhc3NlZCBhbnkgb2YgdGhlIGZpbHRlcnMgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHBhc3NlcztcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTaW5nbGUob2JqKSB7XHJcbiAgICAgICAgbGV0IHBvaW50ID0gbmV3IFBvaW50KHtcclxuICAgICAgICAgICAgeDogb2JqW3RoaXMueFByb3BlcnR5TmFtZV0sIHk6IG9ialt0aGlzLnlQcm9wZXJ0eU5hbWVdLCB6OiBvYmpbdGhpcy56UHJvcGVydHlOYW1lXVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoIXBvaW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBwb2ludCA9IDxQb2ludD53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKHBvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBncmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnQsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IG9ialxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBncmFwaGljLnBvcHVwVGVtcGxhdGUgPSB0aGlzLnNpbmdsZVBvcHVwVGVtcGxhdGU7XHJcbiAgICAgICAgaWYgKHRoaXMuc2luZ2xlUmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgbGV0IHN5bWJvbCA9IHRoaXMuc2luZ2xlUmVuZGVyZXIuZ2V0U3ltYm9sKGdyYXBoaWMsIHRoaXMuX2FjdGl2ZVZpZXcpO1xyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHN5bWJvbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodGhpcy5zaW5nbGVTeW1ib2wpIHtcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLnNpbmdsZVN5bWJvbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vbm8gc3ltYm9sb2d5IGZvciBzaW5nbGVzIGRlZmluZWQsIHVzZSB0aGUgZGVmYXVsdCBzeW1ib2wgZnJvbSB0aGUgY2x1c3RlciByZW5kZXJlclxyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHRoaXMuY2x1c3RlclJlbmRlcmVyLmRlZmF1bHRTeW1ib2w7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFkZChncmFwaGljKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2x1c3RlcihncmlkQ2x1c3RlcjogR3JpZENsdXN0ZXIpIHtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXIgPSBuZXcgQ2x1c3RlcigpO1xyXG4gICAgICAgIGNsdXN0ZXIuZ3JpZENsdXN0ZXIgPSBncmlkQ2x1c3RlcjtcclxuXHJcbiAgICAgICAgLy9tYWtlIHN1cmUgYWxsIGdlb21ldHJpZXMgYWRkZWQgdG8gR3JhcGhpYyBvYmplY3RzIGFyZSBpbiB3ZWIgbWVyY2F0b3Igb3RoZXJ3aXNlIHdyYXAgYXJvdW5kIGRvZXNuJ3Qgd29yay5cclxuICAgICAgICBsZXQgcG9pbnQgPSBuZXcgUG9pbnQoeyB4OiBncmlkQ2x1c3Rlci54LCB5OiBncmlkQ2x1c3Rlci55IH0pO1xyXG4gICAgICAgIGlmICghcG9pbnQuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgIHBvaW50ID0gPFBvaW50PndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IocG9pbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGF0dHJpYnV0ZXM6IGFueSA9IHtcclxuICAgICAgICAgICAgeDogZ3JpZENsdXN0ZXIueCxcclxuICAgICAgICAgICAgeTogZ3JpZENsdXN0ZXIueSxcclxuICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQsXHJcbiAgICAgICAgICAgIGlzQ2x1c3RlcjogdHJ1ZSxcclxuICAgICAgICAgICAgY2x1c3Rlck9iamVjdDogZ3JpZENsdXN0ZXJcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGF0dHJpYnV0ZXMsXHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sID0gdGhpcy5jbHVzdGVyUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oY2x1c3Rlci5jbHVzdGVyR3JhcGhpYykuc3ltYm9sO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJJZCA9IGNsdXN0ZXIuY2x1c3RlckdyYXBoaWNbXCJ1aWRcIl07XHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZCA9IGNsdXN0ZXIuY2x1c3RlcklkO1xyXG5cclxuICAgICAgICAvL2Fsc28gY3JlYXRlIGEgdGV4dCBzeW1ib2wgdG8gZGlzcGxheSB0aGUgY2x1c3RlciBjb3VudFxyXG4gICAgICAgIGxldCB0ZXh0U3ltYm9sID0gdGhpcy50ZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgdGV4dFN5bWJvbC50ZXh0ID0gZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LnRvU3RyaW5nKCk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICB0ZXh0U3ltYm9sLmFuZ2xlID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIudGV4dEdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludCxcclxuICAgICAgICAgICAgYXR0cmlidXRlczoge1xyXG4gICAgICAgICAgICAgICAgaXNDbHVzdGVyVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJJZDogY2x1c3Rlci5jbHVzdGVySWRcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vYWRkIGFuIGFyZWEgZ3JhcGhpYyB0byBkaXNwbGF5IHRoZSBib3VuZHMgb2YgdGhlIGNsdXN0ZXIgaWYgY29uZmlndXJlZCB0b1xyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSAmJiBncmlkQ2x1c3Rlci5wb2ludHMgJiYgZ3JpZENsdXN0ZXIucG9pbnRzLmxlbmd0aCA+IDApIHtcclxuXHJcbiAgICAgICAgICAgIGxldCBtcCA9IG5ldyBNdWx0aXBvaW50KCk7XHJcbiAgICAgICAgICAgIG1wLnBvaW50cyA9IGdyaWRDbHVzdGVyLnBvaW50cztcclxuICAgICAgICAgICAgbGV0IGFyZWE6IGFueSA9IGdlb21ldHJ5RW5naW5lLmNvbnZleEh1bGwobXAsIHRydWUpOyAvL3VzZSBjb252ZXggaHVsbCBvbiB0aGUgcG9pbnRzIHRvIGdldCB0aGUgYm91bmRhcnlcclxuXHJcbiAgICAgICAgICAgIGxldCBhcmVhQXR0cjogYW55ID0ge1xyXG4gICAgICAgICAgICAgICAgeDogZ3JpZENsdXN0ZXIueCxcclxuICAgICAgICAgICAgICAgIHk6IGdyaWRDbHVzdGVyLnksXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJJZDogY2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBpc0NsdXN0ZXJBcmVhOiB0cnVlXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChhcmVhLnJpbmdzICYmIGFyZWEucmluZ3MubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGFyZWFQb2x5ID0gbmV3IFBvbHlnb24oKTsgLy9oYWQgdG8gY3JlYXRlIGEgbmV3IHBvbHlnb24gYW5kIGZpbGwgaXQgd2l0aCB0aGUgcmluZyBvZiB0aGUgY2FsY3VsYXRlZCBhcmVhIGZvciBTY2VuZVZpZXcgdG8gd29yay5cclxuICAgICAgICAgICAgICAgIGFyZWFQb2x5ID0gYXJlYVBvbHkuYWRkUmluZyhhcmVhLnJpbmdzWzBdKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIWFyZWFQb2x5LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGFyZWFQb2x5ID0gPFBvbHlnb24+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihhcmVhUG9seSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY2x1c3Rlci5hcmVhR3JhcGhpYyA9IG5ldyBHcmFwaGljKHsgZ2VvbWV0cnk6IGFyZWFQb2x5LCBhdHRyaWJ1dGVzOiBhcmVhQXR0ciB9KTtcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXIuYXJlYUdyYXBoaWMuc3ltYm9sID0gdGhpcy5hcmVhUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oY2x1c3Rlci5hcmVhR3JhcGhpYykuc3ltYm9sO1xyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9hZGQgdGhlIGdyYXBoaWNzIGluIG9yZGVyICAgICAgICBcclxuICAgICAgICBpZiAoY2x1c3Rlci5hcmVhR3JhcGhpYyAmJiB0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhbHdheXNcIikge1xyXG4gICAgICAgICAgICB0aGlzLmFkZChjbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci5jbHVzdGVyR3JhcGhpYyk7XHJcbiAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci50ZXh0R3JhcGhpYyk7XHJcblxyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzW2NsdXN0ZXIuY2x1c3RlcklkXSA9IGNsdXN0ZXI7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudDogRXh0ZW50LCBleHRlbnRJc1VuaW9uZWQ6IGJvb2xlYW4pIHtcclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHRvdGFsIGFtb3VudCBvZiBncmlkIHNwYWNlcyBiYXNlZCBvbiB0aGUgaGVpZ2h0IGFuZCB3aWR0aCBvZiB0aGUgbWFwIChkaXZpZGUgaXQgYnkgY2x1c3RlclJhdGlvKSAtIHRoZW4gZ2V0IHRoZSBkZWdyZWVzIGZvciB4IGFuZCB5IFxyXG4gICAgICAgIGxldCB4Q291bnQgPSBNYXRoLnJvdW5kKHRoaXMuX2FjdGl2ZVZpZXcud2lkdGggLyB0aGlzLmNsdXN0ZXJSYXRpbyk7XHJcbiAgICAgICAgbGV0IHlDb3VudCA9IE1hdGgucm91bmQodGhpcy5fYWN0aXZlVmlldy5oZWlnaHQgLyB0aGlzLmNsdXN0ZXJSYXRpbyk7XHJcblxyXG4gICAgICAgIC8vaWYgdGhlIGV4dGVudCBoYXMgYmVlbiB1bmlvbmVkIGR1ZSB0byBub3JtYWxpemF0aW9uLCBkb3VibGUgdGhlIGNvdW50IG9mIHggaW4gdGhlIGNsdXN0ZXIgZ3JpZCBhcyB0aGUgdW5pb25pbmcgd2lsbCBoYWx2ZSBpdC5cclxuICAgICAgICBpZiAoZXh0ZW50SXNVbmlvbmVkKSB7XHJcbiAgICAgICAgICAgIHhDb3VudCAqPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHh3ID0gKHdlYkV4dGVudC54bWF4IC0gd2ViRXh0ZW50LnhtaW4pIC8geENvdW50O1xyXG4gICAgICAgIGxldCB5aCA9ICh3ZWJFeHRlbnQueW1heCAtIHdlYkV4dGVudC55bWluKSAvIHlDb3VudDtcclxuXHJcbiAgICAgICAgbGV0IGdzeG1pbiwgZ3N4bWF4LCBnc3ltaW4sIGdzeW1heDtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgYW4gYXJyYXkgb2YgY2x1c3RlcnMgdGhhdCBpcyBhIGdyaWQgb3ZlciB0aGUgdmlzaWJsZSBleHRlbnQuIEVhY2ggY2x1c3RlciBjb250YWlucyB0aGUgZXh0ZW50IChpbiB3ZWIgbWVyYykgdGhhdCBib3VuZHMgdGhlIGdyaWQgc3BhY2UgZm9yIGl0LlxyXG4gICAgICAgIHRoaXMuX2dyaWRDbHVzdGVycyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgeENvdW50OyBpKyspIHtcclxuICAgICAgICAgICAgZ3N4bWluID0gd2ViRXh0ZW50LnhtaW4gKyAoeHcgKiBpKTtcclxuICAgICAgICAgICAgZ3N4bWF4ID0gZ3N4bWluICsgeHc7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgeUNvdW50OyBqKyspIHtcclxuICAgICAgICAgICAgICAgIGdzeW1pbiA9IHdlYkV4dGVudC55bWluICsgKHloICogaik7XHJcbiAgICAgICAgICAgICAgICBnc3ltYXggPSBnc3ltaW4gKyB5aDtcclxuICAgICAgICAgICAgICAgIGxldCBleHQgPSB7IHhtaW46IGdzeG1pbiwgeG1heDogZ3N4bWF4LCB5bWluOiBnc3ltaW4sIHltYXg6IGdzeW1heCB9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ3JpZENsdXN0ZXJzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIGV4dGVudDogZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogMCxcclxuICAgICAgICAgICAgICAgICAgICBzdWJUeXBlQ291bnRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICBzaW5nbGVzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludHM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHg6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgeTogMFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICAgXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhbiBzdmcgc3VyZmFjZSBvbiB0aGUgdmlldyBpZiBpdCBkb2Vzbid0IGFscmVhZHkgZXhpc3RcclxuICAgICAqIEBwYXJhbSB2aWV3XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2NyZWF0ZVN1cmZhY2UoKSB7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UpIHJldHVybjtcclxuICAgICAgICBsZXQgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2xheWVyVmlldzJkLmNvbnRhaW5lci5lbGVtZW50LnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBzdXJmYWNlUGFyZW50RWxlbWVudCA9IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudEVsZW1lbnQgfHwgdGhpcy5fYWN0aXZlVmlldy5jYW52YXMucGFyZW50Tm9kZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlID0gZ2Z4LmNyZWF0ZVN1cmZhY2Uoc3VyZmFjZVBhcmVudEVsZW1lbnQsIFwiMFwiLCBcIjBcIik7XHJcbiAgICAgICAgc3VyZmFjZS5jb250YWluZXJHcm91cCA9IHN1cmZhY2UuY3JlYXRlR3JvdXAoKTtcclxuXHJcbiAgICAgICAgZG9tU3R5bGUuc2V0KHN1cmZhY2UucmF3Tm9kZSwgeyBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLCB0b3A6IFwiMFwiLCB6SW5kZXg6IC0xIH0pO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJvdmVyZmxvd1wiLCBcInZpc2libGVcIik7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcImNsYXNzXCIsIFwiZmNsLXN1cmZhY2VcIik7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlID0gc3VyZmFjZTtcclxuXHJcbiAgICAgICAgLy9UaGlzIGlzIGEgaGFjayBmb3IgSUUgJiBFZGdlLiBoaXRUZXN0IG9uIHRoZSB2aWV3IGRvZXNuJ3QgcGljayB1cCBhbnkgcmVzdWx0cyB1bmxlc3MgdGhlIHotaW5kZXggb2YgdGhlIGxheWVyVmlldyBjb250YWluZXIgaXMgYXQgbGVhc3QgMS4gU28gc2V0IGl0IHRvIDEsIGJ1dCBhbHNvIGhhdmUgdG8gc2V0IHRoZSAuZXNyaS11aVxyXG4gICAgICAgIC8vY29udGFpbmVyIHRvIDIgb3RoZXJ3aXNlIGl0IGNhbid0IGJlIGNsaWNrZWQgb24gYXMgaXQncyBjb3ZlcmVkIGJ5IHRoZSBsYXllciB2aWV3IGNvbnRhaW5lci4gbWVoIVxyXG4gICAgICAgIC8vdXNpbmcgZG9qby9zbmlmZiB0byB0YXJnZXQgSUUgYnJvd3NlcnMuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgKHNuaWZmKFwidHJpZGVudFwiKSB8fCBzbmlmZihcImllXCIpIHx8IHNuaWZmKFwiZWRnZVwiKSkpIHtcclxuICAgICAgICAgICAgZG9tU3R5bGUuc2V0KHRoaXMuX2xheWVyVmlldzJkLmNvbnRhaW5lci5lbGVtZW50LCBcInotaW5kZXhcIiwgXCIxXCIpO1xyXG4gICAgICAgICAgICBxdWVyeShcIi5lc3JpLXVpXCIpLmZvckVhY2goZnVuY3Rpb24gKG5vZGU6IEhUTUxFbGVtZW50LCBpbmRleCkge1xyXG4gICAgICAgICAgICAgICAgZG9tU3R5bGUuc2V0KG5vZGUsIFwiei1pbmRleFwiLCBcIjJcIik7XHJcbiAgICAgICAgICAgIH0pOyBcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1BvaW50ZXJNb3ZlKGV2dCkge1xyXG5cclxuICAgICAgICBsZXQgbW91c2VQb3MgPSB0aGlzLl9nZXRNb3VzZVBvcyhldnQpO1xyXG4gICAgICAgXHJcbiAgICAgICAgLy9pZiB0aGVyZSdzIGFuIGFjdGl2ZSBjbHVzdGVyIGFuZCB0aGUgY3VycmVudCBzY3JlZW4gcG9zIGlzIHdpdGhpbiB0aGUgYm91bmRzIG9mIHRoYXQgY2x1c3RlcidzIGdyb3VwIGNvbnRhaW5lciwgZG9uJ3QgZG8gYW55dGhpbmcgbW9yZS4gXHJcbiAgICAgICAgLy9UT0RPOiB3b3VsZCBwcm9iYWJseSBiZSBiZXR0ZXIgdG8gY2hlY2sgaWYgdGhlIHBvaW50IGlzIGluIHRoZSBhY3R1YWwgY2lyY2xlIG9mIHRoZSBjbHVzdGVyIGdyb3VwIGFuZCBpdCdzIGZsYXJlcyBpbnN0ZWFkIG9mIHVzaW5nIHRoZSByZWN0YW5nbGUgYm91bmRpbmcgYm94LlxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVDbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIGxldCBiYm94ID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICAgICAgaWYgKGJib3gpIHtcclxuICAgICAgICAgICAgICAgIGlmIChtb3VzZVBvcy54ID49IGJib3gubGVmdCAmJiBtb3VzZVBvcy54IDw9IGJib3gucmlnaHQgJiYgbW91c2VQb3MueSA+PSBiYm94LnRvcCAmJiBtb3VzZVBvcy55IDw9IGJib3guYm90dG9tKSByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB2OiBNYXBWaWV3ID0gdGhpcy5fYWN0aXZlVmlldztcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlVmlldy5oaXRUZXN0KG1vdXNlUG9zKS50aGVuKChyZXNwb25zZSkgPT4ge1xyXG5cclxuICAgICAgICAgICAgbGV0IGdyYXBoaWNzID0gcmVzcG9uc2UucmVzdWx0cztcclxuICAgICAgICAgICAgaWYgKGdyYXBoaWNzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGdyYXBoaWNzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZyA9IGdyYXBoaWNzW2ldLmdyYXBoaWM7XHJcbiAgICAgICAgICAgICAgICBpZiAoZyAmJiAoZy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZCAhPSBudWxsICYmICFnLmF0dHJpYnV0ZXMuaXNDbHVzdGVyQXJlYSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2x1c3RlciA9IHRoaXMuX2NsdXN0ZXJzW2cuYXR0cmlidXRlcy5jbHVzdGVySWRdO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FjdGl2YXRlQ2x1c3RlcihjbHVzdGVyKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfYWN0aXZhdGVDbHVzdGVyKGNsdXN0ZXI6IENsdXN0ZXIpIHtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPT09IGNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuOyAvL2FscmVhZHkgYWN0aXZlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPSBjbHVzdGVyO1xyXG4gICAgICAgIHRoaXMuX2luaXRTdXJmYWNlKCk7XHJcbiAgICAgICAgdGhpcy5faW5pdENsdXN0ZXIoKTtcclxuICAgICAgICB0aGlzLl9pbml0RmxhcmVzKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2hpZGVHcmFwaGljKFt0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljXSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhY3RpdmF0ZWRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9zaG93R3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJhY3RpdmF0ZSBjbHVzdGVyXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2RlYWN0aXZhdGVDbHVzdGVyKCkge1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5fc2hvd0dyYXBoaWMoW3RoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWNdKTtcclxuICAgICAgICB0aGlzLl9yZW1vdmVDbGFzc0Zyb21FbGVtZW50KHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUsIFwiYWN0aXZhdGVkXCIpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwiYWN0aXZhdGVkXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5faGlkZUdyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci5hcmVhR3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9jbGVhclN1cmZhY2UoKTtcclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyID0gdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiREUtYWN0aXZhdGUgY2x1c3RlclwiKTtcclxuXHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2luaXRTdXJmYWNlKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgc3VyZmFjZSA9IHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZTtcclxuICAgICAgICBpZiAoIXN1cmZhY2UpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IHNwcDogU2NyZWVuUG9pbnQ7XHJcbiAgICAgICAgbGV0IHNwOiBTY3JlZW5Qb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9TY3JlZW4oPFBvaW50PnRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnksIHNwcCk7XHJcblxyXG4gICAgICAgIC8vdG9TY3JlZW4oKSByZXR1cm5zIHRoZSB3cm9uZyB2YWx1ZSBmb3IgeCBpZiBhIDJkIG1hcCBoYXMgYmVlbiB3cmFwcGVkIGFyb3VuZCB0aGUgZ2xvYmUuIE5lZWQgdG8gY2hlY2sgYW5kIGNhdGVyIGZvciB0aGlzLiBJIHRoaW5rIHRoaXMgYSBidWcgaW4gdGhlIGFwaS5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICB2YXIgd3N3ID0gdGhpcy5fYWN0aXZlVmlldy5zdGF0ZS53b3JsZFNjcmVlbldpZHRoO1xyXG4gICAgICAgICAgICBsZXQgcmF0aW8gPSBwYXJzZUludCgoc3AueCAvIHdzdykudG9GaXhlZCgwKSk7IC8vZ2V0IGEgcmF0aW8gdG8gZGV0ZXJtaW5lIGhvdyBtYW55IHRpbWVzIHRoZSBtYXAgaGFzIGJlZW4gd3JhcHBlZCBhcm91bmQuXHJcbiAgICAgICAgICAgIGlmIChzcC54IDwgMCkge1xyXG4gICAgICAgICAgICAgICAgLy94IGlzIGxlc3MgdGhhbiAwLCBXVEYuIE5lZWQgdG8gYWRqdXN0IGJ5IHRoZSB3b3JsZCBzY3JlZW4gd2lkdGguXHJcbiAgICAgICAgICAgICAgICBzcC54ICs9IHdzdyAqIChyYXRpbyAqIC0xKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmIChzcC54ID4gd3N3KSB7XHJcbiAgICAgICAgICAgICAgICAvL3ggaXMgdG9vIGJpZywgV1RGIGFzIHdlbGwsIGNhdGVyIGZvciBpdC5cclxuICAgICAgICAgICAgICAgIHNwLnggLT0gd3N3ICogcmF0aW87XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAxMSwgb3ZlcmZsb3c6IFwidmlzaWJsZVwiLCB3aWR0aDogXCIxcHhcIiwgaGVpZ2h0OiBcIjFweFwiLCBsZWZ0OiBzcC54ICsgXCJweFwiLCB0b3A6IHNwLnkgKyBcInB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwidmlzaWJsZVwiKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY2xlYXJTdXJmYWNlKCkge1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIHF1ZXJ5KFwiPlwiLCBzdXJmYWNlLmNvbnRhaW5lckdyb3VwLnJhd05vZGUpLmZvckVhY2goZG9tQ29uc3RydWN0LmRlc3Ryb3kpO1xyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAtMSwgb3ZlcmZsb3c6IFwiaGlkZGVuXCIsIHRvcDogXCIwcHhcIiwgbGVmdDogXCIwcHhcIiB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJoaWRkZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdENsdXN0ZXIoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgaWYgKCFzdXJmYWNlKSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vd2UncmUgZ29pbmcgdG8gcmVwbGljYXRlIGEgY2x1c3RlciBncmFwaGljIGluIHRoZSBzdmcgZWxlbWVudCB3ZSBhZGRlZCB0byB0aGUgbGF5ZXIgdmlldy4gSnVzdCBzbyBpdCBjYW4gYmUgc3R5bGVkIGVhc2lseS4gTmF0aXZlIFdlYkdMIGZvciBTY2VuZSBWaWV3cyB3b3VsZCBwcm9iYWJseSBiZSBiZXR0ZXIsIGJ1dCBhdCBsZWFzdCB0aGlzIHdheSBjc3MgY2FuIHN0aWxsIGJlIHVzZWQgdG8gc3R5bGUvYW5pbWF0ZSB0aGluZ3MuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAgPSBzdXJmYWNlLmNvbnRhaW5lckdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQodGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZSwgXCJjbHVzdGVyLWdyb3VwXCIpO1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSB0aGUgY2x1c3RlciBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRDbHVzdGVyRWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkQ2x1c3RlckVsZW1lbnQsIFwiY2x1c3RlclwiKTtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgdGhlIGNsdXN0ZXIgdGV4dCBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRUZXh0RWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkVGV4dEVsZW1lbnQsIFwiY2x1c3Rlci10ZXh0XCIpO1xyXG4gICAgICAgIGNsb25lZFRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChjbG9uZWRDbHVzdGVyRWxlbWVudCk7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChjbG9uZWRUZXh0RWxlbWVudCk7XHJcblxyXG4gICAgICAgIC8vc2V0IHRoZSBncm91cCBjbGFzcyAgICAgXHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQodGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIiwgMTApO1xyXG5cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdEZsYXJlcygpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIgfHwgIXRoaXMuZGlzcGxheUZsYXJlcykgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgZ3JpZENsdXN0ZXIgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmdyaWRDbHVzdGVyO1xyXG5cclxuICAgICAgICAvL2NoZWNrIGlmIHdlIG5lZWQgdG8gY3JlYXRlIGZsYXJlcyBmb3IgdGhlIGNsdXN0ZXJcclxuICAgICAgICBsZXQgc2luZ2xlRmxhcmVzID0gKGdyaWRDbHVzdGVyLnNpbmdsZXMgJiYgZ3JpZENsdXN0ZXIuc2luZ2xlcy5sZW5ndGggPiAwKSAmJiAoZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50IDw9IHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCk7XHJcbiAgICAgICAgbGV0IHN1YlR5cGVGbGFyZXMgPSAhc2luZ2xlRmxhcmVzICYmIChncmlkQ2x1c3Rlci5zdWJUeXBlQ291bnRzICYmIGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMubGVuZ3RoID4gMCk7XHJcblxyXG4gICAgICAgIGlmICghc2luZ2xlRmxhcmVzICYmICFzdWJUeXBlRmxhcmVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybjsgLy9ubyBmbGFyZXMgcmVxdWlyZWRcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBmbGFyZXM6IEZsYXJlW10gPSBbXTtcclxuICAgICAgICBpZiAoc2luZ2xlRmxhcmVzKSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBncmlkQ2x1c3Rlci5zaW5nbGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZiA9IG5ldyBGbGFyZSgpO1xyXG4gICAgICAgICAgICAgICAgZi50b29sdGlwVGV4dCA9IGdyaWRDbHVzdGVyLnNpbmdsZXNbaV1bdGhpcy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eV07XHJcbiAgICAgICAgICAgICAgICBmLnNpbmdsZURhdGEgPSBncmlkQ2x1c3Rlci5zaW5nbGVzW2ldO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZVRleHQgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgZmxhcmVzLnB1c2goZik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoc3ViVHlwZUZsYXJlcykge1xyXG5cclxuICAgICAgICAgICAgLy9zb3J0IHN1YiB0eXBlcyBieSBoaWdoZXN0IGNvdW50IGZpcnN0XHJcbiAgICAgICAgICAgIHZhciBzdWJUeXBlcyA9IGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGIuY291bnQgLSBhLmNvdW50O1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBzdWJUeXBlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGYgPSBuZXcgRmxhcmUoKTtcclxuICAgICAgICAgICAgICAgIGYudG9vbHRpcFRleHQgPSBgJHtzdWJUeXBlc1tpXS5uYW1lfSAoJHtzdWJUeXBlc1tpXS5jb3VudH0pYDtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVUZXh0ID0gc3ViVHlwZXNbaV0uY291bnQ7XHJcbiAgICAgICAgICAgICAgICBmbGFyZXMucHVzaChmKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9pZiB0aGVyZSBhcmUgbW9yZSBmbGFyZSBvYmplY3RzIHRvIGNyZWF0ZSB0aGFuIHRoZSBtYXhGbGFyZUNvdW50IGFuZCB0aGlzIGlzIGEgb25lIG9mIHRob3NlIC0gY3JlYXRlIGEgc3VtbWFyeSBmbGFyZSB0aGF0IGNvbnRhaW5zICcuLi4nIGFzIHRoZSB0ZXh0IGFuZCBtYWtlIHRoaXMgb25lIHBhcnQgb2YgaXQgXHJcbiAgICAgICAgbGV0IHdpbGxDb250YWluU3VtbWFyeUZsYXJlID0gZmxhcmVzLmxlbmd0aCA+IHRoaXMubWF4RmxhcmVDb3VudDtcclxuICAgICAgICBsZXQgZmxhcmVDb3VudCA9IHdpbGxDb250YWluU3VtbWFyeUZsYXJlID8gdGhpcy5tYXhGbGFyZUNvdW50IDogZmxhcmVzLmxlbmd0aDtcclxuXHJcbiAgICAgICAgLy9pZiB0aGVyZSdzIGFuIGV2ZW4gYW1vdW50IG9mIGZsYXJlcywgcG9zaXRpb24gdGhlIGZpcnN0IGZsYXJlIHRvIHRoZSBsZWZ0LCBtaW51cyAxODAgZnJvbSBkZWdyZWUgdG8gZG8gdGhpcy5cclxuICAgICAgICAvL2ZvciBhbiBhZGQgYW1vdW50IHBvc2l0aW9uIHRoZSBmaXJzdCBmbGFyZSBvbiB0b3AsIC05MCB0byBkbyB0aGlzLiBMb29rcyBtb3JlIHN5bW1ldHJpY2FsIHRoaXMgd2F5LlxyXG4gICAgICAgIGxldCBkZWdyZWVWYXJpYW5jZSA9IChmbGFyZUNvdW50ICUgMiA9PT0gMCkgPyAtMTgwIDogLTkwO1xyXG4gICAgICAgIGxldCB2aWV3Um90YXRpb24gPSB0aGlzLl9pczJkID8gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbiA6IDA7XHJcblxyXG4gICAgICAgIGxldCBjbHVzdGVyU2NyZWVuUG9pbnQgPSB0aGlzLl9hY3RpdmVWaWV3LnRvU2NyZWVuKDxQb2ludD50aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5KTtcclxuICAgICAgICBsZXQgY2x1c3RlclN5bWJvbFNpemUgPSA8bnVtYmVyPnRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sLmdldChcInNpemVcIik7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmbGFyZUNvdW50OyBpKyspIHtcclxuXHJcbiAgICAgICAgICAgIGxldCBmbGFyZSA9IGZsYXJlc1tpXTtcclxuXHJcbiAgICAgICAgICAgIC8vc2V0IHNvbWUgYXR0cmlidXRlIGRhdGFcclxuICAgICAgICAgICAgbGV0IGZsYXJlQXR0cmlidXRlcyA9IHtcclxuICAgICAgICAgICAgICAgIGlzRmxhcmU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBpc1N1bW1hcnlGbGFyZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICB0b29sdGlwVGV4dDogXCJcIixcclxuICAgICAgICAgICAgICAgIGZsYXJlVGV4dEdyYXBoaWM6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJHcmFwaGljSWQ6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlcklkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnRcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGxldCBmbGFyZVRleHRBdHRyaWJ1dGVzID0ge307XHJcblxyXG4gICAgICAgICAgICAvL0RvIGEgY291cGxlIG9mIHRoaW5ncyBkaWZmZXJlbnRseSBpZiB0aGlzIGlzIGEgc3VtbWFyeSBmbGFyZSBvciBub3RcclxuICAgICAgICAgICAgbGV0IGlzU3VtbWFyeUZsYXJlID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgJiYgaSA+PSB0aGlzLm1heEZsYXJlQ291bnQgLSAxO1xyXG4gICAgICAgICAgICBpZiAoaXNTdW1tYXJ5RmxhcmUpIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmlzU3VtbWFyeSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBmbGFyZUF0dHJpYnV0ZXMuaXNTdW1tYXJ5RmxhcmUgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgbGV0IHRvb2x0aXBUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIC8vbXVsdGlsaW5lIHRvb2x0aXAgZm9yIHN1bW1hcnkgZmxhcmVzLCBpZTogZ3JlYXRlciB0aGFuIHRoaXMubWF4RmxhcmVDb3VudCBmbGFyZXMgcGVyIGNsdXN0ZXJcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSB0aGlzLm1heEZsYXJlQ291bnQgLSAxLCBqbGVuID0gZmxhcmVzLmxlbmd0aDsgaiA8IGpsZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGogPiAodGhpcy5tYXhGbGFyZUNvdW50IC0gMSkgPyBcIlxcblwiIDogXCJcIjtcclxuICAgICAgICAgICAgICAgICAgICB0b29sdGlwVGV4dCArPSBmbGFyZXNbal0udG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmbGFyZS50b29sdGlwVGV4dCA9IHRvb2x0aXBUZXh0O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmbGFyZUF0dHJpYnV0ZXMudG9vbHRpcFRleHQgPSBmbGFyZS50b29sdGlwVGV4dDtcclxuXHJcbiAgICAgICAgICAgIC8vY3JlYXRlIGEgZ3JhcGhpYyBmb3IgdGhlIGZsYXJlIGFuZCBmb3IgdGhlIGZsYXJlIHRleHRcclxuICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGZsYXJlQXR0cmlidXRlcyxcclxuICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5LFxyXG4gICAgICAgICAgICAgICAgcG9wdXBUZW1wbGF0ZTogbnVsbFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sID0gdGhpcy5fZ2V0RmxhcmVTeW1ib2woZmxhcmUuZ3JhcGhpYyk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgICAgICBpZiAoZmxhcmUuZmxhcmVUZXh0KSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgICAgICAgICB0ZXh0U3ltYm9sLnRleHQgPSAhaXNTdW1tYXJ5RmxhcmUgPyBmbGFyZS5mbGFyZVRleHQudG9TdHJpbmcoKSA6IFwiLi4uXCI7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHRTeW1ib2wuYW5nbGUgPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyR3JhcGhpY0lkOiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJJZFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sLFxyXG4gICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9mbGFyZXMgaGF2ZSBiZWVuIGNyZWF0ZWQgc28gYWRkIHRoZW0gdG8gdGhlIGRvbVxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBmbGFyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGYgPSBmbGFyZXNbaV07XHJcbiAgICAgICAgICAgIGlmICghZi5ncmFwaGljKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIC8vY3JlYXRlIGEgZ3JvdXAgdG8gaG9sZCBmbGFyZSBvYmplY3QgYW5kIHRleHQgaWYgbmVlZGVkLiBcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAuY3JlYXRlR3JvdXAoKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBwb3NpdGlvbiA9IHRoaXMuX3NldEZsYXJlUG9zaXRpb24oZi5mbGFyZUdyb3VwLCBjbHVzdGVyU3ltYm9sU2l6ZSwgZmxhcmVDb3VudCwgaSwgZGVncmVlVmFyaWFuY2UsIHZpZXdSb3RhdGlvbik7XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJmbGFyZS1ncm91cFwiKTtcclxuICAgICAgICAgICAgbGV0IGZsYXJlRWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyhmLmdyYXBoaWMsIGYuZmxhcmVHcm91cCk7XHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGZsYXJlRWxlbWVudCk7XHJcbiAgICAgICAgICAgIGlmIChmLnRleHRHcmFwaGljKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZmxhcmVUZXh0RWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyhmLnRleHRHcmFwaGljLCBmLmZsYXJlR3JvdXApO1xyXG4gICAgICAgICAgICAgICAgZmxhcmVUZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcbiAgICAgICAgICAgICAgICBmLmZsYXJlR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChmbGFyZVRleHRFbGVtZW50KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwiYWN0aXZhdGVkXCIsIDEwKTtcclxuXHJcbiAgICAgICAgICAgIC8vYXNzaWduIHNvbWUgZXZlbnQgaGFuZGxlcnMgZm9yIHRoZSB0b29sdGlwc1xyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAubW91c2VFbnRlciA9IG9uLnBhdXNhYmxlKGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcIm1vdXNlZW50ZXJcIiwgKCkgPT4gdGhpcy5fY3JlYXRlVG9vbHRpcChmKSk7XHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5tb3VzZUxlYXZlID0gb24ucGF1c2FibGUoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwibW91c2VsZWF2ZVwiLCAoKSA9PiB0aGlzLl9kZXN0cm95VG9vbHRpcCgpKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zZXRGbGFyZVBvc2l0aW9uKGZsYXJlR3JvdXA6IGFueSwgY2x1c3RlclN5bWJvbFNpemU6IG51bWJlciwgZmxhcmVDb3VudDogbnVtYmVyLCBmbGFyZUluZGV4OiBudW1iZXIsIGRlZ3JlZVZhcmlhbmNlOiBudW1iZXIsIHZpZXdSb3RhdGlvbjogbnVtYmVyKSB7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSBwb3NpdGlvbiBvZiB0aGUgZmxhcmUgdG8gYmUgcGxhY2VkIGFyb3VuZCB0aGUgY29udGFpbmVyIGNpcmNsZS5cclxuICAgICAgICBsZXQgZGVncmVlID0gcGFyc2VJbnQoKCgzNjAgLyBmbGFyZUNvdW50KSAqIGZsYXJlSW5kZXgpLnRvRml4ZWQoKSk7XHJcbiAgICAgICAgZGVncmVlID0gZGVncmVlICsgZGVncmVlVmFyaWFuY2U7XHJcblxyXG4gICAgICAgIC8vdGFrZSBpbnRvIGFjY291bnQgYW55IHJvdGF0aW9uIG9uIHRoZSB2aWV3XHJcbiAgICAgICAgaWYgKHZpZXdSb3RhdGlvbiAhPT0gMCkge1xyXG4gICAgICAgICAgICBkZWdyZWUgLT0gdmlld1JvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHJhZGlhbiA9IGRlZ3JlZSAqIChNYXRoLlBJIC8gMTgwKTtcclxuICAgICAgICBsZXQgYnVmZmVyID0gdGhpcy5mbGFyZUJ1ZmZlclBpeGVscztcclxuXHJcbiAgICAgICAgLy9wb3NpdGlvbiB0aGUgZmxhcmUgZ3JvdXAgYXJvdW5kIHRoZSBjbHVzdGVyXHJcbiAgICAgICAgbGV0IHBvc2l0aW9uID0ge1xyXG4gICAgICAgICAgICB4OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5jb3MocmFkaWFuKSxcclxuICAgICAgICAgICAgeTogKGJ1ZmZlciArIGNsdXN0ZXJTeW1ib2xTaXplKSAqIE1hdGguc2luKHJhZGlhbilcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAuc2V0VHJhbnNmb3JtKHsgZHg6IHBvc2l0aW9uLngsIGR5OiBwb3NpdGlvbi55IH0pO1xyXG4gICAgICAgIHJldHVybiBwb3NpdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9nZXRGbGFyZVN5bWJvbChmbGFyZUdyYXBoaWM6IEdyYXBoaWMpOiBTaW1wbGVNYXJrZXJTeW1ib2wge1xyXG4gICAgICAgIHJldHVybiAhdGhpcy5mbGFyZVJlbmRlcmVyID8gdGhpcy5mbGFyZVN5bWJvbCA6IHRoaXMuZmxhcmVSZW5kZXJlci5nZXRDbGFzc0JyZWFrSW5mbyhmbGFyZUdyYXBoaWMpLnN5bWJvbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVUb29sdGlwKGZsYXJlOiBGbGFyZSkge1xyXG5cclxuICAgICAgICBsZXQgZmxhcmVHcm91cCA9IGZsYXJlLmZsYXJlR3JvdXA7XHJcbiAgICAgICAgdGhpcy5fZGVzdHJveVRvb2x0aXAoKTtcclxuXHJcbiAgICAgICAgbGV0IHRvb2x0aXBMZW5ndGggPSBxdWVyeShcIi50b29sdGlwLXRleHRcIiwgZmxhcmVHcm91cC5yYXdOb2RlKS5sZW5ndGg7XHJcbiAgICAgICAgaWYgKHRvb2x0aXBMZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSB0ZXh0IGZyb20gdGhlIGRhdGEtdG9vbHRpcCBhdHRyaWJ1dGUgb2YgdGhlIHNoYXBlIG9iamVjdFxyXG4gICAgICAgIGxldCB0ZXh0ID0gZmxhcmUudG9vbHRpcFRleHQ7XHJcbiAgICAgICAgaWYgKCF0ZXh0KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibm8gdG9vbHRpcCB0ZXh0IGZvciBmbGFyZS5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vc3BsaXQgb24gXFxuIGNoYXJhY3RlciB0aGF0IHNob3VsZCBiZSBpbiB0b29sdGlwIHRvIHNpZ25pZnkgbXVsdGlwbGUgbGluZXNcclxuICAgICAgICBsZXQgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpO1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSBhIGdyb3VwIHRvIGhvbGQgdGhlIHRvb2x0aXAgZWxlbWVudHNcclxuICAgICAgICBsZXQgdG9vbHRpcEdyb3VwID0gZmxhcmVHcm91cC5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICAvL2dldCB0aGUgZmxhcmUgc3ltYm9sLCB3ZSdsbCB1c2UgdGhpcyB0byBzdHlsZSB0aGUgdG9vbHRpcCBib3hcclxuICAgICAgICBsZXQgZmxhcmVTeW1ib2wgPSB0aGlzLl9nZXRGbGFyZVN5bWJvbChmbGFyZS5ncmFwaGljKTtcclxuXHJcbiAgICAgICAgLy9hbGlnbiBvbiB0b3AgZm9yIG5vcm1hbCBmbGFyZSwgYWxpZ24gb24gYm90dG9tIGZvciBzdW1tYXJ5IGZsYXJlcy5cclxuICAgICAgICBsZXQgaGVpZ2h0ID0gZmxhcmVTeW1ib2wuc2l6ZTtcclxuXHJcbiAgICAgICAgbGV0IHhQb3MgPSAxO1xyXG4gICAgICAgIGxldCB5UG9zID0gIWZsYXJlLmlzU3VtbWFyeSA/ICgoaGVpZ2h0KSAqIC0xKSA6IGhlaWdodCArIDU7XHJcblxyXG4gICAgICAgIHRvb2x0aXBHcm91cC5yYXdOb2RlLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwidG9vbHRpcC10ZXh0XCIpO1xyXG4gICAgICAgIGxldCB0ZXh0U2hhcGVzID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgdGV4dFNoYXBlID0gdG9vbHRpcEdyb3VwLmNyZWF0ZVRleHQoeyB4OiB4UG9zLCB5OiB5UG9zICsgKGkgKiAxMCksIHRleHQ6IGxpbmVzW2ldLCBhbGlnbjogJ21pZGRsZScgfSlcclxuICAgICAgICAgICAgICAgIC5zZXRGaWxsKHRoaXMuZmxhcmVUZXh0U3ltYm9sLmNvbG9yKVxyXG4gICAgICAgICAgICAgICAgLnNldEZvbnQoeyBzaXplOiAxMCwgZmFtaWx5OiB0aGlzLmZsYXJlVGV4dFN5bWJvbC5mb250LmdldChcImZhbWlseVwiKSwgd2VpZ2h0OiB0aGlzLmZsYXJlVGV4dFN5bWJvbC5mb250LmdldChcIndlaWdodFwiKSB9KTtcclxuXHJcbiAgICAgICAgICAgIHRleHRTaGFwZXMucHVzaCh0ZXh0U2hhcGUpO1xyXG4gICAgICAgICAgICB0ZXh0U2hhcGUucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcmVjdFBhZGRpbmcgPSAyO1xyXG4gICAgICAgIGxldCB0ZXh0Qm94ID0gdG9vbHRpcEdyb3VwLmdldEJvdW5kaW5nQm94KCk7XHJcblxyXG4gICAgICAgIGxldCByZWN0U2hhcGUgPSB0b29sdGlwR3JvdXAuY3JlYXRlUmVjdCh7IHg6IHRleHRCb3gueCAtIHJlY3RQYWRkaW5nLCB5OiB0ZXh0Qm94LnkgLSByZWN0UGFkZGluZywgd2lkdGg6IHRleHRCb3gud2lkdGggKyAocmVjdFBhZGRpbmcgKiAyKSwgaGVpZ2h0OiB0ZXh0Qm94LmhlaWdodCArIChyZWN0UGFkZGluZyAqIDIpLCByOiAwIH0pXHJcbiAgICAgICAgICAgIC5zZXRGaWxsKGZsYXJlU3ltYm9sLmNvbG9yKTtcclxuXHJcbiAgICAgICAgaWYgKGZsYXJlU3ltYm9sLm91dGxpbmUpIHtcclxuICAgICAgICAgICAgcmVjdFNoYXBlLnNldFN0cm9rZSh7IGNvbG9yOiBmbGFyZVN5bWJvbC5vdXRsaW5lLmNvbG9yLCB3aWR0aDogMC41IH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVjdFNoYXBlLnJhd05vZGUuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG5cclxuICAgICAgICBmbGFyZUdyb3VwLm1vdmVUb0Zyb250KCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRleHRTaGFwZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgdGV4dFNoYXBlc1tpXS5tb3ZlVG9Gcm9udCgpO1xyXG4gICAgICAgIH0gICAgICAgIFxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9kZXN0cm95VG9vbHRpcCgpIHtcclxuICAgICAgICBxdWVyeShcIi50b29sdGlwLXRleHRcIiwgdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlLnJhd05vZGUpLmZvckVhY2goZG9tQ29uc3RydWN0LmRlc3Ryb3kpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gaGVscGVyIGZ1bmN0aW9uc1xyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyhncmFwaGljOiBHcmFwaGljLCBzdXJmYWNlOiBhbnkpOiBIVE1MRWxlbWVudCB7XHJcblxyXG4gICAgICAgIC8vZmFrZSBvdXQgYSBHRlhPYmplY3Qgc28gd2UgY2FuIGdlbmVyYXRlIGFuIHN2ZyBzaGFwZSB0aGF0IHRoZSBwYXNzZWQgaW4gZ3JhcGhpY3Mgc2hhcGVcclxuICAgICAgICBsZXQgZyA9IG5ldyBHRlhPYmplY3QoKTtcclxuICAgICAgICBnLmdyYXBoaWMgPSBncmFwaGljO1xyXG4gICAgICAgIGcucmVuZGVyaW5nSW5mbyA9IHsgc3ltYm9sOiBncmFwaGljLnN5bWJvbCB9O1xyXG5cclxuICAgICAgICAvL3NldCB1cCBwYXJhbWV0ZXJzIGZvciB0aGUgY2FsbCB0byByZW5kZXJcclxuICAgICAgICAvL3NldCB0aGUgdHJhbnNmb3JtIG9mIHRoZSBwcm9qZWN0b3IgdG8gMCdzIGFzIHdlJ3JlIGp1c3QgcGxhY2luZyB0aGUgZ2VuZXJhdGVkIGNsdXN0ZXIgc2hhcGUgYXQgZXhhY3RseSAwLDAuXHJcbiAgICAgICAgbGV0IHByb2plY3RvciA9IG5ldyBQcm9qZWN0b3IoKTtcclxuICAgICAgICBwcm9qZWN0b3IuX3RyYW5zZm9ybSA9IFswLCAwLCAwLCAwLCAwLCAwXTtcclxuICAgICAgICBwcm9qZWN0b3IuX3Jlc29sdXRpb24gPSAwO1xyXG5cclxuICAgICAgICBsZXQgc3RhdGUgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgc3RhdGUgPSB0aGlzLl9hY3RpdmVWaWV3LnN0YXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy9mYWtlIG91dCBhIHN0YXRlIG9iamVjdCBmb3IgM2Qgdmlld3MuXHJcbiAgICAgICAgICAgIHN0YXRlID0ge1xyXG4gICAgICAgICAgICAgICAgY2xpcHBlZEV4dGVudDogdGhpcy5fYWN0aXZlVmlldy5leHRlbnQsXHJcbiAgICAgICAgICAgICAgICByb3RhdGlvbjogMCxcclxuICAgICAgICAgICAgICAgIHNwYXRpYWxSZWZlcmVuY2U6IHRoaXMuX2FjdGl2ZVZpZXcuc3BhdGlhbFJlZmVyZW5jZSxcclxuICAgICAgICAgICAgICAgIHdvcmxkU2NyZWVuV2lkdGg6IDFcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBwYXIgPSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2U6IHN1cmZhY2UsXHJcbiAgICAgICAgICAgIHN0YXRlOiBzdGF0ZSxcclxuICAgICAgICAgICAgcHJvamVjdG9yOiBwcm9qZWN0b3JcclxuICAgICAgICB9O1xyXG4gICAgICAgIGcucmVuZGVyKHBhcik7XHJcbiAgICAgICAgcmV0dXJuIGcuX3NoYXBlLnJhd05vZGU7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2V4dGVudCgpOiBFeHRlbnQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5leHRlbnQgOiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2NhbGUoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYWN0aXZlVmlldyA/IHRoaXMuX2FjdGl2ZVZpZXcuc2NhbGUgOiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy9JRSAvIEVkZ2UgZG9uJ3QgaGF2ZSB0aGUgY2xhc3NMaXN0IHByb3BlcnR5IG9uIHN2ZyBlbGVtZW50cywgc28gd2UgY2FuJ3QgdXNlIHRoYXQgYWRkIC8gcmVtb3ZlIGNsYXNzZXMgLSBwcm9iYWJseSB3aHkgZG9qbyBkb21DbGFzcyBkb2Vzbid0IHdvcmsgZWl0aGVyLlxyXG4gICAgLy9zbyB0aGUgZm9sbG93aW5nIHR3byBmdW5jdGlvbnMgYXJlIGRvZGd5IHN0cmluZyBoYWNrcyB0byBhZGQgLyByZW1vdmUgY2xhc3Nlcy4gVXNlcyBhIHRpbWVvdXQgc28geW91IGNhbiBtYWtlIGNzcyB0cmFuc2l0aW9ucyB3b3JrIGlmIGRlc2lyZWQuXHJcbiAgICBwcml2YXRlIF9hZGRDbGFzc1RvRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCwgY2xhc3NOYW1lOiBzdHJpbmcsIHRpbWVvdXRNcz86IG51bWJlciwgY2FsbGJhY2s/OiBGdW5jdGlvbikge1xyXG5cclxuICAgICAgICBsZXQgYWRkQ2xhc3M6IEZ1bmN0aW9uID0gKF9lbGVtZW50LCBfY2xhc3NOYW1lKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjdXJyZW50Q2xhc3MgPSBfZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKTtcclxuICAgICAgICAgICAgaWYgKCFjdXJyZW50Q2xhc3MpIGN1cnJlbnRDbGFzcyA9IFwiXCI7XHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50Q2xhc3MuaW5kZXhPZihcIiBcIiArIF9jbGFzc05hbWUpICE9PSAtMSkgcmV0dXJuO1xyXG4gICAgICAgICAgICBsZXQgbmV3Q2xhc3MgPSAoY3VycmVudENsYXNzICsgXCIgXCIgKyBfY2xhc3NOYW1lKS50cmltKCk7XHJcbiAgICAgICAgICAgIF9lbGVtZW50LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIG5ld0NsYXNzKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodGltZW91dE1zKSB7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgYWRkQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIHRpbWVvdXRNcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfcmVtb3ZlQ2xhc3NGcm9tRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCwgY2xhc3NOYW1lOiBzdHJpbmcsIHRpbWVvdXRNcz86IG51bWJlciwgY2FsbGJhY2s/OiBGdW5jdGlvbikge1xyXG5cclxuICAgICAgICBsZXQgcmVtb3ZlQ2xhc3M6IEZ1bmN0aW9uID0gKF9lbGVtZW50LCBfY2xhc3NOYW1lKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjdXJyZW50Q2xhc3MgPSBfZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKTtcclxuICAgICAgICAgICAgaWYgKCFjdXJyZW50Q2xhc3MpIHJldHVybjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgPT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIF9lbGVtZW50LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIGN1cnJlbnRDbGFzcy5yZXBsYWNlKFwiIFwiICsgX2NsYXNzTmFtZSwgXCJcIikpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZW1vdmVDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9nZXRNb3VzZVBvcyhldnQpIHtcclxuICAgICAgICAvL2NvbnRhaW5lciBvbiB0aGUgdmlldyBpcyBhY3R1YWxseSBhIGh0bWwgZWxlbWVudCBhdCB0aGlzIHBvaW50LCBub3QgYSBzdHJpbmcgYXMgdGhlIHR5cGluZ3Mgc3VnZ2VzdC5cclxuICAgICAgICBsZXQgY29udGFpbmVyOiBhbnkgPSB0aGlzLl9hY3RpdmVWaWV3LmNvbnRhaW5lcjtcclxuICAgICAgICBsZXQgcmVjdCA9IGNvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB4OiBldnQueCAtIHJlY3QubGVmdCxcclxuICAgICAgICAgICAgeTogZXZ0LnkgLSByZWN0LnRvcFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0dGluZyB2aXNpYmxlIHRvIGZhbHNlIG9uIGEgZ3JhcGhpYyBkb2Vzbid0IHdvcmsgaW4gNC4yIGZvciBzb21lIHJlYXNvbi4gUmVtb3ZpbmcgdGhlIGdyYXBoaWMgdG8gaGlkZSBpdCBpbnN0ZWFkLiBJIHRoaW5rIHZpc2libGUgcHJvcGVydHkgc2hvdWxkIHByb2JhYmx5IHdvcmsgdGhvdWdoLlxyXG4gICAgICogQHBhcmFtIGdyYXBoaWNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfaGlkZUdyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYyB8IEdyYXBoaWNbXSkge1xyXG4gICAgICAgIGlmICghZ3JhcGhpYykgcmV0dXJuO1xyXG4gICAgICAgIGlmIChncmFwaGljLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTWFueSg8R3JhcGhpY1tdPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmUoPEdyYXBoaWM+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Nob3dHcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMgfCBHcmFwaGljW10pIHtcclxuICAgICAgICBpZiAoIWdyYXBoaWMpIHJldHVybjtcclxuICAgICAgICBpZiAoZ3JhcGhpYy5oYXNPd25Qcm9wZXJ0eShcImxlbmd0aFwiKSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZE1hbnkoPEdyYXBoaWNbXT5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKDxHcmFwaGljPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyNlbmRyZWdpb25cclxuXHJcbn1cclxuXHJcblxyXG4vL2ludGVyZmFjZSBBY3RpdmVWaWV3IGV4dGVuZHMgTWFwVmlldyBhbmQgU2NlbmVWaWV3IHRvIGFkZCBzb21lIHByb3BlcnRpZXMge1xyXG5pbnRlcmZhY2UgQWN0aXZlVmlldyBleHRlbmRzIE1hcFZpZXcsIFNjZW5lVmlldyB7XHJcbiAgICBjYW52YXM6IGFueTtcclxuICAgIHN0YXRlOiBhbnk7XHJcbiAgICBmY2xTdXJmYWNlOiBhbnk7XHJcbiAgICBmY2xQb2ludGVyTW92ZTogSUhhbmRsZTtcclxuICAgIGZjbFBvaW50ZXJEb3duOiBJSGFuZGxlO1xyXG5cclxuICAgIGNvbnN0cmFpbnRzOiBhbnk7XHJcbiAgICBnb1RvOiAodGFyZ2V0OiBhbnksIG9wdGlvbnM6IF9fZXNyaS5NYXBWaWV3R29Ub09wdGlvbnMpID0+IElQcm9taXNlPGFueT47XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRDbHVzdGVyIHtcclxuICAgIGV4dGVudDogYW55O1xyXG4gICAgY2x1c3RlckNvdW50OiBudW1iZXI7XHJcbiAgICBzdWJUeXBlQ291bnRzOiBhbnlbXSA9IFtdO1xyXG4gICAgc2luZ2xlczogYW55W10gPSBbXTtcclxuICAgIHBvaW50czogYW55W10gPSBbXTtcclxuICAgIHg6IG51bWJlcjtcclxuICAgIHk6IG51bWJlcjtcclxufVxyXG5cclxuXHJcbmNsYXNzIENsdXN0ZXIge1xyXG4gICAgY2x1c3RlckdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0ZXh0R3JhcGhpYzogR3JhcGhpYztcclxuICAgIGFyZWFHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgY2x1c3RlcklkOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyR3JvdXA6IGFueTtcclxuICAgIGdyaWRDbHVzdGVyOiBHcmlkQ2x1c3RlcjtcclxufVxyXG5cclxuY2xhc3MgRmxhcmUge1xyXG4gICAgZ3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRleHRHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgdG9vbHRpcFRleHQ6IHN0cmluZztcclxuICAgIGZsYXJlVGV4dDogc3RyaW5nO1xyXG4gICAgc2luZ2xlRGF0YTogYW55W107XHJcbiAgICBmbGFyZUdyb3VwOiBhbnk7XHJcbiAgICBpc1N1bW1hcnk6IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQb2ludEZpbHRlciB7XHJcbiAgICBmaWx0ZXJOYW1lOiBzdHJpbmc7XHJcbiAgICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHByb3BlcnR5VmFsdWVzOiBhbnlbXTtcclxuXHJcbiAgICAvL2RldGVybWluZXMgd2hldGhlciB0aGUgZmlsdGVyIGluY2x1ZGVzIG9yIGV4Y2x1ZGVzIHRoZSBwb2ludCBkZXBlbmRpbmcgb24gd2hldGhlciBpdCBjb250YWlucyB0aGUgcHJvcGVydHkgdmFsdWUuXHJcbiAgICAvL2ZhbHNlIG1lYW5zIHRoZSBwb2ludCB3aWxsIGJlIGV4Y2x1ZGVkIGlmIHRoZSB2YWx1ZSBkb2VzIGV4aXN0IGluIHRoZSBvYmplY3QsIHRydWUgbWVhbnMgaXQgd2lsbCBiZSBleGNsdWRlZCBpZiBpdCBkb2Vzbid0LlxyXG4gICAga2VlcE9ubHlJZlZhbHVlRXhpc3RzOiBib29sZWFuO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGZpbHRlck5hbWU6IHN0cmluZywgcHJvcGVydHlOYW1lOiBzdHJpbmcsIHZhbHVlczogYW55W10sIGtlZXBPbmx5SWZWYWx1ZUV4aXN0czogYm9vbGVhbiA9IGZhbHNlKSB7XHJcbiAgICAgICAgdGhpcy5maWx0ZXJOYW1lID0gZmlsdGVyTmFtZTtcclxuICAgICAgICB0aGlzLnByb3BlcnR5TmFtZSA9IHByb3BlcnR5TmFtZTtcclxuICAgICAgICB0aGlzLnByb3BlcnR5VmFsdWVzID0gdmFsdWVzO1xyXG4gICAgICAgIHRoaXMua2VlcE9ubHlJZlZhbHVlRXhpc3RzID0ga2VlcE9ubHlJZlZhbHVlRXhpc3RzO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxuIl19
