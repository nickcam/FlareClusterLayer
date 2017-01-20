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
                alert('fixer');
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvRmxhcmVDbHVzdGVyTGF5ZXJfdjQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOENBQThDOzs7Ozs7Ozs7Ozs7Ozs7OztJQTZFOUMseURBQXlEO0lBRXpELElBQWEsaUJBQWlCO1FBQVMscUNBQTJCO1FBb0Q5RCwyQkFBWSxPQUFvQztZQUFoRCxZQUVJLGtCQUFNLE9BQU8sQ0FBQyxTQXlFakI7WUF4Rk8sb0JBQWMsR0FBVyxDQUFDLENBQUM7WUFPM0IsZUFBUyxHQUFzQyxFQUFFLENBQUM7WUFVdEQsa0JBQWtCO1lBQ2xCLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDWCw2QkFBNkI7Z0JBQzdCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQzs7WUFFckYsQ0FBQztZQUVELEtBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUM7WUFFdkQsa0NBQWtDO1lBQ2xDLEtBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUM7WUFDL0MsS0FBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxJQUFJLE9BQU8sQ0FBQztZQUN4RCxLQUFJLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQyxlQUFlLElBQUksQ0FBQyxDQUFDO1lBQ3BELEtBQUksQ0FBQywwQkFBMEIsR0FBRyxPQUFPLENBQUMsMEJBQTBCLElBQUksTUFBTSxDQUFDO1lBQy9FLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLEtBQUksQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLENBQUMsa0JBQWtCLEtBQUssTUFBTSxHQUFHLFNBQVMsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUM7WUFDN0csQ0FBQztZQUNELEtBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7WUFD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LENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDOztPQUNyQixpQkFBaUIsQ0Fva0M3QjtJQXBrQ1ksOENBQWlCO0lBbWxDOUI7UUFBQTtZQUdJLGtCQUFhLEdBQVUsRUFBRSxDQUFDO1lBQzFCLFlBQU8sR0FBVSxFQUFFLENBQUM7WUFDcEIsV0FBTSxHQUFVLEVBQUUsQ0FBQztRQUd2QixDQUFDO1FBQUQsa0JBQUM7SUFBRCxDQVJBLEFBUUMsSUFBQTtJQUdEO1FBQUE7UUFPQSxDQUFDO1FBQUQsY0FBQztJQUFELENBUEEsQUFPQyxJQUFBO0lBRUQ7UUFBQTtRQVFBLENBQUM7UUFBRCxZQUFDO0lBQUQsQ0FSQSxBQVFDLElBQUE7SUFFRDtRQVNJLHFCQUFZLFVBQWtCLEVBQUUsWUFBb0IsRUFBRSxNQUFhLEVBQUUscUJBQXNDO1lBQXRDLHNDQUFBLEVBQUEsNkJBQXNDO1lBQ3ZHLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1lBQzdCLElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1lBQ2pDLElBQUksQ0FBQyxjQUFjLEdBQUcsTUFBTSxDQUFDO1lBQzdCLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxxQkFBcUIsQ0FBQztRQUN2RCxDQUFDO1FBRUwsa0JBQUM7SUFBRCxDQWhCQSxBQWdCQyxJQUFBO0lBaEJZLGtDQUFXIiwiZmlsZSI6IkZsYXJlQ2x1c3RlckxheWVyX3Y0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL3R5cGluZ3MvaW5kZXguZC50c1wiIC8+XHJcblxyXG5pbXBvcnQgKiBhcyBHcmFwaGljc0xheWVyIGZyb20gXCJlc3JpL2xheWVycy9HcmFwaGljc0xheWVyXCI7XHJcbmltcG9ydCAqIGFzIENsYXNzQnJlYWtzUmVuZGVyZXIgZnJvbSBcImVzcmkvcmVuZGVyZXJzL0NsYXNzQnJlYWtzUmVuZGVyZXJcIjtcclxuaW1wb3J0ICogYXMgUG9wdXBUZW1wbGF0ZSBmcm9tIFwiZXNyaS9Qb3B1cFRlbXBsYXRlXCI7XHJcbmltcG9ydCAqIGFzIFNpbXBsZU1hcmtlclN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1NpbXBsZU1hcmtlclN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBUZXh0U3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvVGV4dFN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBTaW1wbGVMaW5lU3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvU2ltcGxlTGluZVN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBDb2xvciBmcm9tIFwiZXNyaS9Db2xvclwiO1xyXG5pbXBvcnQgKiBhcyB3YXRjaFV0aWxzIGZyb20gJ2VzcmkvY29yZS93YXRjaFV0aWxzJztcclxuaW1wb3J0ICogYXMgVmlldyBmcm9tICdlc3JpL3ZpZXdzL1ZpZXcnO1xyXG5pbXBvcnQgKiBhcyB3ZWJNZXJjYXRvclV0aWxzIGZyb20gXCJlc3JpL2dlb21ldHJ5L3N1cHBvcnQvd2ViTWVyY2F0b3JVdGlsc1wiO1xyXG5pbXBvcnQgKiBhcyBHcmFwaGljIGZyb20gXCJlc3JpL0dyYXBoaWNcIjtcclxuaW1wb3J0ICogYXMgUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9pbnRcIjsgXHJcbmltcG9ydCAqIGFzIFNjcmVlblBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1NjcmVlblBvaW50XCI7XHJcbmltcG9ydCAqIGFzIE11bHRpcG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvTXVsdGlwb2ludFwiO1xyXG5pbXBvcnQgKiBhcyBQb2x5Z29uIGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvbHlnb25cIjtcclxuaW1wb3J0ICogYXMgZ2VvbWV0cnlFbmdpbmUgZnJvbSAnZXNyaS9nZW9tZXRyeS9nZW9tZXRyeUVuZ2luZSc7XHJcbmltcG9ydCAqIGFzIFNwYXRpYWxSZWZlcmVuY2UgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU3BhdGlhbFJlZmVyZW5jZVwiO1xyXG5pbXBvcnQgKiBhcyBFeHRlbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvRXh0ZW50XCI7XHJcbmltcG9ydCAqIGFzIE1hcFZpZXcgZnJvbSAnZXNyaS92aWV3cy9NYXBWaWV3JztcclxuaW1wb3J0ICogYXMgU2NlbmVWaWV3IGZyb20gJ2Vzcmkvdmlld3MvU2NlbmVWaWV3JztcclxuXHJcbmltcG9ydCAqIGFzIEdGWE9iamVjdCBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvR0ZYT2JqZWN0XCI7XHJcbmltcG9ydCAqIGFzIFByb2plY3RvciBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvUHJvamVjdG9yXCI7XHJcbiBcclxuaW1wb3J0ICogYXMgYXNkIGZyb20gXCJlc3JpL2NvcmUvYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnNcIjtcclxuXHJcbmltcG9ydCAqIGFzIG9uIGZyb20gJ2Rvam8vb24nO1xyXG5pbXBvcnQgKiBhcyBnZnggZnJvbSAnZG9qb3gvZ2Z4JztcclxuaW1wb3J0ICogYXMgZG9tQ29uc3RydWN0IGZyb20gJ2Rvam8vZG9tLWNvbnN0cnVjdCc7XHJcbmltcG9ydCAqIGFzIHF1ZXJ5IGZyb20gJ2Rvam8vcXVlcnknO1xyXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnZG9qby9kb20nO1xyXG5pbXBvcnQgKiBhcyBkb21BdHRyIGZyb20gJ2Rvam8vZG9tLWF0dHInO1xyXG5pbXBvcnQgKiBhcyBkb21TdHlsZSBmcm9tICdkb2pvL2RvbS1zdHlsZSc7XHJcbmltcG9ydCAqIGFzIHNuaWZmIGZyb20gJ2Rvam8vc25pZmYnO1xyXG4gXHJcbmludGVyZmFjZSBGbGFyZUNsdXN0ZXJMYXllclByb3BlcnRpZXMgZXh0ZW5kcyBfX2VzcmkuR3JhcGhpY3NMYXllclByb3BlcnRpZXMge1xyXG5cclxuICAgIGNsdXN0ZXJSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVSZW5kZXJlcj86IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbD86IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIGFyZWFSZW5kZXJlcj86IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVQb3B1cFRlbXBsYXRlPzogUG9wdXBUZW1wbGF0ZTtcclxuICAgIHNwYXRpYWxSZWZlcmVuY2U/OiBTcGF0aWFsUmVmZXJlbmNlO1xyXG5cclxuICAgIGNsdXN0ZXJSYXRpbz86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJUb1NjYWxlPzogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50PzogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5Pzogc3RyaW5nO1xyXG5cclxuICAgIGRpc3BsYXlGbGFyZXM/OiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ/OiBudW1iZXI7XHJcbiAgICBzaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eT86IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sPzogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM/OiBudW1iZXI7XHJcbiAgICB0ZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbD86IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBzdWJUeXBlRmxhcmVQcm9wZXJ0eT86IHN0cmluZztcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgeVByb3BlcnR5TmFtZT86IHN0cmluZztcclxuICAgIHpQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcblxyXG4gICAgcmVmcmVzaE9uU3RhdGlvbmFyeT86IGJvb2xlYW47XHJcblxyXG4gICAgZmlsdGVycz86IFBvaW50RmlsdGVyW107XHJcblxyXG4gICAgZGF0YT86IGFueVtdO1xyXG5cclxufVxyXG5cclxuLy9leHRlbmQgR3JhcGhpY3NMYXllciB1c2luZyAnYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnMnXHJcbkBhc2Quc3ViY2xhc3MoXCJGbGFyZUNsdXN0ZXJMYXllclwiKVxyXG5leHBvcnQgY2xhc3MgRmxhcmVDbHVzdGVyTGF5ZXIgZXh0ZW5kcyBhc2QuZGVjbGFyZWQoR3JhcGhpY3NMYXllcikge1xyXG5cclxuICAgIHNpbmdsZVJlbmRlcmVyOiBhbnk7XHJcbiAgICBzaW5nbGVTeW1ib2w6IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIHNpbmdsZVBvcHVwVGVtcGxhdGU6IFBvcHVwVGVtcGxhdGU7XHJcblxyXG4gICAgY2x1c3RlclJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgYXJlYVJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgZmxhcmVSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzcGF0aWFsUmVmZXJlbmNlOiBTcGF0aWFsUmVmZXJlbmNlO1xyXG5cclxuICAgIGNsdXN0ZXJSYXRpbzogbnVtYmVyO1xyXG4gICAgY2x1c3RlclRvU2NhbGU6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJNaW5Db3VudDogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5OiBzdHJpbmc7XHJcblxyXG4gICAgZGlzcGxheUZsYXJlczogYm9vbGVhbjtcclxuICAgIG1heEZsYXJlQ291bnQ6IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ6IG51bWJlcjtcclxuICAgIHNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5OiBzdHJpbmc7XHJcbiAgICBmbGFyZVN5bWJvbDogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM6IG51bWJlcjtcclxuICAgIHRleHRTeW1ib2w6IFRleHRTeW1ib2w7XHJcbiAgICBmbGFyZVRleHRTeW1ib2w6IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlczogYm9vbGVhbjtcclxuICAgIHN1YlR5cGVGbGFyZVByb3BlcnR5OiBzdHJpbmc7XHJcblxyXG4gICAgcmVmcmVzaE9uU3RhdGlvbmFyeTogYm9vbGVhbjtcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB6UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcblxyXG4gICAgZmlsdGVyczogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBwcml2YXRlIF9ncmlkQ2x1c3RlcnM6IEdyaWRDbHVzdGVyW107XHJcbiAgICBwcml2YXRlIF9pc0NsdXN0ZXJlZDogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX2FjdGl2ZVZpZXc6IEFjdGl2ZVZpZXc7XHJcbiAgICBwcml2YXRlIF92aWV3TG9hZENvdW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIHByaXZhdGUgX3JlYWR5VG9EcmF3OiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkSW5pdGlhbERyYXc6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9kYXRhOiBhbnlbXTtcclxuICAgIHByaXZhdGUgX2lzMmQ6IGJvb2xlYW47XHJcblxyXG4gICAgcHJpdmF0ZSBfY2x1c3RlcnM6IHsgW2NsdXN0ZXJJZDogbnVtYmVyXTogQ2x1c3RlcjsgfSA9IHt9O1xyXG4gICAgcHJpdmF0ZSBfYWN0aXZlQ2x1c3RlcjogQ2x1c3RlcjtcclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXcyZDogYW55O1xyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3M2Q6IGFueTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zOiBGbGFyZUNsdXN0ZXJMYXllclByb3BlcnRpZXMpIHtcclxuXHJcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vc2V0IHRoZSBkZWZhdWx0c1xyXG4gICAgICAgIGlmICghb3B0aW9ucykge1xyXG4gICAgICAgICAgICAvL21pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyc1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiTWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzIHRvIGZsYXJlIGNsdXN0ZXIgbGF5ZXIgY29uc3RydWN0b3IuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuc2luZ2xlUG9wdXBUZW1wbGF0ZSA9IG9wdGlvbnMuc2luZ2xlUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgdGhlIGNsdXN0ZXJpbmcgcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclJhdGlvID0gb3B0aW9ucy5jbHVzdGVyUmF0aW8gfHwgNzU7XHJcbiAgICAgICAgdGhpcy5jbHVzdGVyVG9TY2FsZSA9IG9wdGlvbnMuY2x1c3RlclRvU2NhbGUgfHwgMjAwMDAwMDtcclxuICAgICAgICB0aGlzLmNsdXN0ZXJNaW5Db3VudCA9IG9wdGlvbnMuY2x1c3Rlck1pbkNvdW50IHx8IDI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eSA9IG9wdGlvbnMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHkgfHwgXCJuYW1lXCI7XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID0gb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwibm9uZVwiID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubWF4RmxhcmVDb3VudCA9IG9wdGlvbnMubWF4RmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCA9IG9wdGlvbnMubWF4U2luZ2xlRmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMuZGlzcGxheUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheUZsYXJlcyA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vZGVmYXVsdCB0byB0cnVlXHJcbiAgICAgICAgdGhpcy5kaXNwbGF5U3ViVHlwZUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheVN1YlR5cGVGbGFyZXMgPT09IHRydWU7XHJcbiAgICAgICAgdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eSA9IG9wdGlvbnMuc3ViVHlwZUZsYXJlUHJvcGVydHkgfHwgdW5kZWZpbmVkO1xyXG4gICAgICAgIHRoaXMuZmxhcmVCdWZmZXJQaXhlbHMgPSBvcHRpb25zLmZsYXJlQnVmZmVyUGl4ZWxzIHx8IDY7XHJcblxyXG4gICAgICAgIC8vZGF0YSBzZXQgcHJvcGVydHkgbmFtZXNcclxuICAgICAgICB0aGlzLnhQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnhQcm9wZXJ0eU5hbWUgfHwgXCJ4XCI7XHJcbiAgICAgICAgdGhpcy55UHJvcGVydHlOYW1lID0gb3B0aW9ucy55UHJvcGVydHlOYW1lIHx8IFwieVwiO1xyXG4gICAgICAgIHRoaXMuelByb3BlcnR5TmFtZSA9IG9wdGlvbnMuelByb3BlcnR5TmFtZSB8fCBcInpcIjtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgdGhlIHN5bWJvbG9neS9yZW5kZXJlciBwcm9wZXJ0aWVzXHJcbiAgICAgICAgdGhpcy5jbHVzdGVyUmVuZGVyZXIgPSBvcHRpb25zLmNsdXN0ZXJSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLmFyZWFSZW5kZXJlciA9IG9wdGlvbnMuYXJlYVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlUmVuZGVyZXIgPSBvcHRpb25zLnNpbmdsZVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlU3ltYm9sID0gb3B0aW9ucy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgdGhpcy5mbGFyZVJlbmRlcmVyID0gb3B0aW9ucy5mbGFyZVJlbmRlcmVyO1xyXG5cclxuICAgICAgICB0aGlzLnJlZnJlc2hPblN0YXRpb25hcnkgPSBvcHRpb25zLnJlZnJlc2hPblN0YXRpb25hcnkgPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlOyAvL2RlZmF1bHQgdG8gdHJ1ZVxyXG5cclxuICAgICAgICAvL2FkZCBzb21lIGRlZmF1bHQgc3ltYm9scyBvciB1c2UgdGhlIG9wdGlvbnMgdmFsdWVzLlxyXG4gICAgICAgIHRoaXMuZmxhcmVTeW1ib2wgPSBvcHRpb25zLmZsYXJlU3ltYm9sIHx8IG5ldyBTaW1wbGVNYXJrZXJTeW1ib2woe1xyXG4gICAgICAgICAgICBzaXplOiAxNCxcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMCwgMCwgMCwgMC41XSksXHJcbiAgICAgICAgICAgIG91dGxpbmU6IG5ldyBTaW1wbGVMaW5lU3ltYm9sKHsgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NSwgMC41XSksIHdpZHRoOiAxIH0pXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMudGV4dFN5bWJvbCA9IG9wdGlvbnMudGV4dFN5bWJvbCB8fCBuZXcgVGV4dFN5bWJvbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTVdKSxcclxuICAgICAgICAgICAgZm9udDoge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogMTAsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtM1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmZsYXJlVGV4dFN5bWJvbCA9IG9wdGlvbnMuZmxhcmVUZXh0U3ltYm9sIHx8IG5ldyBUZXh0U3ltYm9sKHtcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NV0pLFxyXG4gICAgICAgICAgICBmb250OiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiA2LFxyXG4gICAgICAgICAgICAgICAgZmFtaWx5OiBcImFyaWFsXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeW9mZnNldDogLTJcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy9pbml0aWFsIGRhdGFcclxuICAgICAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgdGhpcy5vbihcImxheWVydmlldy1jcmVhdGVcIiwgKGV2dCkgPT4gdGhpcy5fbGF5ZXJWaWV3Q3JlYXRlZChldnQpKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXdDcmVhdGVkKGV2dCkge1xyXG5cclxuICAgICAgICBpZiAoZXZ0LmxheWVyVmlldy52aWV3LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXcyZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXczZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2FkZCBhIHN0YXRpb25hcnkgd2F0Y2ggb24gdGhlIHZpZXcgdG8gcmVmcmVzaCBpZiBzcGVjaWZpZWQgaW4gb3B0aW9ucy5cclxuICAgICAgICBpZiAodGhpcy5yZWZyZXNoT25TdGF0aW9uYXJ5KSB7XHJcbiAgICAgICAgICAgIHdhdGNoVXRpbHMucGF1c2FibGUoZXZ0LmxheWVyVmlldy52aWV3LCBcInN0YXRpb25hcnlcIiwgKGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykgPT4gdGhpcy5fdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5fdmlld0xvYWRDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gZXZ0LmxheWVyVmlldy52aWV3O1xyXG5cclxuICAgICAgICAgICAgdGhpcy5fcmVhZHlUb0RyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkSW5pdGlhbERyYXcpIHtcclxuICAgICAgICAgICAgICAgIC8vd2UndmUgYmVlbiB3YWl0aW5nIGZvciB0aGlzIHRvIGhhcHBlbiB0byBkcmF3XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdmlld0xvYWRDb3VudCsrO1xyXG5cclxuXHJcbiAgICAgICAgaWYgKGV2dC5sYXllclZpZXcudmlldy50eXBlID09PSBcIjJkXCIpIHtcclxuICAgICAgICAgICAgLy9mb3IgbWFwIHZpZXdzLCB3YWl0IGZvciB0aGUgbGF5ZXJ2aWV3IG90IGJlIGF0dGFjaGVkLCBiZWZvcmUgYWRkaW5nIGV2ZW50c1xyXG4gICAgICAgICAgICB3YXRjaFV0aWxzLndoZW5UcnVlT25jZShldnQubGF5ZXJWaWV3LCBcImF0dGFjaGVkXCIsICgpID0+IHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy9mb3Igc2NlbmUgdmlld3MganVzdCBhZGQgdGhlIGV2ZW50cyBzdHJhaWdodCBhd2F5XHJcbiAgICAgICAgICAgIHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9hZGRWaWV3RXZlbnRzKGxheWVyVmlldzogYW55KSB7XHJcbiAgICAgICAgbGV0IHY6IEFjdGl2ZVZpZXcgPSBsYXllclZpZXcudmlldztcclxuICAgICAgICBpZiAoIXYuZmNsUG9pbnRlck1vdmUpIHtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb250YWluZXI6IEhUTUxFbGVtZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBpZiAodi50eXBlID09PSBcIjJkXCIpIHtcclxuICAgICAgICAgICAgICAgIC8vZm9yIGEgbWFwIHZpZXcgZ2V0IHRoZSBjb250YWluZXIgZWxlbWVudCBvZiB0aGUgbGF5ZXIgdmlldyB0byBhZGQgbW91c2Vtb3ZlIGV2ZW50IHRvLlxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gbGF5ZXJWaWV3LmNvbnRhaW5lci5lbGVtZW50O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy9mb3Igc2NlbmUgdmlldyBnZXQgdGhlIGNhbnZhcyBlbGVtZW50IHVuZGVyIHRoZSB2aWV3IGNvbnRhaW5lciB0byBhZGQgbW91c2Vtb3ZlIHRvLlxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gPEhUTUxFbGVtZW50PnF1ZXJ5KFwiY2FudmFzXCIsIHYuY29udGFpbmVyKVswXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy9BZGQgcG9pbnRlciBtb3ZlIGFuZCBwb2ludGVyIGRvd24uIFBvaW50ZXIgZG93biB0byBoYW5kbGUgdG91Y2ggZGV2aWNlcy5cclxuICAgICAgICAgICAgdi5mY2xQb2ludGVyTW92ZSA9IHYub24oXCJwb2ludGVyLW1vdmVcIiwgKGV2dCkgPT4gdGhpcy5fdmlld1BvaW50ZXJNb3ZlKGV2dCkpO1xyXG4gICAgICAgICAgICB2LmZjbFBvaW50ZXJEb3duID0gdi5vbihcInBvaW50ZXItZG93blwiLCAoZXZ0KSA9PiB0aGlzLl92aWV3UG9pbnRlck1vdmUoZXZ0KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF92aWV3U3RhdGlvbmFyeShpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpIHtcclxuXHJcbiAgICAgICAgaWYgKGlzU3RhdGlvbmFyeSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghaXNTdGF0aW9uYXJ5ICYmIHRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgLy9pZiBtb3ZpbmcgZGVhY3RpdmF0ZSBjbHVzdGVyO1xyXG4gICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgY2xlYXIoKSB7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVBbGwoKTtcclxuICAgICAgICB0aGlzLl9jbHVzdGVycyA9IHt9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBzZXREYXRhKGRhdGE6IGFueVtdLCBkcmF3RGF0YTogYm9vbGVhbiA9IHRydWUpIHtcclxuICAgICAgICB0aGlzLl9kYXRhID0gZGF0YTtcclxuICAgICAgICBpZiAoZHJhd0RhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGRyYXcoYWN0aXZlVmlldz86IGFueSkge1xyXG5cclxuICAgICAgICBpZiAoYWN0aXZlVmlldykge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gYWN0aXZlVmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vTm90IHJlYWR5IHRvIGRyYXcgeWV0IHNvIHF1ZXVlIG9uZSB1cFxyXG4gICAgICAgIGlmICghdGhpcy5fcmVhZHlUb0RyYXcpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkSW5pdGlhbERyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZVZpZXcgfHwgIXRoaXMuX2RhdGEpIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5faXMyZCA9IHRoaXMuX2FjdGl2ZVZpZXcudHlwZSA9PT0gXCIyZFwiO1xyXG5cclxuICAgICAgICAvL2NoZWNrIHRvIG1ha2Ugc3VyZSB3ZSBoYXZlIGFuIGFyZWEgcmVuZGVyZXIgc2V0IGlmIG9uZSBuZWVkcyB0byBiZVxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSAmJiAhdGhpcy5hcmVhUmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkZsYXJlQ2x1c3RlckxheWVyOiBhcmVhUmVuZGVyZXIgbXVzdCBiZSBzZXQgaWYgY2x1c3RlckFyZWFEaXNwbGF5IGlzIHNldC5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2xlYXIoKTtcclxuICAgICAgICBjb25zb2xlLnRpbWUoXCJkcmF3LWRhdGEtXCIgKyB0aGlzLl9hY3RpdmVWaWV3LnR5cGUpO1xyXG5cclxuICAgICAgICB0aGlzLl9pc0NsdXN0ZXJlZCA9IHRoaXMuY2x1c3RlclRvU2NhbGUgPCB0aGlzLl9zY2FsZSgpO1xyXG5cclxuICAgICAgICBsZXQgZ3JhcGhpY3M6IEdyYXBoaWNbXSA9IFtdO1xyXG5cclxuICAgICAgICAvL2dldCBhbiBleHRlbnQgdGhhdCBpcyBpbiB3ZWIgbWVyY2F0b3IgdG8gbWFrZSBzdXJlIGl0J3MgZmxhdCBmb3IgZXh0ZW50IGNoZWNraW5nXHJcbiAgICAgICAgLy9UaGUgd2ViZXh0ZW50IHdpbGwgbmVlZCB0byBiZSBub3JtYWxpemVkIHNpbmNlIHBhbm5pbmcgb3ZlciB0aGUgaW50ZXJuYXRpb25hbCBkYXRlbGluZSB3aWxsIGNhdXNlXHJcbiAgICAgICAgLy9jYXVzZSB0aGUgZXh0ZW50IHRvIHNoaWZ0IG91dHNpZGUgdGhlIC0xODAgdG8gMTgwIGRlZ3JlZSB3aW5kb3cuICBJZiB3ZSBkb24ndCBub3JtYWxpemUgdGhlbiB0aGVcclxuICAgICAgICAvL2NsdXN0ZXJzIHdpbGwgbm90IGJlIGRyYXduIGlmIHRoZSBtYXAgcGFucyBvdmVyIHRoZSBpbnRlcm5hdGlvbmFsIGRhdGVsaW5lLlxyXG4gICAgICAgIGxldCB3ZWJFeHRlbnQ6IGFueSA9ICF0aGlzLl9leHRlbnQoKS5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IgPyA8RXh0ZW50PndlYk1lcmNhdG9yVXRpbHMucHJvamVjdCh0aGlzLl9leHRlbnQoKSwgbmV3IFNwYXRpYWxSZWZlcmVuY2UoeyBcIndraWRcIjogMTAyMTAwIH0pKSA6IHRoaXMuX2V4dGVudCgpO1xyXG4gICAgICAgIGxldCBleHRlbnRJc1VuaW9uZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgbGV0IG5vcm1hbGl6ZWRXZWJFeHRlbnQgPSB3ZWJFeHRlbnQubm9ybWFsaXplKCk7XHJcbiAgICAgICAgd2ViRXh0ZW50ID0gbm9ybWFsaXplZFdlYkV4dGVudFswXTtcclxuICAgICAgICBpZiAobm9ybWFsaXplZFdlYkV4dGVudC5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgIHdlYkV4dGVudCA9IHdlYkV4dGVudC51bmlvbihub3JtYWxpemVkV2ViRXh0ZW50WzFdKTtcclxuICAgICAgICAgICAgZXh0ZW50SXNVbmlvbmVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVDbHVzdGVyR3JpZCh3ZWJFeHRlbnQsIGV4dGVudElzVW5pb25lZCk7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgbGV0IHdlYjogbnVtYmVyW10sIG9iajogYW55LCBkYXRhTGVuZ3RoID0gdGhpcy5fZGF0YS5sZW5ndGgsIHhWYWw6IG51bWJlciwgeVZhbDogbnVtYmVyO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YUxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG9iaiA9IHRoaXMuX2RhdGFbaV07XHJcblxyXG4gICAgICAgICAgICAvL2NoZWNrIGlmIGZpbHRlcnMgYXJlIHNwZWNpZmllZCBhbmQgY29udGludWUgaWYgdGhpcyBvYmplY3QgZG9lc24ndCBwYXNzXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fcGFzc2VzRmlsdGVyKG9iaikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB4VmFsID0gb2JqW3RoaXMueFByb3BlcnR5TmFtZV07XHJcbiAgICAgICAgICAgIHlWYWwgPSBvYmpbdGhpcy55UHJvcGVydHlOYW1lXTtcclxuXHJcbiAgICAgICAgICAgIC8vZ2V0IGEgd2ViIG1lcmMgbG5nL2xhdCBmb3IgZXh0ZW50IGNoZWNraW5nLiBVc2Ugd2ViIG1lcmMgYXMgaXQncyBmbGF0IHRvIGNhdGVyIGZvciBsb25naXR1ZGUgcG9sZVxyXG4gICAgICAgICAgICBpZiAodGhpcy5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgICAgIHdlYiA9IFt4VmFsLCB5VmFsXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHdlYiA9IHdlYk1lcmNhdG9yVXRpbHMubG5nTGF0VG9YWSh4VmFsLCB5VmFsKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy9jaGVjayBpZiB0aGUgb2JqIGlzIHZpc2libGUgaW4gdGhlIGV4dGVudCBiZWZvcmUgcHJvY2VlZGluZ1xyXG4gICAgICAgICAgICBpZiAoKHdlYlswXSA8PSB3ZWJFeHRlbnQueG1pbiB8fCB3ZWJbMF0gPiB3ZWJFeHRlbnQueG1heCkgfHwgKHdlYlsxXSA8PSB3ZWJFeHRlbnQueW1pbiB8fCB3ZWJbMV0gPiB3ZWJFeHRlbnQueW1heCkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAvL2xvb3AgY2x1c3RlciBncmlkIHRvIHNlZSBpZiBpdCBzaG91bGQgYmUgYWRkZWQgdG8gb25lXHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgakxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGogPCBqTGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2wgPSB0aGlzLl9ncmlkQ2x1c3RlcnNbal07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh3ZWJbMF0gPD0gY2wuZXh0ZW50LnhtaW4gfHwgd2ViWzBdID4gY2wuZXh0ZW50LnhtYXggfHwgd2ViWzFdIDw9IGNsLmV4dGVudC55bWluIHx8IHdlYlsxXSA+IGNsLmV4dGVudC55bWF4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvL25vdCBoZXJlIHNvIGNhcnJ5IG9uXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvL3JlY2FsYyB0aGUgeCBhbmQgeSBvZiB0aGUgY2x1c3RlciBieSBhdmVyYWdpbmcgdGhlIHBvaW50cyBhZ2FpblxyXG4gICAgICAgICAgICAgICAgICAgIGNsLnggPSBjbC5jbHVzdGVyQ291bnQgPiAwID8gKHhWYWwgKyAoY2wueCAqIGNsLmNsdXN0ZXJDb3VudCkpIC8gKGNsLmNsdXN0ZXJDb3VudCArIDEpIDogeFZhbDtcclxuICAgICAgICAgICAgICAgICAgICBjbC55ID0gY2wuY2x1c3RlckNvdW50ID4gMCA/ICh5VmFsICsgKGNsLnkgKiBjbC5jbHVzdGVyQ291bnQpKSAvIChjbC5jbHVzdGVyQ291bnQgKyAxKSA6IHlWYWw7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vcHVzaCBldmVyeSBwb2ludCBpbnRvIHRoZSBjbHVzdGVyIHNvIHdlIGhhdmUgaXQgZm9yIGFyZWEgZGlzcGxheSBpZiByZXF1aXJlZC4gVGhpcyBjb3VsZCBiZSBvbWl0dGVkIGlmIG5ldmVyIGNoZWNraW5nIGFyZWFzLCBvciBvbiBkZW1hbmQgYXQgbGVhc3RcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wucG9pbnRzLnB1c2goW3hWYWwsIHlWYWxdKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNsLmNsdXN0ZXJDb3VudCsrO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3ViVHlwZUV4aXN0cyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHMgPSAwLCBzTGVuID0gY2wuc3ViVHlwZUNvdW50cy5sZW5ndGg7IHMgPCBzTGVuOyBzKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsLnN1YlR5cGVDb3VudHNbc10ubmFtZSA9PT0gb2JqW3RoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzW3NdLmNvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJUeXBlRXhpc3RzID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXN1YlR5cGVFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc3ViVHlwZUNvdW50cy5wdXNoKHsgbmFtZTogb2JqW3RoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHldLCBjb3VudDogMSB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vYWRkIHRoZSBzaW5nbGUgZml4IHJlY29yZCBpZiBzdGlsbCB1bmRlciB0aGUgbWF4U2luZ2xlRmxhcmVDb3VudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbC5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnNpbmdsZXMucHVzaChvYmopO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc2luZ2xlcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvL25vdCBjbHVzdGVyZWQgc28ganVzdCBhZGQgZXZlcnkgb2JqXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVTaW5nbGUob2JqKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9ncmlkQ2x1c3RlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uY2x1c3RlckNvdW50IDwgdGhpcy5jbHVzdGVyTWluQ291bnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgamxlbiA9IHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5zaW5nbGVzLmxlbmd0aDsgaiA8IGpsZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVTaW5nbGUodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLnNpbmdsZXNbal0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5jbHVzdGVyQ291bnQgPiAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlQ2x1c3Rlcih0aGlzLl9ncmlkQ2x1c3RlcnNbaV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2VtaXQgYW4gZXZlbnQgdG8gc2lnbmFsIGRyYXdpbmcgaXMgY29tcGxldGUuXHJcbiAgICAgICAgdGhpcy5lbWl0KFwiZHJhdy1jb21wbGV0ZVwiLCB7fSk7XHJcbiAgICAgICAgY29uc29sZS50aW1lRW5kKGBkcmF3LWRhdGEtJHt0aGlzLl9hY3RpdmVWaWV3LnR5cGV9YCk7XHJcblxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVTdXJmYWNlKCk7XHJcbiAgICAgICAgfSwgMTApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Bhc3Nlc0ZpbHRlcihvYmo6IGFueSk6IGJvb2xlYW4ge1xyXG4gICAgICAgIGlmICghdGhpcy5maWx0ZXJzIHx8IHRoaXMuZmlsdGVycy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgICAgIGxldCBwYXNzZXMgPSB0cnVlO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmZpbHRlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRoaXMuZmlsdGVyc1tpXTtcclxuICAgICAgICAgICAgaWYgKG9ialtmaWx0ZXIucHJvcGVydHlOYW1lXSA9PSBudWxsKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGxldCB2YWxFeGlzdHMgPSBmaWx0ZXIucHJvcGVydHlWYWx1ZXMuaW5kZXhPZihvYmpbZmlsdGVyLnByb3BlcnR5TmFtZV0pICE9PSAtMTtcclxuICAgICAgICAgICAgaWYgKHZhbEV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcGFzc2VzID0gZmlsdGVyLmtlZXBPbmx5SWZWYWx1ZUV4aXN0czsgLy90aGUgdmFsdWUgZXhpc3RzIHNvIHJldHVybiB3aGV0aGVyIHdlIHNob3VsZCBiZSBrZWVwaW5nIGl0IG9yIG5vdC5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmICghdmFsRXhpc3RzICYmIGZpbHRlci5rZWVwT25seUlmVmFsdWVFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIHBhc3NlcyA9IGZhbHNlOyAvL3JldHVybiBmYWxzZSBhcyB0aGUgdmFsdWUgZG9lc24ndCBleGlzdCwgYW5kIHdlIHNob3VsZCBvbmx5IGJlIGtlZXBpbmcgcG9pbnQgb2JqZWN0cyB3aGVyZSBpdCBkb2VzIGV4aXN0LlxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIXBhc3NlcykgcmV0dXJuIGZhbHNlOyAvL2lmIGl0IGhhc24ndCBwYXNzZWQgYW55IG9mIHRoZSBmaWx0ZXJzIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBwYXNzZXM7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlU2luZ2xlKG9iaikge1xyXG4gICAgICAgIGxldCBwb2ludCA9IG5ldyBQb2ludCh7XHJcbiAgICAgICAgICAgIHg6IG9ialt0aGlzLnhQcm9wZXJ0eU5hbWVdLCB5OiBvYmpbdGhpcy55UHJvcGVydHlOYW1lXSwgejogb2JqW3RoaXMuelByb3BlcnR5TmFtZV1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKCFwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHBvaW50LFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBvYmpcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgZ3JhcGhpYy5wb3B1cFRlbXBsYXRlID0gdGhpcy5zaW5nbGVQb3B1cFRlbXBsYXRlO1xyXG4gICAgICAgIGlmICh0aGlzLnNpbmdsZVJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIGxldCBzeW1ib2wgPSB0aGlzLnNpbmdsZVJlbmRlcmVyLmdldFN5bWJvbChncmFwaGljLCB0aGlzLl9hY3RpdmVWaWV3KTtcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSBzeW1ib2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHRoaXMuc2luZ2xlU3ltYm9sKSB7XHJcbiAgICAgICAgICAgIGdyYXBoaWMuc3ltYm9sID0gdGhpcy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL25vIHN5bWJvbG9neSBmb3Igc2luZ2xlcyBkZWZpbmVkLCB1c2UgdGhlIGRlZmF1bHQgc3ltYm9sIGZyb20gdGhlIGNsdXN0ZXIgcmVuZGVyZXJcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLmNsdXN0ZXJSZW5kZXJlci5kZWZhdWx0U3ltYm9sO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5hZGQoZ3JhcGhpYyk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsdXN0ZXIoZ3JpZENsdXN0ZXI6IEdyaWRDbHVzdGVyKSB7XHJcblxyXG4gICAgICAgIGxldCBjbHVzdGVyID0gbmV3IENsdXN0ZXIoKTtcclxuICAgICAgICBjbHVzdGVyLmdyaWRDbHVzdGVyID0gZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vbWFrZSBzdXJlIGFsbCBnZW9tZXRyaWVzIGFkZGVkIHRvIEdyYXBoaWMgb2JqZWN0cyBhcmUgaW4gd2ViIG1lcmNhdG9yIG90aGVyd2lzZSB3cmFwIGFyb3VuZCBkb2Vzbid0IHdvcmsuXHJcbiAgICAgICAgbGV0IHBvaW50ID0gbmV3IFBvaW50KHsgeDogZ3JpZENsdXN0ZXIueCwgeTogZ3JpZENsdXN0ZXIueSB9KTtcclxuICAgICAgICBpZiAoIXBvaW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBwb2ludCA9IDxQb2ludD53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKHBvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBhdHRyaWJ1dGVzOiBhbnkgPSB7XHJcbiAgICAgICAgICAgIHg6IGdyaWRDbHVzdGVyLngsXHJcbiAgICAgICAgICAgIHk6IGdyaWRDbHVzdGVyLnksXHJcbiAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LFxyXG4gICAgICAgICAgICBpc0NsdXN0ZXI6IHRydWUsXHJcbiAgICAgICAgICAgIGNsdXN0ZXJPYmplY3Q6IGdyaWRDbHVzdGVyXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBhdHRyaWJ1dGVzLFxyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnRcclxuICAgICAgICB9KTtcclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbCA9IHRoaXMuY2x1c3RlclJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMpLnN5bWJvbDtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAwO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVySWQgPSBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljW1widWlkXCJdO1xyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuYXR0cmlidXRlcy5jbHVzdGVySWQgPSBjbHVzdGVyLmNsdXN0ZXJJZDtcclxuXHJcbiAgICAgICAgLy9hbHNvIGNyZWF0ZSBhIHRleHQgc3ltYm9sIHRvIGRpc3BsYXkgdGhlIGNsdXN0ZXIgY291bnRcclxuICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMudGV4dFN5bWJvbC5jbG9uZSgpO1xyXG4gICAgICAgIHRleHRTeW1ib2wudGV4dCA9IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudC50b1N0cmluZygpO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgdGV4dFN5bWJvbC5hbmdsZSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnQsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgIGlzQ2x1c3RlclRleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBpc1RleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVySWQ6IGNsdXN0ZXIuY2x1c3RlcklkXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN5bWJvbDogdGV4dFN5bWJvbFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvL2FkZCBhbiBhcmVhIGdyYXBoaWMgdG8gZGlzcGxheSB0aGUgYm91bmRzIG9mIHRoZSBjbHVzdGVyIGlmIGNvbmZpZ3VyZWQgdG9cclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgJiYgZ3JpZENsdXN0ZXIucG9pbnRzICYmIGdyaWRDbHVzdGVyLnBvaW50cy5sZW5ndGggPiAwKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgbXAgPSBuZXcgTXVsdGlwb2ludCgpO1xyXG4gICAgICAgICAgICBtcC5wb2ludHMgPSBncmlkQ2x1c3Rlci5wb2ludHM7XHJcbiAgICAgICAgICAgIGxldCBhcmVhOiBhbnkgPSBnZW9tZXRyeUVuZ2luZS5jb252ZXhIdWxsKG1wLCB0cnVlKTsgLy91c2UgY29udmV4IGh1bGwgb24gdGhlIHBvaW50cyB0byBnZXQgdGhlIGJvdW5kYXJ5XHJcblxyXG4gICAgICAgICAgICBsZXQgYXJlYUF0dHI6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgIHg6IGdyaWRDbHVzdGVyLngsXHJcbiAgICAgICAgICAgICAgICB5OiBncmlkQ2x1c3Rlci55LFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVySWQ6IGNsdXN0ZXIuY2x1c3RlcklkLFxyXG4gICAgICAgICAgICAgICAgaXNDbHVzdGVyQXJlYTogdHJ1ZVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoYXJlYS5yaW5ncyAmJiBhcmVhLnJpbmdzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGxldCBhcmVhUG9seSA9IG5ldyBQb2x5Z29uKCk7IC8vaGFkIHRvIGNyZWF0ZSBhIG5ldyBwb2x5Z29uIGFuZCBmaWxsIGl0IHdpdGggdGhlIHJpbmcgb2YgdGhlIGNhbGN1bGF0ZWQgYXJlYSBmb3IgU2NlbmVWaWV3IHRvIHdvcmsuXHJcbiAgICAgICAgICAgICAgICBhcmVhUG9seSA9IGFyZWFQb2x5LmFkZFJpbmcoYXJlYS5yaW5nc1swXSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFhcmVhUG9seS5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcmVhUG9seSA9IDxQb2x5Z29uPndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IoYXJlYVBvbHkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNsdXN0ZXIuYXJlYUdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7IGdlb21ldHJ5OiBhcmVhUG9seSwgYXR0cmlidXRlczogYXJlYUF0dHIgfSk7XHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyLmFyZWFHcmFwaGljLnN5bWJvbCA9IHRoaXMuYXJlYVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGNsdXN0ZXIuYXJlYUdyYXBoaWMpLnN5bWJvbDtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vYWRkIHRoZSBncmFwaGljcyBpbiBvcmRlciAgICAgICAgXHJcbiAgICAgICAgaWYgKGNsdXN0ZXIuYXJlYUdyYXBoaWMgJiYgdGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwiYWx3YXlzXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci5hcmVhR3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMpO1xyXG4gICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIudGV4dEdyYXBoaWMpO1xyXG5cclxuICAgICAgICB0aGlzLl9jbHVzdGVyc1tjbHVzdGVyLmNsdXN0ZXJJZF0gPSBjbHVzdGVyO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDbHVzdGVyR3JpZCh3ZWJFeHRlbnQ6IEV4dGVudCwgZXh0ZW50SXNVbmlvbmVkOiBib29sZWFuKSB7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSB0b3RhbCBhbW91bnQgb2YgZ3JpZCBzcGFjZXMgYmFzZWQgb24gdGhlIGhlaWdodCBhbmQgd2lkdGggb2YgdGhlIG1hcCAoZGl2aWRlIGl0IGJ5IGNsdXN0ZXJSYXRpbykgLSB0aGVuIGdldCB0aGUgZGVncmVlcyBmb3IgeCBhbmQgeSBcclxuICAgICAgICBsZXQgeENvdW50ID0gTWF0aC5yb3VuZCh0aGlzLl9hY3RpdmVWaWV3LndpZHRoIC8gdGhpcy5jbHVzdGVyUmF0aW8pO1xyXG4gICAgICAgIGxldCB5Q291bnQgPSBNYXRoLnJvdW5kKHRoaXMuX2FjdGl2ZVZpZXcuaGVpZ2h0IC8gdGhpcy5jbHVzdGVyUmF0aW8pO1xyXG5cclxuICAgICAgICAvL2lmIHRoZSBleHRlbnQgaGFzIGJlZW4gdW5pb25lZCBkdWUgdG8gbm9ybWFsaXphdGlvbiwgZG91YmxlIHRoZSBjb3VudCBvZiB4IGluIHRoZSBjbHVzdGVyIGdyaWQgYXMgdGhlIHVuaW9uaW5nIHdpbGwgaGFsdmUgaXQuXHJcbiAgICAgICAgaWYgKGV4dGVudElzVW5pb25lZCkge1xyXG4gICAgICAgICAgICB4Q291bnQgKj0gMjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB4dyA9ICh3ZWJFeHRlbnQueG1heCAtIHdlYkV4dGVudC54bWluKSAvIHhDb3VudDtcclxuICAgICAgICBsZXQgeWggPSAod2ViRXh0ZW50LnltYXggLSB3ZWJFeHRlbnQueW1pbikgLyB5Q291bnQ7XHJcblxyXG4gICAgICAgIGxldCBnc3htaW4sIGdzeG1heCwgZ3N5bWluLCBnc3ltYXg7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIGFuIGFycmF5IG9mIGNsdXN0ZXJzIHRoYXQgaXMgYSBncmlkIG92ZXIgdGhlIHZpc2libGUgZXh0ZW50LiBFYWNoIGNsdXN0ZXIgY29udGFpbnMgdGhlIGV4dGVudCAoaW4gd2ViIG1lcmMpIHRoYXQgYm91bmRzIHRoZSBncmlkIHNwYWNlIGZvciBpdC5cclxuICAgICAgICB0aGlzLl9ncmlkQ2x1c3RlcnMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHhDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGdzeG1pbiA9IHdlYkV4dGVudC54bWluICsgKHh3ICogaSk7XHJcbiAgICAgICAgICAgIGdzeG1heCA9IGdzeG1pbiArIHh3O1xyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHlDb3VudDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBnc3ltaW4gPSB3ZWJFeHRlbnQueW1pbiArICh5aCAqIGopO1xyXG4gICAgICAgICAgICAgICAgZ3N5bWF4ID0gZ3N5bWluICsgeWg7XHJcbiAgICAgICAgICAgICAgICBsZXQgZXh0ID0geyB4bWluOiBnc3htaW4sIHhtYXg6IGdzeG1heCwgeW1pbjogZ3N5bWluLCB5bWF4OiBnc3ltYXggfTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2dyaWRDbHVzdGVycy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICBleHRlbnQ6IGV4dCxcclxuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgc3ViVHlwZUNvdW50czogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgc2luZ2xlczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICB4OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6IDBcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYW4gc3ZnIHN1cmZhY2Ugb24gdGhlIHZpZXcgaWYgaXQgZG9lc24ndCBhbHJlYWR5IGV4aXN0XHJcbiAgICAgKiBAcGFyYW0gdmlld1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTdXJmYWNlKCkge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQucGFyZW50RWxlbWVudCB8fCB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnROb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9hY3RpdmVWaWV3LmNhbnZhcy5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgc3VyZmFjZSA9IGdmeC5jcmVhdGVTdXJmYWNlKHN1cmZhY2VQYXJlbnRFbGVtZW50LCBcIjBcIiwgXCIwXCIpO1xyXG4gICAgICAgIHN1cmZhY2UuY29udGFpbmVyR3JvdXAgPSBzdXJmYWNlLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgcG9zaXRpb246IFwiYWJzb2x1dGVcIiwgdG9wOiBcIjBcIiwgekluZGV4OiAtMSB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJ2aXNpYmxlXCIpO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJjbGFzc1wiLCBcImZjbC1zdXJmYWNlXCIpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZSA9IHN1cmZhY2U7XHJcblxyXG4gICAgICAgIC8vVGhpcyBpcyBhIGhhY2sgZm9yIElFICYgRWRnZS4gaGl0VGVzdCBvbiB0aGUgdmlldyBkb2Vzbid0IHBpY2sgdXAgYW55IHJlc3VsdHMgdW5sZXNzIHRoZSB6LWluZGV4IG9mIHRoZSBsYXllclZpZXcgY29udGFpbmVyIGlzIGF0IGxlYXN0IDEuIFNvIHNldCBpdCB0byAxLCBidXQgYWxzbyBoYXZlIHRvIHNldCB0aGUgLmVzcmktdWlcclxuICAgICAgICAvL2NvbnRhaW5lciB0byAyIG90aGVyd2lzZSBpdCBjYW4ndCBiZSBjbGlja2VkIG9uIGFzIGl0J3MgY292ZXJlZCBieSB0aGUgbGF5ZXIgdmlldyBjb250YWluZXIuIG1laCFcclxuICAgICAgICAvL3VzaW5nIGRvam8vc25pZmYgdG8gdGFyZ2V0IElFIGJyb3dzZXJzLlxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkICYmIChzbmlmZihcInRyaWRlbnRcIikgfHwgc25pZmYoXCJpZVwiKSB8fCBzbmlmZihcImVkZ2VcIikpKSB7XHJcbiAgICAgICAgICAgIGFsZXJ0KCdmaXhlcicpO1xyXG4gICAgICAgICAgICBkb21TdHlsZS5zZXQodGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQsIFwiei1pbmRleFwiLCBcIjFcIik7XHJcbiAgICAgICAgICAgIHF1ZXJ5KFwiLmVzcmktdWlcIikuZm9yRWFjaChmdW5jdGlvbiAobm9kZTogSFRNTEVsZW1lbnQsIGluZGV4KSB7XHJcbiAgICAgICAgICAgICAgICBkb21TdHlsZS5zZXQobm9kZSwgXCJ6LWluZGV4XCIsIFwiMlwiKTtcclxuICAgICAgICAgICAgfSk7IFxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF92aWV3UG9pbnRlck1vdmUoZXZ0KSB7XHJcblxyXG4gICAgICAgIGxldCBtb3VzZVBvcyA9IHRoaXMuX2dldE1vdXNlUG9zKGV2dCk7XHJcbiAgICAgICBcclxuICAgICAgICAvL2lmIHRoZXJlJ3MgYW4gYWN0aXZlIGNsdXN0ZXIgYW5kIHRoZSBjdXJyZW50IHNjcmVlbiBwb3MgaXMgd2l0aGluIHRoZSBib3VuZHMgb2YgdGhhdCBjbHVzdGVyJ3MgZ3JvdXAgY29udGFpbmVyLCBkb24ndCBkbyBhbnl0aGluZyBtb3JlLiBcclxuICAgICAgICAvL1RPRE86IHdvdWxkIHByb2JhYmx5IGJlIGJldHRlciB0byBjaGVjayBpZiB0aGUgcG9pbnQgaXMgaW4gdGhlIGFjdHVhbCBjaXJjbGUgb2YgdGhlIGNsdXN0ZXIgZ3JvdXAgYW5kIGl0J3MgZmxhcmVzIGluc3RlYWQgb2YgdXNpbmcgdGhlIHJlY3RhbmdsZSBib3VuZGluZyBib3guXHJcbiAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgbGV0IGJib3ggPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgICAgICBpZiAoYmJveCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG1vdXNlUG9zLnggPj0gYmJveC5sZWZ0ICYmIG1vdXNlUG9zLnggPD0gYmJveC5yaWdodCAmJiBtb3VzZVBvcy55ID49IGJib3gudG9wICYmIG1vdXNlUG9zLnkgPD0gYmJveC5ib3R0b20pIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHY6IE1hcFZpZXcgPSB0aGlzLl9hY3RpdmVWaWV3O1xyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3LmhpdFRlc3QobW91c2VQb3MpLnRoZW4oKHJlc3BvbnNlKSA9PiB7XHJcblxyXG4gICAgICAgICAgICBsZXQgZ3JhcGhpY3MgPSByZXNwb25zZS5yZXN1bHRzO1xyXG4gICAgICAgICAgICBpZiAoZ3JhcGhpY3MubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZ3JhcGhpY3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBnID0gZ3JhcGhpY3NbaV0uZ3JhcGhpYztcclxuICAgICAgICAgICAgICAgIGlmIChnICYmIChnLmF0dHJpYnV0ZXMuY2x1c3RlcklkICE9IG51bGwgJiYgIWcuYXR0cmlidXRlcy5pc0NsdXN0ZXJBcmVhKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBjbHVzdGVyID0gdGhpcy5fY2x1c3RlcnNbZy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZF07XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWN0aXZhdGVDbHVzdGVyKGNsdXN0ZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9hY3RpdmF0ZUNsdXN0ZXIoY2x1c3RlcjogQ2x1c3Rlcikge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ2x1c3RlciA9PT0gY2x1c3Rlcikge1xyXG4gICAgICAgICAgICByZXR1cm47IC8vYWxyZWFkeSBhY3RpdmVcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IGNsdXN0ZXI7XHJcbiAgICAgICAgdGhpcy5faW5pdFN1cmZhY2UoKTtcclxuICAgICAgICB0aGlzLl9pbml0Q2x1c3RlcigpO1xyXG4gICAgICAgIHRoaXMuX2luaXRGbGFyZXMoKTtcclxuXHJcbiAgICAgICAgdGhpcy5faGlkZUdyYXBoaWMoW3RoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWNdKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGVhY3RpdmF0ZUNsdXN0ZXIoKSB7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLl9zaG93R3JhcGhpYyhbdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpY10pO1xyXG4gICAgICAgIHRoaXMuX3JlbW92ZUNsYXNzRnJvbUVsZW1lbnQodGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIik7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhY3RpdmF0ZWRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9oaWRlR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX2NsZWFyU3VyZmFjZSgpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJERS1hY3RpdmF0ZSBjbHVzdGVyXCIpO1xyXG5cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdFN1cmZhY2UoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgc3BwOiBTY3JlZW5Qb2ludDtcclxuICAgICAgICBsZXQgc3A6IFNjcmVlblBvaW50ID0gdGhpcy5fYWN0aXZlVmlldy50b1NjcmVlbig8UG9pbnQ+dGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSwgc3BwKTtcclxuXHJcbiAgICAgICAgLy90b1NjcmVlbigpIHJldHVybnMgdGhlIHdyb25nIHZhbHVlIGZvciB4IGlmIGEgMmQgbWFwIGhhcyBiZWVuIHdyYXBwZWQgYXJvdW5kIHRoZSBnbG9iZS4gTmVlZCB0byBjaGVjayBhbmQgY2F0ZXIgZm9yIHRoaXMuIEkgdGhpbmsgdGhpcyBhIGJ1ZyBpbiB0aGUgYXBpLlxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHZhciB3c3cgPSB0aGlzLl9hY3RpdmVWaWV3LnN0YXRlLndvcmxkU2NyZWVuV2lkdGg7XHJcbiAgICAgICAgICAgIGxldCByYXRpbyA9IHBhcnNlSW50KChzcC54IC8gd3N3KS50b0ZpeGVkKDApKTsgLy9nZXQgYSByYXRpbyB0byBkZXRlcm1pbmUgaG93IG1hbnkgdGltZXMgdGhlIG1hcCBoYXMgYmVlbiB3cmFwcGVkIGFyb3VuZC5cclxuICAgICAgICAgICAgaWYgKHNwLnggPCAwKSB7XHJcbiAgICAgICAgICAgICAgICAvL3ggaXMgbGVzcyB0aGFuIDAsIFdURi4gTmVlZCB0byBhZGp1c3QgYnkgdGhlIHdvcmxkIHNjcmVlbiB3aWR0aC5cclxuICAgICAgICAgICAgICAgIHNwLnggKz0gd3N3ICogKHJhdGlvICogLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHNwLnggPiB3c3cpIHtcclxuICAgICAgICAgICAgICAgIC8veCBpcyB0b28gYmlnLCBXVEYgYXMgd2VsbCwgY2F0ZXIgZm9yIGl0LlxyXG4gICAgICAgICAgICAgICAgc3AueCAtPSB3c3cgKiByYXRpbztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZG9tU3R5bGUuc2V0KHN1cmZhY2UucmF3Tm9kZSwgeyB6SW5kZXg6IDExLCBvdmVyZmxvdzogXCJ2aXNpYmxlXCIsIHdpZHRoOiBcIjFweFwiLCBoZWlnaHQ6IFwiMXB4XCIsIGxlZnQ6IHNwLnggKyBcInB4XCIsIHRvcDogc3AueSArIFwicHhcIiB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJ2aXNpYmxlXCIpO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jbGVhclN1cmZhY2UoKSB7XHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgcXVlcnkoXCI+XCIsIHN1cmZhY2UuY29udGFpbmVyR3JvdXAucmF3Tm9kZSkuZm9yRWFjaChkb21Db25zdHJ1Y3QuZGVzdHJveSk7XHJcbiAgICAgICAgZG9tU3R5bGUuc2V0KHN1cmZhY2UucmF3Tm9kZSwgeyB6SW5kZXg6IC0xLCBvdmVyZmxvdzogXCJoaWRkZW5cIiwgdG9wOiBcIjBweFwiLCBsZWZ0OiBcIjBweFwiIH0pO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJvdmVyZmxvd1wiLCBcImhpZGRlblwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9pbml0Q2x1c3RlcigpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHJldHVybjtcclxuICAgICAgICBsZXQgc3VyZmFjZSA9IHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZTtcclxuICAgICAgICBpZiAoIXN1cmZhY2UpIHJldHVybjtcclxuXHJcbiAgICAgICAgLy93ZSdyZSBnb2luZyB0byByZXBsaWNhdGUgYSBjbHVzdGVyIGdyYXBoaWMgaW4gdGhlIHN2ZyBlbGVtZW50IHdlIGFkZGVkIHRvIHRoZSBsYXllciB2aWV3LiBKdXN0IHNvIGl0IGNhbiBiZSBzdHlsZWQgZWFzaWx5LiBOYXRpdmUgV2ViR0wgZm9yIFNjZW5lIFZpZXdzIHdvdWxkIHByb2JhYmx5IGJlIGJldHRlciwgYnV0IGF0IGxlYXN0IHRoaXMgd2F5IGNzcyBjYW4gc3RpbGwgYmUgdXNlZCB0byBzdHlsZS9hbmltYXRlIHRoaW5ncy5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCA9IHN1cmZhY2UuY29udGFpbmVyR3JvdXAuY3JlYXRlR3JvdXAoKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImNsdXN0ZXItZ3JvdXBcIik7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIHRoZSBjbHVzdGVyIHNoYXBlXHJcbiAgICAgICAgbGV0IGNsb25lZENsdXN0ZXJFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChjbG9uZWRDbHVzdGVyRWxlbWVudCwgXCJjbHVzdGVyXCIpO1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSB0aGUgY2x1c3RlciB0ZXh0IHNoYXBlXHJcbiAgICAgICAgbGV0IGNsb25lZFRleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChjbG9uZWRUZXh0RWxlbWVudCwgXCJjbHVzdGVyLXRleHRcIik7XHJcbiAgICAgICAgY2xvbmVkVGV4dEVsZW1lbnQuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGNsb25lZENsdXN0ZXJFbGVtZW50KTtcclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGNsb25lZFRleHRFbGVtZW50KTtcclxuXHJcbiAgICAgICAgLy9zZXQgdGhlIGdyb3VwIGNsYXNzICAgICBcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0RmxhcmVzKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlciB8fCAhdGhpcy5kaXNwbGF5RmxhcmVzKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBncmlkQ2x1c3RlciA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vY2hlY2sgaWYgd2UgbmVlZCB0byBjcmVhdGUgZmxhcmVzIGZvciB0aGUgY2x1c3RlclxyXG4gICAgICAgIGxldCBzaW5nbGVGbGFyZXMgPSAoZ3JpZENsdXN0ZXIuc2luZ2xlcyAmJiBncmlkQ2x1c3Rlci5zaW5nbGVzLmxlbmd0aCA+IDApICYmIChncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KTtcclxuICAgICAgICBsZXQgc3ViVHlwZUZsYXJlcyA9ICFzaW5nbGVGbGFyZXMgJiYgKGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMgJiYgZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5sZW5ndGggPiAwKTtcclxuXHJcbiAgICAgICAgaWYgKCFzaW5nbGVGbGFyZXMgJiYgIXN1YlR5cGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuOyAvL25vIGZsYXJlcyByZXF1aXJlZFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZsYXJlczogRmxhcmVbXSA9IFtdO1xyXG4gICAgICAgIGlmIChzaW5nbGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGdyaWRDbHVzdGVyLnNpbmdsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBmID0gbmV3IEZsYXJlKCk7XHJcbiAgICAgICAgICAgICAgICBmLnRvb2x0aXBUZXh0ID0gZ3JpZENsdXN0ZXIuc2luZ2xlc1tpXVt0aGlzLnNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5XTtcclxuICAgICAgICAgICAgICAgIGYuc2luZ2xlRGF0YSA9IGdyaWRDbHVzdGVyLnNpbmdsZXNbaV07XHJcbiAgICAgICAgICAgICAgICBmLmZsYXJlVGV4dCA9IFwiXCI7XHJcbiAgICAgICAgICAgICAgICBmbGFyZXMucHVzaChmKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChzdWJUeXBlRmxhcmVzKSB7XHJcblxyXG4gICAgICAgICAgICAvL3NvcnQgc3ViIHR5cGVzIGJ5IGhpZ2hlc3QgY291bnQgZmlyc3RcclxuICAgICAgICAgICAgdmFyIHN1YlR5cGVzID0gZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5jb3VudCAtIGEuY291bnQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN1YlR5cGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZiA9IG5ldyBGbGFyZSgpO1xyXG4gICAgICAgICAgICAgICAgZi50b29sdGlwVGV4dCA9IGAke3N1YlR5cGVzW2ldLm5hbWV9ICgke3N1YlR5cGVzW2ldLmNvdW50fSlgO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZVRleHQgPSBzdWJUeXBlc1tpXS5jb3VudDtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2lmIHRoZXJlIGFyZSBtb3JlIGZsYXJlIG9iamVjdHMgdG8gY3JlYXRlIHRoYW4gdGhlIG1heEZsYXJlQ291bnQgYW5kIHRoaXMgaXMgYSBvbmUgb2YgdGhvc2UgLSBjcmVhdGUgYSBzdW1tYXJ5IGZsYXJlIHRoYXQgY29udGFpbnMgJy4uLicgYXMgdGhlIHRleHQgYW5kIG1ha2UgdGhpcyBvbmUgcGFydCBvZiBpdCBcclxuICAgICAgICBsZXQgd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPSBmbGFyZXMubGVuZ3RoID4gdGhpcy5tYXhGbGFyZUNvdW50O1xyXG4gICAgICAgIGxldCBmbGFyZUNvdW50ID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPyB0aGlzLm1heEZsYXJlQ291bnQgOiBmbGFyZXMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvL2lmIHRoZXJlJ3MgYW4gZXZlbiBhbW91bnQgb2YgZmxhcmVzLCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgdG8gdGhlIGxlZnQsIG1pbnVzIDE4MCBmcm9tIGRlZ3JlZSB0byBkbyB0aGlzLlxyXG4gICAgICAgIC8vZm9yIGFuIGFkZCBhbW91bnQgcG9zaXRpb24gdGhlIGZpcnN0IGZsYXJlIG9uIHRvcCwgLTkwIHRvIGRvIHRoaXMuIExvb2tzIG1vcmUgc3ltbWV0cmljYWwgdGhpcyB3YXkuXHJcbiAgICAgICAgbGV0IGRlZ3JlZVZhcmlhbmNlID0gKGZsYXJlQ291bnQgJSAyID09PSAwKSA/IC0xODAgOiAtOTA7XHJcbiAgICAgICAgbGV0IHZpZXdSb3RhdGlvbiA9IHRoaXMuX2lzMmQgPyB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uIDogMDtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTY3JlZW5Qb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9TY3JlZW4oPFBvaW50PnRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnkpO1xyXG4gICAgICAgIGxldCBjbHVzdGVyU3ltYm9sU2l6ZSA9IDxudW1iZXI+dGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2wuZ2V0KFwic2l6ZVwiKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZsYXJlQ291bnQ7IGkrKykge1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlID0gZmxhcmVzW2ldO1xyXG5cclxuICAgICAgICAgICAgLy9zZXQgc29tZSBhdHRyaWJ1dGUgZGF0YVxyXG4gICAgICAgICAgICBsZXQgZmxhcmVBdHRyaWJ1dGVzID0ge1xyXG4gICAgICAgICAgICAgICAgaXNGbGFyZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzU3VtbWFyeUZsYXJlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0OiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgZmxhcmVUZXh0R3JhcGhpYzogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckdyYXBoaWNJZDogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudFxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlVGV4dEF0dHJpYnV0ZXMgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIC8vRG8gYSBjb3VwbGUgb2YgdGhpbmdzIGRpZmZlcmVudGx5IGlmIHRoaXMgaXMgYSBzdW1tYXJ5IGZsYXJlIG9yIG5vdFxyXG4gICAgICAgICAgICBsZXQgaXNTdW1tYXJ5RmxhcmUgPSB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSAmJiBpID49IHRoaXMubWF4RmxhcmVDb3VudCAtIDE7XHJcbiAgICAgICAgICAgIGlmIChpc1N1bW1hcnlGbGFyZSkge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuaXNTdW1tYXJ5ID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy5pc1N1bW1hcnlGbGFyZSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBsZXQgdG9vbHRpcFRleHQgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgLy9tdWx0aWxpbmUgdG9vbHRpcCBmb3Igc3VtbWFyeSBmbGFyZXMsIGllOiBncmVhdGVyIHRoYW4gdGhpcy5tYXhGbGFyZUNvdW50IGZsYXJlcyBwZXIgY2x1c3RlclxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IHRoaXMubWF4RmxhcmVDb3VudCAtIDEsIGpsZW4gPSBmbGFyZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHRpcFRleHQgKz0gaiA+ICh0aGlzLm1heEZsYXJlQ291bnQgLSAxKSA/IFwiXFxuXCIgOiBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGZsYXJlc1tqXS50b29sdGlwVGV4dDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRvb2x0aXBUZXh0ID0gdG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy50b29sdGlwVGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG5cclxuICAgICAgICAgICAgLy9jcmVhdGUgYSBncmFwaGljIGZvciB0aGUgZmxhcmUgYW5kIGZvciB0aGUgZmxhcmUgdGV4dFxyXG4gICAgICAgICAgICBmbGFyZS5ncmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlczogZmxhcmVBdHRyaWJ1dGVzLFxyXG4gICAgICAgICAgICAgICAgZ2VvbWV0cnk6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnksXHJcbiAgICAgICAgICAgICAgICBwb3B1cFRlbXBsYXRlOiBudWxsXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLl9nZXRGbGFyZVN5bWJvbChmbGFyZS5ncmFwaGljKTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBmbGFyZS5ncmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMDtcclxuICAgICAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgICAgIGlmIChmbGFyZS5mbGFyZVRleHQpIHtcclxuICAgICAgICAgICAgICAgIGxldCB0ZXh0U3ltYm9sID0gdGhpcy5mbGFyZVRleHRTeW1ib2wuY2xvbmUoKTtcclxuICAgICAgICAgICAgICAgIHRleHRTeW1ib2wudGV4dCA9ICFpc1N1bW1hcnlGbGFyZSA/IGZsYXJlLmZsYXJlVGV4dC50b1N0cmluZygpIDogXCIuLi5cIjtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dFN5bWJvbC5hbmdsZSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgZmxhcmUudGV4dEdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1RleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJHcmFwaGljSWQ6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlcklkXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzeW1ib2w6IHRleHRTeW1ib2wsXHJcbiAgICAgICAgICAgICAgICAgICAgZ2VvbWV0cnk6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnlcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2ZsYXJlcyBoYXZlIGJlZW4gY3JlYXRlZCBzbyBhZGQgdGhlbSB0byB0aGUgZG9tXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGZsYXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgZiA9IGZsYXJlc1tpXTtcclxuICAgICAgICAgICAgaWYgKCFmLmdyYXBoaWMpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgLy9jcmVhdGUgYSBncm91cCB0byBob2xkIGZsYXJlIG9iamVjdCBhbmQgdGV4dCBpZiBuZWVkZWQuIFxyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICAgICAgbGV0IHBvc2l0aW9uID0gdGhpcy5fc2V0RmxhcmVQb3NpdGlvbihmLmZsYXJlR3JvdXAsIGNsdXN0ZXJTeW1ib2xTaXplLCBmbGFyZUNvdW50LCBpLCBkZWdyZWVWYXJpYW5jZSwgdmlld1JvdGF0aW9uKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImZsYXJlLWdyb3VwXCIpO1xyXG4gICAgICAgICAgICBsZXQgZmxhcmVFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYuZ3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVFbGVtZW50KTtcclxuICAgICAgICAgICAgaWYgKGYudGV4dEdyYXBoaWMpIHtcclxuICAgICAgICAgICAgICAgIGxldCBmbGFyZVRleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYudGV4dEdyYXBoaWMsIGYuZmxhcmVHcm91cCk7XHJcbiAgICAgICAgICAgICAgICBmbGFyZVRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGZsYXJlVGV4dEVsZW1lbnQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIiwgMTApO1xyXG5cclxuICAgICAgICAgICAgLy9hc3NpZ24gc29tZSBldmVudCBoYW5kbGVycyBmb3IgdGhlIHRvb2x0aXBzXHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5tb3VzZUVudGVyID0gb24ucGF1c2FibGUoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwibW91c2VlbnRlclwiLCAoKSA9PiB0aGlzLl9jcmVhdGVUb29sdGlwKGYpKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLm1vdXNlTGVhdmUgPSBvbi5wYXVzYWJsZShmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJtb3VzZWxlYXZlXCIsICgpID0+IHRoaXMuX2Rlc3Ryb3lUb29sdGlwKCkpO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NldEZsYXJlUG9zaXRpb24oZmxhcmVHcm91cDogYW55LCBjbHVzdGVyU3ltYm9sU2l6ZTogbnVtYmVyLCBmbGFyZUNvdW50OiBudW1iZXIsIGZsYXJlSW5kZXg6IG51bWJlciwgZGVncmVlVmFyaWFuY2U6IG51bWJlciwgdmlld1JvdGF0aW9uOiBudW1iZXIpIHtcclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHBvc2l0aW9uIG9mIHRoZSBmbGFyZSB0byBiZSBwbGFjZWQgYXJvdW5kIHRoZSBjb250YWluZXIgY2lyY2xlLlxyXG4gICAgICAgIGxldCBkZWdyZWUgPSBwYXJzZUludCgoKDM2MCAvIGZsYXJlQ291bnQpICogZmxhcmVJbmRleCkudG9GaXhlZCgpKTtcclxuICAgICAgICBkZWdyZWUgPSBkZWdyZWUgKyBkZWdyZWVWYXJpYW5jZTtcclxuXHJcbiAgICAgICAgLy90YWtlIGludG8gYWNjb3VudCBhbnkgcm90YXRpb24gb24gdGhlIHZpZXdcclxuICAgICAgICBpZiAodmlld1JvdGF0aW9uICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGRlZ3JlZSAtPSB2aWV3Um90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmFkaWFuID0gZGVncmVlICogKE1hdGguUEkgLyAxODApO1xyXG4gICAgICAgIGxldCBidWZmZXIgPSB0aGlzLmZsYXJlQnVmZmVyUGl4ZWxzO1xyXG5cclxuICAgICAgICAvL3Bvc2l0aW9uIHRoZSBmbGFyZSBncm91cCBhcm91bmQgdGhlIGNsdXN0ZXJcclxuICAgICAgICBsZXQgcG9zaXRpb24gPSB7XHJcbiAgICAgICAgICAgIHg6IChidWZmZXIgKyBjbHVzdGVyU3ltYm9sU2l6ZSkgKiBNYXRoLmNvcyhyYWRpYW4pLFxyXG4gICAgICAgICAgICB5OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5zaW4ocmFkaWFuKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmxhcmVHcm91cC5zZXRUcmFuc2Zvcm0oeyBkeDogcG9zaXRpb24ueCwgZHk6IHBvc2l0aW9uLnkgfSk7XHJcbiAgICAgICAgcmV0dXJuIHBvc2l0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldEZsYXJlU3ltYm9sKGZsYXJlR3JhcGhpYzogR3JhcGhpYyk6IFNpbXBsZU1hcmtlclN5bWJvbCB7XHJcbiAgICAgICAgcmV0dXJuICF0aGlzLmZsYXJlUmVuZGVyZXIgPyB0aGlzLmZsYXJlU3ltYm9sIDogdGhpcy5mbGFyZVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGZsYXJlR3JhcGhpYykuc3ltYm9sO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZVRvb2x0aXAoZmxhcmU6IEZsYXJlKSB7XHJcblxyXG4gICAgICAgIGxldCBmbGFyZUdyb3VwID0gZmxhcmUuZmxhcmVHcm91cDtcclxuICAgICAgICB0aGlzLl9kZXN0cm95VG9vbHRpcCgpO1xyXG5cclxuICAgICAgICBsZXQgdG9vbHRpcExlbmd0aCA9IHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCBmbGFyZUdyb3VwLnJhd05vZGUpLmxlbmd0aDtcclxuICAgICAgICBpZiAodG9vbHRpcExlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHRleHQgZnJvbSB0aGUgZGF0YS10b29sdGlwIGF0dHJpYnV0ZSBvZiB0aGUgc2hhcGUgb2JqZWN0XHJcbiAgICAgICAgbGV0IHRleHQgPSBmbGFyZS50b29sdGlwVGV4dDtcclxuICAgICAgICBpZiAoIXRleHQpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJubyB0b29sdGlwIHRleHQgZm9yIGZsYXJlLlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9zcGxpdCBvbiBcXG4gY2hhcmFjdGVyIHRoYXQgc2hvdWxkIGJlIGluIHRvb2x0aXAgdG8gc2lnbmlmeSBtdWx0aXBsZSBsaW5lc1xyXG4gICAgICAgIGxldCBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIik7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIGEgZ3JvdXAgdG8gaG9sZCB0aGUgdG9vbHRpcCBlbGVtZW50c1xyXG4gICAgICAgIGxldCB0b29sdGlwR3JvdXAgPSBmbGFyZUdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSBmbGFyZSBzeW1ib2wsIHdlJ2xsIHVzZSB0aGlzIHRvIHN0eWxlIHRoZSB0b29sdGlwIGJveFxyXG4gICAgICAgIGxldCBmbGFyZVN5bWJvbCA9IHRoaXMuX2dldEZsYXJlU3ltYm9sKGZsYXJlLmdyYXBoaWMpO1xyXG5cclxuICAgICAgICAvL2FsaWduIG9uIHRvcCBmb3Igbm9ybWFsIGZsYXJlLCBhbGlnbiBvbiBib3R0b20gZm9yIHN1bW1hcnkgZmxhcmVzLlxyXG4gICAgICAgIGxldCBoZWlnaHQgPSBmbGFyZVN5bWJvbC5zaXplO1xyXG5cclxuICAgICAgICBsZXQgeFBvcyA9IDE7XHJcbiAgICAgICAgbGV0IHlQb3MgPSAhZmxhcmUuaXNTdW1tYXJ5ID8gKChoZWlnaHQpICogLTEpIDogaGVpZ2h0ICsgNTtcclxuXHJcbiAgICAgICAgdG9vbHRpcEdyb3VwLnJhd05vZGUuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJ0b29sdGlwLXRleHRcIik7XHJcbiAgICAgICAgbGV0IHRleHRTaGFwZXMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHJcbiAgICAgICAgICAgIGxldCB0ZXh0U2hhcGUgPSB0b29sdGlwR3JvdXAuY3JlYXRlVGV4dCh7IHg6IHhQb3MsIHk6IHlQb3MgKyAoaSAqIDEwKSwgdGV4dDogbGluZXNbaV0sIGFsaWduOiAnbWlkZGxlJyB9KVxyXG4gICAgICAgICAgICAgICAgLnNldEZpbGwodGhpcy5mbGFyZVRleHRTeW1ib2wuY29sb3IpXHJcbiAgICAgICAgICAgICAgICAuc2V0Rm9udCh7IHNpemU6IDEwLCBmYW1pbHk6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwiZmFtaWx5XCIpLCB3ZWlnaHQ6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwid2VpZ2h0XCIpIH0pO1xyXG5cclxuICAgICAgICAgICAgdGV4dFNoYXBlcy5wdXNoKHRleHRTaGFwZSk7XHJcbiAgICAgICAgICAgIHRleHRTaGFwZS5yYXdOb2RlLnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByZWN0UGFkZGluZyA9IDI7XHJcbiAgICAgICAgbGV0IHRleHRCb3ggPSB0b29sdGlwR3JvdXAuZ2V0Qm91bmRpbmdCb3goKTtcclxuXHJcbiAgICAgICAgbGV0IHJlY3RTaGFwZSA9IHRvb2x0aXBHcm91cC5jcmVhdGVSZWN0KHsgeDogdGV4dEJveC54IC0gcmVjdFBhZGRpbmcsIHk6IHRleHRCb3gueSAtIHJlY3RQYWRkaW5nLCB3aWR0aDogdGV4dEJveC53aWR0aCArIChyZWN0UGFkZGluZyAqIDIpLCBoZWlnaHQ6IHRleHRCb3guaGVpZ2h0ICsgKHJlY3RQYWRkaW5nICogMiksIHI6IDAgfSlcclxuICAgICAgICAgICAgLnNldEZpbGwoZmxhcmVTeW1ib2wuY29sb3IpO1xyXG5cclxuICAgICAgICBpZiAoZmxhcmVTeW1ib2wub3V0bGluZSkge1xyXG4gICAgICAgICAgICByZWN0U2hhcGUuc2V0U3Ryb2tlKHsgY29sb3I6IGZsYXJlU3ltYm9sLm91dGxpbmUuY29sb3IsIHdpZHRoOiAwLjUgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWN0U2hhcGUucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAubW92ZVRvRnJvbnQoKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGV4dFNoYXBlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICB0ZXh0U2hhcGVzW2ldLm1vdmVUb0Zyb250KCk7XHJcbiAgICAgICAgfSAgICAgICAgXHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2Rlc3Ryb3lUb29sdGlwKCkge1xyXG4gICAgICAgIHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UucmF3Tm9kZSkuZm9yRWFjaChkb21Db25zdHJ1Y3QuZGVzdHJveSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vI3JlZ2lvbiBoZWxwZXIgZnVuY3Rpb25zXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMsIHN1cmZhY2U6IGFueSk6IEhUTUxFbGVtZW50IHtcclxuXHJcbiAgICAgICAgLy9mYWtlIG91dCBhIEdGWE9iamVjdCBzbyB3ZSBjYW4gZ2VuZXJhdGUgYW4gc3ZnIHNoYXBlIHRoYXQgdGhlIHBhc3NlZCBpbiBncmFwaGljcyBzaGFwZVxyXG4gICAgICAgIGxldCBnID0gbmV3IEdGWE9iamVjdCgpO1xyXG4gICAgICAgIGcuZ3JhcGhpYyA9IGdyYXBoaWM7XHJcbiAgICAgICAgZy5yZW5kZXJpbmdJbmZvID0geyBzeW1ib2w6IGdyYXBoaWMuc3ltYm9sIH07XHJcblxyXG4gICAgICAgIC8vc2V0IHVwIHBhcmFtZXRlcnMgZm9yIHRoZSBjYWxsIHRvIHJlbmRlclxyXG4gICAgICAgIC8vc2V0IHRoZSB0cmFuc2Zvcm0gb2YgdGhlIHByb2plY3RvciB0byAwJ3MgYXMgd2UncmUganVzdCBwbGFjaW5nIHRoZSBnZW5lcmF0ZWQgY2x1c3RlciBzaGFwZSBhdCBleGFjdGx5IDAsMC5cclxuICAgICAgICBsZXQgcHJvamVjdG9yID0gbmV3IFByb2plY3RvcigpO1xyXG4gICAgICAgIHByb2plY3Rvci5fdHJhbnNmb3JtID0gWzAsIDAsIDAsIDAsIDAsIDBdO1xyXG4gICAgICAgIHByb2plY3Rvci5fcmVzb2x1dGlvbiA9IDA7XHJcblxyXG4gICAgICAgIGxldCBzdGF0ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICBzdGF0ZSA9IHRoaXMuX2FjdGl2ZVZpZXcuc3RhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL2Zha2Ugb3V0IGEgc3RhdGUgb2JqZWN0IGZvciAzZCB2aWV3cy5cclxuICAgICAgICAgICAgc3RhdGUgPSB7XHJcbiAgICAgICAgICAgICAgICBjbGlwcGVkRXh0ZW50OiB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCxcclxuICAgICAgICAgICAgICAgIHJvdGF0aW9uOiAwLFxyXG4gICAgICAgICAgICAgICAgc3BhdGlhbFJlZmVyZW5jZTogdGhpcy5fYWN0aXZlVmlldy5zcGF0aWFsUmVmZXJlbmNlLFxyXG4gICAgICAgICAgICAgICAgd29ybGRTY3JlZW5XaWR0aDogMVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHBhciA9IHtcclxuICAgICAgICAgICAgc3VyZmFjZTogc3VyZmFjZSxcclxuICAgICAgICAgICAgc3RhdGU6IHN0YXRlLFxyXG4gICAgICAgICAgICBwcm9qZWN0b3I6IHByb2plY3RvclxyXG4gICAgICAgIH07XHJcbiAgICAgICAgZy5yZW5kZXIocGFyKTtcclxuICAgICAgICByZXR1cm4gZy5fc2hhcGUucmF3Tm9kZTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfZXh0ZW50KCk6IEV4dGVudCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVZpZXcgPyB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zY2FsZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5zY2FsZSA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvL0lFIC8gRWRnZSBkb24ndCBoYXZlIHRoZSBjbGFzc0xpc3QgcHJvcGVydHkgb24gc3ZnIGVsZW1lbnRzLCBzbyB3ZSBjYW4ndCB1c2UgdGhhdCBhZGQgLyByZW1vdmUgY2xhc3NlcyAtIHByb2JhYmx5IHdoeSBkb2pvIGRvbUNsYXNzIGRvZXNuJ3Qgd29yayBlaXRoZXIuXHJcbiAgICAvL3NvIHRoZSBmb2xsb3dpbmcgdHdvIGZ1bmN0aW9ucyBhcmUgZG9kZ3kgc3RyaW5nIGhhY2tzIHRvIGFkZCAvIHJlbW92ZSBjbGFzc2VzLiBVc2VzIGEgdGltZW91dCBzbyB5b3UgY2FuIG1ha2UgY3NzIHRyYW5zaXRpb25zIHdvcmsgaWYgZGVzaXJlZC5cclxuICAgIHByaXZhdGUgX2FkZENsYXNzVG9FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCBhZGRDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgY3VycmVudENsYXNzID0gXCJcIjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgIT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIGxldCBuZXdDbGFzcyA9IChjdXJyZW50Q2xhc3MgKyBcIiBcIiArIF9jbGFzc05hbWUpLnRyaW0oKTtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgbmV3Q2xhc3MpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGFkZENsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9yZW1vdmVDbGFzc0Zyb21FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCByZW1vdmVDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgcmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudENsYXNzLmluZGV4T2YoXCIgXCIgKyBfY2xhc3NOYW1lKSA9PT0gLTEpIHJldHVybjtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgY3VycmVudENsYXNzLnJlcGxhY2UoXCIgXCIgKyBfY2xhc3NOYW1lLCBcIlwiKSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKHRpbWVvdXRNcykge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCB0aW1lb3V0TXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmVtb3ZlQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldE1vdXNlUG9zKGV2dCkge1xyXG4gICAgICAgIC8vY29udGFpbmVyIG9uIHRoZSB2aWV3IGlzIGFjdHVhbGx5IGEgaHRtbCBlbGVtZW50IGF0IHRoaXMgcG9pbnQsIG5vdCBhIHN0cmluZyBhcyB0aGUgdHlwaW5ncyBzdWdnZXN0LlxyXG4gICAgICAgIGxldCBjb250YWluZXI6IGFueSA9IHRoaXMuX2FjdGl2ZVZpZXcuY29udGFpbmVyO1xyXG4gICAgICAgIGxldCByZWN0ID0gY29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHg6IGV2dC54IC0gcmVjdC5sZWZ0LFxyXG4gICAgICAgICAgICB5OiBldnQueSAtIHJlY3QudG9wXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXR0aW5nIHZpc2libGUgdG8gZmFsc2Ugb24gYSBncmFwaGljIGRvZXNuJ3Qgd29yayBpbiA0LjIgZm9yIHNvbWUgcmVhc29uLiBSZW1vdmluZyB0aGUgZ3JhcGhpYyB0byBoaWRlIGl0IGluc3RlYWQuIEkgdGhpbmsgdmlzaWJsZSBwcm9wZXJ0eSBzaG91bGQgcHJvYmFibHkgd29yayB0aG91Z2guXHJcbiAgICAgKiBAcGFyYW0gZ3JhcGhpY1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9oaWRlR3JhcGhpYyhncmFwaGljOiBHcmFwaGljIHwgR3JhcGhpY1tdKSB7XHJcbiAgICAgICAgaWYgKCFncmFwaGljKSByZXR1cm47XHJcbiAgICAgICAgaWYgKGdyYXBoaWMuaGFzT3duUHJvcGVydHkoXCJsZW5ndGhcIikpIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNYW55KDxHcmFwaGljW10+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSg8R3JhcGhpYz5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2hvd0dyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYyB8IEdyYXBoaWNbXSkge1xyXG4gICAgICAgIGlmICghZ3JhcGhpYykgcmV0dXJuO1xyXG4gICAgICAgIGlmIChncmFwaGljLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkTWFueSg8R3JhcGhpY1tdPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5hZGQoPEdyYXBoaWM+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vI2VuZHJlZ2lvblxyXG5cclxufVxyXG5cclxuXHJcbi8vaW50ZXJmYWNlIEFjdGl2ZVZpZXcgZXh0ZW5kcyBNYXBWaWV3IGFuZCBTY2VuZVZpZXcgdG8gYWRkIHNvbWUgcHJvcGVydGllcyB7XHJcbmludGVyZmFjZSBBY3RpdmVWaWV3IGV4dGVuZHMgTWFwVmlldywgU2NlbmVWaWV3IHtcclxuICAgIGNhbnZhczogYW55O1xyXG4gICAgc3RhdGU6IGFueTtcclxuICAgIGZjbFN1cmZhY2U6IGFueTtcclxuICAgIGZjbFBvaW50ZXJNb3ZlOiBJSGFuZGxlO1xyXG4gICAgZmNsUG9pbnRlckRvd246IElIYW5kbGU7XHJcblxyXG4gICAgY29uc3RyYWludHM6IGFueTtcclxuICAgIGdvVG86ICh0YXJnZXQ6IGFueSwgb3B0aW9uczogX19lc3JpLk1hcFZpZXdHb1RvT3B0aW9ucykgPT4gSVByb21pc2U8YW55PjtcclxufVxyXG5cclxuY2xhc3MgR3JpZENsdXN0ZXIge1xyXG4gICAgZXh0ZW50OiBhbnk7XHJcbiAgICBjbHVzdGVyQ291bnQ6IG51bWJlcjtcclxuICAgIHN1YlR5cGVDb3VudHM6IGFueVtdID0gW107XHJcbiAgICBzaW5nbGVzOiBhbnlbXSA9IFtdO1xyXG4gICAgcG9pbnRzOiBhbnlbXSA9IFtdO1xyXG4gICAgeDogbnVtYmVyO1xyXG4gICAgeTogbnVtYmVyO1xyXG59XHJcblxyXG5cclxuY2xhc3MgQ2x1c3RlciB7XHJcbiAgICBjbHVzdGVyR3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRleHRHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgYXJlYUdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICBjbHVzdGVySWQ6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJHcm91cDogYW55O1xyXG4gICAgZ3JpZENsdXN0ZXI6IEdyaWRDbHVzdGVyO1xyXG59XHJcblxyXG5jbGFzcyBGbGFyZSB7XHJcbiAgICBncmFwaGljOiBHcmFwaGljO1xyXG4gICAgdGV4dEdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0b29sdGlwVGV4dDogc3RyaW5nO1xyXG4gICAgZmxhcmVUZXh0OiBzdHJpbmc7XHJcbiAgICBzaW5nbGVEYXRhOiBhbnlbXTtcclxuICAgIGZsYXJlR3JvdXA6IGFueTtcclxuICAgIGlzU3VtbWFyeTogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFBvaW50RmlsdGVyIHtcclxuICAgIGZpbHRlck5hbWU6IHN0cmluZztcclxuICAgIHByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG4gICAgcHJvcGVydHlWYWx1ZXM6IGFueVtdO1xyXG5cclxuICAgIC8vZGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBmaWx0ZXIgaW5jbHVkZXMgb3IgZXhjbHVkZXMgdGhlIHBvaW50IGRlcGVuZGluZyBvbiB3aGV0aGVyIGl0IGNvbnRhaW5zIHRoZSBwcm9wZXJ0eSB2YWx1ZS5cclxuICAgIC8vZmFsc2UgbWVhbnMgdGhlIHBvaW50IHdpbGwgYmUgZXhjbHVkZWQgaWYgdGhlIHZhbHVlIGRvZXMgZXhpc3QgaW4gdGhlIG9iamVjdCwgdHJ1ZSBtZWFucyBpdCB3aWxsIGJlIGV4Y2x1ZGVkIGlmIGl0IGRvZXNuJ3QuXHJcbiAgICBrZWVwT25seUlmVmFsdWVFeGlzdHM6IGJvb2xlYW47XHJcblxyXG4gICAgY29uc3RydWN0b3IoZmlsdGVyTmFtZTogc3RyaW5nLCBwcm9wZXJ0eU5hbWU6IHN0cmluZywgdmFsdWVzOiBhbnlbXSwga2VlcE9ubHlJZlZhbHVlRXhpc3RzOiBib29sZWFuID0gZmFsc2UpIHtcclxuICAgICAgICB0aGlzLmZpbHRlck5hbWUgPSBmaWx0ZXJOYW1lO1xyXG4gICAgICAgIHRoaXMucHJvcGVydHlOYW1lID0gcHJvcGVydHlOYW1lO1xyXG4gICAgICAgIHRoaXMucHJvcGVydHlWYWx1ZXMgPSB2YWx1ZXM7XHJcbiAgICAgICAgdGhpcy5rZWVwT25seUlmVmFsdWVFeGlzdHMgPSBrZWVwT25seUlmVmFsdWVFeGlzdHM7XHJcbiAgICB9XHJcblxyXG59XHJcblxyXG4iXX0=
