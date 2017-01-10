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
define(["require", "exports", "esri/layers/GraphicsLayer", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/TextSymbol", "esri/symbols/SimpleLineSymbol", "esri/Color", 'esri/core/watchUtils', "esri/geometry/support/webMercatorUtils", "esri/Graphic", "esri/geometry/Point", "esri/geometry/ScreenPoint", "esri/geometry/Multipoint", "esri/geometry/Polygon", 'esri/geometry/geometryEngine', "esri/geometry/SpatialReference", "esri/views/2d/engine/graphics/GFXObject", "esri/views/2d/engine/graphics/Projector", "esri/core/accessorSupport/decorators", 'dojo/on', 'dojox/gfx', 'dojo/dom-construct', 'dojo/query', 'dojo/dom-attr', 'dojo/dom-style'], function (require, exports, GraphicsLayer, SimpleMarkerSymbol, TextSymbol, SimpleLineSymbol, Color, watchUtils, webMercatorUtils, Graphic, Point, ScreenPoint, Multipoint, Polygon, geometryEngine, SpatialReference, GFXObject, Projector, accessorSupportDecorators, on, gfx, domConstruct, query, domAttr, domStyle) {
    "use strict";
    var baseGraphicsLayer = accessorSupportDecorators.declared(GraphicsLayer);
    var FlareClusterLayer = (function (_super) {
        __extends(FlareClusterLayer, _super);
        function FlareClusterLayer(options) {
            var _this = this;
            _super.call(this, options);
            this._viewLoadCount = 0;
            this._clusters = {};
            //set the defaults
            if (!options) {
                //missing required parameters
                console.error("Missing required parameters to flare cluster layer constructor.");
                return;
            }
            this.singlePopupTemplate = options.singlePopupTemplate;
            //set up the clustering properties
            this.clusterRatio = options.clusterRatio || 75;
            this.clusterToScale = options.clusterToScale || 2000000;
            this.clusterMinCount = options.clusterMinCount || 2;
            this.singleFlareTooltipProperty = options.singleFlareTooltipProperty || "name";
            if (options.clusterAreaDisplay) {
                this.clusterAreaDisplay = options.clusterAreaDisplay === "none" ? undefined : options.clusterAreaDisplay;
            }
            this.maxFlareCount = options.maxFlareCount || 8;
            this.maxSingleFlareCount = options.maxSingleFlareCount || 8;
            this.displayFlares = options.displayFlares === false ? false : true; //default to true
            this.displaySubTypeFlares = options.displaySubTypeFlares === true;
            this.subTypeFlareProperty = options.subTypeFlareProperty || undefined;
            this.flareBufferPixels = options.flareBufferPixels || 6;
            //data set property names
            this.xPropertyName = options.xPropertyName || "x";
            this.yPropertyName = options.yPropertyName || "y";
            this.zPropertyName = options.zPropertyName || "z";
            //set up the symbology/renderer properties
            this.clusterRenderer = options.clusterRenderer;
            this.areaRenderer = options.areaRenderer;
            this.singleRenderer = options.singleRenderer;
            this.singleSymbol = options.singleSymbol;
            this.flareRenderer = options.flareRenderer;
            //add some default symbols or use the options values.
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
                yoffset: -3
            });
            this.flareTextSymbol = options.flareTextSymbol || new TextSymbol({
                color: new Color([255, 255, 255]),
                font: {
                    size: 6,
                    family: "arial"
                },
                yoffset: -2
            });
            //initial data
            this._data = options.data || undefined;
            this.on("layerview-create", function (evt) { return _this._layerViewCreated(evt); });
            if (this._data) {
                this.draw();
            }
        }
        FlareClusterLayer.prototype._layerViewCreated = function (evt) {
            var _this = this;
            if (evt.layerView.view.type === "2d") {
                this._layerView2d = evt.layerView;
            }
            else {
                this._layerView3d = evt.layerView;
            }
            //add a stationary watch on the view to do some stuff.
            watchUtils.pausable(evt.layerView.view, "stationary", function (isStationary, b, c, view) { return _this._viewStationary(isStationary, b, c, view); });
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
                //using the built in pointermove event of a view doens't work for touch. Dojo's mousemove registers touches as well.
                //v.fclPointerMove = v.on("pointer-move", (evt) => this._viewPointerMove(evt));
                v.fclPointerMove = on(container, "mousemove", function (evt) { return _this._viewPointerMove(evt); });
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
            //This is a hack for IE. hitTest on the view doens't pick up any results unless the z-index of the layerView container is at least 1. So set it to 1, but also have to set the .esri-ui
            //container to 2 otherwise it can't be clicked on as it's covered by the layer view container. meh!
            if (this._is2d) {
                domStyle.set(this._layerView2d.container.element, "z-index", "1");
                query(".esri-ui").forEach(function (node, index) {
                    domStyle.set(node, "z-index", "2");
                });
            }
        };
        FlareClusterLayer.prototype._viewPointerMove = function (evt) {
            var _this = this;
            var mousePos = this._getMousePos(evt);
            var sp = new ScreenPoint({ x: mousePos.x, y: mousePos.y });
            //if there's an active cluster and the current screen pos is within the bounds of that cluster's group container, don't do anything more. 
            //TODO: would probably be better to check if the point is in the actual circle of the cluster group and it's flares instead of using the rectangle bounding box.
            if (this._activeCluster) {
                var bbox = this._activeCluster.clusterGroup.rawNode.getBoundingClientRect();
                if (bbox) {
                    if (mousePos.x >= bbox.left && mousePos.x <= bbox.right && mousePos.y >= bbox.top && mousePos.y <= bbox.bottom)
                        return;
                }
            }
            this._activeView.hitTest(sp).then(function (response) {
                //console.log(response);
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
            //flares have been created so add them to the dom
            var _loop_1 = function(i_2, len_1) {
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
            for (var i_2 = 0, len_1 = flares.length; i_2 < len_1; i_2++) {
                var state_1 = _loop_1(i_2, len_1);
                if (state_1 === "continue") continue;
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
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
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
            accessorSupportDecorators.subclass("FlareClusterLayer"), 
            __metadata('design:paramtypes', [Object])
        ], FlareClusterLayer);
        return FlareClusterLayer;
    }(baseGraphicsLayer));
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkZsYXJlQ2x1c3RlckxheWVyX3Y0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhDQUE4Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFnRjlDLElBQUksaUJBQWlCLEdBQWlDLHlCQUF5QixDQUFDLFFBQVEsQ0FBTSxhQUFhLENBQUMsQ0FBQztJQUk3RztRQUF1QyxxQ0FBaUI7UUFrRHBELDJCQUFZLE9BQW9DO1lBbERwRCxpQkEyakNDO1lBdmdDTyxrQkFBTSxPQUFPLENBQUMsQ0FBQztZQWZYLG1CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBTzNCLGNBQVMsR0FBc0MsRUFBRSxDQUFDO1lBVXRELGtCQUFrQjtZQUNsQixFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsNkJBQTZCO2dCQUM3QixPQUFPLENBQUMsS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7Z0JBQ2pGLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1lBRXZELGtDQUFrQztZQUNsQyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO1lBQy9DLElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUM7WUFDeEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxJQUFJLENBQUMsQ0FBQztZQUNwRCxJQUFJLENBQUMsMEJBQTBCLEdBQUcsT0FBTyxDQUFDLDBCQUEwQixJQUFJLE1BQU0sQ0FBQztZQUMvRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixLQUFLLE1BQU0sR0FBRyxTQUFTLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDO1lBQzdHLENBQUM7WUFDRCxJQUFJLENB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QVksVUFBa0IsRUFBRSxZQUFvQixFQUFFLE1BQWEsRUFBRSxxQkFBc0M7WUFBdEMscUNBQXNDLEdBQXRDLDZCQUFzQztZQUN2RyxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztZQUM3QixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztZQUNqQyxJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQztZQUM3QixJQUFJLENBQUMscUJBQXFCLEdBQUcscUJBQXFCLENBQUM7UUFDdkQsQ0FBQztRQUVMLGtCQUFDO0lBQUQsQ0FoQkEsQUFnQkMsSUFBQTtJQWhCWSxtQkFBVyxjQWdCdkIsQ0FBQSIsImZpbGUiOiJGbGFyZUNsdXN0ZXJMYXllcl92NC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxyXG5cclxuXHJcbmltcG9ydCAqIGFzIEdyYXBoaWNzTGF5ZXIgZnJvbSBcImVzcmkvbGF5ZXJzL0dyYXBoaWNzTGF5ZXJcIjtcclxuaW1wb3J0ICogYXMgQ2xhc3NCcmVha3NSZW5kZXJlciBmcm9tIFwiZXNyaS9yZW5kZXJlcnMvQ2xhc3NCcmVha3NSZW5kZXJlclwiO1xyXG5pbXBvcnQgKiBhcyBQb3B1cFRlbXBsYXRlIGZyb20gXCJlc3JpL1BvcHVwVGVtcGxhdGVcIjtcclxuaW1wb3J0ICogYXMgU2ltcGxlTWFya2VyU3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvU2ltcGxlTWFya2VyU3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIFRleHRTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9UZXh0U3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIFNpbXBsZUxpbmVTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9TaW1wbGVMaW5lU3ltYm9sXCI7XHJcbmltcG9ydCAqIGFzIENvbG9yIGZyb20gXCJlc3JpL0NvbG9yXCI7XHJcbmltcG9ydCAqIGFzIHdhdGNoVXRpbHMgZnJvbSAnZXNyaS9jb3JlL3dhdGNoVXRpbHMnO1xyXG5pbXBvcnQgKiBhcyBWaWV3IGZyb20gJ2Vzcmkvdmlld3MvVmlldyc7XHJcbmltcG9ydCAqIGFzIHdlYk1lcmNhdG9yVXRpbHMgZnJvbSBcImVzcmkvZ2VvbWV0cnkvc3VwcG9ydC93ZWJNZXJjYXRvclV0aWxzXCI7XHJcbmltcG9ydCAqIGFzIEdyYXBoaWMgZnJvbSBcImVzcmkvR3JhcGhpY1wiO1xyXG5pbXBvcnQgKiBhcyBQb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9Qb2ludFwiO1xyXG5pbXBvcnQgKiBhcyBTY3JlZW5Qb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TY3JlZW5Qb2ludFwiO1xyXG5pbXBvcnQgKiBhcyBNdWx0aXBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L011bHRpcG9pbnRcIjtcclxuaW1wb3J0ICogYXMgUG9seWdvbiBmcm9tIFwiZXNyaS9nZW9tZXRyeS9Qb2x5Z29uXCI7XHJcbmltcG9ydCAqIGFzIGdlb21ldHJ5RW5naW5lIGZyb20gJ2VzcmkvZ2VvbWV0cnkvZ2VvbWV0cnlFbmdpbmUnO1xyXG5pbXBvcnQgKiBhcyBTcGF0aWFsUmVmZXJlbmNlIGZyb20gXCJlc3JpL2dlb21ldHJ5L1NwYXRpYWxSZWZlcmVuY2VcIjtcclxuaW1wb3J0ICogYXMgRXh0ZW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L0V4dGVudFwiO1xyXG5pbXBvcnQgKiBhcyBleHRlcm5hbFJlbmRlcmVycyBmcm9tIFwiZXNyaS92aWV3cy8zZC9leHRlcm5hbFJlbmRlcmVyc1wiO1xyXG5cclxuaW1wb3J0ICogYXMgR0ZYT2JqZWN0IGZyb20gXCJlc3JpL3ZpZXdzLzJkL2VuZ2luZS9ncmFwaGljcy9HRlhPYmplY3RcIjtcclxuaW1wb3J0ICogYXMgUHJvamVjdG9yIGZyb20gXCJlc3JpL3ZpZXdzLzJkL2VuZ2luZS9ncmFwaGljcy9Qcm9qZWN0b3JcIjtcclxuIFxyXG5pbXBvcnQgKiBhcyBhY2Nlc3NvclN1cHBvcnREZWNvcmF0b3JzIGZyb20gXCJlc3JpL2NvcmUvYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnNcIjtcclxuIFxyXG5pbXBvcnQgKiBhcyBvbiBmcm9tICdkb2pvL29uJztcclxuaW1wb3J0ICogYXMgZ2Z4IGZyb20gJ2Rvam94L2dmeCc7XHJcbmltcG9ydCAqIGFzIGRvbUNvbnN0cnVjdCBmcm9tICdkb2pvL2RvbS1jb25zdHJ1Y3QnO1xyXG5pbXBvcnQgKiBhcyBxdWVyeSBmcm9tICdkb2pvL3F1ZXJ5JztcclxuaW1wb3J0ICogYXMgZG9tIGZyb20gJ2Rvam8vZG9tJztcclxuaW1wb3J0ICogYXMgZG9tQXR0ciBmcm9tICdkb2pvL2RvbS1hdHRyJztcclxuaW1wb3J0ICogYXMgZG9tU3R5bGUgZnJvbSAnZG9qby9kb20tc3R5bGUnO1xyXG5cclxuXHJcbmludGVyZmFjZSBGbGFyZUNsdXN0ZXJMYXllclByb3BlcnRpZXMgZXh0ZW5kcyBfX2VzcmkuR3JhcGhpY3NMYXllclByb3BlcnRpZXMge1xyXG5cclxuICAgIGNsdXN0ZXJSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVSZW5kZXJlcj86IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbD86IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIGFyZWFSZW5kZXJlcj86IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVQb3B1cFRlbXBsYXRlPzogUG9wdXBUZW1wbGF0ZTtcclxuICAgIHNwYXRpYWxSZWZlcmVuY2U/OiBTcGF0aWFsUmVmZXJlbmNlO1xyXG4gICAgIFxyXG4gICAgY2x1c3RlclJhdGlvPzogbnVtYmVyO1xyXG4gICAgY2x1c3RlclRvU2NhbGU/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyTWluQ291bnQ/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyQXJlYURpc3BsYXk/OiBzdHJpbmc7XHJcblxyXG4gICAgZGlzcGxheUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBtYXhGbGFyZUNvdW50PzogbnVtYmVyO1xyXG4gICAgbWF4U2luZ2xlRmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIHNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5Pzogc3RyaW5nO1xyXG4gICAgZmxhcmVTeW1ib2w/OiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBmbGFyZUJ1ZmZlclBpeGVscz86IG51bWJlcjtcclxuICAgIHRleHRTeW1ib2w/OiBUZXh0U3ltYm9sO1xyXG4gICAgZmxhcmVUZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGRpc3BsYXlTdWJUeXBlRmxhcmVzPzogYm9vbGVhbjtcclxuICAgIHN1YlR5cGVGbGFyZVByb3BlcnR5Pzogc3RyaW5nO1xyXG5cclxuICAgIHhQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgelByb3BlcnR5TmFtZT86IHN0cmluZztcclxuXHJcbiAgICBmaWx0ZXJzPzogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBkYXRhPzogYW55W107XHJcblxyXG59XHJcblxyXG5cclxuLy9UaGlzIGlzIGhvdyB5b3UgaGF2ZSB0byBleHRlbmQgY2xhc3NlcyBpbiBhcmNnaXMgYXBpIHRoYXQgYXJlIGEgc3ViY2xhc3Mgb2YgQWNjZXNzb3IuXHJcbi8vV2lsbCBsaWtlbHkgY2hhbmdlIGluIGZ1dHVyZSByZWxlYXNlcy4gU2VlIHRoZXNlIGxpbmtzIC0gaHR0cHM6Ly9naXRodWIuY29tL0VzcmkvanNhcGktcmVzb3VyY2VzL2lzc3Vlcy80MCAmIGh0dHBzOi8vZ2l0aHViLmNvbS95Y2Fib24vZXh0ZW5kLWFjY2Vzc29yLWV4YW1wbGVcclxuaW50ZXJmYWNlIEJhc2VHcmFwaGljc0xheWVyIGV4dGVuZHMgR3JhcGhpY3NMYXllciB7IH1cclxuaW50ZXJmYWNlIEJhc2VHcmFwaGljc0xheWVyQ29uc3RydWN0b3IgeyBuZXcgKG9wdGlvbnM/OiBfX2VzcmkuR3JhcGhpY3NMYXllclByb3BlcnRpZXMpOiBCYXNlR3JhcGhpY3NMYXllcjsgfVxyXG5sZXQgYmFzZUdyYXBoaWNzTGF5ZXI6IEJhc2VHcmFwaGljc0xheWVyQ29uc3RydWN0b3IgPSBhY2Nlc3NvclN1cHBvcnREZWNvcmF0b3JzLmRlY2xhcmVkKDxhbnk+R3JhcGhpY3NMYXllcik7XHJcblxyXG5cclxuQGFjY2Vzc29yU3VwcG9ydERlY29yYXRvcnMuc3ViY2xhc3MoXCJGbGFyZUNsdXN0ZXJMYXllclwiKVxyXG5leHBvcnQgY2xhc3MgRmxhcmVDbHVzdGVyTGF5ZXIgZXh0ZW5kcyBiYXNlR3JhcGhpY3NMYXllciB7XHJcblxyXG4gICAgc2luZ2xlUmVuZGVyZXI6IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbDogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgc2luZ2xlUG9wdXBUZW1wbGF0ZTogUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICBjbHVzdGVyUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBhcmVhUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNwYXRpYWxSZWZlcmVuY2U6IFNwYXRpYWxSZWZlcmVuY2U7XHJcblxyXG4gICAgY2x1c3RlclJhdGlvOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyVG9TY2FsZTogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyQXJlYURpc3BsYXk6IHN0cmluZztcclxuXHJcbiAgICBkaXNwbGF5RmxhcmVzOiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudDogbnVtYmVyO1xyXG4gICAgbWF4U2luZ2xlRmxhcmVDb3VudDogbnVtYmVyO1xyXG4gICAgc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHk6IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sOiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBmbGFyZUJ1ZmZlclBpeGVsczogbnVtYmVyO1xyXG4gICAgdGV4dFN5bWJvbDogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbDogVGV4dFN5bWJvbDtcclxuICAgIGRpc3BsYXlTdWJUeXBlRmxhcmVzOiBib29sZWFuO1xyXG4gICAgc3ViVHlwZUZsYXJlUHJvcGVydHk6IHN0cmluZztcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB6UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcblxyXG4gICAgZmlsdGVyczogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBwcml2YXRlIF9ncmlkQ2x1c3RlcnM6IEdyaWRDbHVzdGVyW107XHJcbiAgICBwcml2YXRlIF9pc0NsdXN0ZXJlZDogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX2FjdGl2ZVZpZXc6IEFjdGl2ZVZpZXc7XHJcbiAgICBwcml2YXRlIF92aWV3TG9hZENvdW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIHByaXZhdGUgX3JlYWR5VG9EcmF3OiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkSW5pdGlhbERyYXc6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9kYXRhOiBhbnlbXTtcclxuICAgIHByaXZhdGUgX2lzMmQ6IGJvb2xlYW47XHJcbiAgICAgXHJcbiAgICBwcml2YXRlIF9jbHVzdGVyczogeyBbY2x1c3RlcklkOiBudW1iZXJdOiBDbHVzdGVyOyB9ID0ge307XHJcbiAgICBwcml2YXRlIF9hY3RpdmVDbHVzdGVyOiBDbHVzdGVyO1xyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlldzJkOiBhbnk7XHJcbiAgICBwcml2YXRlIF9sYXllclZpZXczZDogYW55O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEZsYXJlQ2x1c3RlckxheWVyUHJvcGVydGllcykge1xyXG5cclxuICAgICAgICBzdXBlcihvcHRpb25zKTtcclxuXHJcbiAgICAgICAgLy9zZXQgdGhlIGRlZmF1bHRzXHJcbiAgICAgICAgaWYgKCFvcHRpb25zKSB7XHJcbiAgICAgICAgICAgIC8vbWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzXHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJNaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnMgdG8gZmxhcmUgY2x1c3RlciBsYXllciBjb25zdHJ1Y3Rvci5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuc2luZ2xlUG9wdXBUZW1wbGF0ZSA9IG9wdGlvbnMuc2luZ2xlUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgdGhlIGNsdXN0ZXJpbmcgcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclJhdGlvID0gb3B0aW9ucy5jbHVzdGVyUmF0aW8gfHwgNzU7XHJcbiAgICAgICAgdGhpcy5jbHVzdGVyVG9TY2FsZSA9IG9wdGlvbnMuY2x1c3RlclRvU2NhbGUgfHwgMjAwMDAwMDtcclxuICAgICAgICB0aGlzLmNsdXN0ZXJNaW5Db3VudCA9IG9wdGlvbnMuY2x1c3Rlck1pbkNvdW50IHx8IDI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eSA9IG9wdGlvbnMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHkgfHwgXCJuYW1lXCI7XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID0gb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwibm9uZVwiID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubWF4RmxhcmVDb3VudCA9IG9wdGlvbnMubWF4RmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCA9IG9wdGlvbnMubWF4U2luZ2xlRmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMuZGlzcGxheUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheUZsYXJlcyA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vZGVmYXVsdCB0byB0cnVlXHJcbiAgICAgICAgdGhpcy5kaXNwbGF5U3ViVHlwZUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheVN1YlR5cGVGbGFyZXMgPT09IHRydWU7XHJcbiAgICAgICAgdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eSA9IG9wdGlvbnMuc3ViVHlwZUZsYXJlUHJvcGVydHkgfHwgdW5kZWZpbmVkO1xyXG4gICAgICAgIHRoaXMuZmxhcmVCdWZmZXJQaXhlbHMgPSBvcHRpb25zLmZsYXJlQnVmZmVyUGl4ZWxzIHx8IDY7XHJcblxyXG4gICAgICAgIC8vZGF0YSBzZXQgcHJvcGVydHkgbmFtZXNcclxuICAgICAgICB0aGlzLnhQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnhQcm9wZXJ0eU5hbWUgfHwgXCJ4XCI7XHJcbiAgICAgICAgdGhpcy55UHJvcGVydHlOYW1lID0gb3B0aW9ucy55UHJvcGVydHlOYW1lIHx8IFwieVwiO1xyXG4gICAgICAgIHRoaXMuelByb3BlcnR5TmFtZSA9IG9wdGlvbnMuelByb3BlcnR5TmFtZSB8fCBcInpcIjtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgdGhlIHN5bWJvbG9neS9yZW5kZXJlciBwcm9wZXJ0aWVzXHJcbiAgICAgICAgdGhpcy5jbHVzdGVyUmVuZGVyZXIgPSBvcHRpb25zLmNsdXN0ZXJSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLmFyZWFSZW5kZXJlciA9IG9wdGlvbnMuYXJlYVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlUmVuZGVyZXIgPSBvcHRpb25zLnNpbmdsZVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlU3ltYm9sID0gb3B0aW9ucy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgdGhpcy5mbGFyZVJlbmRlcmVyID0gb3B0aW9ucy5mbGFyZVJlbmRlcmVyO1xyXG5cclxuICAgICAgICAvL2FkZCBzb21lIGRlZmF1bHQgc3ltYm9scyBvciB1c2UgdGhlIG9wdGlvbnMgdmFsdWVzLlxyXG4gICAgICAgIHRoaXMuZmxhcmVTeW1ib2wgPSBvcHRpb25zLmZsYXJlU3ltYm9sIHx8IG5ldyBTaW1wbGVNYXJrZXJTeW1ib2woe1xyXG4gICAgICAgICAgICBzaXplOiAxNCxcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMCwgMCwgMCwgMC41XSksXHJcbiAgICAgICAgICAgIG91dGxpbmU6IG5ldyBTaW1wbGVMaW5lU3ltYm9sKHsgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NSwgMC41XSksIHdpZHRoOiAxIH0pXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgIFxyXG4gICAgICAgIHRoaXMudGV4dFN5bWJvbCA9IG9wdGlvbnMudGV4dFN5bWJvbCB8fCBuZXcgVGV4dFN5bWJvbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTVdKSxcclxuICAgICAgICAgICAgZm9udDoge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogMTAsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtM1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmZsYXJlVGV4dFN5bWJvbCA9IG9wdGlvbnMuZmxhcmVUZXh0U3ltYm9sIHx8IG5ldyBUZXh0U3ltYm9sKHtcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NV0pLFxyXG4gICAgICAgICAgICBmb250OiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiA2LFxyXG4gICAgICAgICAgICAgICAgZmFtaWx5OiBcImFyaWFsXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeW9mZnNldDogLTJcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy9pbml0aWFsIGRhdGFcclxuICAgICAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgdGhpcy5vbihcImxheWVydmlldy1jcmVhdGVcIiwgKGV2dCkgPT4gdGhpcy5fbGF5ZXJWaWV3Q3JlYXRlZChldnQpKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXdDcmVhdGVkKGV2dCkge1xyXG5cclxuICAgICAgICBpZiAoZXZ0LmxheWVyVmlldy52aWV3LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXcyZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXczZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2FkZCBhIHN0YXRpb25hcnkgd2F0Y2ggb24gdGhlIHZpZXcgdG8gZG8gc29tZSBzdHVmZi5cclxuICAgICAgICB3YXRjaFV0aWxzLnBhdXNhYmxlKGV2dC5sYXllclZpZXcudmlldywgXCJzdGF0aW9uYXJ5XCIsIChpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpID0+IHRoaXMuX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fdmlld0xvYWRDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gZXZ0LmxheWVyVmlldy52aWV3O1xyXG5cclxuICAgICAgICAgICAgdGhpcy5fcmVhZHlUb0RyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkSW5pdGlhbERyYXcpIHtcclxuICAgICAgICAgICAgICAgIC8vd2UndmUgYmVlbiB3YWl0aW5nIGZvciB0aGlzIHRvIGhhcHBlbiB0byBkcmF3XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdmlld0xvYWRDb3VudCsrO1xyXG5cclxuXHJcbiAgICAgICAgaWYgKGV2dC5sYXllclZpZXcudmlldy50eXBlID09PSBcIjJkXCIpIHtcclxuICAgICAgICAgICAgLy9mb3IgbWFwIHZpZXdzLCB3YWl0IGZvciB0aGUgbGF5ZXJ2aWV3IG90IGJlIGF0dGFjaGVkLCBiZWZvcmUgYWRkaW5nIGV2ZW50c1xyXG4gICAgICAgICAgICB3YXRjaFV0aWxzLndoZW5UcnVlT25jZShldnQubGF5ZXJWaWV3LCBcImF0dGFjaGVkXCIsICgpID0+IHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy9mb3Igc2NlbmUgdmlld3MganVzdCBhZGQgdGhlIGV2ZW50cyBzdHJhaWdodCBhd2F5XHJcbiAgICAgICAgICAgIHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9hZGRWaWV3RXZlbnRzKGxheWVyVmlldzogYW55KSB7XHJcbiAgICAgICAgbGV0IHY6IEFjdGl2ZVZpZXcgPSBsYXllclZpZXcudmlldztcclxuICAgICAgICBpZiAoIXYuZmNsUG9pbnRlck1vdmUpIHsgXHJcblxyXG4gICAgICAgICAgICBsZXQgY29udGFpbmVyOiBIVE1MRWxlbWVudCA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYgKHYudHlwZSA9PT0gXCIyZFwiKSB7XHJcbiAgICAgICAgICAgICAgICAvL2ZvciBhIG1hcCB2aWV3IGdldCB0aGUgY29udGFpbmVyIGVsZW1lbnQgb2YgdGhlIGxheWVyIHZpZXcgdG8gYWRkIG1vdXNlbW92ZSBldmVudCB0by5cclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lciA9IGxheWVyVmlldy5jb250YWluZXIuZWxlbWVudDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vZm9yIHNjZW5lIHZpZXcgZ2V0IHRoZSBjYW52YXMgZWxlbWVudCB1bmRlciB0aGUgdmlldyBjb250YWluZXIgdG8gYWRkIG1vdXNlbW92ZSB0by5cclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lciA9IDxIVE1MRWxlbWVudD5xdWVyeShcImNhbnZhc1wiLCB2LmNvbnRhaW5lcilbMF07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vdXNpbmcgdGhlIGJ1aWx0IGluIHBvaW50ZXJtb3ZlIGV2ZW50IG9mIGEgdmlldyBkb2Vucyd0IHdvcmsgZm9yIHRvdWNoLiBEb2pvJ3MgbW91c2Vtb3ZlIHJlZ2lzdGVycyB0b3VjaGVzIGFzIHdlbGwuXHJcbiAgICAgICAgICAgIC8vdi5mY2xQb2ludGVyTW92ZSA9IHYub24oXCJwb2ludGVyLW1vdmVcIiwgKGV2dCkgPT4gdGhpcy5fdmlld1BvaW50ZXJNb3ZlKGV2dCkpO1xyXG4gICAgICAgICAgICB2LmZjbFBvaW50ZXJNb3ZlID0gb24oY29udGFpbmVyLCBcIm1vdXNlbW92ZVwiLCAoZXZ0KSA9PiB0aGlzLl92aWV3UG9pbnRlck1vdmUoZXZ0KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgIFxyXG5cclxuICAgIHByaXZhdGUgX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpc1N0YXRpb25hcnkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIWlzU3RhdGlvbmFyeSAmJiB0aGlzLl9hY3RpdmVDbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIC8vaWYgbW92aW5nIGRlYWN0aXZhdGUgY2x1c3RlcjtcclxuICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGNsZWFyKCkge1xyXG4gICAgICAgIHRoaXMucmVtb3ZlQWxsKCk7XHJcbiAgICAgICAgdGhpcy5fY2x1c3RlcnMgPSB7fTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgc2V0RGF0YShkYXRhOiBhbnlbXSwgZHJhd0RhdGE6IGJvb2xlYW4gPSB0cnVlKSB7XHJcbiAgICAgICAgdGhpcy5fZGF0YSA9IGRhdGE7XHJcbiAgICAgICAgaWYgKGRyYXdEYXRhKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBkcmF3KGFjdGl2ZVZpZXc/OiBhbnkpIHtcclxuXHJcbiAgICAgICAgaWYgKGFjdGl2ZVZpZXcpIHtcclxuICAgICAgICAgICAgdGhpcy5fYWN0aXZlVmlldyA9IGFjdGl2ZVZpZXc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL05vdCByZWFkeSB0byBkcmF3IHlldCBzbyBxdWV1ZSBvbmUgdXBcclxuICAgICAgICBpZiAoIXRoaXMuX3JlYWR5VG9EcmF3KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3ID0gdHJ1ZTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVWaWV3IHx8ICF0aGlzLl9kYXRhKSByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMuX2lzMmQgPSB0aGlzLl9hY3RpdmVWaWV3LnR5cGUgPT09IFwiMmRcIjtcclxuXHJcbiAgICAgICAgLy9jaGVjayB0byBtYWtlIHN1cmUgd2UgaGF2ZSBhbiBhcmVhIHJlbmRlcmVyIHNldCBpZiBvbmUgbmVlZHMgdG8gYmVcclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgJiYgIXRoaXMuYXJlYVJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGbGFyZUNsdXN0ZXJMYXllcjogYXJlYVJlbmRlcmVyIG11c3QgYmUgc2V0IGlmIGNsdXN0ZXJBcmVhRGlzcGxheSBpcyBzZXQuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgY29uc29sZS50aW1lKFwiZHJhdy1kYXRhLVwiICsgdGhpcy5fYWN0aXZlVmlldy50eXBlKTtcclxuXHJcbiAgICAgICAgdGhpcy5faXNDbHVzdGVyZWQgPSB0aGlzLmNsdXN0ZXJUb1NjYWxlIDwgdGhpcy5fc2NhbGUoKTtcclxuXHJcbiAgICAgICAgbGV0IGdyYXBoaWNzOiBHcmFwaGljW10gPSBbXTtcclxuXHJcbiAgICAgICAgLy9nZXQgYW4gZXh0ZW50IHRoYXQgaXMgaW4gd2ViIG1lcmNhdG9yIHRvIG1ha2Ugc3VyZSBpdCdzIGZsYXQgZm9yIGV4dGVudCBjaGVja2luZ1xyXG4gICAgICAgIC8vVGhlIHdlYmV4dGVudCB3aWxsIG5lZWQgdG8gYmUgbm9ybWFsaXplZCBzaW5jZSBwYW5uaW5nIG92ZXIgdGhlIGludGVybmF0aW9uYWwgZGF0ZWxpbmUgd2lsbCBjYXVzZVxyXG4gICAgICAgIC8vY2F1c2UgdGhlIGV4dGVudCB0byBzaGlmdCBvdXRzaWRlIHRoZSAtMTgwIHRvIDE4MCBkZWdyZWUgd2luZG93LiAgSWYgd2UgZG9uJ3Qgbm9ybWFsaXplIHRoZW4gdGhlXHJcbiAgICAgICAgLy9jbHVzdGVycyB3aWxsIG5vdCBiZSBkcmF3biBpZiB0aGUgbWFwIHBhbnMgb3ZlciB0aGUgaW50ZXJuYXRpb25hbCBkYXRlbGluZS5cclxuICAgICAgICBsZXQgd2ViRXh0ZW50OiBhbnkgPSAhdGhpcy5fZXh0ZW50KCkuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yID8gPEV4dGVudD53ZWJNZXJjYXRvclV0aWxzLnByb2plY3QodGhpcy5fZXh0ZW50KCksIG5ldyBTcGF0aWFsUmVmZXJlbmNlKHsgXCJ3a2lkXCI6IDEwMjEwMCB9KSkgOiB0aGlzLl9leHRlbnQoKTtcclxuICAgICAgICBsZXQgZXh0ZW50SXNVbmlvbmVkID0gZmFsc2U7XHJcblxyXG4gICAgICAgIGxldCBub3JtYWxpemVkV2ViRXh0ZW50ID0gd2ViRXh0ZW50Lm5vcm1hbGl6ZSgpO1xyXG4gICAgICAgIHdlYkV4dGVudCA9IG5vcm1hbGl6ZWRXZWJFeHRlbnRbMF07XHJcbiAgICAgICAgaWYgKG5vcm1hbGl6ZWRXZWJFeHRlbnQubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICB3ZWJFeHRlbnQgPSB3ZWJFeHRlbnQudW5pb24obm9ybWFsaXplZFdlYkV4dGVudFsxXSk7XHJcbiAgICAgICAgICAgIGV4dGVudElzVW5pb25lZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlQ2x1c3RlckdyaWQod2ViRXh0ZW50LCBleHRlbnRJc1VuaW9uZWQpO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIGxldCB3ZWI6IG51bWJlcltdLCBvYmo6IGFueSwgZGF0YUxlbmd0aCA9IHRoaXMuX2RhdGEubGVuZ3RoLCB4VmFsOiBudW1iZXIsIHlWYWw6IG51bWJlcjtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGFMZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBvYmogPSB0aGlzLl9kYXRhW2ldO1xyXG5cclxuICAgICAgICAgICAgLy9jaGVjayBpZiBmaWx0ZXJzIGFyZSBzcGVjaWZpZWQgYW5kIGNvbnRpbnVlIGlmIHRoaXMgb2JqZWN0IGRvZXNuJ3QgcGFzc1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3Bhc3Nlc0ZpbHRlcihvYmopKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgeFZhbCA9IG9ialt0aGlzLnhQcm9wZXJ0eU5hbWVdO1xyXG4gICAgICAgICAgICB5VmFsID0gb2JqW3RoaXMueVByb3BlcnR5TmFtZV07XHJcblxyXG4gICAgICAgICAgICAvL2dldCBhIHdlYiBtZXJjIGxuZy9sYXQgZm9yIGV4dGVudCBjaGVja2luZy4gVXNlIHdlYiBtZXJjIGFzIGl0J3MgZmxhdCB0byBjYXRlciBmb3IgbG9uZ2l0dWRlIHBvbGVcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgICAgICB3ZWIgPSBbeFZhbCwgeVZhbF07XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB3ZWIgPSB3ZWJNZXJjYXRvclV0aWxzLmxuZ0xhdFRvWFkoeFZhbCwgeVZhbCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vY2hlY2sgaWYgdGhlIG9iaiBpcyB2aXNpYmxlIGluIHRoZSBleHRlbnQgYmVmb3JlIHByb2NlZWRpbmdcclxuICAgICAgICAgICAgaWYgKCh3ZWJbMF0gPD0gd2ViRXh0ZW50LnhtaW4gfHwgd2ViWzBdID4gd2ViRXh0ZW50LnhtYXgpIHx8ICh3ZWJbMV0gPD0gd2ViRXh0ZW50LnltaW4gfHwgd2ViWzFdID4gd2ViRXh0ZW50LnltYXgpKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgLy9sb29wIGNsdXN0ZXIgZ3JpZCB0byBzZWUgaWYgaXQgc2hvdWxkIGJlIGFkZGVkIHRvIG9uZVxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDAsIGpMZW4gPSB0aGlzLl9ncmlkQ2x1c3RlcnMubGVuZ3RoOyBqIDwgakxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsID0gdGhpcy5fZ3JpZENsdXN0ZXJzW2pdO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAod2ViWzBdIDw9IGNsLmV4dGVudC54bWluIHx8IHdlYlswXSA+IGNsLmV4dGVudC54bWF4IHx8IHdlYlsxXSA8PSBjbC5leHRlbnQueW1pbiB8fCB3ZWJbMV0gPiBjbC5leHRlbnQueW1heCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTsgLy9ub3QgaGVyZSBzbyBjYXJyeSBvblxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9yZWNhbGMgdGhlIHggYW5kIHkgb2YgdGhlIGNsdXN0ZXIgYnkgYXZlcmFnaW5nIHRoZSBwb2ludHMgYWdhaW5cclxuICAgICAgICAgICAgICAgICAgICBjbC54ID0gY2wuY2x1c3RlckNvdW50ID4gMCA/ICh4VmFsICsgKGNsLnggKiBjbC5jbHVzdGVyQ291bnQpKSAvIChjbC5jbHVzdGVyQ291bnQgKyAxKSA6IHhWYWw7XHJcbiAgICAgICAgICAgICAgICAgICAgY2wueSA9IGNsLmNsdXN0ZXJDb3VudCA+IDAgPyAoeVZhbCArIChjbC55ICogY2wuY2x1c3RlckNvdW50KSkgLyAoY2wuY2x1c3RlckNvdW50ICsgMSkgOiB5VmFsO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvL3B1c2ggZXZlcnkgcG9pbnQgaW50byB0aGUgY2x1c3RlciBzbyB3ZSBoYXZlIGl0IGZvciBhcmVhIGRpc3BsYXkgaWYgcmVxdWlyZWQuIFRoaXMgY291bGQgYmUgb21pdHRlZCBpZiBuZXZlciBjaGVja2luZyBhcmVhcywgb3Igb24gZGVtYW5kIGF0IGxlYXN0XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnBvaW50cy5wdXNoKFt4VmFsLCB5VmFsXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBjbC5jbHVzdGVyQ291bnQrKztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN1YlR5cGVFeGlzdHMgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBzID0gMCwgc0xlbiA9IGNsLnN1YlR5cGVDb3VudHMubGVuZ3RoOyBzIDwgc0xlbjsgcysrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjbC5zdWJUeXBlQ291bnRzW3NdLm5hbWUgPT09IG9ialt0aGlzLnN1YlR5cGVGbGFyZVByb3BlcnR5XSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2wuc3ViVHlwZUNvdW50c1tzXS5jb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViVHlwZUV4aXN0cyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzdWJUeXBlRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnN1YlR5cGVDb3VudHMucHVzaCh7IG5hbWU6IG9ialt0aGlzLnN1YlR5cGVGbGFyZVByb3BlcnR5XSwgY291bnQ6IDEgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvL2FkZCB0aGUgc2luZ2xlIGZpeCByZWNvcmQgaWYgc3RpbGwgdW5kZXIgdGhlIG1heFNpbmdsZUZsYXJlQ291bnRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY2wuY2x1c3RlckNvdW50IDw9IHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zaW5nbGVzLnB1c2gob2JqKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnNpbmdsZXMgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy9ub3QgY2x1c3RlcmVkIHNvIGp1c3QgYWRkIGV2ZXJ5IG9ialxyXG4gICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlU2luZ2xlKG9iaik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLmNsdXN0ZXJDb3VudCA8IHRoaXMuY2x1c3Rlck1pbkNvdW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDAsIGpsZW4gPSB0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uc2luZ2xlcy5sZW5ndGg7IGogPCBqbGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlU2luZ2xlKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5zaW5nbGVzW2pdKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uY2x1c3RlckNvdW50ID4gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNsdXN0ZXIodGhpcy5fZ3JpZENsdXN0ZXJzW2ldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9lbWl0IGFuIGV2ZW50IHRvIHNpZ25hbCBkcmF3aW5nIGlzIGNvbXBsZXRlLlxyXG4gICAgICAgIHRoaXMuZW1pdChcImRyYXctY29tcGxldGVcIiwge30pO1xyXG4gICAgICAgIGNvbnNvbGUudGltZUVuZChgZHJhdy1kYXRhLSR7dGhpcy5fYWN0aXZlVmlldy50eXBlfWApO1xyXG5cclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU3VyZmFjZSgpO1xyXG4gICAgICAgIH0sIDEwKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9wYXNzZXNGaWx0ZXIob2JqOiBhbnkpOiBib29sZWFuIHtcclxuICAgICAgICBpZiAoIXRoaXMuZmlsdGVycyB8fCB0aGlzLmZpbHRlcnMubGVuZ3RoID09PSAwKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgICBsZXQgcGFzc2VzID0gdHJ1ZTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5maWx0ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBmaWx0ZXIgPSB0aGlzLmZpbHRlcnNbaV07XHJcbiAgICAgICAgICAgIGlmIChvYmpbZmlsdGVyLnByb3BlcnR5TmFtZV0gPT0gbnVsbCkgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBsZXQgdmFsRXhpc3RzID0gZmlsdGVyLnByb3BlcnR5VmFsdWVzLmluZGV4T2Yob2JqW2ZpbHRlci5wcm9wZXJ0eU5hbWVdKSAhPT0gLTE7XHJcbiAgICAgICAgICAgIGlmICh2YWxFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIHBhc3NlcyA9IGZpbHRlci5rZWVwT25seUlmVmFsdWVFeGlzdHM7IC8vdGhlIHZhbHVlIGV4aXN0cyBzbyByZXR1cm4gd2hldGhlciB3ZSBzaG91bGQgYmUga2VlcGluZyBpdCBvciBub3QuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoIXZhbEV4aXN0cyAmJiBmaWx0ZXIua2VlcE9ubHlJZlZhbHVlRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBwYXNzZXMgPSBmYWxzZTsgLy9yZXR1cm4gZmFsc2UgYXMgdGhlIHZhbHVlIGRvZXNuJ3QgZXhpc3QsIGFuZCB3ZSBzaG91bGQgb25seSBiZSBrZWVwaW5nIHBvaW50IG9iamVjdHMgd2hlcmUgaXQgZG9lcyBleGlzdC5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFwYXNzZXMpIHJldHVybiBmYWxzZTsgLy9pZiBpdCBoYXNuJ3QgcGFzc2VkIGFueSBvZiB0aGUgZmlsdGVycyByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcGFzc2VzO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZVNpbmdsZShvYmopIHtcclxuICAgICAgICBsZXQgcG9pbnQgPSBuZXcgUG9pbnQoe1xyXG4gICAgICAgICAgICB4OiBvYmpbdGhpcy54UHJvcGVydHlOYW1lXSwgeTogb2JqW3RoaXMueVByb3BlcnR5TmFtZV0sIHo6IG9ialt0aGlzLnpQcm9wZXJ0eU5hbWVdXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICghcG9pbnQuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgIHBvaW50ID0gPFBvaW50PndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IocG9pbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludCxcclxuICAgICAgICAgICAgYXR0cmlidXRlczogb2JqXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGdyYXBoaWMucG9wdXBUZW1wbGF0ZSA9IHRoaXMuc2luZ2xlUG9wdXBUZW1wbGF0ZTtcclxuICAgICAgICBpZiAodGhpcy5zaW5nbGVSZW5kZXJlcikge1xyXG4gICAgICAgICAgICBsZXQgc3ltYm9sID0gdGhpcy5zaW5nbGVSZW5kZXJlci5nZXRTeW1ib2woZ3JhcGhpYywgdGhpcy5fYWN0aXZlVmlldyk7XHJcbiAgICAgICAgICAgIGdyYXBoaWMuc3ltYm9sID0gc3ltYm9sO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0aGlzLnNpbmdsZVN5bWJvbCkge1xyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHRoaXMuc2luZ2xlU3ltYm9sO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy9ubyBzeW1ib2xvZ3kgZm9yIHNpbmdsZXMgZGVmaW5lZCwgdXNlIHRoZSBkZWZhdWx0IHN5bWJvbCBmcm9tIHRoZSBjbHVzdGVyIHJlbmRlcmVyXHJcbiAgICAgICAgICAgIGdyYXBoaWMuc3ltYm9sID0gdGhpcy5jbHVzdGVyUmVuZGVyZXIuZGVmYXVsdFN5bWJvbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuYWRkKGdyYXBoaWMpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDbHVzdGVyKGdyaWRDbHVzdGVyOiBHcmlkQ2x1c3Rlcikge1xyXG5cclxuICAgICAgICBsZXQgY2x1c3RlciA9IG5ldyBDbHVzdGVyKCk7XHJcbiAgICAgICAgY2x1c3Rlci5ncmlkQ2x1c3RlciA9IGdyaWRDbHVzdGVyO1xyXG5cclxuICAgICAgICAvL21ha2Ugc3VyZSBhbGwgZ2VvbWV0cmllcyBhZGRlZCB0byBHcmFwaGljIG9iamVjdHMgYXJlIGluIHdlYiBtZXJjYXRvciBvdGhlcndpc2Ugd3JhcCBhcm91bmQgZG9lc24ndCB3b3JrLlxyXG4gICAgICAgIGxldCBwb2ludCA9IG5ldyBQb2ludCh7IHg6IGdyaWRDbHVzdGVyLngsIHk6IGdyaWRDbHVzdGVyLnkgfSk7XHJcbiAgICAgICAgaWYgKCFwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgYXR0cmlidXRlczogYW55ID0ge1xyXG4gICAgICAgICAgICB4OiBncmlkQ2x1c3Rlci54LFxyXG4gICAgICAgICAgICB5OiBncmlkQ2x1c3Rlci55LFxyXG4gICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudCxcclxuICAgICAgICAgICAgaXNDbHVzdGVyOiB0cnVlLFxyXG4gICAgICAgICAgICBjbHVzdGVyT2JqZWN0OiBncmlkQ2x1c3RlclxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgYXR0cmlidXRlczogYXR0cmlidXRlcyxcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHBvaW50XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2wgPSB0aGlzLmNsdXN0ZXJSZW5kZXJlci5nZXRDbGFzc0JyZWFrSW5mbyhjbHVzdGVyLmNsdXN0ZXJHcmFwaGljKS5zeW1ib2w7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlcklkID0gY2x1c3Rlci5jbHVzdGVyR3JhcGhpY1tcInVpZFwiXTtcclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmF0dHJpYnV0ZXMuY2x1c3RlcklkID0gY2x1c3Rlci5jbHVzdGVySWQ7XHJcblxyXG4gICAgICAgIC8vYWxzbyBjcmVhdGUgYSB0ZXh0IHN5bWJvbCB0byBkaXNwbGF5IHRoZSBjbHVzdGVyIGNvdW50XHJcbiAgICAgICAgbGV0IHRleHRTeW1ib2wgPSB0aGlzLnRleHRTeW1ib2wuY2xvbmUoKTtcclxuICAgICAgICB0ZXh0U3ltYm9sLnRleHQgPSBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQudG9TdHJpbmcoKTtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgIHRleHRTeW1ib2wuYW5nbGUgPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2x1c3Rlci50ZXh0R3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHBvaW50LFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgICAgICAgICBpc0NsdXN0ZXJUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaXNUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlcklkOiBjbHVzdGVyLmNsdXN0ZXJJZFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzeW1ib2w6IHRleHRTeW1ib2xcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy9hZGQgYW4gYXJlYSBncmFwaGljIHRvIGRpc3BsYXkgdGhlIGJvdW5kcyBvZiB0aGUgY2x1c3RlciBpZiBjb25maWd1cmVkIHRvXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ICYmIGdyaWRDbHVzdGVyLnBvaW50cyAmJiBncmlkQ2x1c3Rlci5wb2ludHMubGVuZ3RoID4gMCkge1xyXG5cclxuICAgICAgICAgICAgbGV0IG1wID0gbmV3IE11bHRpcG9pbnQoKTtcclxuICAgICAgICAgICAgbXAucG9pbnRzID0gZ3JpZENsdXN0ZXIucG9pbnRzO1xyXG4gICAgICAgICAgICBsZXQgYXJlYTogYW55ID0gZ2VvbWV0cnlFbmdpbmUuY29udmV4SHVsbChtcCwgdHJ1ZSk7IC8vdXNlIGNvbnZleCBodWxsIG9uIHRoZSBwb2ludHMgdG8gZ2V0IHRoZSBib3VuZGFyeVxyXG5cclxuICAgICAgICAgICAgbGV0IGFyZWFBdHRyOiBhbnkgPSB7XHJcbiAgICAgICAgICAgICAgICB4OiBncmlkQ2x1c3Rlci54LFxyXG4gICAgICAgICAgICAgICAgeTogZ3JpZENsdXN0ZXIueSxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlcklkOiBjbHVzdGVyLmNsdXN0ZXJJZCxcclxuICAgICAgICAgICAgICAgIGlzQ2x1c3RlckFyZWE6IHRydWVcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGFyZWEucmluZ3MgJiYgYXJlYS5yaW5ncy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgYXJlYVBvbHkgPSBuZXcgUG9seWdvbigpOyAvL2hhZCB0byBjcmVhdGUgYSBuZXcgcG9seWdvbiBhbmQgZmlsbCBpdCB3aXRoIHRoZSByaW5nIG9mIHRoZSBjYWxjdWxhdGVkIGFyZWEgZm9yIFNjZW5lVmlldyB0byB3b3JrLlxyXG4gICAgICAgICAgICAgICAgYXJlYVBvbHkgPSBhcmVhUG9seS5hZGRSaW5nKGFyZWEucmluZ3NbMF0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghYXJlYVBvbHkuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJlYVBvbHkgPSA8UG9seWdvbj53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKGFyZWFQb2x5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyLmFyZWFHcmFwaGljID0gbmV3IEdyYXBoaWMoeyBnZW9tZXRyeTogYXJlYVBvbHksIGF0dHJpYnV0ZXM6IGFyZWFBdHRyIH0pO1xyXG4gICAgICAgICAgICAgICAgY2x1c3Rlci5hcmVhR3JhcGhpYy5zeW1ib2wgPSB0aGlzLmFyZWFSZW5kZXJlci5nZXRDbGFzc0JyZWFrSW5mbyhjbHVzdGVyLmFyZWFHcmFwaGljKS5zeW1ib2w7XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2FkZCB0aGUgZ3JhcGhpY3MgaW4gb3JkZXIgICAgICAgIFxyXG4gICAgICAgIGlmIChjbHVzdGVyLmFyZWFHcmFwaGljICYmIHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFsd2F5c1wiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmFkZChjbHVzdGVyLmNsdXN0ZXJHcmFwaGljKTtcclxuICAgICAgICB0aGlzLmFkZChjbHVzdGVyLnRleHRHcmFwaGljKTtcclxuXHJcbiAgICAgICAgdGhpcy5fY2x1c3RlcnNbY2x1c3Rlci5jbHVzdGVySWRdID0gY2x1c3RlcjtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2x1c3RlckdyaWQod2ViRXh0ZW50OiBFeHRlbnQsIGV4dGVudElzVW5pb25lZDogYm9vbGVhbikge1xyXG5cclxuICAgICAgICAvL2dldCB0aGUgdG90YWwgYW1vdW50IG9mIGdyaWQgc3BhY2VzIGJhc2VkIG9uIHRoZSBoZWlnaHQgYW5kIHdpZHRoIG9mIHRoZSBtYXAgKGRpdmlkZSBpdCBieSBjbHVzdGVyUmF0aW8pIC0gdGhlbiBnZXQgdGhlIGRlZ3JlZXMgZm9yIHggYW5kIHkgXHJcbiAgICAgICAgbGV0IHhDb3VudCA9IE1hdGgucm91bmQodGhpcy5fYWN0aXZlVmlldy53aWR0aCAvIHRoaXMuY2x1c3RlclJhdGlvKTtcclxuICAgICAgICBsZXQgeUNvdW50ID0gTWF0aC5yb3VuZCh0aGlzLl9hY3RpdmVWaWV3LmhlaWdodCAvIHRoaXMuY2x1c3RlclJhdGlvKTtcclxuXHJcbiAgICAgICAgLy9pZiB0aGUgZXh0ZW50IGhhcyBiZWVuIHVuaW9uZWQgZHVlIHRvIG5vcm1hbGl6YXRpb24sIGRvdWJsZSB0aGUgY291bnQgb2YgeCBpbiB0aGUgY2x1c3RlciBncmlkIGFzIHRoZSB1bmlvbmluZyB3aWxsIGhhbHZlIGl0LlxyXG4gICAgICAgIGlmIChleHRlbnRJc1VuaW9uZWQpIHtcclxuICAgICAgICAgICAgeENvdW50ICo9IDI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgeHcgPSAod2ViRXh0ZW50LnhtYXggLSB3ZWJFeHRlbnQueG1pbikgLyB4Q291bnQ7XHJcbiAgICAgICAgbGV0IHloID0gKHdlYkV4dGVudC55bWF4IC0gd2ViRXh0ZW50LnltaW4pIC8geUNvdW50O1xyXG5cclxuICAgICAgICBsZXQgZ3N4bWluLCBnc3htYXgsIGdzeW1pbiwgZ3N5bWF4O1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSBhbiBhcnJheSBvZiBjbHVzdGVycyB0aGF0IGlzIGEgZ3JpZCBvdmVyIHRoZSB2aXNpYmxlIGV4dGVudC4gRWFjaCBjbHVzdGVyIGNvbnRhaW5zIHRoZSBleHRlbnQgKGluIHdlYiBtZXJjKSB0aGF0IGJvdW5kcyB0aGUgZ3JpZCBzcGFjZSBmb3IgaXQuXHJcbiAgICAgICAgdGhpcy5fZ3JpZENsdXN0ZXJzID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB4Q291bnQ7IGkrKykge1xyXG4gICAgICAgICAgICBnc3htaW4gPSB3ZWJFeHRlbnQueG1pbiArICh4dyAqIGkpO1xyXG4gICAgICAgICAgICBnc3htYXggPSBnc3htaW4gKyB4dztcclxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB5Q291bnQ7IGorKykge1xyXG4gICAgICAgICAgICAgICAgZ3N5bWluID0gd2ViRXh0ZW50LnltaW4gKyAoeWggKiBqKTtcclxuICAgICAgICAgICAgICAgIGdzeW1heCA9IGdzeW1pbiArIHloO1xyXG4gICAgICAgICAgICAgICAgbGV0IGV4dCA9IHsgeG1pbjogZ3N4bWluLCB4bWF4OiBnc3htYXgsIHltaW46IGdzeW1pbiwgeW1heDogZ3N5bWF4IH07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9ncmlkQ2x1c3RlcnMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgZXh0ZW50OiBleHQsXHJcbiAgICAgICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIHN1YlR5cGVDb3VudHM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHNpbmdsZXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHBvaW50czogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgeDogMCxcclxuICAgICAgICAgICAgICAgICAgICB5OiAwXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhbiBzdmcgc3VyZmFjZSBvbiB0aGUgdmlldyBpZiBpdCBkb2Vzbid0IGFscmVhZHkgZXhpc3RcclxuICAgICAqIEBwYXJhbSB2aWV3XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2NyZWF0ZVN1cmZhY2UoKSB7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UpIHJldHVybjtcclxuICAgICAgICBsZXQgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2xheWVyVmlldzJkLmNvbnRhaW5lci5lbGVtZW50LnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBzdXJmYWNlUGFyZW50RWxlbWVudCA9IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudEVsZW1lbnQgfHwgdGhpcy5fYWN0aXZlVmlldy5jYW52YXMucGFyZW50Tm9kZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlID0gZ2Z4LmNyZWF0ZVN1cmZhY2Uoc3VyZmFjZVBhcmVudEVsZW1lbnQsIFwiMFwiLCBcIjBcIik7XHJcbiAgICAgICAgc3VyZmFjZS5jb250YWluZXJHcm91cCA9IHN1cmZhY2UuY3JlYXRlR3JvdXAoKTtcclxuXHJcbiAgICAgICAgZG9tU3R5bGUuc2V0KHN1cmZhY2UucmF3Tm9kZSwgeyBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLCB0b3A6IFwiMFwiLCB6SW5kZXg6IC0xIH0pO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJvdmVyZmxvd1wiLCBcInZpc2libGVcIik7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcImNsYXNzXCIsIFwiZmNsLXN1cmZhY2VcIik7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlID0gc3VyZmFjZTtcclxuXHJcbiAgICAgICAgLy9UaGlzIGlzIGEgaGFjayBmb3IgSUUuIGhpdFRlc3Qgb24gdGhlIHZpZXcgZG9lbnMndCBwaWNrIHVwIGFueSByZXN1bHRzIHVubGVzcyB0aGUgei1pbmRleCBvZiB0aGUgbGF5ZXJWaWV3IGNvbnRhaW5lciBpcyBhdCBsZWFzdCAxLiBTbyBzZXQgaXQgdG8gMSwgYnV0IGFsc28gaGF2ZSB0byBzZXQgdGhlIC5lc3JpLXVpXHJcbiAgICAgICAgLy9jb250YWluZXIgdG8gMiBvdGhlcndpc2UgaXQgY2FuJ3QgYmUgY2xpY2tlZCBvbiBhcyBpdCdzIGNvdmVyZWQgYnkgdGhlIGxheWVyIHZpZXcgY29udGFpbmVyLiBtZWghXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgZG9tU3R5bGUuc2V0KHRoaXMuX2xheWVyVmlldzJkLmNvbnRhaW5lci5lbGVtZW50LCBcInotaW5kZXhcIiwgXCIxXCIpO1xyXG4gICAgICAgICAgICBxdWVyeShcIi5lc3JpLXVpXCIpLmZvckVhY2goZnVuY3Rpb24gKG5vZGU6IEhUTUxFbGVtZW50LCBpbmRleCkge1xyXG4gICAgICAgICAgICAgICAgZG9tU3R5bGUuc2V0KG5vZGUsIFwiei1pbmRleFwiLCBcIjJcIik7XHJcbiAgICAgICAgICAgIH0pOyBcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1BvaW50ZXJNb3ZlKGV2dCkge1xyXG5cclxuICAgICAgICBsZXQgbW91c2VQb3MgPSB0aGlzLl9nZXRNb3VzZVBvcyhldnQpO1xyXG4gICAgICAgIGxldCBzcCA9IG5ldyBTY3JlZW5Qb2ludCh7IHg6IG1vdXNlUG9zLngsIHk6IG1vdXNlUG9zLnkgfSk7XHJcblxyXG4gICAgICAgIC8vaWYgdGhlcmUncyBhbiBhY3RpdmUgY2x1c3RlciBhbmQgdGhlIGN1cnJlbnQgc2NyZWVuIHBvcyBpcyB3aXRoaW4gdGhlIGJvdW5kcyBvZiB0aGF0IGNsdXN0ZXIncyBncm91cCBjb250YWluZXIsIGRvbid0IGRvIGFueXRoaW5nIG1vcmUuIFxyXG4gICAgICAgIC8vVE9ETzogd291bGQgcHJvYmFibHkgYmUgYmV0dGVyIHRvIGNoZWNrIGlmIHRoZSBwb2ludCBpcyBpbiB0aGUgYWN0dWFsIGNpcmNsZSBvZiB0aGUgY2x1c3RlciBncm91cCBhbmQgaXQncyBmbGFyZXMgaW5zdGVhZCBvZiB1c2luZyB0aGUgcmVjdGFuZ2xlIGJvdW5kaW5nIGJveC5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ2x1c3Rlcikge1xyXG4gICAgICAgICAgICBsZXQgYmJveCA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgICAgIGlmIChiYm94KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobW91c2VQb3MueCA+PSBiYm94LmxlZnQgJiYgbW91c2VQb3MueCA8PSBiYm94LnJpZ2h0ICYmIG1vdXNlUG9zLnkgPj0gYmJveC50b3AgJiYgbW91c2VQb3MueSA8PSBiYm94LmJvdHRvbSkgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3LmhpdFRlc3Qoc3ApLnRoZW4oKHJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2cocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICBsZXQgZ3JhcGhpY3MgPSByZXNwb25zZS5yZXN1bHRzO1xyXG4gICAgICAgICAgICBpZiAoZ3JhcGhpY3MubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGdyYXBoaWNzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZyA9IGdyYXBoaWNzW2ldLmdyYXBoaWM7XHJcbiAgICAgICAgICAgICAgICBpZiAoZyAmJiAoZy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZCAhPSBudWxsICYmICFnLmF0dHJpYnV0ZXMuaXNDbHVzdGVyQXJlYSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2x1c3RlciA9IHRoaXMuX2NsdXN0ZXJzW2cuYXR0cmlidXRlcy5jbHVzdGVySWRdO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FjdGl2YXRlQ2x1c3RlcihjbHVzdGVyKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9ICAgIFxyXG5cclxuICAgIHByaXZhdGUgX2FjdGl2YXRlQ2x1c3RlcihjbHVzdGVyOiBDbHVzdGVyKSB7XHJcbiAgICAgICBcclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ2x1c3RlciA9PT0gY2x1c3Rlcikge1xyXG4gICAgICAgICAgICByZXR1cm47IC8vYWxyZWFkeSBhY3RpdmVcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IGNsdXN0ZXI7XHJcbiAgICAgICAgdGhpcy5faW5pdFN1cmZhY2UoKTtcclxuICAgICAgICB0aGlzLl9pbml0Q2x1c3RlcigpO1xyXG4gICAgICAgIHRoaXMuX2luaXRGbGFyZXMoKTtcclxuXHJcbiAgICAgICAgdGhpcy5faGlkZUdyYXBoaWMoW3RoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWNdKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGVhY3RpdmF0ZUNsdXN0ZXIoKSB7XHJcbiAgXHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKFt0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljXSk7XHJcbiAgICAgICAgdGhpcy5fcmVtb3ZlQ2xhc3NGcm9tRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hpZGVHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fY2xlYXJTdXJmYWNlKCk7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIkRFLWFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcbiAgICAgICBcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdFN1cmZhY2UoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgc3BwOiBTY3JlZW5Qb2ludDtcclxuICAgICAgICBsZXQgc3A6IFNjcmVlblBvaW50ID0gdGhpcy5fYWN0aXZlVmlldy50b1NjcmVlbih0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5LCBzcHApO1xyXG5cclxuICAgICAgICAvL3RvU2NyZWVuKCkgcmV0dXJucyB0aGUgd3JvbmcgdmFsdWUgZm9yIHggaWYgYSAyZCBtYXAgaGFzIGJlZW4gd3JhcHBlZCBhcm91bmQgdGhlIGdsb2JlLiBOZWVkIHRvIGNoZWNrIGFuZCBjYXRlciBmb3IgdGhpcy4gSSB0aGluayB0aGlzIGEgYnVnIGluIHRoZSBhcGkuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgdmFyIHdzdyA9IHRoaXMuX2FjdGl2ZVZpZXcuc3RhdGUud29ybGRTY3JlZW5XaWR0aDtcclxuICAgICAgICAgICAgbGV0IHJhdGlvID0gcGFyc2VJbnQoKHNwLnggLyB3c3cpLnRvRml4ZWQoMCkpOyAvL2dldCBhIHJhdGlvIHRvIGRldGVybWluZSBob3cgbWFueSB0aW1lcyB0aGUgbWFwIGhhcyBiZWVuIHdyYXBwZWQgYXJvdW5kLlxyXG4gICAgICAgICAgICBpZiAoc3AueCA8IDApIHsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvL3ggaXMgbGVzcyB0aGFuIDAsIFdURi4gTmVlZCB0byBhZGp1c3QgYnkgdGhlIHdvcmxkIHNjcmVlbiB3aWR0aC5cclxuICAgICAgICAgICAgICAgIHNwLnggKz0gd3N3ICogKHJhdGlvICogLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHNwLnggPiB3c3cpIHsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvL3ggaXMgdG9vIGJpZywgV1RGIGFzIHdlbGwsIGNhdGVyIGZvciBpdC5cclxuICAgICAgICAgICAgICAgIHNwLnggLT0gd3N3ICogcmF0aW87XHJcbiAgICAgICAgICAgIH0gICAgICAgICAgICBcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAxMSwgb3ZlcmZsb3c6IFwidmlzaWJsZVwiLCB3aWR0aDogXCIxcHhcIiwgaGVpZ2h0OiBcIjFweFwiLCBsZWZ0OiBzcC54ICsgXCJweFwiLCB0b3A6IHNwLnkgKyBcInB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwidmlzaWJsZVwiKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY2xlYXJTdXJmYWNlKCkge1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIHF1ZXJ5KFwiPlwiLCBzdXJmYWNlLmNvbnRhaW5lckdyb3VwLnJhd05vZGUpLmZvckVhY2goZG9tQ29uc3RydWN0LmRlc3Ryb3kpO1xyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAtMSwgb3ZlcmZsb3c6IFwiaGlkZGVuXCIsIHRvcDogXCIwcHhcIiwgbGVmdDogXCIwcHhcIiB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJoaWRkZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdENsdXN0ZXIoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgaWYgKCFzdXJmYWNlKSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vd2UncmUgZ29pbmcgdG8gcmVwbGljYXRlIGEgY2x1c3RlciBncmFwaGljIGluIHRoZSBzdmcgZWxlbWVudCB3ZSBhZGRlZCB0byB0aGUgbGF5ZXIgdmlldy4gSnVzdCBzbyBpdCBjYW4gYmUgc3R5bGVkIGVhc2lseS4gTmF0aXZlIFdlYkdMIGZvciBTY2VuZSBWaWV3cyB3b3VsZCBwcm9iYWJseSBiZSBiZXR0ZXIsIGJ1dCBhdCBsZWFzdCB0aGlzIHdheSBjc3MgY2FuIHN0aWxsIGJlIHVzZWQgdG8gc3R5bGUvYW5pbWF0ZSB0aGluZ3MuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAgPSBzdXJmYWNlLmNvbnRhaW5lckdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQodGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZSwgXCJjbHVzdGVyLWdyb3VwXCIpO1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSB0aGUgY2x1c3RlciBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRDbHVzdGVyRWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkQ2x1c3RlckVsZW1lbnQsIFwiY2x1c3RlclwiKTtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgdGhlIGNsdXN0ZXIgdGV4dCBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRUZXh0RWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkVGV4dEVsZW1lbnQsIFwiY2x1c3Rlci10ZXh0XCIpO1xyXG4gICAgICAgIGNsb25lZFRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChjbG9uZWRDbHVzdGVyRWxlbWVudCk7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChjbG9uZWRUZXh0RWxlbWVudCk7XHJcbiAgICAgICBcclxuICAgICAgICAvL3NldCB0aGUgZ3JvdXAgY2xhc3MgICAgIFxyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUsIFwiYWN0aXZhdGVkXCIsIDEwKTtcclxuXHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2luaXRGbGFyZXMoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyIHx8ICF0aGlzLmRpc3BsYXlGbGFyZXMpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IGdyaWRDbHVzdGVyID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5ncmlkQ2x1c3RlcjtcclxuXHJcbiAgICAgICAgLy9jaGVjayBpZiB3ZSBuZWVkIHRvIGNyZWF0ZSBmbGFyZXMgZm9yIHRoZSBjbHVzdGVyXHJcbiAgICAgICAgbGV0IHNpbmdsZUZsYXJlcyA9IChncmlkQ2x1c3Rlci5zaW5nbGVzICYmIGdyaWRDbHVzdGVyLnNpbmdsZXMubGVuZ3RoID4gMCkgJiYgKGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudCA8PSB0aGlzLm1heFNpbmdsZUZsYXJlQ291bnQpO1xyXG4gICAgICAgIGxldCBzdWJUeXBlRmxhcmVzID0gIXNpbmdsZUZsYXJlcyAmJiAoZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cyAmJiBncmlkQ2x1c3Rlci5zdWJUeXBlQ291bnRzLmxlbmd0aCA+IDApO1xyXG5cclxuICAgICAgICBpZiAoIXNpbmdsZUZsYXJlcyAmJiAhc3ViVHlwZUZsYXJlcykge1xyXG4gICAgICAgICAgICByZXR1cm47IC8vbm8gZmxhcmVzIHJlcXVpcmVkXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZmxhcmVzOiBGbGFyZVtdID0gW107XHJcbiAgICAgICAgaWYgKHNpbmdsZUZsYXJlcykge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZ3JpZENsdXN0ZXIuc2luZ2xlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGYgPSBuZXcgRmxhcmUoKTtcclxuICAgICAgICAgICAgICAgIGYudG9vbHRpcFRleHQgPSBncmlkQ2x1c3Rlci5zaW5nbGVzW2ldW3RoaXMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHldO1xyXG4gICAgICAgICAgICAgICAgZi5zaW5nbGVEYXRhID0gZ3JpZENsdXN0ZXIuc2luZ2xlc1tpXTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHN1YlR5cGVGbGFyZXMpIHtcclxuXHJcbiAgICAgICAgICAgIC8vc29ydCBzdWIgdHlwZXMgYnkgaGlnaGVzdCBjb3VudCBmaXJzdFxyXG4gICAgICAgICAgICB2YXIgc3ViVHlwZXMgPSBncmlkQ2x1c3Rlci5zdWJUeXBlQ291bnRzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBiLmNvdW50IC0gYS5jb3VudDtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gc3ViVHlwZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBmID0gbmV3IEZsYXJlKCk7XHJcbiAgICAgICAgICAgICAgICBmLnRvb2x0aXBUZXh0ID0gYCR7c3ViVHlwZXNbaV0ubmFtZX0gKCR7c3ViVHlwZXNbaV0uY291bnR9KWA7XHJcbiAgICAgICAgICAgICAgICBmLmZsYXJlVGV4dCA9IHN1YlR5cGVzW2ldLmNvdW50O1xyXG4gICAgICAgICAgICAgICAgZmxhcmVzLnB1c2goZik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vaWYgdGhlcmUgYXJlIG1vcmUgZmxhcmUgb2JqZWN0cyB0byBjcmVhdGUgdGhhbiB0aGUgbWF4RmxhcmVDb3VudCBhbmQgdGhpcyBpcyBhIG9uZSBvZiB0aG9zZSAtIGNyZWF0ZSBhIHN1bW1hcnkgZmxhcmUgdGhhdCBjb250YWlucyAnLi4uJyBhcyB0aGUgdGV4dCBhbmQgbWFrZSB0aGlzIG9uZSBwYXJ0IG9mIGl0IFxyXG4gICAgICAgIGxldCB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSA9IGZsYXJlcy5sZW5ndGggPiB0aGlzLm1heEZsYXJlQ291bnQ7XHJcbiAgICAgICAgbGV0IGZsYXJlQ291bnQgPSB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSA/IHRoaXMubWF4RmxhcmVDb3VudCA6IGZsYXJlcy5sZW5ndGg7XHJcblxyXG4gICAgICAgIC8vaWYgdGhlcmUncyBhbiBldmVuIGFtb3VudCBvZiBmbGFyZXMsIHBvc2l0aW9uIHRoZSBmaXJzdCBmbGFyZSB0byB0aGUgbGVmdCwgbWludXMgMTgwIGZyb20gZGVncmVlIHRvIGRvIHRoaXMuXHJcbiAgICAgICAgLy9mb3IgYW4gYWRkIGFtb3VudCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgb24gdG9wLCAtOTAgdG8gZG8gdGhpcy4gTG9va3MgbW9yZSBzeW1tZXRyaWNhbCB0aGlzIHdheS5cclxuICAgICAgICBsZXQgZGVncmVlVmFyaWFuY2UgPSAoZmxhcmVDb3VudCAlIDIgPT09IDApID8gLTE4MCA6IC05MDtcclxuICAgICAgICBsZXQgdmlld1JvdGF0aW9uID0gdGhpcy5faXMyZCA/IHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24gOiAwO1xyXG5cclxuICAgICAgICBsZXQgY2x1c3RlclNjcmVlblBvaW50ID0gdGhpcy5fYWN0aXZlVmlldy50b1NjcmVlbih0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5KTtcclxuICAgICAgICBsZXQgY2x1c3RlclN5bWJvbFNpemUgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbC5nZXQoXCJzaXplXCIpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmxhcmVDb3VudDsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgZmxhcmUgPSBmbGFyZXNbaV07XHJcblxyXG4gICAgICAgICAgICAvL3NldCBzb21lIGF0dHJpYnV0ZSBkYXRhXHJcbiAgICAgICAgICAgIGxldCBmbGFyZUF0dHJpYnV0ZXMgPSB7XHJcbiAgICAgICAgICAgICAgICBpc0ZsYXJlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgaXNTdW1tYXJ5RmxhcmU6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgdG9vbHRpcFRleHQ6IFwiXCIsXHJcbiAgICAgICAgICAgICAgICBmbGFyZVRleHRHcmFwaGljOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyR3JhcGhpY0lkOiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJJZCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICBcclxuICAgICAgICAgICAgbGV0IGZsYXJlVGV4dEF0dHJpYnV0ZXMgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIC8vRG8gYSBjb3VwbGUgb2YgdGhpbmdzIGRpZmZlcmVudGx5IGlmIHRoaXMgaXMgYSBzdW1tYXJ5IGZsYXJlIG9yIG5vdFxyXG4gICAgICAgICAgICBsZXQgaXNTdW1tYXJ5RmxhcmUgPSB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSAmJiBpID49IHRoaXMubWF4RmxhcmVDb3VudCAtIDE7XHJcbiAgICAgICAgICAgIGlmIChpc1N1bW1hcnlGbGFyZSkgeyAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgZmxhcmUuaXNTdW1tYXJ5ID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy5pc1N1bW1hcnlGbGFyZSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBsZXQgdG9vbHRpcFRleHQgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgLy9tdWx0aWxpbmUgdG9vbHRpcCBmb3Igc3VtbWFyeSBmbGFyZXMsIGllOiBncmVhdGVyIHRoYW4gdGhpcy5tYXhGbGFyZUNvdW50IGZsYXJlcyBwZXIgY2x1c3RlclxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IHRoaXMubWF4RmxhcmVDb3VudCAtIDEsIGpsZW4gPSBmbGFyZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHRpcFRleHQgKz0gaiA+ICh0aGlzLm1heEZsYXJlQ291bnQgLSAxKSA/IFwiXFxuXCIgOiBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGZsYXJlc1tqXS50b29sdGlwVGV4dDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRvb2x0aXBUZXh0ID0gdG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICBcclxuICAgICAgICAgICAgZmxhcmVBdHRyaWJ1dGVzLnRvb2x0aXBUZXh0ID0gZmxhcmUudG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vY3JlYXRlIGEgZ3JhcGhpYyBmb3IgdGhlIGZsYXJlIGFuZCBmb3IgdGhlIGZsYXJlIHRleHRcclxuICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGZsYXJlQXR0cmlidXRlcyxcclxuICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5LFxyXG4gICAgICAgICAgICAgICAgcG9wdXBUZW1wbGF0ZTogbnVsbFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sID0gdGhpcy5fZ2V0RmxhcmVTeW1ib2woZmxhcmUuZ3JhcGhpYyk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgICAgICBpZiAoZmxhcmUuZmxhcmVUZXh0KSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgICAgICAgICB0ZXh0U3ltYm9sLnRleHQgPSAhaXNTdW1tYXJ5RmxhcmUgPyBmbGFyZS5mbGFyZVRleHQudG9TdHJpbmcoKSA6IFwiLi4uXCI7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHRTeW1ib2wuYW5nbGUgPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyR3JhcGhpY0lkOiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJJZFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sLFxyXG4gICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9mbGFyZXMgaGF2ZSBiZWVuIGNyZWF0ZWQgc28gYWRkIHRoZW0gdG8gdGhlIGRvbVxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBmbGFyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGYgPSBmbGFyZXNbaV07XHJcbiAgICAgICAgICAgIGlmICghZi5ncmFwaGljKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIC8vY3JlYXRlIGEgZ3JvdXAgdG8gaG9sZCBmbGFyZSBvYmplY3QgYW5kIHRleHQgaWYgbmVlZGVkLlxyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG4gICAgICAgICAgICBsZXQgcG9zaXRpb24gPSB0aGlzLl9zZXRGbGFyZVBvc2l0aW9uKGYuZmxhcmVHcm91cCwgY2x1c3RlclN5bWJvbFNpemUsIGZsYXJlQ291bnQsIGksIGRlZ3JlZVZhcmlhbmNlLCB2aWV3Um90YXRpb24pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwiZmxhcmUtZ3JvdXBcIik7XHJcbiAgICAgICAgICAgIGxldCBmbGFyZUVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWMoZi5ncmFwaGljLCBmLmZsYXJlR3JvdXApO1xyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChmbGFyZUVsZW1lbnQpO1xyXG4gICAgICAgICAgICBpZiAoZi50ZXh0R3JhcGhpYykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGZsYXJlVGV4dEVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWMoZi50ZXh0R3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgICAgIGZsYXJlVGV4dEVsZW1lbnQuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVUZXh0RWxlbWVudCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgICAgICAgICAvL2Fzc2lnbiBzb21lIGV2ZW50IGhhbmRsZXJzIGZvciB0aGUgdG9vbHRpcHNcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLm1vdXNlRW50ZXIgPSBvbi5wYXVzYWJsZShmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJtb3VzZWVudGVyXCIsICgpID0+IHRoaXMuX2NyZWF0ZVRvb2x0aXAoZikpO1xyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAubW91c2VMZWF2ZSA9IG9uLnBhdXNhYmxlKGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcIm1vdXNlbGVhdmVcIiwgKCkgPT4gdGhpcy5fZGVzdHJveVRvb2x0aXAoKSk7XHJcbiAgICAgICAgICAgICBcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NldEZsYXJlUG9zaXRpb24oZmxhcmVHcm91cDogYW55LCBjbHVzdGVyU3ltYm9sU2l6ZTogbnVtYmVyLCBmbGFyZUNvdW50OiBudW1iZXIsIGZsYXJlSW5kZXg6IG51bWJlciwgZGVncmVlVmFyaWFuY2U6IG51bWJlciwgdmlld1JvdGF0aW9uOiBudW1iZXIpIHtcclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHBvc2l0aW9uIG9mIHRoZSBmbGFyZSB0byBiZSBwbGFjZWQgYXJvdW5kIHRoZSBjb250YWluZXIgY2lyY2xlLlxyXG4gICAgICAgIGxldCBkZWdyZWUgPSBwYXJzZUludCgoKDM2MCAvIGZsYXJlQ291bnQpICogZmxhcmVJbmRleCkudG9GaXhlZCgpKTtcclxuICAgICAgICBkZWdyZWUgPSBkZWdyZWUgKyBkZWdyZWVWYXJpYW5jZTtcclxuXHJcbiAgICAgICAgLy90YWtlIGludG8gYWNjb3VudCBhbnkgcm90YXRpb24gb24gdGhlIHZpZXdcclxuICAgICAgICBpZiAodmlld1JvdGF0aW9uICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGRlZ3JlZSAtPSB2aWV3Um90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmFkaWFuID0gZGVncmVlICogKE1hdGguUEkgLyAxODApO1xyXG4gICAgICAgIGxldCBidWZmZXIgPSB0aGlzLmZsYXJlQnVmZmVyUGl4ZWxzO1xyXG5cclxuICAgICAgICAvL3Bvc2l0aW9uIHRoZSBmbGFyZSBncm91cCBhcm91bmQgdGhlIGNsdXN0ZXJcclxuICAgICAgICBsZXQgcG9zaXRpb24gPSB7XHJcbiAgICAgICAgICAgIHg6IChidWZmZXIgKyBjbHVzdGVyU3ltYm9sU2l6ZSkgKiBNYXRoLmNvcyhyYWRpYW4pLFxyXG4gICAgICAgICAgICB5OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5zaW4ocmFkaWFuKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmxhcmVHcm91cC5zZXRUcmFuc2Zvcm0oeyBkeDogcG9zaXRpb24ueCwgZHk6IHBvc2l0aW9uLnkgfSk7XHJcbiAgICAgICAgcmV0dXJuIHBvc2l0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldEZsYXJlU3ltYm9sKGZsYXJlR3JhcGhpYzogR3JhcGhpYyk6IFNpbXBsZU1hcmtlclN5bWJvbCB7XHJcbiAgICAgICAgcmV0dXJuICF0aGlzLmZsYXJlUmVuZGVyZXIgPyB0aGlzLmZsYXJlU3ltYm9sIDogdGhpcy5mbGFyZVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGZsYXJlR3JhcGhpYykuc3ltYm9sO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZVRvb2x0aXAoZmxhcmU6IEZsYXJlKSB7XHJcblxyXG4gICAgICAgIGxldCBmbGFyZUdyb3VwID0gZmxhcmUuZmxhcmVHcm91cDtcclxuICAgICAgICB0aGlzLl9kZXN0cm95VG9vbHRpcCgpO1xyXG5cclxuICAgICAgICBsZXQgdG9vbHRpcExlbmd0aCA9IHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCBmbGFyZUdyb3VwLnJhd05vZGUpLmxlbmd0aDtcclxuICAgICAgICBpZiAodG9vbHRpcExlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHRleHQgZnJvbSB0aGUgZGF0YS10b29sdGlwIGF0dHJpYnV0ZSBvZiB0aGUgc2hhcGUgb2JqZWN0XHJcbiAgICAgICAgbGV0IHRleHQgPSBmbGFyZS50b29sdGlwVGV4dDtcclxuICAgICAgICBpZiAoIXRleHQpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJubyB0b29sdGlwIHRleHQgZm9yIGZsYXJlLlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9zcGxpdCBvbiBcXG4gY2hhcmFjdGVyIHRoYXQgc2hvdWxkIGJlIGluIHRvb2x0aXAgdG8gc2lnbmlmeSBtdWx0aXBsZSBsaW5lc1xyXG4gICAgICAgIGxldCBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIik7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIGEgZ3JvdXAgdG8gaG9sZCB0aGUgdG9vbHRpcCBlbGVtZW50c1xyXG4gICAgICAgIGxldCB0b29sdGlwR3JvdXAgPSBmbGFyZUdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSBmbGFyZSBzeW1ib2wsIHdlJ2xsIHVzZSB0aGlzIHRvIHN0eWxlIHRoZSB0b29sdGlwIGJveFxyXG4gICAgICAgIGxldCBmbGFyZVN5bWJvbCA9IHRoaXMuX2dldEZsYXJlU3ltYm9sKGZsYXJlLmdyYXBoaWMpO1xyXG5cclxuICAgICAgICAvL2FsaWduIG9uIHRvcCBmb3Igbm9ybWFsIGZsYXJlLCBhbGlnbiBvbiBib3R0b20gZm9yIHN1bW1hcnkgZmxhcmVzLlxyXG4gICAgICAgIGxldCBoZWlnaHQgPSBmbGFyZVN5bWJvbC5zaXplO1xyXG5cclxuICAgICAgICBsZXQgeFBvcyA9IDE7XHJcbiAgICAgICAgbGV0IHlQb3MgPSAhZmxhcmUuaXNTdW1tYXJ5ID8gKChoZWlnaHQpICogLTEpIDogaGVpZ2h0ICsgNTtcclxuXHJcbiAgICAgICAgdG9vbHRpcEdyb3VwLnJhd05vZGUuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJ0b29sdGlwLXRleHRcIik7XHJcbiAgICAgICAgbGV0IHRleHRTaGFwZXMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHJcbiAgICAgICAgICAgIGxldCB0ZXh0U2hhcGUgPSB0b29sdGlwR3JvdXAuY3JlYXRlVGV4dCh7IHg6IHhQb3MsIHk6IHlQb3MgKyAoaSAqIDEwKSwgdGV4dDogbGluZXNbaV0sIGFsaWduOiAnbWlkZGxlJyB9KVxyXG4gICAgICAgICAgICAgICAgLnNldEZpbGwodGhpcy5mbGFyZVRleHRTeW1ib2wuY29sb3IpXHJcbiAgICAgICAgICAgICAgICAuc2V0Rm9udCh7IHNpemU6IDEwLCBmYW1pbHk6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwiZmFtaWx5XCIpLCB3ZWlnaHQ6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwid2VpZ2h0XCIpIH0pO1xyXG5cclxuICAgICAgICAgICAgdGV4dFNoYXBlcy5wdXNoKHRleHRTaGFwZSk7XHJcbiAgICAgICAgICAgIHRleHRTaGFwZS5yYXdOb2RlLnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByZWN0UGFkZGluZyA9IDI7XHJcbiAgICAgICAgbGV0IHRleHRCb3ggPSB0b29sdGlwR3JvdXAuZ2V0Qm91bmRpbmdCb3goKTtcclxuXHJcbiAgICAgICAgbGV0IHJlY3RTaGFwZSA9IHRvb2x0aXBHcm91cC5jcmVhdGVSZWN0KHsgeDogdGV4dEJveC54IC0gcmVjdFBhZGRpbmcsIHk6IHRleHRCb3gueSAtIHJlY3RQYWRkaW5nLCB3aWR0aDogdGV4dEJveC53aWR0aCArIChyZWN0UGFkZGluZyAqIDIpLCBoZWlnaHQ6IHRleHRCb3guaGVpZ2h0ICsgKHJlY3RQYWRkaW5nICogMiksIHI6IDAgfSlcclxuICAgICAgICAgICAgLnNldEZpbGwoZmxhcmVTeW1ib2wuY29sb3IpO1xyXG5cclxuICAgICAgICBpZiAoZmxhcmVTeW1ib2wub3V0bGluZSkge1xyXG4gICAgICAgICAgICByZWN0U2hhcGUuc2V0U3Ryb2tlKHsgY29sb3I6IGZsYXJlU3ltYm9sLm91dGxpbmUuY29sb3IsIHdpZHRoOiAwLjUgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWN0U2hhcGUucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAubW92ZVRvRnJvbnQoKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGV4dFNoYXBlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICB0ZXh0U2hhcGVzW2ldLm1vdmVUb0Zyb250KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2Rlc3Ryb3lUb29sdGlwKCkge1xyXG4gICAgICAgIHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UucmF3Tm9kZSkuZm9yRWFjaChkb21Db25zdHJ1Y3QuZGVzdHJveSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vI3JlZ2lvbiBoZWxwZXIgZnVuY3Rpb25zXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMsIHN1cmZhY2U6IGFueSk6IEhUTUxFbGVtZW50IHtcclxuXHJcbiAgICAgICAgLy9mYWtlIG91dCBhIEdGWE9iamVjdCBzbyB3ZSBjYW4gZ2VuZXJhdGUgYW4gc3ZnIHNoYXBlIHRoYXQgdGhlIHBhc3NlZCBpbiBncmFwaGljcyBzaGFwZVxyXG4gICAgICAgIGxldCBnID0gbmV3IEdGWE9iamVjdCgpO1xyXG4gICAgICAgIGcuZ3JhcGhpYyA9IGdyYXBoaWM7XHJcbiAgICAgICAgZy5yZW5kZXJpbmdJbmZvID0geyBzeW1ib2w6IGdyYXBoaWMuc3ltYm9sIH07XHJcblxyXG4gICAgICAgIC8vc2V0IHVwIHBhcmFtZXRlcnMgZm9yIHRoZSBjYWxsIHRvIHJlbmRlclxyXG4gICAgICAgIC8vc2V0IHRoZSB0cmFuc2Zvcm0gb2YgdGhlIHByb2plY3RvciB0byAwJ3MgYXMgd2UncmUganVzdCBwbGFjaW5nIHRoZSBnZW5lcmF0ZWQgY2x1c3RlciBzaGFwZSBhdCBleGFjdGx5IDAsMC5cclxuICAgICAgICBsZXQgcHJvamVjdG9yID0gbmV3IFByb2plY3RvcigpO1xyXG4gICAgICAgIHByb2plY3Rvci5fdHJhbnNmb3JtID0gWzAsIDAsIDAsIDAsIDAsIDBdO1xyXG4gICAgICAgIHByb2plY3Rvci5fcmVzb2x1dGlvbiA9IDA7XHJcblxyXG4gICAgICAgIGxldCBzdGF0ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICBzdGF0ZSA9IHRoaXMuX2FjdGl2ZVZpZXcuc3RhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL2Zha2Ugb3V0IGEgc3RhdGUgb2JqZWN0IGZvciAzZCB2aWV3cy5cclxuICAgICAgICAgICAgc3RhdGUgPSB7XHJcbiAgICAgICAgICAgICAgICBjbGlwcGVkRXh0ZW50OiB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCxcclxuICAgICAgICAgICAgICAgIHJvdGF0aW9uOiAwLFxyXG4gICAgICAgICAgICAgICAgc3BhdGlhbFJlZmVyZW5jZTogdGhpcy5fYWN0aXZlVmlldy5zcGF0aWFsUmVmZXJlbmNlLFxyXG4gICAgICAgICAgICAgICAgd29ybGRTY3JlZW5XaWR0aDogMVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHBhciA9IHtcclxuICAgICAgICAgICAgc3VyZmFjZTogc3VyZmFjZSxcclxuICAgICAgICAgICAgc3RhdGU6IHN0YXRlLFxyXG4gICAgICAgICAgICBwcm9qZWN0b3I6IHByb2plY3RvclxyXG4gICAgICAgIH07XHJcbiAgICAgICAgZy5yZW5kZXIocGFyKTtcclxuICAgICAgICByZXR1cm4gZy5fc2hhcGUucmF3Tm9kZTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfZXh0ZW50KCk6IEV4dGVudCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVZpZXcgPyB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zY2FsZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5zY2FsZSA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvL0lFIC8gRWRnZSBkb24ndCBoYXZlIHRoZSBjbGFzc0xpc3QgcHJvcGVydHkgb24gc3ZnIGVsZW1lbnRzLCBzbyB3ZSBjYW4ndCB1c2UgdGhhdCBhZGQgLyByZW1vdmUgY2xhc3NlcyAtIHByb2JhYmx5IHdoeSBkb2pvIGRvbUNsYXNzIGRvZXNuJ3Qgd29yayBlaXRoZXIuXHJcbiAgICAvL3NvIHRoZSBmb2xsb3dpbmcgdHdvIGZ1bmN0aW9ucyBhcmUgZG9kZ3kgc3RyaW5nIGhhY2tzIHRvIGFkZCAvIHJlbW92ZSBjbGFzc2VzLiBVc2VzIGEgdGltZW91dCBzbyB5b3UgY2FuIG1ha2UgY3NzIHRyYW5zaXRpb25zIHdvcmsgaWYgZGVzaXJlZC5cclxuICAgIHByaXZhdGUgX2FkZENsYXNzVG9FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCBhZGRDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgY3VycmVudENsYXNzID0gXCJcIjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgIT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIGxldCBuZXdDbGFzcyA9IChjdXJyZW50Q2xhc3MgKyBcIiBcIiArIF9jbGFzc05hbWUpLnRyaW0oKTtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgbmV3Q2xhc3MpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGFkZENsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9yZW1vdmVDbGFzc0Zyb21FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCByZW1vdmVDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgcmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudENsYXNzLmluZGV4T2YoXCIgXCIgKyBfY2xhc3NOYW1lKSA9PT0gLTEpIHJldHVybjtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgY3VycmVudENsYXNzLnJlcGxhY2UoXCIgXCIgKyBfY2xhc3NOYW1lLCBcIlwiKSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKHRpbWVvdXRNcykge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCB0aW1lb3V0TXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmVtb3ZlQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldE1vdXNlUG9zKGV2dCkge1xyXG4gICAgICAgIC8vY29udGFpbmVyIG9uIHRoZSB2aWV3IGlzIGFjdHVhbGx5IGEgaHRtbCBlbGVtZW50IGF0IHRoaXMgcG9pbnQsIG5vdCBhIHN0cmluZyBhcyB0aGUgdHlwaW5ncyBzdWdnZXN0LlxyXG4gICAgICAgIGxldCBjb250YWluZXI6IGFueSA9IHRoaXMuX2FjdGl2ZVZpZXcuY29udGFpbmVyO1xyXG4gICAgICAgIGxldCByZWN0ID0gY29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHg6IGV2dC5jbGllbnRYIC0gcmVjdC5sZWZ0LFxyXG4gICAgICAgICAgICB5OiBldnQuY2xpZW50WSAtIHJlY3QudG9wXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXR0aW5nIHZpc2libGUgdG8gZmFsc2Ugb24gYSBncmFwaGljIGRvZXNuJ3Qgd29yayBpbiA0LjIgZm9yIHNvbWUgcmVhc29uLiBSZW1vdmluZyB0aGUgZ3JhcGhpYyB0byBoaWRlIGl0IGluc3RlYWQuIEkgdGhpbmsgdmlzaWJsZSBwcm9wZXJ0eSBzaG91bGQgcHJvYmFibHkgd29yayB0aG91Z2guXHJcbiAgICAgKiBAcGFyYW0gZ3JhcGhpY1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9oaWRlR3JhcGhpYyhncmFwaGljOiBHcmFwaGljIHwgR3JhcGhpY1tdKSB7XHJcbiAgICAgICAgaWYgKCFncmFwaGljKSByZXR1cm47XHJcbiAgICAgICAgaWYgKGdyYXBoaWMuaGFzT3duUHJvcGVydHkoXCJsZW5ndGhcIikpIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNYW55KDxHcmFwaGljW10+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSg8R3JhcGhpYz5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2hvd0dyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYyB8IEdyYXBoaWNbXSkge1xyXG4gICAgICAgIGlmICghZ3JhcGhpYykgcmV0dXJuO1xyXG4gICAgICAgIGlmIChncmFwaGljLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkTWFueSg8R3JhcGhpY1tdPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5hZGQoPEdyYXBoaWM+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vI2VuZHJlZ2lvblxyXG5cclxufVxyXG5cclxuXHJcbmludGVyZmFjZSBBY3RpdmVWaWV3IGV4dGVuZHMgX19lc3JpLlZpZXcge1xyXG4gICAgY2FudmFzOiBhbnk7XHJcbiAgICBzdGF0ZTogYW55O1xyXG4gICAgZXh0ZW50OiBFeHRlbnQ7XHJcbiAgICBzY2FsZTogbnVtYmVyO1xyXG4gICAgZmNsU3VyZmFjZTogYW55O1xyXG4gICAgZmNsUG9pbnRlck1vdmU6IElIYW5kbGU7ICAgIFxyXG4gICAgcm90YXRpb246IG51bWJlcjtcclxuXHJcbiAgICB0b1NjcmVlbihnZW9tZXRyeTogX19lc3JpLkdlb21ldHJ5LCBzcD86IFNjcmVlblBvaW50KTogU2NyZWVuUG9pbnQ7XHJcbiAgICBoaXRUZXN0KHNjcnJlblBvaW50OiBTY3JlZW5Qb2ludCk6IGFueTtcclxufVxyXG5cclxuY2xhc3MgR3JpZENsdXN0ZXIge1xyXG4gICAgZXh0ZW50OiBhbnk7XHJcbiAgICBjbHVzdGVyQ291bnQ6IG51bWJlcjtcclxuICAgIHN1YlR5cGVDb3VudHM6IGFueVtdID0gW107XHJcbiAgICBzaW5nbGVzOiBhbnlbXSA9IFtdO1xyXG4gICAgcG9pbnRzOiBhbnlbXSA9IFtdO1xyXG4gICAgeDogbnVtYmVyO1xyXG4gICAgeTogbnVtYmVyO1xyXG59XHJcblxyXG5cclxuY2xhc3MgQ2x1c3RlciB7XHJcbiAgICBjbHVzdGVyR3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRleHRHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgYXJlYUdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICBjbHVzdGVySWQ6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJHcm91cDogYW55O1xyXG4gICAgZ3JpZENsdXN0ZXI6IEdyaWRDbHVzdGVyO1xyXG59XHJcblxyXG5jbGFzcyBGbGFyZSB7IFxyXG4gICAgZ3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRleHRHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgdG9vbHRpcFRleHQ6IHN0cmluZztcclxuICAgIGZsYXJlVGV4dDogc3RyaW5nO1xyXG4gICAgc2luZ2xlRGF0YTogYW55W107XHJcbiAgICBmbGFyZUdyb3VwOiBhbnk7XHJcbiAgICBpc1N1bW1hcnk6IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQb2ludEZpbHRlciB7XHJcbiAgICBmaWx0ZXJOYW1lOiBzdHJpbmc7XHJcbiAgICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHByb3BlcnR5VmFsdWVzOiBhbnlbXTtcclxuXHJcbiAgICAvL2RldGVybWluZXMgd2hldGhlciB0aGUgZmlsdGVyIGluY2x1ZGVzIG9yIGV4Y2x1ZGVzIHRoZSBwb2ludCBkZXBlbmRpbmcgb24gd2hldGhlciBpdCBjb250YWlucyB0aGUgcHJvcGVydHkgdmFsdWUuXHJcbiAgICAvL2ZhbHNlIG1lYW5zIHRoZSBwb2ludCB3aWxsIGJlIGV4Y2x1ZGVkIGlmIHRoZSB2YWx1ZSBkb2VzIGV4aXN0IGluIHRoZSBvYmplY3QsIHRydWUgbWVhbnMgaXQgd2lsbCBiZSBleGNsdWRlZCBpZiBpdCBkb2Vzbid0LlxyXG4gICAga2VlcE9ubHlJZlZhbHVlRXhpc3RzOiBib29sZWFuO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGZpbHRlck5hbWU6IHN0cmluZywgcHJvcGVydHlOYW1lOiBzdHJpbmcsIHZhbHVlczogYW55W10sIGtlZXBPbmx5SWZWYWx1ZUV4aXN0czogYm9vbGVhbiA9IGZhbHNlKSB7XHJcbiAgICAgICAgdGhpcy5maWx0ZXJOYW1lID0gZmlsdGVyTmFtZTtcclxuICAgICAgICB0aGlzLnByb3BlcnR5TmFtZSA9IHByb3BlcnR5TmFtZTtcclxuICAgICAgICB0aGlzLnByb3BlcnR5VmFsdWVzID0gdmFsdWVzO1xyXG4gICAgICAgIHRoaXMua2VlcE9ubHlJZlZhbHVlRXhpc3RzID0ga2VlcE9ubHlJZlZhbHVlRXhpc3RzO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxuIl19
