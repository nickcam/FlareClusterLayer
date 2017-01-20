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
define(["require", "exports", "esri/layers/GraphicsLayer", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/TextSymbol", "esri/symbols/SimpleLineSymbol", "esri/Color", 'esri/core/watchUtils', "esri/geometry/support/webMercatorUtils", "esri/Graphic", "esri/geometry/Point", "esri/geometry/Multipoint", "esri/geometry/Polygon", 'esri/geometry/geometryEngine', "esri/geometry/SpatialReference", "esri/views/2d/engine/graphics/GFXObject", "esri/views/2d/engine/graphics/Projector", "esri/core/accessorSupport/decorators", 'dojo/on', 'dojox/gfx', 'dojo/dom-construct', 'dojo/query', 'dojo/dom-attr', 'dojo/dom-style', 'dojo/sniff'], function (require, exports, GraphicsLayer, SimpleMarkerSymbol, TextSymbol, SimpleLineSymbol, Color, watchUtils, webMercatorUtils, Graphic, Point, Multipoint, Polygon, geometryEngine, SpatialReference, GFXObject, Projector, asd, on, gfx, domConstruct, query, domAttr, domStyle, sniff) {
    "use strict";
    //extend GraphicsLayer using 'accessorSupport/decorators'
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
            this.refreshOnStationary = options.refreshOnStationary === false ? false : true; //default to true
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
            __metadata('design:paramtypes', [Object])
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvRmxhcmVDbHVzdGVyTGF5ZXJfdjQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOENBQThDOzs7Ozs7Ozs7Ozs7Ozs7OztJQTZFOUMseURBQXlEO0lBRXpEO1FBQXVDLHFDQUEyQjtRQW9EOUQsMkJBQVksT0FBb0M7WUFwRHBELGlCQW9rQ0M7WUE5Z0NPLGtCQUFNLE9BQU8sQ0FBQyxDQUFDO1lBZlgsbUJBQWMsR0FBVyxDQUFDLENBQUM7WUFPM0IsY0FBUyxHQUFzQyxFQUFFLENBQUM7WUFVdEQsa0JBQWtCO1lBQ2xCLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDWCw2QkFBNkI7Z0JBQzdCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQztnQkFDakYsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUM7WUFFdkQsa0NBQWtDO1lBQ2xDLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUM7WUFDL0MsSUFBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxJQUFJLE9BQU8sQ0FBQztZQUN4RCxJQUFJLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQyxlQUFlLElBQUksQ0FBQyxDQUFDO1lBQ3BELElBQUksQ0FBQywwQkFBMEIsR0FBRyxPQUFPLENBQUMsMEJBQTBCLElBQUksTUFBTSxDQUFDO1lBQy9FLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLENBQUMsa0JBQWtCLEtBQUssTUFBTSxHQUFHLFNBQVMsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUM7WUFDN0csQ0FBQztZQUNELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxD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LENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQW9rQ2pFO0lBcGtDWSx5QkFBaUIsb0JBb2tDN0IsQ0FBQTtJQW1CRDtRQUFBO1lBR0ksa0JBQWEsR0FBVSxFQUFFLENBQUM7WUFDMUIsWUFBTyxHQUFVLEVBQUUsQ0FBQztZQUNwQixXQUFNLEdBQVUsRUFBRSxDQUFDO1FBR3ZCLENBQUM7UUFBRCxrQkFBQztJQUFELENBUkEsQUFRQyxJQUFBO0lBR0Q7UUFBQTtRQU9BLENBQUM7UUFBRCxjQUFDO0lBQUQsQ0FQQSxBQU9DLElBQUE7SUFFRDtRQUFBO1FBUUEsQ0FBQztRQUFELFlBQUM7SUFBRCxDQVJBLEFBUUMsSUFBQTtJQUVEO1FBU0kscUJBQVksVUFBa0IsRUFBRSxZQUFvQixFQUFFLE1BQWEsRUFBRSxxQkFBc0M7WUFBdEMscUNBQXNDLEdBQXRDLDZCQUFzQztZQUN2RyxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztZQUM3QixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztZQUNqQyxJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQztZQUM3QixJQUFJLENBQUMscUJBQXFCLEdBQUcscUJBQXFCLENBQUM7UUFDdkQsQ0FBQztRQUVMLGtCQUFDO0lBQUQsQ0FoQkEsQUFnQkMsSUFBQTtJQWhCWSxtQkFBVyxjQWdCdkIsQ0FBQSIsImZpbGUiOiJGbGFyZUNsdXN0ZXJMYXllcl92NC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxyXG5cclxuaW1wb3J0ICogYXMgR3JhcGhpY3NMYXllciBmcm9tIFwiZXNyaS9sYXllcnMvR3JhcGhpY3NMYXllclwiO1xyXG5pbXBvcnQgKiBhcyBDbGFzc0JyZWFrc1JlbmRlcmVyIGZyb20gXCJlc3JpL3JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyXCI7XHJcbmltcG9ydCAqIGFzIFBvcHVwVGVtcGxhdGUgZnJvbSBcImVzcmkvUG9wdXBUZW1wbGF0ZVwiO1xyXG5pbXBvcnQgKiBhcyBTaW1wbGVNYXJrZXJTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9TaW1wbGVNYXJrZXJTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgVGV4dFN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1RleHRTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgU2ltcGxlTGluZVN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1NpbXBsZUxpbmVTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgQ29sb3IgZnJvbSBcImVzcmkvQ29sb3JcIjtcclxuaW1wb3J0ICogYXMgd2F0Y2hVdGlscyBmcm9tICdlc3JpL2NvcmUvd2F0Y2hVdGlscyc7XHJcbmltcG9ydCAqIGFzIFZpZXcgZnJvbSAnZXNyaS92aWV3cy9WaWV3JztcclxuaW1wb3J0ICogYXMgd2ViTWVyY2F0b3JVdGlscyBmcm9tIFwiZXNyaS9nZW9tZXRyeS9zdXBwb3J0L3dlYk1lcmNhdG9yVXRpbHNcIjtcclxuaW1wb3J0ICogYXMgR3JhcGhpYyBmcm9tIFwiZXNyaS9HcmFwaGljXCI7XHJcbmltcG9ydCAqIGFzIFBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvaW50XCI7XHJcbmltcG9ydCAqIGFzIFNjcmVlblBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1NjcmVlblBvaW50XCI7XHJcbmltcG9ydCAqIGFzIE11bHRpcG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvTXVsdGlwb2ludFwiO1xyXG5pbXBvcnQgKiBhcyBQb2x5Z29uIGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvbHlnb25cIjtcclxuaW1wb3J0ICogYXMgZ2VvbWV0cnlFbmdpbmUgZnJvbSAnZXNyaS9nZW9tZXRyeS9nZW9tZXRyeUVuZ2luZSc7XHJcbmltcG9ydCAqIGFzIFNwYXRpYWxSZWZlcmVuY2UgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU3BhdGlhbFJlZmVyZW5jZVwiO1xyXG5pbXBvcnQgKiBhcyBFeHRlbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvRXh0ZW50XCI7XHJcbmltcG9ydCAqIGFzIE1hcFZpZXcgZnJvbSAnZXNyaS92aWV3cy9NYXBWaWV3JztcclxuaW1wb3J0ICogYXMgU2NlbmVWaWV3IGZyb20gJ2Vzcmkvdmlld3MvU2NlbmVWaWV3JztcclxuXHJcbmltcG9ydCAqIGFzIEdGWE9iamVjdCBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvR0ZYT2JqZWN0XCI7XHJcbmltcG9ydCAqIGFzIFByb2plY3RvciBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvUHJvamVjdG9yXCI7XHJcbiBcclxuaW1wb3J0ICogYXMgYXNkIGZyb20gXCJlc3JpL2NvcmUvYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnNcIjtcclxuXHJcbmltcG9ydCAqIGFzIG9uIGZyb20gJ2Rvam8vb24nO1xyXG5pbXBvcnQgKiBhcyBnZnggZnJvbSAnZG9qb3gvZ2Z4JztcclxuaW1wb3J0ICogYXMgZG9tQ29uc3RydWN0IGZyb20gJ2Rvam8vZG9tLWNvbnN0cnVjdCc7XHJcbmltcG9ydCAqIGFzIHF1ZXJ5IGZyb20gJ2Rvam8vcXVlcnknO1xyXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnZG9qby9kb20nO1xyXG5pbXBvcnQgKiBhcyBkb21BdHRyIGZyb20gJ2Rvam8vZG9tLWF0dHInO1xyXG5pbXBvcnQgKiBhcyBkb21TdHlsZSBmcm9tICdkb2pvL2RvbS1zdHlsZSc7XHJcbmltcG9ydCAqIGFzIHNuaWZmIGZyb20gJ2Rvam8vc25pZmYnO1xyXG4gXHJcbmludGVyZmFjZSBGbGFyZUNsdXN0ZXJMYXllclByb3BlcnRpZXMgZXh0ZW5kcyBfX2VzcmkuR3JhcGhpY3NMYXllclByb3BlcnRpZXMge1xyXG5cclxuICAgIGNsdXN0ZXJSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVSZW5kZXJlcj86IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbD86IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIGFyZWFSZW5kZXJlcj86IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzaW5nbGVQb3B1cFRlbXBsYXRlPzogUG9wdXBUZW1wbGF0ZTtcclxuICAgIHNwYXRpYWxSZWZlcmVuY2U/OiBTcGF0aWFsUmVmZXJlbmNlO1xyXG5cclxuICAgIGNsdXN0ZXJSYXRpbz86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJUb1NjYWxlPzogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50PzogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5Pzogc3RyaW5nO1xyXG5cclxuICAgIGRpc3BsYXlGbGFyZXM/OiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ/OiBudW1iZXI7XHJcbiAgICBzaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eT86IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sPzogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM/OiBudW1iZXI7XHJcbiAgICB0ZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbD86IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBzdWJUeXBlRmxhcmVQcm9wZXJ0eT86IHN0cmluZztcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgeVByb3BlcnR5TmFtZT86IHN0cmluZztcclxuICAgIHpQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcblxyXG4gICAgcmVmcmVzaE9uU3RhdGlvbmFyeT86IGJvb2xlYW47XHJcblxyXG4gICAgZmlsdGVycz86IFBvaW50RmlsdGVyW107XHJcblxyXG4gICAgZGF0YT86IGFueVtdO1xyXG5cclxufVxyXG5cclxuLy9leHRlbmQgR3JhcGhpY3NMYXllciB1c2luZyAnYWNjZXNzb3JTdXBwb3J0L2RlY29yYXRvcnMnXHJcbkBhc2Quc3ViY2xhc3MoXCJGbGFyZUNsdXN0ZXJMYXllclwiKVxyXG5leHBvcnQgY2xhc3MgRmxhcmVDbHVzdGVyTGF5ZXIgZXh0ZW5kcyBhc2QuZGVjbGFyZWQoR3JhcGhpY3NMYXllcikge1xyXG5cclxuICAgIHNpbmdsZVJlbmRlcmVyOiBhbnk7XHJcbiAgICBzaW5nbGVTeW1ib2w6IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIHNpbmdsZVBvcHVwVGVtcGxhdGU6IFBvcHVwVGVtcGxhdGU7XHJcblxyXG4gICAgY2x1c3RlclJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgYXJlYVJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgZmxhcmVSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzcGF0aWFsUmVmZXJlbmNlOiBTcGF0aWFsUmVmZXJlbmNlO1xyXG5cclxuICAgIGNsdXN0ZXJSYXRpbzogbnVtYmVyO1xyXG4gICAgY2x1c3RlclRvU2NhbGU6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJNaW5Db3VudDogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5OiBzdHJpbmc7XHJcblxyXG4gICAgZGlzcGxheUZsYXJlczogYm9vbGVhbjtcclxuICAgIG1heEZsYXJlQ291bnQ6IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ6IG51bWJlcjtcclxuICAgIHNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5OiBzdHJpbmc7XHJcbiAgICBmbGFyZVN5bWJvbDogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM6IG51bWJlcjtcclxuICAgIHRleHRTeW1ib2w6IFRleHRTeW1ib2w7XHJcbiAgICBmbGFyZVRleHRTeW1ib2w6IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlczogYm9vbGVhbjtcclxuICAgIHN1YlR5cGVGbGFyZVByb3BlcnR5OiBzdHJpbmc7XHJcblxyXG4gICAgcmVmcmVzaE9uU3RhdGlvbmFyeTogYm9vbGVhbjtcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB6UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcblxyXG4gICAgZmlsdGVyczogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBwcml2YXRlIF9ncmlkQ2x1c3RlcnM6IEdyaWRDbHVzdGVyW107XHJcbiAgICBwcml2YXRlIF9pc0NsdXN0ZXJlZDogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX2FjdGl2ZVZpZXc6IEFjdGl2ZVZpZXc7XHJcbiAgICBwcml2YXRlIF92aWV3TG9hZENvdW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIHByaXZhdGUgX3JlYWR5VG9EcmF3OiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkSW5pdGlhbERyYXc6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9kYXRhOiBhbnlbXTtcclxuICAgIHByaXZhdGUgX2lzMmQ6IGJvb2xlYW47XHJcblxyXG4gICAgcHJpdmF0ZSBfY2x1c3RlcnM6IHsgW2NsdXN0ZXJJZDogbnVtYmVyXTogQ2x1c3RlcjsgfSA9IHt9O1xyXG4gICAgcHJpdmF0ZSBfYWN0aXZlQ2x1c3RlcjogQ2x1c3RlcjtcclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXcyZDogYW55O1xyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3M2Q6IGFueTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zOiBGbGFyZUNsdXN0ZXJMYXllclByb3BlcnRpZXMpIHtcclxuXHJcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vc2V0IHRoZSBkZWZhdWx0c1xyXG4gICAgICAgIGlmICghb3B0aW9ucykge1xyXG4gICAgICAgICAgICAvL21pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyc1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiTWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzIHRvIGZsYXJlIGNsdXN0ZXIgbGF5ZXIgY29uc3RydWN0b3IuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuc2luZ2xlUG9wdXBUZW1wbGF0ZSA9IG9wdGlvbnMuc2luZ2xlUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgdGhlIGNsdXN0ZXJpbmcgcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclJhdGlvID0gb3B0aW9ucy5jbHVzdGVyUmF0aW8gfHwgNzU7XHJcbiAgICAgICAgdGhpcy5jbHVzdGVyVG9TY2FsZSA9IG9wdGlvbnMuY2x1c3RlclRvU2NhbGUgfHwgMjAwMDAwMDtcclxuICAgICAgICB0aGlzLmNsdXN0ZXJNaW5Db3VudCA9IG9wdGlvbnMuY2x1c3Rlck1pbkNvdW50IHx8IDI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eSA9IG9wdGlvbnMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHkgfHwgXCJuYW1lXCI7XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID0gb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwibm9uZVwiID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubWF4RmxhcmVDb3VudCA9IG9wdGlvbnMubWF4RmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCA9IG9wdGlvbnMubWF4U2luZ2xlRmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMuZGlzcGxheUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheUZsYXJlcyA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vZGVmYXVsdCB0byB0cnVlXHJcbiAgICAgICAgdGhpcy5kaXNwbGF5U3ViVHlwZUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheVN1YlR5cGVGbGFyZXMgPT09IHRydWU7XHJcbiAgICAgICAgdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eSA9IG9wdGlvbnMuc3ViVHlwZUZsYXJlUHJvcGVydHkgfHwgdW5kZWZpbmVkO1xyXG4gICAgICAgIHRoaXMuZmxhcmVCdWZmZXJQaXhlbHMgPSBvcHRpb25zLmZsYXJlQnVmZmVyUGl4ZWxzIHx8IDY7XHJcblxyXG4gICAgICAgIC8vZGF0YSBzZXQgcHJvcGVydHkgbmFtZXNcclxuICAgICAgICB0aGlzLnhQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnhQcm9wZXJ0eU5hbWUgfHwgXCJ4XCI7XHJcbiAgICAgICAgdGhpcy55UHJvcGVydHlOYW1lID0gb3B0aW9ucy55UHJvcGVydHlOYW1lIHx8IFwieVwiO1xyXG4gICAgICAgIHRoaXMuelByb3BlcnR5TmFtZSA9IG9wdGlvbnMuelByb3BlcnR5TmFtZSB8fCBcInpcIjtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgdGhlIHN5bWJvbG9neS9yZW5kZXJlciBwcm9wZXJ0aWVzXHJcbiAgICAgICAgdGhpcy5jbHVzdGVyUmVuZGVyZXIgPSBvcHRpb25zLmNsdXN0ZXJSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLmFyZWFSZW5kZXJlciA9IG9wdGlvbnMuYXJlYVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlUmVuZGVyZXIgPSBvcHRpb25zLnNpbmdsZVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlU3ltYm9sID0gb3B0aW9ucy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgdGhpcy5mbGFyZVJlbmRlcmVyID0gb3B0aW9ucy5mbGFyZVJlbmRlcmVyO1xyXG5cclxuICAgICAgICB0aGlzLnJlZnJlc2hPblN0YXRpb25hcnkgPSBvcHRpb25zLnJlZnJlc2hPblN0YXRpb25hcnkgPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlOyAvL2RlZmF1bHQgdG8gdHJ1ZVxyXG5cclxuICAgICAgICAvL2FkZCBzb21lIGRlZmF1bHQgc3ltYm9scyBvciB1c2UgdGhlIG9wdGlvbnMgdmFsdWVzLlxyXG4gICAgICAgIHRoaXMuZmxhcmVTeW1ib2wgPSBvcHRpb25zLmZsYXJlU3ltYm9sIHx8IG5ldyBTaW1wbGVNYXJrZXJTeW1ib2woe1xyXG4gICAgICAgICAgICBzaXplOiAxNCxcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMCwgMCwgMCwgMC41XSksXHJcbiAgICAgICAgICAgIG91dGxpbmU6IG5ldyBTaW1wbGVMaW5lU3ltYm9sKHsgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NSwgMC41XSksIHdpZHRoOiAxIH0pXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMudGV4dFN5bWJvbCA9IG9wdGlvbnMudGV4dFN5bWJvbCB8fCBuZXcgVGV4dFN5bWJvbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTVdKSxcclxuICAgICAgICAgICAgZm9udDoge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogMTAsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtM1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmZsYXJlVGV4dFN5bWJvbCA9IG9wdGlvbnMuZmxhcmVUZXh0U3ltYm9sIHx8IG5ldyBUZXh0U3ltYm9sKHtcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NV0pLFxyXG4gICAgICAgICAgICBmb250OiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiA2LFxyXG4gICAgICAgICAgICAgICAgZmFtaWx5OiBcImFyaWFsXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeW9mZnNldDogLTJcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy9pbml0aWFsIGRhdGFcclxuICAgICAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgdGhpcy5vbihcImxheWVydmlldy1jcmVhdGVcIiwgKGV2dCkgPT4gdGhpcy5fbGF5ZXJWaWV3Q3JlYXRlZChldnQpKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXdDcmVhdGVkKGV2dCkge1xyXG5cclxuICAgICAgICBpZiAoZXZ0LmxheWVyVmlldy52aWV3LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXcyZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXczZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2FkZCBhIHN0YXRpb25hcnkgd2F0Y2ggb24gdGhlIHZpZXcgdG8gcmVmcmVzaCBpZiBzcGVjaWZpZWQgaW4gb3B0aW9ucy5cclxuICAgICAgICBpZiAodGhpcy5yZWZyZXNoT25TdGF0aW9uYXJ5KSB7XHJcbiAgICAgICAgICAgIHdhdGNoVXRpbHMucGF1c2FibGUoZXZ0LmxheWVyVmlldy52aWV3LCBcInN0YXRpb25hcnlcIiwgKGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykgPT4gdGhpcy5fdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5fdmlld0xvYWRDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gZXZ0LmxheWVyVmlldy52aWV3O1xyXG5cclxuICAgICAgICAgICAgdGhpcy5fcmVhZHlUb0RyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkSW5pdGlhbERyYXcpIHtcclxuICAgICAgICAgICAgICAgIC8vd2UndmUgYmVlbiB3YWl0aW5nIGZvciB0aGlzIHRvIGhhcHBlbiB0byBkcmF3XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdmlld0xvYWRDb3VudCsrO1xyXG5cclxuXHJcbiAgICAgICAgaWYgKGV2dC5sYXllclZpZXcudmlldy50eXBlID09PSBcIjJkXCIpIHtcclxuICAgICAgICAgICAgLy9mb3IgbWFwIHZpZXdzLCB3YWl0IGZvciB0aGUgbGF5ZXJ2aWV3IG90IGJlIGF0dGFjaGVkLCBiZWZvcmUgYWRkaW5nIGV2ZW50c1xyXG4gICAgICAgICAgICB3YXRjaFV0aWxzLndoZW5UcnVlT25jZShldnQubGF5ZXJWaWV3LCBcImF0dGFjaGVkXCIsICgpID0+IHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy9mb3Igc2NlbmUgdmlld3MganVzdCBhZGQgdGhlIGV2ZW50cyBzdHJhaWdodCBhd2F5XHJcbiAgICAgICAgICAgIHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9hZGRWaWV3RXZlbnRzKGxheWVyVmlldzogYW55KSB7XHJcbiAgICAgICAgbGV0IHY6IEFjdGl2ZVZpZXcgPSBsYXllclZpZXcudmlldztcclxuICAgICAgICBpZiAoIXYuZmNsUG9pbnRlck1vdmUpIHtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb250YWluZXI6IEhUTUxFbGVtZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBpZiAodi50eXBlID09PSBcIjJkXCIpIHtcclxuICAgICAgICAgICAgICAgIC8vZm9yIGEgbWFwIHZpZXcgZ2V0IHRoZSBjb250YWluZXIgZWxlbWVudCBvZiB0aGUgbGF5ZXIgdmlldyB0byBhZGQgbW91c2Vtb3ZlIGV2ZW50IHRvLlxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gbGF5ZXJWaWV3LmNvbnRhaW5lci5lbGVtZW50O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy9mb3Igc2NlbmUgdmlldyBnZXQgdGhlIGNhbnZhcyBlbGVtZW50IHVuZGVyIHRoZSB2aWV3IGNvbnRhaW5lciB0byBhZGQgbW91c2Vtb3ZlIHRvLlxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gPEhUTUxFbGVtZW50PnF1ZXJ5KFwiY2FudmFzXCIsIHYuY29udGFpbmVyKVswXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy9BZGQgcG9pbnRlciBtb3ZlIGFuZCBwb2ludGVyIGRvd24uIFBvaW50ZXIgZG93biB0byBoYW5kbGUgdG91Y2ggZGV2aWNlcy5cclxuICAgICAgICAgICAgdi5mY2xQb2ludGVyTW92ZSA9IHYub24oXCJwb2ludGVyLW1vdmVcIiwgKGV2dCkgPT4gdGhpcy5fdmlld1BvaW50ZXJNb3ZlKGV2dCkpO1xyXG4gICAgICAgICAgICB2LmZjbFBvaW50ZXJEb3duID0gdi5vbihcInBvaW50ZXItZG93blwiLCAoZXZ0KSA9PiB0aGlzLl92aWV3UG9pbnRlck1vdmUoZXZ0KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF92aWV3U3RhdGlvbmFyeShpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpIHtcclxuXHJcbiAgICAgICAgaWYgKGlzU3RhdGlvbmFyeSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghaXNTdGF0aW9uYXJ5ICYmIHRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgLy9pZiBtb3ZpbmcgZGVhY3RpdmF0ZSBjbHVzdGVyO1xyXG4gICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgY2xlYXIoKSB7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVBbGwoKTtcclxuICAgICAgICB0aGlzLl9jbHVzdGVycyA9IHt9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBzZXREYXRhKGRhdGE6IGFueVtdLCBkcmF3RGF0YTogYm9vbGVhbiA9IHRydWUpIHtcclxuICAgICAgICB0aGlzLl9kYXRhID0gZGF0YTtcclxuICAgICAgICBpZiAoZHJhd0RhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGRyYXcoYWN0aXZlVmlldz86IGFueSkge1xyXG5cclxuICAgICAgICBpZiAoYWN0aXZlVmlldykge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gYWN0aXZlVmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vTm90IHJlYWR5IHRvIGRyYXcgeWV0IHNvIHF1ZXVlIG9uZSB1cFxyXG4gICAgICAgIGlmICghdGhpcy5fcmVhZHlUb0RyYXcpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkSW5pdGlhbERyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZVZpZXcgfHwgIXRoaXMuX2RhdGEpIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5faXMyZCA9IHRoaXMuX2FjdGl2ZVZpZXcudHlwZSA9PT0gXCIyZFwiO1xyXG5cclxuICAgICAgICAvL2NoZWNrIHRvIG1ha2Ugc3VyZSB3ZSBoYXZlIGFuIGFyZWEgcmVuZGVyZXIgc2V0IGlmIG9uZSBuZWVkcyB0byBiZVxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSAmJiAhdGhpcy5hcmVhUmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkZsYXJlQ2x1c3RlckxheWVyOiBhcmVhUmVuZGVyZXIgbXVzdCBiZSBzZXQgaWYgY2x1c3RlckFyZWFEaXNwbGF5IGlzIHNldC5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2xlYXIoKTtcclxuICAgICAgICBjb25zb2xlLnRpbWUoXCJkcmF3LWRhdGEtXCIgKyB0aGlzLl9hY3RpdmVWaWV3LnR5cGUpO1xyXG5cclxuICAgICAgICB0aGlzLl9pc0NsdXN0ZXJlZCA9IHRoaXMuY2x1c3RlclRvU2NhbGUgPCB0aGlzLl9zY2FsZSgpO1xyXG5cclxuICAgICAgICBsZXQgZ3JhcGhpY3M6IEdyYXBoaWNbXSA9IFtdO1xyXG5cclxuICAgICAgICAvL2dldCBhbiBleHRlbnQgdGhhdCBpcyBpbiB3ZWIgbWVyY2F0b3IgdG8gbWFrZSBzdXJlIGl0J3MgZmxhdCBmb3IgZXh0ZW50IGNoZWNraW5nXHJcbiAgICAgICAgLy9UaGUgd2ViZXh0ZW50IHdpbGwgbmVlZCB0byBiZSBub3JtYWxpemVkIHNpbmNlIHBhbm5pbmcgb3ZlciB0aGUgaW50ZXJuYXRpb25hbCBkYXRlbGluZSB3aWxsIGNhdXNlXHJcbiAgICAgICAgLy9jYXVzZSB0aGUgZXh0ZW50IHRvIHNoaWZ0IG91dHNpZGUgdGhlIC0xODAgdG8gMTgwIGRlZ3JlZSB3aW5kb3cuICBJZiB3ZSBkb24ndCBub3JtYWxpemUgdGhlbiB0aGVcclxuICAgICAgICAvL2NsdXN0ZXJzIHdpbGwgbm90IGJlIGRyYXduIGlmIHRoZSBtYXAgcGFucyBvdmVyIHRoZSBpbnRlcm5hdGlvbmFsIGRhdGVsaW5lLlxyXG4gICAgICAgIGxldCB3ZWJFeHRlbnQ6IGFueSA9ICF0aGlzLl9leHRlbnQoKS5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IgPyA8RXh0ZW50PndlYk1lcmNhdG9yVXRpbHMucHJvamVjdCh0aGlzLl9leHRlbnQoKSwgbmV3IFNwYXRpYWxSZWZlcmVuY2UoeyBcIndraWRcIjogMTAyMTAwIH0pKSA6IHRoaXMuX2V4dGVudCgpO1xyXG4gICAgICAgIGxldCBleHRlbnRJc1VuaW9uZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgbGV0IG5vcm1hbGl6ZWRXZWJFeHRlbnQgPSB3ZWJFeHRlbnQubm9ybWFsaXplKCk7XHJcbiAgICAgICAgd2ViRXh0ZW50ID0gbm9ybWFsaXplZFdlYkV4dGVudFswXTtcclxuICAgICAgICBpZiAobm9ybWFsaXplZFdlYkV4dGVudC5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgIHdlYkV4dGVudCA9IHdlYkV4dGVudC51bmlvbihub3JtYWxpemVkV2ViRXh0ZW50WzFdKTtcclxuICAgICAgICAgICAgZXh0ZW50SXNVbmlvbmVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVDbHVzdGVyR3JpZCh3ZWJFeHRlbnQsIGV4dGVudElzVW5pb25lZCk7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgbGV0IHdlYjogbnVtYmVyW10sIG9iajogYW55LCBkYXRhTGVuZ3RoID0gdGhpcy5fZGF0YS5sZW5ndGgsIHhWYWw6IG51bWJlciwgeVZhbDogbnVtYmVyO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YUxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG9iaiA9IHRoaXMuX2RhdGFbaV07XHJcblxyXG4gICAgICAgICAgICAvL2NoZWNrIGlmIGZpbHRlcnMgYXJlIHNwZWNpZmllZCBhbmQgY29udGludWUgaWYgdGhpcyBvYmplY3QgZG9lc24ndCBwYXNzXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fcGFzc2VzRmlsdGVyKG9iaikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB4VmFsID0gb2JqW3RoaXMueFByb3BlcnR5TmFtZV07XHJcbiAgICAgICAgICAgIHlWYWwgPSBvYmpbdGhpcy55UHJvcGVydHlOYW1lXTtcclxuXHJcbiAgICAgICAgICAgIC8vZ2V0IGEgd2ViIG1lcmMgbG5nL2xhdCBmb3IgZXh0ZW50IGNoZWNraW5nLiBVc2Ugd2ViIG1lcmMgYXMgaXQncyBmbGF0IHRvIGNhdGVyIGZvciBsb25naXR1ZGUgcG9sZVxyXG4gICAgICAgICAgICBpZiAodGhpcy5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgICAgIHdlYiA9IFt4VmFsLCB5VmFsXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHdlYiA9IHdlYk1lcmNhdG9yVXRpbHMubG5nTGF0VG9YWSh4VmFsLCB5VmFsKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy9jaGVjayBpZiB0aGUgb2JqIGlzIHZpc2libGUgaW4gdGhlIGV4dGVudCBiZWZvcmUgcHJvY2VlZGluZ1xyXG4gICAgICAgICAgICBpZiAoKHdlYlswXSA8PSB3ZWJFeHRlbnQueG1pbiB8fCB3ZWJbMF0gPiB3ZWJFeHRlbnQueG1heCkgfHwgKHdlYlsxXSA8PSB3ZWJFeHRlbnQueW1pbiB8fCB3ZWJbMV0gPiB3ZWJFeHRlbnQueW1heCkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAvL2xvb3AgY2x1c3RlciBncmlkIHRvIHNlZSBpZiBpdCBzaG91bGQgYmUgYWRkZWQgdG8gb25lXHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgakxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGogPCBqTGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2wgPSB0aGlzLl9ncmlkQ2x1c3RlcnNbal07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh3ZWJbMF0gPD0gY2wuZXh0ZW50LnhtaW4gfHwgd2ViWzBdID4gY2wuZXh0ZW50LnhtYXggfHwgd2ViWzFdIDw9IGNsLmV4dGVudC55bWluIHx8IHdlYlsxXSA+IGNsLmV4dGVudC55bWF4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvL25vdCBoZXJlIHNvIGNhcnJ5IG9uXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvL3JlY2FsYyB0aGUgeCBhbmQgeSBvZiB0aGUgY2x1c3RlciBieSBhdmVyYWdpbmcgdGhlIHBvaW50cyBhZ2FpblxyXG4gICAgICAgICAgICAgICAgICAgIGNsLnggPSBjbC5jbHVzdGVyQ291bnQgPiAwID8gKHhWYWwgKyAoY2wueCAqIGNsLmNsdXN0ZXJDb3VudCkpIC8gKGNsLmNsdXN0ZXJDb3VudCArIDEpIDogeFZhbDtcclxuICAgICAgICAgICAgICAgICAgICBjbC55ID0gY2wuY2x1c3RlckNvdW50ID4gMCA/ICh5VmFsICsgKGNsLnkgKiBjbC5jbHVzdGVyQ291bnQpKSAvIChjbC5jbHVzdGVyQ291bnQgKyAxKSA6IHlWYWw7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vcHVzaCBldmVyeSBwb2ludCBpbnRvIHRoZSBjbHVzdGVyIHNvIHdlIGhhdmUgaXQgZm9yIGFyZWEgZGlzcGxheSBpZiByZXF1aXJlZC4gVGhpcyBjb3VsZCBiZSBvbWl0dGVkIGlmIG5ldmVyIGNoZWNraW5nIGFyZWFzLCBvciBvbiBkZW1hbmQgYXQgbGVhc3RcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wucG9pbnRzLnB1c2goW3hWYWwsIHlWYWxdKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNsLmNsdXN0ZXJDb3VudCsrO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3ViVHlwZUV4aXN0cyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHMgPSAwLCBzTGVuID0gY2wuc3ViVHlwZUNvdW50cy5sZW5ndGg7IHMgPCBzTGVuOyBzKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsLnN1YlR5cGVDb3VudHNbc10ubmFtZSA9PT0gb2JqW3RoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzW3NdLmNvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJUeXBlRXhpc3RzID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXN1YlR5cGVFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc3ViVHlwZUNvdW50cy5wdXNoKHsgbmFtZTogb2JqW3RoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHldLCBjb3VudDogMSB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vYWRkIHRoZSBzaW5nbGUgZml4IHJlY29yZCBpZiBzdGlsbCB1bmRlciB0aGUgbWF4U2luZ2xlRmxhcmVDb3VudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbC5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnNpbmdsZXMucHVzaChvYmopO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc2luZ2xlcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvL25vdCBjbHVzdGVyZWQgc28ganVzdCBhZGQgZXZlcnkgb2JqXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVTaW5nbGUob2JqKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9ncmlkQ2x1c3RlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uY2x1c3RlckNvdW50IDwgdGhpcy5jbHVzdGVyTWluQ291bnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgamxlbiA9IHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5zaW5nbGVzLmxlbmd0aDsgaiA8IGpsZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVTaW5nbGUodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLnNpbmdsZXNbal0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5jbHVzdGVyQ291bnQgPiAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlQ2x1c3Rlcih0aGlzLl9ncmlkQ2x1c3RlcnNbaV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2VtaXQgYW4gZXZlbnQgdG8gc2lnbmFsIGRyYXdpbmcgaXMgY29tcGxldGUuXHJcbiAgICAgICAgdGhpcy5lbWl0KFwiZHJhdy1jb21wbGV0ZVwiLCB7fSk7XHJcbiAgICAgICAgY29uc29sZS50aW1lRW5kKGBkcmF3LWRhdGEtJHt0aGlzLl9hY3RpdmVWaWV3LnR5cGV9YCk7XHJcblxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVTdXJmYWNlKCk7XHJcbiAgICAgICAgfSwgMTApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Bhc3Nlc0ZpbHRlcihvYmo6IGFueSk6IGJvb2xlYW4ge1xyXG4gICAgICAgIGlmICghdGhpcy5maWx0ZXJzIHx8IHRoaXMuZmlsdGVycy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgICAgIGxldCBwYXNzZXMgPSB0cnVlO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmZpbHRlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRoaXMuZmlsdGVyc1tpXTtcclxuICAgICAgICAgICAgaWYgKG9ialtmaWx0ZXIucHJvcGVydHlOYW1lXSA9PSBudWxsKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGxldCB2YWxFeGlzdHMgPSBmaWx0ZXIucHJvcGVydHlWYWx1ZXMuaW5kZXhPZihvYmpbZmlsdGVyLnByb3BlcnR5TmFtZV0pICE9PSAtMTtcclxuICAgICAgICAgICAgaWYgKHZhbEV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcGFzc2VzID0gZmlsdGVyLmtlZXBPbmx5SWZWYWx1ZUV4aXN0czsgLy90aGUgdmFsdWUgZXhpc3RzIHNvIHJldHVybiB3aGV0aGVyIHdlIHNob3VsZCBiZSBrZWVwaW5nIGl0IG9yIG5vdC5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmICghdmFsRXhpc3RzICYmIGZpbHRlci5rZWVwT25seUlmVmFsdWVFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIHBhc3NlcyA9IGZhbHNlOyAvL3JldHVybiBmYWxzZSBhcyB0aGUgdmFsdWUgZG9lc24ndCBleGlzdCwgYW5kIHdlIHNob3VsZCBvbmx5IGJlIGtlZXBpbmcgcG9pbnQgb2JqZWN0cyB3aGVyZSBpdCBkb2VzIGV4aXN0LlxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIXBhc3NlcykgcmV0dXJuIGZhbHNlOyAvL2lmIGl0IGhhc24ndCBwYXNzZWQgYW55IG9mIHRoZSBmaWx0ZXJzIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBwYXNzZXM7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlU2luZ2xlKG9iaikge1xyXG4gICAgICAgIGxldCBwb2ludCA9IG5ldyBQb2ludCh7XHJcbiAgICAgICAgICAgIHg6IG9ialt0aGlzLnhQcm9wZXJ0eU5hbWVdLCB5OiBvYmpbdGhpcy55UHJvcGVydHlOYW1lXSwgejogb2JqW3RoaXMuelByb3BlcnR5TmFtZV1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKCFwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHBvaW50LFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBvYmpcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgZ3JhcGhpYy5wb3B1cFRlbXBsYXRlID0gdGhpcy5zaW5nbGVQb3B1cFRlbXBsYXRlO1xyXG4gICAgICAgIGlmICh0aGlzLnNpbmdsZVJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIGxldCBzeW1ib2wgPSB0aGlzLnNpbmdsZVJlbmRlcmVyLmdldFN5bWJvbChncmFwaGljLCB0aGlzLl9hY3RpdmVWaWV3KTtcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSBzeW1ib2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHRoaXMuc2luZ2xlU3ltYm9sKSB7XHJcbiAgICAgICAgICAgIGdyYXBoaWMuc3ltYm9sID0gdGhpcy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL25vIHN5bWJvbG9neSBmb3Igc2luZ2xlcyBkZWZpbmVkLCB1c2UgdGhlIGRlZmF1bHQgc3ltYm9sIGZyb20gdGhlIGNsdXN0ZXIgcmVuZGVyZXJcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLmNsdXN0ZXJSZW5kZXJlci5kZWZhdWx0U3ltYm9sO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5hZGQoZ3JhcGhpYyk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsdXN0ZXIoZ3JpZENsdXN0ZXI6IEdyaWRDbHVzdGVyKSB7XHJcblxyXG4gICAgICAgIGxldCBjbHVzdGVyID0gbmV3IENsdXN0ZXIoKTtcclxuICAgICAgICBjbHVzdGVyLmdyaWRDbHVzdGVyID0gZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vbWFrZSBzdXJlIGFsbCBnZW9tZXRyaWVzIGFkZGVkIHRvIEdyYXBoaWMgb2JqZWN0cyBhcmUgaW4gd2ViIG1lcmNhdG9yIG90aGVyd2lzZSB3cmFwIGFyb3VuZCBkb2Vzbid0IHdvcmsuXHJcbiAgICAgICAgbGV0IHBvaW50ID0gbmV3IFBvaW50KHsgeDogZ3JpZENsdXN0ZXIueCwgeTogZ3JpZENsdXN0ZXIueSB9KTtcclxuICAgICAgICBpZiAoIXBvaW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBwb2ludCA9IDxQb2ludD53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKHBvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBhdHRyaWJ1dGVzOiBhbnkgPSB7XHJcbiAgICAgICAgICAgIHg6IGdyaWRDbHVzdGVyLngsXHJcbiAgICAgICAgICAgIHk6IGdyaWRDbHVzdGVyLnksXHJcbiAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LFxyXG4gICAgICAgICAgICBpc0NsdXN0ZXI6IHRydWUsXHJcbiAgICAgICAgICAgIGNsdXN0ZXJPYmplY3Q6IGdyaWRDbHVzdGVyXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBhdHRyaWJ1dGVzLFxyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnRcclxuICAgICAgICB9KTtcclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbCA9IHRoaXMuY2x1c3RlclJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMpLnN5bWJvbDtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAwO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVySWQgPSBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljW1widWlkXCJdO1xyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuYXR0cmlidXRlcy5jbHVzdGVySWQgPSBjbHVzdGVyLmNsdXN0ZXJJZDtcclxuXHJcbiAgICAgICAgLy9hbHNvIGNyZWF0ZSBhIHRleHQgc3ltYm9sIHRvIGRpc3BsYXkgdGhlIGNsdXN0ZXIgY291bnRcclxuICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMudGV4dFN5bWJvbC5jbG9uZSgpO1xyXG4gICAgICAgIHRleHRTeW1ib2wudGV4dCA9IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudC50b1N0cmluZygpO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgdGV4dFN5bWJvbC5hbmdsZSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnQsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgIGlzQ2x1c3RlclRleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBpc1RleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVySWQ6IGNsdXN0ZXIuY2x1c3RlcklkXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN5bWJvbDogdGV4dFN5bWJvbFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvL2FkZCBhbiBhcmVhIGdyYXBoaWMgdG8gZGlzcGxheSB0aGUgYm91bmRzIG9mIHRoZSBjbHVzdGVyIGlmIGNvbmZpZ3VyZWQgdG9cclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgJiYgZ3JpZENsdXN0ZXIucG9pbnRzICYmIGdyaWRDbHVzdGVyLnBvaW50cy5sZW5ndGggPiAwKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgbXAgPSBuZXcgTXVsdGlwb2ludCgpO1xyXG4gICAgICAgICAgICBtcC5wb2ludHMgPSBncmlkQ2x1c3Rlci5wb2ludHM7XHJcbiAgICAgICAgICAgIGxldCBhcmVhOiBhbnkgPSBnZW9tZXRyeUVuZ2luZS5jb252ZXhIdWxsKG1wLCB0cnVlKTsgLy91c2UgY29udmV4IGh1bGwgb24gdGhlIHBvaW50cyB0byBnZXQgdGhlIGJvdW5kYXJ5XHJcblxyXG4gICAgICAgICAgICBsZXQgYXJlYUF0dHI6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgIHg6IGdyaWRDbHVzdGVyLngsXHJcbiAgICAgICAgICAgICAgICB5OiBncmlkQ2x1c3Rlci55LFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVySWQ6IGNsdXN0ZXIuY2x1c3RlcklkLFxyXG4gICAgICAgICAgICAgICAgaXNDbHVzdGVyQXJlYTogdHJ1ZVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoYXJlYS5yaW5ncyAmJiBhcmVhLnJpbmdzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGxldCBhcmVhUG9seSA9IG5ldyBQb2x5Z29uKCk7IC8vaGFkIHRvIGNyZWF0ZSBhIG5ldyBwb2x5Z29uIGFuZCBmaWxsIGl0IHdpdGggdGhlIHJpbmcgb2YgdGhlIGNhbGN1bGF0ZWQgYXJlYSBmb3IgU2NlbmVWaWV3IHRvIHdvcmsuXHJcbiAgICAgICAgICAgICAgICBhcmVhUG9seSA9IGFyZWFQb2x5LmFkZFJpbmcoYXJlYS5yaW5nc1swXSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFhcmVhUG9seS5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcmVhUG9seSA9IDxQb2x5Z29uPndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IoYXJlYVBvbHkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNsdXN0ZXIuYXJlYUdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7IGdlb21ldHJ5OiBhcmVhUG9seSwgYXR0cmlidXRlczogYXJlYUF0dHIgfSk7XHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyLmFyZWFHcmFwaGljLnN5bWJvbCA9IHRoaXMuYXJlYVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGNsdXN0ZXIuYXJlYUdyYXBoaWMpLnN5bWJvbDtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vYWRkIHRoZSBncmFwaGljcyBpbiBvcmRlciAgICAgICAgXHJcbiAgICAgICAgaWYgKGNsdXN0ZXIuYXJlYUdyYXBoaWMgJiYgdGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwiYWx3YXlzXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci5hcmVhR3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMpO1xyXG4gICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIudGV4dEdyYXBoaWMpO1xyXG5cclxuICAgICAgICB0aGlzLl9jbHVzdGVyc1tjbHVzdGVyLmNsdXN0ZXJJZF0gPSBjbHVzdGVyO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDbHVzdGVyR3JpZCh3ZWJFeHRlbnQ6IEV4dGVudCwgZXh0ZW50SXNVbmlvbmVkOiBib29sZWFuKSB7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSB0b3RhbCBhbW91bnQgb2YgZ3JpZCBzcGFjZXMgYmFzZWQgb24gdGhlIGhlaWdodCBhbmQgd2lkdGggb2YgdGhlIG1hcCAoZGl2aWRlIGl0IGJ5IGNsdXN0ZXJSYXRpbykgLSB0aGVuIGdldCB0aGUgZGVncmVlcyBmb3IgeCBhbmQgeSBcclxuICAgICAgICBsZXQgeENvdW50ID0gTWF0aC5yb3VuZCh0aGlzLl9hY3RpdmVWaWV3LndpZHRoIC8gdGhpcy5jbHVzdGVyUmF0aW8pO1xyXG4gICAgICAgIGxldCB5Q291bnQgPSBNYXRoLnJvdW5kKHRoaXMuX2FjdGl2ZVZpZXcuaGVpZ2h0IC8gdGhpcy5jbHVzdGVyUmF0aW8pO1xyXG5cclxuICAgICAgICAvL2lmIHRoZSBleHRlbnQgaGFzIGJlZW4gdW5pb25lZCBkdWUgdG8gbm9ybWFsaXphdGlvbiwgZG91YmxlIHRoZSBjb3VudCBvZiB4IGluIHRoZSBjbHVzdGVyIGdyaWQgYXMgdGhlIHVuaW9uaW5nIHdpbGwgaGFsdmUgaXQuXHJcbiAgICAgICAgaWYgKGV4dGVudElzVW5pb25lZCkge1xyXG4gICAgICAgICAgICB4Q291bnQgKj0gMjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB4dyA9ICh3ZWJFeHRlbnQueG1heCAtIHdlYkV4dGVudC54bWluKSAvIHhDb3VudDtcclxuICAgICAgICBsZXQgeWggPSAod2ViRXh0ZW50LnltYXggLSB3ZWJFeHRlbnQueW1pbikgLyB5Q291bnQ7XHJcblxyXG4gICAgICAgIGxldCBnc3htaW4sIGdzeG1heCwgZ3N5bWluLCBnc3ltYXg7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIGFuIGFycmF5IG9mIGNsdXN0ZXJzIHRoYXQgaXMgYSBncmlkIG92ZXIgdGhlIHZpc2libGUgZXh0ZW50LiBFYWNoIGNsdXN0ZXIgY29udGFpbnMgdGhlIGV4dGVudCAoaW4gd2ViIG1lcmMpIHRoYXQgYm91bmRzIHRoZSBncmlkIHNwYWNlIGZvciBpdC5cclxuICAgICAgICB0aGlzLl9ncmlkQ2x1c3RlcnMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHhDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGdzeG1pbiA9IHdlYkV4dGVudC54bWluICsgKHh3ICogaSk7XHJcbiAgICAgICAgICAgIGdzeG1heCA9IGdzeG1pbiArIHh3O1xyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHlDb3VudDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBnc3ltaW4gPSB3ZWJFeHRlbnQueW1pbiArICh5aCAqIGopO1xyXG4gICAgICAgICAgICAgICAgZ3N5bWF4ID0gZ3N5bWluICsgeWg7XHJcbiAgICAgICAgICAgICAgICBsZXQgZXh0ID0geyB4bWluOiBnc3htaW4sIHhtYXg6IGdzeG1heCwgeW1pbjogZ3N5bWluLCB5bWF4OiBnc3ltYXggfTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2dyaWRDbHVzdGVycy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICBleHRlbnQ6IGV4dCxcclxuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgc3ViVHlwZUNvdW50czogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgc2luZ2xlczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICB4OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6IDBcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYW4gc3ZnIHN1cmZhY2Ugb24gdGhlIHZpZXcgaWYgaXQgZG9lc24ndCBhbHJlYWR5IGV4aXN0XHJcbiAgICAgKiBAcGFyYW0gdmlld1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTdXJmYWNlKCkge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQucGFyZW50RWxlbWVudCB8fCB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnROb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9hY3RpdmVWaWV3LmNhbnZhcy5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgc3VyZmFjZSA9IGdmeC5jcmVhdGVTdXJmYWNlKHN1cmZhY2VQYXJlbnRFbGVtZW50LCBcIjBcIiwgXCIwXCIpO1xyXG4gICAgICAgIHN1cmZhY2UuY29udGFpbmVyR3JvdXAgPSBzdXJmYWNlLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgcG9zaXRpb246IFwiYWJzb2x1dGVcIiwgdG9wOiBcIjBcIiwgekluZGV4OiAtMSB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJ2aXNpYmxlXCIpO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJjbGFzc1wiLCBcImZjbC1zdXJmYWNlXCIpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZSA9IHN1cmZhY2U7XHJcblxyXG4gICAgICAgIC8vVGhpcyBpcyBhIGhhY2sgZm9yIElFICYgRWRnZS4gaGl0VGVzdCBvbiB0aGUgdmlldyBkb2Vzbid0IHBpY2sgdXAgYW55IHJlc3VsdHMgdW5sZXNzIHRoZSB6LWluZGV4IG9mIHRoZSBsYXllclZpZXcgY29udGFpbmVyIGlzIGF0IGxlYXN0IDEuIFNvIHNldCBpdCB0byAxLCBidXQgYWxzbyBoYXZlIHRvIHNldCB0aGUgLmVzcmktdWlcclxuICAgICAgICAvL2NvbnRhaW5lciB0byAyIG90aGVyd2lzZSBpdCBjYW4ndCBiZSBjbGlja2VkIG9uIGFzIGl0J3MgY292ZXJlZCBieSB0aGUgbGF5ZXIgdmlldyBjb250YWluZXIuIG1laCFcclxuICAgICAgICAvL3VzaW5nIGRvam8vc25pZmYgdG8gdGFyZ2V0IElFIGJyb3dzZXJzLlxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkICYmIChzbmlmZihcInRyaWRlbnRcIikgfHwgc25pZmYoXCJpZVwiKSB8fCBzbmlmZihcImVkZ2VcIikpKSB7XHJcbiAgICAgICAgICAgIGFsZXJ0KCdmaXhlcicpO1xyXG4gICAgICAgICAgICBkb21TdHlsZS5zZXQodGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQsIFwiei1pbmRleFwiLCBcIjFcIik7XHJcbiAgICAgICAgICAgIHF1ZXJ5KFwiLmVzcmktdWlcIikuZm9yRWFjaChmdW5jdGlvbiAobm9kZTogSFRNTEVsZW1lbnQsIGluZGV4KSB7XHJcbiAgICAgICAgICAgICAgICBkb21TdHlsZS5zZXQobm9kZSwgXCJ6LWluZGV4XCIsIFwiMlwiKTtcclxuICAgICAgICAgICAgfSk7IFxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF92aWV3UG9pbnRlck1vdmUoZXZ0KSB7XHJcblxyXG4gICAgICAgIGxldCBtb3VzZVBvcyA9IHRoaXMuX2dldE1vdXNlUG9zKGV2dCk7XHJcbiAgICAgICBcclxuICAgICAgICAvL2lmIHRoZXJlJ3MgYW4gYWN0aXZlIGNsdXN0ZXIgYW5kIHRoZSBjdXJyZW50IHNjcmVlbiBwb3MgaXMgd2l0aGluIHRoZSBib3VuZHMgb2YgdGhhdCBjbHVzdGVyJ3MgZ3JvdXAgY29udGFpbmVyLCBkb24ndCBkbyBhbnl0aGluZyBtb3JlLiBcclxuICAgICAgICAvL1RPRE86IHdvdWxkIHByb2JhYmx5IGJlIGJldHRlciB0byBjaGVjayBpZiB0aGUgcG9pbnQgaXMgaW4gdGhlIGFjdHVhbCBjaXJjbGUgb2YgdGhlIGNsdXN0ZXIgZ3JvdXAgYW5kIGl0J3MgZmxhcmVzIGluc3RlYWQgb2YgdXNpbmcgdGhlIHJlY3RhbmdsZSBib3VuZGluZyBib3guXHJcbiAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgbGV0IGJib3ggPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgICAgICBpZiAoYmJveCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG1vdXNlUG9zLnggPj0gYmJveC5sZWZ0ICYmIG1vdXNlUG9zLnggPD0gYmJveC5yaWdodCAmJiBtb3VzZVBvcy55ID49IGJib3gudG9wICYmIG1vdXNlUG9zLnkgPD0gYmJveC5ib3R0b20pIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHY6IE1hcFZpZXcgPSB0aGlzLl9hY3RpdmVWaWV3O1xyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3LmhpdFRlc3QobW91c2VQb3MpLnRoZW4oKHJlc3BvbnNlKSA9PiB7XHJcblxyXG4gICAgICAgICAgICBsZXQgZ3JhcGhpY3MgPSByZXNwb25zZS5yZXN1bHRzO1xyXG4gICAgICAgICAgICBpZiAoZ3JhcGhpY3MubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZ3JhcGhpY3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBnID0gZ3JhcGhpY3NbaV0uZ3JhcGhpYztcclxuICAgICAgICAgICAgICAgIGlmIChnICYmIChnLmF0dHJpYnV0ZXMuY2x1c3RlcklkICE9IG51bGwgJiYgIWcuYXR0cmlidXRlcy5pc0NsdXN0ZXJBcmVhKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBjbHVzdGVyID0gdGhpcy5fY2x1c3RlcnNbZy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZF07XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWN0aXZhdGVDbHVzdGVyKGNsdXN0ZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9hY3RpdmF0ZUNsdXN0ZXIoY2x1c3RlcjogQ2x1c3Rlcikge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ2x1c3RlciA9PT0gY2x1c3Rlcikge1xyXG4gICAgICAgICAgICByZXR1cm47IC8vYWxyZWFkeSBhY3RpdmVcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IGNsdXN0ZXI7XHJcbiAgICAgICAgdGhpcy5faW5pdFN1cmZhY2UoKTtcclxuICAgICAgICB0aGlzLl9pbml0Q2x1c3RlcigpO1xyXG4gICAgICAgIHRoaXMuX2luaXRGbGFyZXMoKTtcclxuXHJcbiAgICAgICAgdGhpcy5faGlkZUdyYXBoaWMoW3RoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWNdKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGVhY3RpdmF0ZUNsdXN0ZXIoKSB7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLl9zaG93R3JhcGhpYyhbdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpY10pO1xyXG4gICAgICAgIHRoaXMuX3JlbW92ZUNsYXNzRnJvbUVsZW1lbnQodGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIik7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhY3RpdmF0ZWRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9oaWRlR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX2NsZWFyU3VyZmFjZSgpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJERS1hY3RpdmF0ZSBjbHVzdGVyXCIpO1xyXG5cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdFN1cmZhY2UoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgc3BwOiBTY3JlZW5Qb2ludDtcclxuICAgICAgICBsZXQgc3A6IFNjcmVlblBvaW50ID0gdGhpcy5fYWN0aXZlVmlldy50b1NjcmVlbig8UG9pbnQ+dGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSwgc3BwKTtcclxuXHJcbiAgICAgICAgLy90b1NjcmVlbigpIHJldHVybnMgdGhlIHdyb25nIHZhbHVlIGZvciB4IGlmIGEgMmQgbWFwIGhhcyBiZWVuIHdyYXBwZWQgYXJvdW5kIHRoZSBnbG9iZS4gTmVlZCB0byBjaGVjayBhbmQgY2F0ZXIgZm9yIHRoaXMuIEkgdGhpbmsgdGhpcyBhIGJ1ZyBpbiB0aGUgYXBpLlxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHZhciB3c3cgPSB0aGlzLl9hY3RpdmVWaWV3LnN0YXRlLndvcmxkU2NyZWVuV2lkdGg7XHJcbiAgICAgICAgICAgIGxldCByYXRpbyA9IHBhcnNlSW50KChzcC54IC8gd3N3KS50b0ZpeGVkKDApKTsgLy9nZXQgYSByYXRpbyB0byBkZXRlcm1pbmUgaG93IG1hbnkgdGltZXMgdGhlIG1hcCBoYXMgYmVlbiB3cmFwcGVkIGFyb3VuZC5cclxuICAgICAgICAgICAgaWYgKHNwLnggPCAwKSB7XHJcbiAgICAgICAgICAgICAgICAvL3ggaXMgbGVzcyB0aGFuIDAsIFdURi4gTmVlZCB0byBhZGp1c3QgYnkgdGhlIHdvcmxkIHNjcmVlbiB3aWR0aC5cclxuICAgICAgICAgICAgICAgIHNwLnggKz0gd3N3ICogKHJhdGlvICogLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHNwLnggPiB3c3cpIHtcclxuICAgICAgICAgICAgICAgIC8veCBpcyB0b28gYmlnLCBXVEYgYXMgd2VsbCwgY2F0ZXIgZm9yIGl0LlxyXG4gICAgICAgICAgICAgICAgc3AueCAtPSB3c3cgKiByYXRpbztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZG9tU3R5bGUuc2V0KHN1cmZhY2UucmF3Tm9kZSwgeyB6SW5kZXg6IDExLCBvdmVyZmxvdzogXCJ2aXNpYmxlXCIsIHdpZHRoOiBcIjFweFwiLCBoZWlnaHQ6IFwiMXB4XCIsIGxlZnQ6IHNwLnggKyBcInB4XCIsIHRvcDogc3AueSArIFwicHhcIiB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJ2aXNpYmxlXCIpO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jbGVhclN1cmZhY2UoKSB7XHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgcXVlcnkoXCI+XCIsIHN1cmZhY2UuY29udGFpbmVyR3JvdXAucmF3Tm9kZSkuZm9yRWFjaChkb21Db25zdHJ1Y3QuZGVzdHJveSk7XHJcbiAgICAgICAgZG9tU3R5bGUuc2V0KHN1cmZhY2UucmF3Tm9kZSwgeyB6SW5kZXg6IC0xLCBvdmVyZmxvdzogXCJoaWRkZW5cIiwgdG9wOiBcIjBweFwiLCBsZWZ0OiBcIjBweFwiIH0pO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJvdmVyZmxvd1wiLCBcImhpZGRlblwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9pbml0Q2x1c3RlcigpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHJldHVybjtcclxuICAgICAgICBsZXQgc3VyZmFjZSA9IHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZTtcclxuICAgICAgICBpZiAoIXN1cmZhY2UpIHJldHVybjtcclxuXHJcbiAgICAgICAgLy93ZSdyZSBnb2luZyB0byByZXBsaWNhdGUgYSBjbHVzdGVyIGdyYXBoaWMgaW4gdGhlIHN2ZyBlbGVtZW50IHdlIGFkZGVkIHRvIHRoZSBsYXllciB2aWV3LiBKdXN0IHNvIGl0IGNhbiBiZSBzdHlsZWQgZWFzaWx5LiBOYXRpdmUgV2ViR0wgZm9yIFNjZW5lIFZpZXdzIHdvdWxkIHByb2JhYmx5IGJlIGJldHRlciwgYnV0IGF0IGxlYXN0IHRoaXMgd2F5IGNzcyBjYW4gc3RpbGwgYmUgdXNlZCB0byBzdHlsZS9hbmltYXRlIHRoaW5ncy5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCA9IHN1cmZhY2UuY29udGFpbmVyR3JvdXAuY3JlYXRlR3JvdXAoKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImNsdXN0ZXItZ3JvdXBcIik7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIHRoZSBjbHVzdGVyIHNoYXBlXHJcbiAgICAgICAgbGV0IGNsb25lZENsdXN0ZXJFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChjbG9uZWRDbHVzdGVyRWxlbWVudCwgXCJjbHVzdGVyXCIpO1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSB0aGUgY2x1c3RlciB0ZXh0IHNoYXBlXHJcbiAgICAgICAgbGV0IGNsb25lZFRleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwKTtcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChjbG9uZWRUZXh0RWxlbWVudCwgXCJjbHVzdGVyLXRleHRcIik7XHJcbiAgICAgICAgY2xvbmVkVGV4dEVsZW1lbnQuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGNsb25lZENsdXN0ZXJFbGVtZW50KTtcclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGNsb25lZFRleHRFbGVtZW50KTtcclxuXHJcbiAgICAgICAgLy9zZXQgdGhlIGdyb3VwIGNsYXNzICAgICBcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0RmxhcmVzKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlciB8fCAhdGhpcy5kaXNwbGF5RmxhcmVzKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBncmlkQ2x1c3RlciA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vY2hlY2sgaWYgd2UgbmVlZCB0byBjcmVhdGUgZmxhcmVzIGZvciB0aGUgY2x1c3RlclxyXG4gICAgICAgIGxldCBzaW5nbGVGbGFyZXMgPSAoZ3JpZENsdXN0ZXIuc2luZ2xlcyAmJiBncmlkQ2x1c3Rlci5zaW5nbGVzLmxlbmd0aCA+IDApICYmIChncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KTtcclxuICAgICAgICBsZXQgc3ViVHlwZUZsYXJlcyA9ICFzaW5nbGVGbGFyZXMgJiYgKGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMgJiYgZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5sZW5ndGggPiAwKTtcclxuXHJcbiAgICAgICAgaWYgKCFzaW5nbGVGbGFyZXMgJiYgIXN1YlR5cGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuOyAvL25vIGZsYXJlcyByZXF1aXJlZFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZsYXJlczogRmxhcmVbXSA9IFtdO1xyXG4gICAgICAgIGlmIChzaW5nbGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGdyaWRDbHVzdGVyLnNpbmdsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBmID0gbmV3IEZsYXJlKCk7XHJcbiAgICAgICAgICAgICAgICBmLnRvb2x0aXBUZXh0ID0gZ3JpZENsdXN0ZXIuc2luZ2xlc1tpXVt0aGlzLnNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5XTtcclxuICAgICAgICAgICAgICAgIGYuc2luZ2xlRGF0YSA9IGdyaWRDbHVzdGVyLnNpbmdsZXNbaV07XHJcbiAgICAgICAgICAgICAgICBmLmZsYXJlVGV4dCA9IFwiXCI7XHJcbiAgICAgICAgICAgICAgICBmbGFyZXMucHVzaChmKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChzdWJUeXBlRmxhcmVzKSB7XHJcblxyXG4gICAgICAgICAgICAvL3NvcnQgc3ViIHR5cGVzIGJ5IGhpZ2hlc3QgY291bnQgZmlyc3RcclxuICAgICAgICAgICAgdmFyIHN1YlR5cGVzID0gZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5jb3VudCAtIGEuY291bnQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN1YlR5cGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZiA9IG5ldyBGbGFyZSgpO1xyXG4gICAgICAgICAgICAgICAgZi50b29sdGlwVGV4dCA9IGAke3N1YlR5cGVzW2ldLm5hbWV9ICgke3N1YlR5cGVzW2ldLmNvdW50fSlgO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZVRleHQgPSBzdWJUeXBlc1tpXS5jb3VudDtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2lmIHRoZXJlIGFyZSBtb3JlIGZsYXJlIG9iamVjdHMgdG8gY3JlYXRlIHRoYW4gdGhlIG1heEZsYXJlQ291bnQgYW5kIHRoaXMgaXMgYSBvbmUgb2YgdGhvc2UgLSBjcmVhdGUgYSBzdW1tYXJ5IGZsYXJlIHRoYXQgY29udGFpbnMgJy4uLicgYXMgdGhlIHRleHQgYW5kIG1ha2UgdGhpcyBvbmUgcGFydCBvZiBpdCBcclxuICAgICAgICBsZXQgd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPSBmbGFyZXMubGVuZ3RoID4gdGhpcy5tYXhGbGFyZUNvdW50O1xyXG4gICAgICAgIGxldCBmbGFyZUNvdW50ID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPyB0aGlzLm1heEZsYXJlQ291bnQgOiBmbGFyZXMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvL2lmIHRoZXJlJ3MgYW4gZXZlbiBhbW91bnQgb2YgZmxhcmVzLCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgdG8gdGhlIGxlZnQsIG1pbnVzIDE4MCBmcm9tIGRlZ3JlZSB0byBkbyB0aGlzLlxyXG4gICAgICAgIC8vZm9yIGFuIGFkZCBhbW91bnQgcG9zaXRpb24gdGhlIGZpcnN0IGZsYXJlIG9uIHRvcCwgLTkwIHRvIGRvIHRoaXMuIExvb2tzIG1vcmUgc3ltbWV0cmljYWwgdGhpcyB3YXkuXHJcbiAgICAgICAgbGV0IGRlZ3JlZVZhcmlhbmNlID0gKGZsYXJlQ291bnQgJSAyID09PSAwKSA/IC0xODAgOiAtOTA7XHJcbiAgICAgICAgbGV0IHZpZXdSb3RhdGlvbiA9IHRoaXMuX2lzMmQgPyB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uIDogMDtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTY3JlZW5Qb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9TY3JlZW4oPFBvaW50PnRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnkpO1xyXG4gICAgICAgIGxldCBjbHVzdGVyU3ltYm9sU2l6ZSA9IDxudW1iZXI+dGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2wuZ2V0KFwic2l6ZVwiKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZsYXJlQ291bnQ7IGkrKykge1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlID0gZmxhcmVzW2ldO1xyXG5cclxuICAgICAgICAgICAgLy9zZXQgc29tZSBhdHRyaWJ1dGUgZGF0YVxyXG4gICAgICAgICAgICBsZXQgZmxhcmVBdHRyaWJ1dGVzID0ge1xyXG4gICAgICAgICAgICAgICAgaXNGbGFyZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzU3VtbWFyeUZsYXJlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0OiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgZmxhcmVUZXh0R3JhcGhpYzogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckdyYXBoaWNJZDogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudFxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlVGV4dEF0dHJpYnV0ZXMgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIC8vRG8gYSBjb3VwbGUgb2YgdGhpbmdzIGRpZmZlcmVudGx5IGlmIHRoaXMgaXMgYSBzdW1tYXJ5IGZsYXJlIG9yIG5vdFxyXG4gICAgICAgICAgICBsZXQgaXNTdW1tYXJ5RmxhcmUgPSB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSAmJiBpID49IHRoaXMubWF4RmxhcmVDb3VudCAtIDE7XHJcbiAgICAgICAgICAgIGlmIChpc1N1bW1hcnlGbGFyZSkge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuaXNTdW1tYXJ5ID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy5pc1N1bW1hcnlGbGFyZSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBsZXQgdG9vbHRpcFRleHQgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgLy9tdWx0aWxpbmUgdG9vbHRpcCBmb3Igc3VtbWFyeSBmbGFyZXMsIGllOiBncmVhdGVyIHRoYW4gdGhpcy5tYXhGbGFyZUNvdW50IGZsYXJlcyBwZXIgY2x1c3RlclxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IHRoaXMubWF4RmxhcmVDb3VudCAtIDEsIGpsZW4gPSBmbGFyZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHRpcFRleHQgKz0gaiA+ICh0aGlzLm1heEZsYXJlQ291bnQgLSAxKSA/IFwiXFxuXCIgOiBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGZsYXJlc1tqXS50b29sdGlwVGV4dDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRvb2x0aXBUZXh0ID0gdG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy50b29sdGlwVGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG5cclxuICAgICAgICAgICAgLy9jcmVhdGUgYSBncmFwaGljIGZvciB0aGUgZmxhcmUgYW5kIGZvciB0aGUgZmxhcmUgdGV4dFxyXG4gICAgICAgICAgICBmbGFyZS5ncmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlczogZmxhcmVBdHRyaWJ1dGVzLFxyXG4gICAgICAgICAgICAgICAgZ2VvbWV0cnk6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnksXHJcbiAgICAgICAgICAgICAgICBwb3B1cFRlbXBsYXRlOiBudWxsXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLl9nZXRGbGFyZVN5bWJvbChmbGFyZS5ncmFwaGljKTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBmbGFyZS5ncmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMDtcclxuICAgICAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgICAgIGlmIChmbGFyZS5mbGFyZVRleHQpIHtcclxuICAgICAgICAgICAgICAgIGxldCB0ZXh0U3ltYm9sID0gdGhpcy5mbGFyZVRleHRTeW1ib2wuY2xvbmUoKTtcclxuICAgICAgICAgICAgICAgIHRleHRTeW1ib2wudGV4dCA9ICFpc1N1bW1hcnlGbGFyZSA/IGZsYXJlLmZsYXJlVGV4dC50b1N0cmluZygpIDogXCIuLi5cIjtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dFN5bWJvbC5hbmdsZSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgZmxhcmUudGV4dEdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1RleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJHcmFwaGljSWQ6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlcklkXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzeW1ib2w6IHRleHRTeW1ib2wsXHJcbiAgICAgICAgICAgICAgICAgICAgZ2VvbWV0cnk6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnlcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2ZsYXJlcyBoYXZlIGJlZW4gY3JlYXRlZCBzbyBhZGQgdGhlbSB0byB0aGUgZG9tXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGZsYXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgZiA9IGZsYXJlc1tpXTtcclxuICAgICAgICAgICAgaWYgKCFmLmdyYXBoaWMpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgLy9jcmVhdGUgYSBncm91cCB0byBob2xkIGZsYXJlIG9iamVjdCBhbmQgdGV4dCBpZiBuZWVkZWQuIFxyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICAgICAgbGV0IHBvc2l0aW9uID0gdGhpcy5fc2V0RmxhcmVQb3NpdGlvbihmLmZsYXJlR3JvdXAsIGNsdXN0ZXJTeW1ib2xTaXplLCBmbGFyZUNvdW50LCBpLCBkZWdyZWVWYXJpYW5jZSwgdmlld1JvdGF0aW9uKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImZsYXJlLWdyb3VwXCIpO1xyXG4gICAgICAgICAgICBsZXQgZmxhcmVFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYuZ3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVFbGVtZW50KTtcclxuICAgICAgICAgICAgaWYgKGYudGV4dEdyYXBoaWMpIHtcclxuICAgICAgICAgICAgICAgIGxldCBmbGFyZVRleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYudGV4dEdyYXBoaWMsIGYuZmxhcmVHcm91cCk7XHJcbiAgICAgICAgICAgICAgICBmbGFyZVRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGZsYXJlVGV4dEVsZW1lbnQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIiwgMTApO1xyXG5cclxuICAgICAgICAgICAgLy9hc3NpZ24gc29tZSBldmVudCBoYW5kbGVycyBmb3IgdGhlIHRvb2x0aXBzXHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5tb3VzZUVudGVyID0gb24ucGF1c2FibGUoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwibW91c2VlbnRlclwiLCAoKSA9PiB0aGlzLl9jcmVhdGVUb29sdGlwKGYpKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLm1vdXNlTGVhdmUgPSBvbi5wYXVzYWJsZShmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJtb3VzZWxlYXZlXCIsICgpID0+IHRoaXMuX2Rlc3Ryb3lUb29sdGlwKCkpO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NldEZsYXJlUG9zaXRpb24oZmxhcmVHcm91cDogYW55LCBjbHVzdGVyU3ltYm9sU2l6ZTogbnVtYmVyLCBmbGFyZUNvdW50OiBudW1iZXIsIGZsYXJlSW5kZXg6IG51bWJlciwgZGVncmVlVmFyaWFuY2U6IG51bWJlciwgdmlld1JvdGF0aW9uOiBudW1iZXIpIHtcclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHBvc2l0aW9uIG9mIHRoZSBmbGFyZSB0byBiZSBwbGFjZWQgYXJvdW5kIHRoZSBjb250YWluZXIgY2lyY2xlLlxyXG4gICAgICAgIGxldCBkZWdyZWUgPSBwYXJzZUludCgoKDM2MCAvIGZsYXJlQ291bnQpICogZmxhcmVJbmRleCkudG9GaXhlZCgpKTtcclxuICAgICAgICBkZWdyZWUgPSBkZWdyZWUgKyBkZWdyZWVWYXJpYW5jZTtcclxuXHJcbiAgICAgICAgLy90YWtlIGludG8gYWNjb3VudCBhbnkgcm90YXRpb24gb24gdGhlIHZpZXdcclxuICAgICAgICBpZiAodmlld1JvdGF0aW9uICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGRlZ3JlZSAtPSB2aWV3Um90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmFkaWFuID0gZGVncmVlICogKE1hdGguUEkgLyAxODApO1xyXG4gICAgICAgIGxldCBidWZmZXIgPSB0aGlzLmZsYXJlQnVmZmVyUGl4ZWxzO1xyXG5cclxuICAgICAgICAvL3Bvc2l0aW9uIHRoZSBmbGFyZSBncm91cCBhcm91bmQgdGhlIGNsdXN0ZXJcclxuICAgICAgICBsZXQgcG9zaXRpb24gPSB7XHJcbiAgICAgICAgICAgIHg6IChidWZmZXIgKyBjbHVzdGVyU3ltYm9sU2l6ZSkgKiBNYXRoLmNvcyhyYWRpYW4pLFxyXG4gICAgICAgICAgICB5OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5zaW4ocmFkaWFuKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmxhcmVHcm91cC5zZXRUcmFuc2Zvcm0oeyBkeDogcG9zaXRpb24ueCwgZHk6IHBvc2l0aW9uLnkgfSk7XHJcbiAgICAgICAgcmV0dXJuIHBvc2l0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldEZsYXJlU3ltYm9sKGZsYXJlR3JhcGhpYzogR3JhcGhpYyk6IFNpbXBsZU1hcmtlclN5bWJvbCB7XHJcbiAgICAgICAgcmV0dXJuICF0aGlzLmZsYXJlUmVuZGVyZXIgPyB0aGlzLmZsYXJlU3ltYm9sIDogdGhpcy5mbGFyZVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGZsYXJlR3JhcGhpYykuc3ltYm9sO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZVRvb2x0aXAoZmxhcmU6IEZsYXJlKSB7XHJcblxyXG4gICAgICAgIGxldCBmbGFyZUdyb3VwID0gZmxhcmUuZmxhcmVHcm91cDtcclxuICAgICAgICB0aGlzLl9kZXN0cm95VG9vbHRpcCgpO1xyXG5cclxuICAgICAgICBsZXQgdG9vbHRpcExlbmd0aCA9IHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCBmbGFyZUdyb3VwLnJhd05vZGUpLmxlbmd0aDtcclxuICAgICAgICBpZiAodG9vbHRpcExlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHRleHQgZnJvbSB0aGUgZGF0YS10b29sdGlwIGF0dHJpYnV0ZSBvZiB0aGUgc2hhcGUgb2JqZWN0XHJcbiAgICAgICAgbGV0IHRleHQgPSBmbGFyZS50b29sdGlwVGV4dDtcclxuICAgICAgICBpZiAoIXRleHQpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJubyB0b29sdGlwIHRleHQgZm9yIGZsYXJlLlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9zcGxpdCBvbiBcXG4gY2hhcmFjdGVyIHRoYXQgc2hvdWxkIGJlIGluIHRvb2x0aXAgdG8gc2lnbmlmeSBtdWx0aXBsZSBsaW5lc1xyXG4gICAgICAgIGxldCBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIik7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIGEgZ3JvdXAgdG8gaG9sZCB0aGUgdG9vbHRpcCBlbGVtZW50c1xyXG4gICAgICAgIGxldCB0b29sdGlwR3JvdXAgPSBmbGFyZUdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSBmbGFyZSBzeW1ib2wsIHdlJ2xsIHVzZSB0aGlzIHRvIHN0eWxlIHRoZSB0b29sdGlwIGJveFxyXG4gICAgICAgIGxldCBmbGFyZVN5bWJvbCA9IHRoaXMuX2dldEZsYXJlU3ltYm9sKGZsYXJlLmdyYXBoaWMpO1xyXG5cclxuICAgICAgICAvL2FsaWduIG9uIHRvcCBmb3Igbm9ybWFsIGZsYXJlLCBhbGlnbiBvbiBib3R0b20gZm9yIHN1bW1hcnkgZmxhcmVzLlxyXG4gICAgICAgIGxldCBoZWlnaHQgPSBmbGFyZVN5bWJvbC5zaXplO1xyXG5cclxuICAgICAgICBsZXQgeFBvcyA9IDE7XHJcbiAgICAgICAgbGV0IHlQb3MgPSAhZmxhcmUuaXNTdW1tYXJ5ID8gKChoZWlnaHQpICogLTEpIDogaGVpZ2h0ICsgNTtcclxuXHJcbiAgICAgICAgdG9vbHRpcEdyb3VwLnJhd05vZGUuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJ0b29sdGlwLXRleHRcIik7XHJcbiAgICAgICAgbGV0IHRleHRTaGFwZXMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHJcbiAgICAgICAgICAgIGxldCB0ZXh0U2hhcGUgPSB0b29sdGlwR3JvdXAuY3JlYXRlVGV4dCh7IHg6IHhQb3MsIHk6IHlQb3MgKyAoaSAqIDEwKSwgdGV4dDogbGluZXNbaV0sIGFsaWduOiAnbWlkZGxlJyB9KVxyXG4gICAgICAgICAgICAgICAgLnNldEZpbGwodGhpcy5mbGFyZVRleHRTeW1ib2wuY29sb3IpXHJcbiAgICAgICAgICAgICAgICAuc2V0Rm9udCh7IHNpemU6IDEwLCBmYW1pbHk6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwiZmFtaWx5XCIpLCB3ZWlnaHQ6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwid2VpZ2h0XCIpIH0pO1xyXG5cclxuICAgICAgICAgICAgdGV4dFNoYXBlcy5wdXNoKHRleHRTaGFwZSk7XHJcbiAgICAgICAgICAgIHRleHRTaGFwZS5yYXdOb2RlLnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByZWN0UGFkZGluZyA9IDI7XHJcbiAgICAgICAgbGV0IHRleHRCb3ggPSB0b29sdGlwR3JvdXAuZ2V0Qm91bmRpbmdCb3goKTtcclxuXHJcbiAgICAgICAgbGV0IHJlY3RTaGFwZSA9IHRvb2x0aXBHcm91cC5jcmVhdGVSZWN0KHsgeDogdGV4dEJveC54IC0gcmVjdFBhZGRpbmcsIHk6IHRleHRCb3gueSAtIHJlY3RQYWRkaW5nLCB3aWR0aDogdGV4dEJveC53aWR0aCArIChyZWN0UGFkZGluZyAqIDIpLCBoZWlnaHQ6IHRleHRCb3guaGVpZ2h0ICsgKHJlY3RQYWRkaW5nICogMiksIHI6IDAgfSlcclxuICAgICAgICAgICAgLnNldEZpbGwoZmxhcmVTeW1ib2wuY29sb3IpO1xyXG5cclxuICAgICAgICBpZiAoZmxhcmVTeW1ib2wub3V0bGluZSkge1xyXG4gICAgICAgICAgICByZWN0U2hhcGUuc2V0U3Ryb2tlKHsgY29sb3I6IGZsYXJlU3ltYm9sLm91dGxpbmUuY29sb3IsIHdpZHRoOiAwLjUgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWN0U2hhcGUucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAubW92ZVRvRnJvbnQoKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGV4dFNoYXBlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICB0ZXh0U2hhcGVzW2ldLm1vdmVUb0Zyb250KCk7XHJcbiAgICAgICAgfSAgICAgICAgXHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2Rlc3Ryb3lUb29sdGlwKCkge1xyXG4gICAgICAgIHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UucmF3Tm9kZSkuZm9yRWFjaChkb21Db25zdHJ1Y3QuZGVzdHJveSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vI3JlZ2lvbiBoZWxwZXIgZnVuY3Rpb25zXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMsIHN1cmZhY2U6IGFueSk6IEhUTUxFbGVtZW50IHtcclxuXHJcbiAgICAgICAgLy9mYWtlIG91dCBhIEdGWE9iamVjdCBzbyB3ZSBjYW4gZ2VuZXJhdGUgYW4gc3ZnIHNoYXBlIHRoYXQgdGhlIHBhc3NlZCBpbiBncmFwaGljcyBzaGFwZVxyXG4gICAgICAgIGxldCBnID0gbmV3IEdGWE9iamVjdCgpO1xyXG4gICAgICAgIGcuZ3JhcGhpYyA9IGdyYXBoaWM7XHJcbiAgICAgICAgZy5yZW5kZXJpbmdJbmZvID0geyBzeW1ib2w6IGdyYXBoaWMuc3ltYm9sIH07XHJcblxyXG4gICAgICAgIC8vc2V0IHVwIHBhcmFtZXRlcnMgZm9yIHRoZSBjYWxsIHRvIHJlbmRlclxyXG4gICAgICAgIC8vc2V0IHRoZSB0cmFuc2Zvcm0gb2YgdGhlIHByb2plY3RvciB0byAwJ3MgYXMgd2UncmUganVzdCBwbGFjaW5nIHRoZSBnZW5lcmF0ZWQgY2x1c3RlciBzaGFwZSBhdCBleGFjdGx5IDAsMC5cclxuICAgICAgICBsZXQgcHJvamVjdG9yID0gbmV3IFByb2plY3RvcigpO1xyXG4gICAgICAgIHByb2plY3Rvci5fdHJhbnNmb3JtID0gWzAsIDAsIDAsIDAsIDAsIDBdO1xyXG4gICAgICAgIHByb2plY3Rvci5fcmVzb2x1dGlvbiA9IDA7XHJcblxyXG4gICAgICAgIGxldCBzdGF0ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICBzdGF0ZSA9IHRoaXMuX2FjdGl2ZVZpZXcuc3RhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL2Zha2Ugb3V0IGEgc3RhdGUgb2JqZWN0IGZvciAzZCB2aWV3cy5cclxuICAgICAgICAgICAgc3RhdGUgPSB7XHJcbiAgICAgICAgICAgICAgICBjbGlwcGVkRXh0ZW50OiB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCxcclxuICAgICAgICAgICAgICAgIHJvdGF0aW9uOiAwLFxyXG4gICAgICAgICAgICAgICAgc3BhdGlhbFJlZmVyZW5jZTogdGhpcy5fYWN0aXZlVmlldy5zcGF0aWFsUmVmZXJlbmNlLFxyXG4gICAgICAgICAgICAgICAgd29ybGRTY3JlZW5XaWR0aDogMVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHBhciA9IHtcclxuICAgICAgICAgICAgc3VyZmFjZTogc3VyZmFjZSxcclxuICAgICAgICAgICAgc3RhdGU6IHN0YXRlLFxyXG4gICAgICAgICAgICBwcm9qZWN0b3I6IHByb2plY3RvclxyXG4gICAgICAgIH07XHJcbiAgICAgICAgZy5yZW5kZXIocGFyKTtcclxuICAgICAgICByZXR1cm4gZy5fc2hhcGUucmF3Tm9kZTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfZXh0ZW50KCk6IEV4dGVudCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVZpZXcgPyB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zY2FsZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5zY2FsZSA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvL0lFIC8gRWRnZSBkb24ndCBoYXZlIHRoZSBjbGFzc0xpc3QgcHJvcGVydHkgb24gc3ZnIGVsZW1lbnRzLCBzbyB3ZSBjYW4ndCB1c2UgdGhhdCBhZGQgLyByZW1vdmUgY2xhc3NlcyAtIHByb2JhYmx5IHdoeSBkb2pvIGRvbUNsYXNzIGRvZXNuJ3Qgd29yayBlaXRoZXIuXHJcbiAgICAvL3NvIHRoZSBmb2xsb3dpbmcgdHdvIGZ1bmN0aW9ucyBhcmUgZG9kZ3kgc3RyaW5nIGhhY2tzIHRvIGFkZCAvIHJlbW92ZSBjbGFzc2VzLiBVc2VzIGEgdGltZW91dCBzbyB5b3UgY2FuIG1ha2UgY3NzIHRyYW5zaXRpb25zIHdvcmsgaWYgZGVzaXJlZC5cclxuICAgIHByaXZhdGUgX2FkZENsYXNzVG9FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCBhZGRDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgY3VycmVudENsYXNzID0gXCJcIjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgIT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIGxldCBuZXdDbGFzcyA9IChjdXJyZW50Q2xhc3MgKyBcIiBcIiArIF9jbGFzc05hbWUpLnRyaW0oKTtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgbmV3Q2xhc3MpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGFkZENsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9yZW1vdmVDbGFzc0Zyb21FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCByZW1vdmVDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgcmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudENsYXNzLmluZGV4T2YoXCIgXCIgKyBfY2xhc3NOYW1lKSA9PT0gLTEpIHJldHVybjtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgY3VycmVudENsYXNzLnJlcGxhY2UoXCIgXCIgKyBfY2xhc3NOYW1lLCBcIlwiKSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKHRpbWVvdXRNcykge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCB0aW1lb3V0TXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmVtb3ZlQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldE1vdXNlUG9zKGV2dCkge1xyXG4gICAgICAgIC8vY29udGFpbmVyIG9uIHRoZSB2aWV3IGlzIGFjdHVhbGx5IGEgaHRtbCBlbGVtZW50IGF0IHRoaXMgcG9pbnQsIG5vdCBhIHN0cmluZyBhcyB0aGUgdHlwaW5ncyBzdWdnZXN0LlxyXG4gICAgICAgIGxldCBjb250YWluZXI6IGFueSA9IHRoaXMuX2FjdGl2ZVZpZXcuY29udGFpbmVyO1xyXG4gICAgICAgIGxldCByZWN0ID0gY29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHg6IGV2dC54IC0gcmVjdC5sZWZ0LFxyXG4gICAgICAgICAgICB5OiBldnQueSAtIHJlY3QudG9wXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXR0aW5nIHZpc2libGUgdG8gZmFsc2Ugb24gYSBncmFwaGljIGRvZXNuJ3Qgd29yayBpbiA0LjIgZm9yIHNvbWUgcmVhc29uLiBSZW1vdmluZyB0aGUgZ3JhcGhpYyB0byBoaWRlIGl0IGluc3RlYWQuIEkgdGhpbmsgdmlzaWJsZSBwcm9wZXJ0eSBzaG91bGQgcHJvYmFibHkgd29yayB0aG91Z2guXHJcbiAgICAgKiBAcGFyYW0gZ3JhcGhpY1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9oaWRlR3JhcGhpYyhncmFwaGljOiBHcmFwaGljIHwgR3JhcGhpY1tdKSB7XHJcbiAgICAgICAgaWYgKCFncmFwaGljKSByZXR1cm47XHJcbiAgICAgICAgaWYgKGdyYXBoaWMuaGFzT3duUHJvcGVydHkoXCJsZW5ndGhcIikpIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNYW55KDxHcmFwaGljW10+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSg8R3JhcGhpYz5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2hvd0dyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYyB8IEdyYXBoaWNbXSkge1xyXG4gICAgICAgIGlmICghZ3JhcGhpYykgcmV0dXJuO1xyXG4gICAgICAgIGlmIChncmFwaGljLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkTWFueSg8R3JhcGhpY1tdPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5hZGQoPEdyYXBoaWM+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vI2VuZHJlZ2lvblxyXG5cclxufVxyXG5cclxuXHJcbi8vaW50ZXJmYWNlIEFjdGl2ZVZpZXcgZXh0ZW5kcyBfX2VzcmkuVmlldyB7XHJcbmludGVyZmFjZSBBY3RpdmVWaWV3IGV4dGVuZHMgTWFwVmlldywgU2NlbmVWaWV3IHtcclxuICAgIGNhbnZhczogYW55O1xyXG4gICAgc3RhdGU6IGFueTtcclxuICAgIC8vZXh0ZW50OiBFeHRlbnQ7XHJcbiAgICAvL3NjYWxlOiBudW1iZXI7XHJcbiAgICBmY2xTdXJmYWNlOiBhbnk7XHJcbiAgICBmY2xQb2ludGVyTW92ZTogSUhhbmRsZTtcclxuICAgIGZjbFBvaW50ZXJEb3duOiBJSGFuZGxlO1xyXG5cclxuICAgIC8vcm90YXRpb246IG51bWJlcjtcclxuXHJcbiAgICBjb25zdHJhaW50czogYW55O1xyXG4gICAgZ29UbzogKHRhcmdldDogYW55LCBvcHRpb25zOiBfX2VzcmkuTWFwVmlld0dvVG9PcHRpb25zKSA9PiBJUHJvbWlzZTxhbnk+O1xyXG59XHJcblxyXG5jbGFzcyBHcmlkQ2x1c3RlciB7XHJcbiAgICBleHRlbnQ6IGFueTtcclxuICAgIGNsdXN0ZXJDb3VudDogbnVtYmVyO1xyXG4gICAgc3ViVHlwZUNvdW50czogYW55W10gPSBbXTtcclxuICAgIHNpbmdsZXM6IGFueVtdID0gW107XHJcbiAgICBwb2ludHM6IGFueVtdID0gW107XHJcbiAgICB4OiBudW1iZXI7XHJcbiAgICB5OiBudW1iZXI7XHJcbn1cclxuXHJcblxyXG5jbGFzcyBDbHVzdGVyIHtcclxuICAgIGNsdXN0ZXJHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgdGV4dEdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICBhcmVhR3JhcGhpYzogR3JhcGhpYztcclxuICAgIGNsdXN0ZXJJZDogbnVtYmVyO1xyXG4gICAgY2x1c3Rlckdyb3VwOiBhbnk7XHJcbiAgICBncmlkQ2x1c3RlcjogR3JpZENsdXN0ZXI7XHJcbn1cclxuXHJcbmNsYXNzIEZsYXJlIHtcclxuICAgIGdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0ZXh0R3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRvb2x0aXBUZXh0OiBzdHJpbmc7XHJcbiAgICBmbGFyZVRleHQ6IHN0cmluZztcclxuICAgIHNpbmdsZURhdGE6IGFueVtdO1xyXG4gICAgZmxhcmVHcm91cDogYW55O1xyXG4gICAgaXNTdW1tYXJ5OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUG9pbnRGaWx0ZXIge1xyXG4gICAgZmlsdGVyTmFtZTogc3RyaW5nO1xyXG4gICAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICBwcm9wZXJ0eVZhbHVlczogYW55W107XHJcblxyXG4gICAgLy9kZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGZpbHRlciBpbmNsdWRlcyBvciBleGNsdWRlcyB0aGUgcG9pbnQgZGVwZW5kaW5nIG9uIHdoZXRoZXIgaXQgY29udGFpbnMgdGhlIHByb3BlcnR5IHZhbHVlLlxyXG4gICAgLy9mYWxzZSBtZWFucyB0aGUgcG9pbnQgd2lsbCBiZSBleGNsdWRlZCBpZiB0aGUgdmFsdWUgZG9lcyBleGlzdCBpbiB0aGUgb2JqZWN0LCB0cnVlIG1lYW5zIGl0IHdpbGwgYmUgZXhjbHVkZWQgaWYgaXQgZG9lc24ndC5cclxuICAgIGtlZXBPbmx5SWZWYWx1ZUV4aXN0czogYm9vbGVhbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihmaWx0ZXJOYW1lOiBzdHJpbmcsIHByb3BlcnR5TmFtZTogc3RyaW5nLCB2YWx1ZXM6IGFueVtdLCBrZWVwT25seUlmVmFsdWVFeGlzdHM6IGJvb2xlYW4gPSBmYWxzZSkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVyTmFtZSA9IGZpbHRlck5hbWU7XHJcbiAgICAgICAgdGhpcy5wcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eU5hbWU7XHJcbiAgICAgICAgdGhpcy5wcm9wZXJ0eVZhbHVlcyA9IHZhbHVlcztcclxuICAgICAgICB0aGlzLmtlZXBPbmx5SWZWYWx1ZUV4aXN0cyA9IGtlZXBPbmx5SWZWYWx1ZUV4aXN0cztcclxuICAgIH1cclxuXHJcbn1cclxuXHJcbiJdfQ==
