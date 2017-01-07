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
            //wire up some view events
            this._addViewEvents(evt.layerView.view);
        };
        FlareClusterLayer.prototype._addViewEvents = function (view) {
            var _this = this;
            var v = view ? view : this._activeView;
            if (!v.fclPointerMove) {
                var container = view.container;
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
                //reaasign events if needed
                this._addViewEvents();
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkZsYXJlQ2x1c3RlckxheWVyX3Y0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhDQUE4Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFnRjlDLElBQUksaUJBQWlCLEdBQWlDLHlCQUF5QixDQUFDLFFBQVEsQ0FBTSxhQUFhLENBQUMsQ0FBQztJQUk3RztRQUF1QyxxQ0FBaUI7UUFrRHBELDJCQUFZLE9BQW9DO1lBbERwRCxpQkFnakNDO1lBNS9CTyxrQkFBTSxPQUFPLENBQUMsQ0FBQztZQWZYLG1CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBTzNCLGNBQVMsR0FBc0MsRUFBRSxDQUFDO1lBVXRELGtCQUFrQjtZQUNsQixFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsNkJBQTZCO2dCQUM3QixPQUFPLENBQUMsS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7Z0JBQ2pGLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1lBRXZELGtDQUFrQztZQUNsQyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO1lBQy9DLElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUM7WUFDeEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxJQUFJLENBQUMsQ0FBQztZQUNwRCxJQUFJLENBQUMsMEJBQTBCLEdBQUcsT0FBTyxDQUFDLDBCQUEwQixJQUFJLE1BQU0sQ0FBQztZQUMvRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixLQUFLLE1BQU0sR0FBRyxTQUFTLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDO1lBQzdHLENBQUM7WUFDRCxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO1lBQ2hELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsbUJBQW1CLElBQUksQ0FBQyxDQUFDO1lBQzVELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsS0FBSyxLQUFLLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLGlCQUFpQjtZQUN0RixJQUFJLENBQUMsb0JBQW9CLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixLQUFLLElBQUksQ0FBQztZQUNsRSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixJQUFJLFNBQVMsQ0FBQztZQUN0RSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixJQUFJLENBQUMsQ0FBQztZQUV4RCx5QkFBeUI7WUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxJQUFJLEdBQUcsQ0FBQztZQUNsRCxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDO1lBQ2xELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxHQUFHLENBQUM7WUFFbEQsMENBQTBDO1lBQzFDLElBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQztZQUMvQyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUM7WUFDekMsSUFBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDO1lBQzdDLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQztZQUN6QyxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7WUFFM0MscURBQXFEO1lBQ3JELElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLFdBQVcsSUFBSSxJQUFJLGtCQUFrQixDQUFDO2dCQUM3RCxJQUFJLEVBQUUsRUFBRTtnQkFDUixLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDaEMsT0FBTyxFQUFFLElBQUksZ0JBQWdCLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQzthQUN0RixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLElBQUksSUFBSSxVQUFVLENBQUM7Z0JBQ25ELEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ2pDLElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsRUFBRTtvQkFDUixNQUFNLEVBQUUsT0FBTztpQkFDbEI7Z0JBQ0QsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUNkLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsSUFBSSxJQUFJLFVBQVUsQ0FBQztnQkFDN0QsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDakMsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxDQUFDO29CQUNQLE1BQU0sRUFBRSxPQUFPO2lCQUNsQjtnQkFDRCxPQUFPLEVBQUUsQ0FBQyxDQUFDO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsY0FBYztZQUNkLElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxTQUFTLENBQUM7WUFFdkMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxVQUFDLEdBQUcsSUFBSyxPQUFBLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBM0IsQ0FBMkIsQ0FBQyxDQUFDO1lBRWxFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNiLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoQixDQUFDO1FBQ0wsQ0FBQztRQUdPLDZDQUFpQixHQUF6QixVQUEwQixHQUFHO1lBQTdCLGlCQTJCQztZQXpCRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO1lBQ3RDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7WUFDdEMsQ0FBQztZQUVELHNEQUFzRDtZQUN0RCxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxVQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksSUFBSyxPQUFBLEtBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQTlDLENBQThDLENBQUMsQ0FBQztZQUVwSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7Z0JBRXRDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO29CQUMxQiwrQ0FBK0M7b0JBQy9DLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDWixJQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO2dCQUNwQyxDQUFDO1lBQ0wsQ0FBQztZQUNELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV0QiwwQkFBMEI7WUFDMUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTVDLENBQUM7UUFHTywwQ0FBYyxHQUF0QixVQUF1QixJQUFpQjtZQUF4QyxpQkFTQztZQVJHLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUN2QyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUNwQixJQUFJLFNBQVMsR0FBUSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUVwQyxvSEFBb0g7Z0JBQ3BILCtFQUErRTtnQkFDL0UsQ0FBQyxDQUFDLGNBQWMsR0FBRyxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxVQUFDLEdBQUcsSUFBSyxPQUFBLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBMUIsQ0FBMEIsQ0FBQyxDQUFDO1lBQ3ZGLENBQUM7UUFDTCxDQUFDO1FBR08sMkNBQWUsR0FBdkIsVUFBd0IsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSTtZQUU1QyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNiLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsQ0FBQztnQkFFRCwyQkFBMkI7Z0JBQzNCLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUMxQixDQUFDO1lBRUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZDLCtCQUErQjtnQkFDL0IsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDOUIsQ0FBQztRQUNMLENBQUM7UUFHRCxpQ0FBSyxHQUFMO1lBQ0ksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO1FBQ3hCLENBQUM7UUFHRCxtQ0FBTyxHQUFQLFVBQVEsSUFBVyxFQUFFLFFBQXdCO1lBQXhCLHdCQUF3QixHQUF4QixlQUF3QjtZQUN6QyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNsQixFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNYLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoQixDQUFDO1FBQ0wsQ0FBQztRQUVELGdDQUFJLEdBQUosVUFBSyxVQUFnQjtZQUFyQixpQkErSUM7WUE3SUcsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDYixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztZQUNsQyxDQUFDO1lBRUQsdUNBQXVDO1lBQ3ZDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUU3QyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQztZQUU1QyxvRUFBb0U7WUFDcEUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ2hELE9BQU8sQ0FBQyxLQUFLLENBQUMsMkVBQTJFLENBQUMsQ0FBQztnQkFDM0YsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFbkQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUV4RCxJQUFJLFFBQVEsR0FBYyxFQUFFLENBQUM7WUFFN0Isa0ZBQWtGO1lBQ2xGLG1HQUFtRztZQUNuRyxrR0FBa0c7WUFDbEcsNkVBQTZFO1lBQzdFLElBQUksU0FBUyxHQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsR0FBVyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksZ0JBQWdCLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsTCxJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUM7WUFFNUIsSUFBSSxtQkFBbUIsR0FBRyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEQsU0FBUyxHQUFHLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNwRCxlQUFlLEdBQUcsSUFBSSxDQUFDO1lBQzNCLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDcEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN4RCxDQUFDO1lBR0QsSUFBSSxHQUFhLEVBQUUsR0FBUSxFQUFFLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFZLEVBQUUsSUFBWSxDQUFDO1lBQ3hGLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ2xDLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVwQix5RUFBeUU7Z0JBQ3pFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzNCLFFBQVEsQ0FBQztnQkFDYixDQUFDO2dCQUVELElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUMvQixJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFFL0IsbUdBQW1HO2dCQUNuRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztvQkFDdEMsR0FBRyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN2QixDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNKLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNsRCxDQUFDO2dCQUVELDZEQUE2RDtnQkFDN0QsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2pILFFBQVEsQ0FBQztnQkFDYixDQUFDO2dCQUVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUVwQix1REFBdUQ7b0JBQ3ZELEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUM5RCxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUUvQixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDOzRCQUM3RyxRQUFRLENBQUMsQ0FBQyxzQkFBc0I7d0JBQ3BDLENBQUM7d0JBRUQsaUVBQWlFO3dCQUNqRSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO3dCQUM5RixFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO3dCQUU5RixvSkFBb0o7d0JBQ3BKLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7NEJBQzFCLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQ2pDLENBQUM7d0JBRUQsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDO3dCQUVsQixJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7d0JBQzFCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDOzRCQUM1RCxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO2dDQUM5RCxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO2dDQUM1QixhQUFhLEdBQUcsSUFBSSxDQUFDO2dDQUNyQixLQUFLLENBQUM7NEJBQ1YsQ0FBQzt3QkFDTCxDQUFDO3dCQUVELEVBQUUsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzs0QkFDakIsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO3dCQUM5RSxDQUFDO3dCQUVELGtFQUFrRTt3QkFDbEUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDOzRCQUM5QyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDekIsQ0FBQzt3QkFDRCxJQUFJLENBQUMsQ0FBQzs0QkFDRixFQUFFLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQzt3QkFDcEIsQ0FBQzt3QkFFRCxLQUFLLENBQUM7b0JBQ1YsQ0FBQztnQkFDTCxDQUFDO2dCQUNELElBQUksQ0FBQyxDQUFDO29CQUNGLHFDQUFxQztvQkFDckMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDNUIsQ0FBQztZQUNMLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDcEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQzVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO3dCQUM1RCxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7NEJBQ3pFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDekQsQ0FBQztvQkFDTCxDQUFDO29CQUNELElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM5QyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQztZQUVELDhDQUE4QztZQUM5QyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMvQixPQUFPLENBQUMsT0FBTyxDQUFDLGVBQWEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFNLENBQUMsQ0FBQztZQUV0RCxVQUFVLENBQUM7Z0JBQ1AsS0FBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQzFCLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNYLENBQUM7UUFFTyx5Q0FBYSxHQUFyQixVQUFzQixHQUFRO1lBQzFCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztZQUM1RCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDbEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3RELElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksSUFBSSxDQUFDO29CQUFDLFFBQVEsQ0FBQztnQkFFL0MsSUFBSSxTQUFTLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUMvRSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUNaLE1BQU0sR0FBRyxNQUFNLENBQUMscUJBQXFCLENBQUMsQ0FBQyxvRUFBb0U7Z0JBQy9HLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7b0JBQ2xELE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQywyR0FBMkc7Z0JBQy9ILENBQUM7Z0JBRUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7b0JBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLHNEQUFzRDtZQUNyRixDQUFDO1lBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNsQixDQUFDO1FBRU8seUNBQWEsR0FBckIsVUFBc0IsR0FBRztZQUNyQixJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQztnQkFDbEIsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO2FBQ3JGLENBQUMsQ0FBQztZQUVILEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLEtBQUssR0FBVSxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNuRSxDQUFDO1lBRUQsSUFBSSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUM7Z0JBQ3RCLFFBQVEsRUFBRSxLQUFLO2dCQUNmLFVBQVUsRUFBRSxHQUFHO2FBQ2xCLENBQUMsQ0FBQztZQUVILE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDO1lBQ2pELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUN0RSxPQUFPLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztZQUM1QixDQUFDO1lBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDdkMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLG9GQUFvRjtnQkFDcEYsT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQztZQUN4RCxDQUFDO1lBRUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0QixDQUFDO1FBR08sMENBQWMsR0FBdEIsVUFBdUIsV0FBd0I7WUFFM0MsSUFBSSxPQUFPLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUM1QixPQUFPLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztZQUVsQywyR0FBMkc7WUFDM0csSUFBSSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDOUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztnQkFDeEMsS0FBSyxHQUFVLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25FLENBQUM7WUFFRCxJQUFJLFVBQVUsR0FBUTtnQkFDbEIsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO2dCQUNoQixDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBQ2hCLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWTtnQkFDdEMsU0FBUyxFQUFFLElBQUk7Z0JBQ2YsYUFBYSxFQUFFLFdBQVc7YUFDN0IsQ0FBQTtZQUVELE9BQU8sQ0FBQyxjQUFjLEdBQUcsSUFBSSxPQUFPLENBQUM7Z0JBQ2pDLFVBQVUsRUFBRSxVQUFVO2dCQUN0QixRQUFRLEVBQUUsS0FBSzthQUNsQixDQUFDLENBQUM7WUFDSCxPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUM7WUFFdEcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztZQUM3RSxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUM7Z0JBQ0YsT0FBTyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQy9DLENBQUM7WUFFRCxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbEQsT0FBTyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7WUFFaEUsd0RBQXdEO1lBQ3hELElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDekMsVUFBVSxDQUFDLElBQUksR0FBRyxXQUFXLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3RELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxVQUFVLENBQUMsS0FBSyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztZQUN2RCxDQUFDO1lBRUQsT0FBTyxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDOUIsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsVUFBVSxFQUFFO29CQUNSLGFBQWEsRUFBRSxJQUFJO29CQUNuQixNQUFNLEVBQUUsSUFBSTtvQkFDWixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7aUJBQy9CO2dCQUNELE1BQU0sRUFBRSxVQUFVO2FBQ3JCLENBQUMsQ0FBQztZQUVILDJFQUEyRTtZQUMzRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLElBQUksV0FBVyxDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVqRixJQUFJLEVBQUUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUMxQixFQUFFLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUM7Z0JBQy9CLElBQUksSUFBSSxHQUFRLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsbURBQW1EO2dCQUV4RyxJQUFJLFFBQVEsR0FBUTtvQkFDaEIsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO29CQUNoQixDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7b0JBQ2hCLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWTtvQkFDdEMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO29CQUM1QixhQUFhLEVBQUUsSUFBSTtpQkFDdEIsQ0FBQTtnQkFFRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3RDLElBQUksUUFBUSxHQUFHLElBQUksT0FBTyxFQUFFLENBQUMsQ0FBQyxxR0FBcUc7b0JBQ25JLFFBQVEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFFM0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzt3QkFDM0MsUUFBUSxHQUFZLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUMzRSxDQUFDO29CQUVELE9BQU8sQ0FBQyxXQUFXLEdBQUcsSUFBSSxPQUFPLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO29CQUNoRixPQUFPLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUM7Z0JBRWpHLENBQUM7WUFDTCxDQUFDO1lBRUQsbUNBQW1DO1lBQ25DLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLGtCQUFrQixLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzlELElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUU5QixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxPQUFPLENBQUM7UUFDaEQsQ0FBQztRQUdPLDhDQUFrQixHQUExQixVQUEyQixTQUFpQixFQUFFLGVBQXdCO1lBRWxFLDhJQUE4STtZQUM5SSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNwRSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVyRSwrSEFBK0g7WUFDL0gsRUFBRSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztnQkFDbEIsTUFBTSxJQUFJLENBQUMsQ0FBQztZQUNoQixDQUFDO1lBRUQsSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUM7WUFDcEQsSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUM7WUFFcEQsSUFBSSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUM7WUFFbkMsdUpBQXVKO1lBQ3ZKLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRSxDQUFDO1lBQ3hCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sR0FBRyxTQUFTLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxNQUFNLEdBQUcsTUFBTSxHQUFHLEVBQUUsQ0FBQztnQkFDckIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDOUIsTUFBTSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQ25DLE1BQU0sR0FBRyxNQUFNLEdBQUcsRUFBRSxDQUFDO29CQUNyQixJQUFJLEdBQUcsR0FBRyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQztvQkFDckUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7d0JBQ3BCLE1BQU0sRUFBRSxHQUFHO3dCQUNYLFlBQVksRUFBRSxDQUFDO3dCQUNmLGFBQWEsRUFBRSxFQUFFO3dCQUNqQixPQUFPLEVBQUUsRUFBRTt3QkFDWCxNQUFNLEVBQUUsRUFBRTt3QkFDVixDQUFDLEVBQUUsQ0FBQzt3QkFDSixDQUFDLEVBQUUsQ0FBQztxQkFDUCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7UUFDTCxDQUFDO1FBRUQ7OztXQUdHO1FBQ0ssMENBQWMsR0FBdEI7WUFFSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQztnQkFBQyxNQUFNLENBQUM7WUFDeEMsSUFBSSxvQkFBb0IsR0FBRyxTQUFTLENBQUM7WUFDckMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2Isb0JBQW9CLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO1lBQy9ILENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixvQkFBb0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ3ZHLENBQUM7WUFFRCxJQUFJLE9BQU8sR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDLG9CQUFvQixFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNoRSxPQUFPLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUUvQyxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM5RSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3BELE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDckQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDO1lBRXRDLHVMQUF1TDtZQUN2TCxtR0FBbUc7WUFDbkcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNsRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBaUIsRUFBRSxLQUFLO29CQUN4RCxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ3ZDLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztRQUNMLENBQUM7UUFFTyw0Q0FBZ0IsR0FBeEIsVUFBeUIsR0FBRztZQUE1QixpQkFvQ0M7WUFsQ0csSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUV0QyxJQUFJLEVBQUUsR0FBRyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUUzRCwwSUFBMEk7WUFDMUksZ0tBQWdLO1lBQ2hLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDNUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDUCxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUM7d0JBQUMsTUFBTSxDQUFDO2dCQUMzSCxDQUFDO1lBQ0wsQ0FBQztZQUVELElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFDLFFBQVE7Z0JBQ3ZDLHdCQUF3QjtnQkFDeEIsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQztnQkFDaEMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN4QixLQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDMUIsTUFBTSxDQUFDO2dCQUNYLENBQUM7Z0JBR0QsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztvQkFDNUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3ZFLElBQUksT0FBTyxHQUFHLEtBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDckQsS0FBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO3dCQUMvQixNQUFNLENBQUM7b0JBQ1gsQ0FBQztvQkFDRCxJQUFJLENBQUMsQ0FBQzt3QkFDRixLQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDOUIsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO1FBRU8sNENBQWdCLEdBQXhCLFVBQXlCLE9BQWdCO1lBRXJDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDbEMsTUFBTSxDQUFDLENBQUMsZ0JBQWdCO1lBQzVCLENBQUM7WUFDRCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUUxQixJQUFJLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQztZQUM5QixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUVuQixJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBRXpGLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkQsQ0FBQztZQUVELGtDQUFrQztRQUN0QyxDQUFDO1FBRU8sOENBQWtCLEdBQTFCO1lBRUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVqQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQ3pGLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFFcEYsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBRUQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO1lBRWhDLHFDQUFxQztRQUV6QyxDQUFDO1FBR08sd0NBQVksR0FBcEI7WUFDSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBRWpDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVyQixJQUFJLEdBQWdCLENBQUM7WUFDckIsSUFBSSxFQUFFLEdBQWdCLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUVsRywwSkFBMEo7WUFDMUosRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ2xELElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQywwRUFBMEU7Z0JBQ3pILEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDWCxrRUFBa0U7b0JBQ2xFLEVBQUUsQ0FBQyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9CLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDbEIsMENBQTBDO29CQUMxQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUM7Z0JBQ3hCLENBQUM7WUFDTCxDQUFDO1lBRUQsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNySSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXhELENBQUM7UUFFTyx5Q0FBYSxHQUFyQjtZQUNJLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3pFLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDM0YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBRU8sd0NBQVksR0FBcEI7WUFDSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ2pDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVyQix3UEFBd1A7WUFDeFAsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN4RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBRW5GLDBCQUEwQjtZQUMxQixJQUFJLG9CQUFvQixHQUFHLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3RJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUV6RCwrQkFBK0I7WUFDL0IsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNoSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDM0QsaUJBQWlCLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUMzRSxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFFeEUsMEJBQTBCO1lBQzFCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXZGLENBQUM7UUFHTyx1Q0FBVyxHQUFuQjtZQUFBLGlCQThJQztZQTdJRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUV4RCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQztZQUVsRCxtREFBbUQ7WUFDbkQsSUFBSSxZQUFZLEdBQUcsQ0FBQyxXQUFXLENBQUMsT0FBTyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUNySSxJQUFJLGFBQWEsR0FBRyxDQUFDLFlBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLElBQUksV0FBVyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFFekcsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLENBQUMsQ0FBQyxvQkFBb0I7WUFDaEMsQ0FBQztZQUVELElBQUksTUFBTSxHQUFZLEVBQUUsQ0FBQztZQUN6QixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUM3RCxJQUFJLENBQUMsR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNwQixDQUFDLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7b0JBQ3hFLENBQUMsQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7b0JBQ2pCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25CLENBQUM7WUFDTCxDQUFDO1lBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBRXJCLHVDQUF1QztnQkFDdkMsSUFBSSxRQUFRLEdBQUcsV0FBVyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFDN0IsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDcEIsQ0FBQyxDQUFDLFdBQVcsR0FBTSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQUcsQ0FBQztvQkFDN0QsQ0FBQyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO29CQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQixDQUFDO1lBQ0wsQ0FBQztZQUVELG9MQUFvTDtZQUNwTCxJQUFJLHVCQUF1QixHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUNqRSxJQUFJLFVBQVUsR0FBRyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFFOUUsOEdBQThHO1lBQzlHLHFHQUFxRztZQUNyRyxJQUFJLGNBQWMsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDekQsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7WUFFOUQsSUFBSSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNoRyxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUUsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUMsR0FBRyxVQUFVLEVBQUUsR0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFFbEMsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUMsQ0FBQyxDQUFDO2dCQUV0Qix5QkFBeUI7Z0JBQ3pCLElBQUksZUFBZSxHQUFHO29CQUNsQixPQUFPLEVBQUUsSUFBSTtvQkFDYixjQUFjLEVBQUUsS0FBSztvQkFDckIsV0FBVyxFQUFFLEVBQUU7b0JBQ2YsZ0JBQWdCLEVBQUUsU0FBUztvQkFDM0IsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTO29CQUMvQyxZQUFZLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQ3pDLENBQUM7Z0JBRUYsSUFBSSxtQkFBbUIsR0FBRyxFQUFFLENBQUM7Z0JBRTdCLHFFQUFxRTtnQkFDckUsSUFBSSxjQUFjLEdBQUcsdUJBQXVCLElBQUksR0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO2dCQUM1RSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO29CQUNqQixLQUFLLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztvQkFDdkIsZUFBZSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7b0JBQ3RDLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztvQkFDckIsOEZBQThGO29CQUM5RixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQ3ZFLFdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7d0JBQ3hELFdBQVcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO29CQUN6QyxDQUFDO29CQUNELEtBQUssQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO2dCQUNwQyxDQUFDO2dCQUVELGVBQWUsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztnQkFFaEQsdURBQXVEO2dCQUN2RCxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDO29CQUN4QixVQUFVLEVBQUUsZUFBZTtvQkFDM0IsUUFBUSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLFFBQVE7b0JBQ3JELGFBQWEsRUFBRSxJQUFJO2lCQUN0QixDQUFDLENBQUM7Z0JBRUgsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzNELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUMxQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7Z0JBQ3BFLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLENBQUM7b0JBQ0YsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QyxDQUFDO2dCQUdELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUNsQixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUM5QyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDO29CQUV2RSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzt3QkFDMUMsVUFBVSxDQUFDLEtBQUssR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7b0JBQ3ZELENBQUM7b0JBRUQsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQzt3QkFDNUIsVUFBVSxFQUFFOzRCQUNSLE1BQU0sRUFBRSxJQUFJOzRCQUNaLGdCQUFnQixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUzt5QkFDbEQ7d0JBQ0QsTUFBTSxFQUFFLFVBQVU7d0JBQ2xCLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRO3FCQUN4RCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7WUFFRCxpREFBaUQ7WUFDakQ7Z0JBQ0ksSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUMsQ0FBQyxDQUFDO2dCQUNsQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7b0JBQUMsa0JBQVM7Z0JBRXpCLHlEQUF5RDtnQkFDekQsQ0FBQyxDQUFDLFVBQVUsR0FBRyxNQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDOUQsSUFBSSxRQUFRLEdBQUcsTUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsVUFBVSxFQUFFLEdBQUMsRUFBRSxjQUFjLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBRXBILE1BQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztnQkFDN0QsSUFBSSxZQUFZLEdBQUcsTUFBSSxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNqRixDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQy9DLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO29CQUNoQixJQUFJLGdCQUFnQixHQUFHLE1BQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDekYsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUN4RCxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDdkQsQ0FBQztnQkFFRCxNQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUUvRCw2Q0FBNkM7Z0JBQzdDLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUF0QixDQUFzQixDQUFDLENBQUM7Z0JBQ3hHLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsZUFBZSxFQUFFLEVBQXRCLENBQXNCLENBQUMsQ0FBQzs7O1lBckI1RyxHQUFHLENBQUMsQ0FBQyxJQUFJLEdBQUMsR0FBRyxDQUFDLEVBQUUsS0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBQyxHQUFHLEtBQUcsRUFBRSxHQUFDLEVBQUU7OzthQXVCaEQ7UUFFTCxDQUFDO1FBRU8sNkNBQWlCLEdBQXpCLFVBQTBCLFVBQWUsRUFBRSxpQkFBeUIsRUFBRSxVQUFrQixFQUFFLFVBQWtCLEVBQUUsY0FBc0IsRUFBRSxZQUFvQjtZQUV0Six5RUFBeUU7WUFDekUsSUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNuRSxNQUFNLEdBQUcsTUFBTSxHQUFHLGNBQWMsQ0FBQztZQUVqQyw0Q0FBNEM7WUFDNUMsRUFBRSxDQUFDLENBQUMsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLE1BQU0sSUFBSSxZQUFZLENBQUM7WUFDM0IsQ0FBQztZQUVELElBQUksTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDdEMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1lBRXBDLDZDQUE2QztZQUM3QyxJQUFJLFFBQVEsR0FBRztnQkFDWCxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztnQkFDbEQsQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7YUFDckQsQ0FBQTtZQUVELFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUQsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNwQixDQUFDO1FBRU8sMkNBQWUsR0FBdkIsVUFBd0IsWUFBcUI7WUFDekMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQzlHLENBQUM7UUFFTywwQ0FBYyxHQUF0QixVQUF1QixLQUFZO1lBRS9CLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7WUFDbEMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBRXZCLElBQUksYUFBYSxHQUFHLEtBQUssQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUN0RSxFQUFFLENBQUMsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEIsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELGtFQUFrRTtZQUNsRSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO1lBQzdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDUixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7Z0JBQzFDLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCwyRUFBMkU7WUFDM0UsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU3Qiw2Q0FBNkM7WUFDN0MsSUFBSSxZQUFZLEdBQUcsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBRTVDLCtEQUErRDtZQUMvRCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUV0RCxvRUFBb0U7WUFDcEUsSUFBSSxNQUFNLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztZQUU5QixJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7WUFDYixJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUUzRCxZQUFZLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDM0QsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBRS9DLElBQUksU0FBUyxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUM7cUJBQ3BHLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztxQkFDbkMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUU3SCxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQixTQUFTLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM3RCxDQUFDO1lBRUQsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBQ3BCLElBQUksT0FBTyxHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUU1QyxJQUFJLFNBQVMsR0FBRyxZQUFZLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxHQUFHLFdBQVcsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7aUJBQzFMLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFaEMsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDMUUsQ0FBQztZQUVELFNBQVMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN6QixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNwRCxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDaEMsQ0FBQztRQUVMLENBQUM7UUFFTywyQ0FBZSxHQUF2QjtZQUNJLEtBQUssQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5RixDQUFDO1FBR0QsMEJBQTBCO1FBRWxCLDJEQUErQixHQUF2QyxVQUF3QyxPQUFnQixFQUFFLE9BQVk7WUFFbEUsd0ZBQXdGO1lBQ3hGLElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7WUFDeEIsQ0FBQyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7WUFDcEIsQ0FBQyxDQUFDLGFBQWEsR0FBRyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFFN0MsMENBQTBDO1lBQzFDLDZHQUE2RztZQUM3RyxJQUFJLFNBQVMsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBRTFCLElBQUksS0FBSyxHQUFHLFNBQVMsQ0FBQztZQUN0QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUM7WUFDbkMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLHVDQUF1QztnQkFDdkMsS0FBSyxHQUFHO29CQUNKLGFBQWEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU07b0JBQ3RDLFFBQVEsRUFBRSxDQUFDO29CQUNYLGdCQUFnQixFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCO29CQUNuRCxnQkFBZ0IsRUFBRSxDQUFDO2lCQUN0QixDQUFDO1lBQ04sQ0FBQztZQUVELElBQUksR0FBRyxHQUFHO2dCQUNOLE9BQU8sRUFBRSxPQUFPO2dCQUNoQixLQUFLLEVBQUUsS0FBSztnQkFDWixTQUFTLEVBQUUsU0FBUzthQUN2QixDQUFDO1lBQ0YsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNkLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUM1QixDQUFDO1FBR08sbUNBQU8sR0FBZjtZQUNJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztRQUNsRSxDQUFDO1FBRU8sa0NBQU0sR0FBZDtZQUNJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUNqRSxDQUFDO1FBRUQsMEpBQTBKO1FBQzFKLGdKQUFnSjtRQUN4SSw4Q0FBa0IsR0FBMUIsVUFBMkIsT0FBb0IsRUFBRSxTQUFpQixFQUFFLFNBQWtCLEVBQUUsUUFBbUI7WUFFdkcsSUFBSSxRQUFRLEdBQWEsVUFBQyxRQUFRLEVBQUUsVUFBVTtnQkFDMUMsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7b0JBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztnQkFDckMsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQUMsTUFBTSxDQUFDO2dCQUMxRCxJQUFJLFFBQVEsR0FBRyxDQUFDLFlBQVksR0FBRyxHQUFHLEdBQUcsVUFBVSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ3hELFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQzdDLENBQUMsQ0FBQztZQUVGLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1osVUFBVSxDQUFDO29CQUNQLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQzdCLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQ1gsUUFBUSxFQUFFLENBQUM7b0JBQ2YsQ0FBQztnQkFDTCxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEIsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDakMsQ0FBQztRQUNMLENBQUM7UUFHTyxtREFBdUIsR0FBL0IsVUFBZ0MsT0FBb0IsRUFBRSxTQUFpQixFQUFFLFNBQWtCLEVBQUUsUUFBbUI7WUFFNUcsSUFBSSxXQUFXLEdBQWEsVUFBQyxRQUFRLEVBQUUsVUFBVTtnQkFDN0MsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7b0JBQUMsTUFBTSxDQUFDO2dCQUMxQixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFBQyxNQUFNLENBQUM7Z0JBQzFELFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQy9FLENBQUMsQ0FBQztZQUVGLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1osVUFBVSxDQUFDO29CQUNQLFdBQVcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQ2hDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQ1gsUUFBUSxFQUFFLENBQUM7b0JBQ2YsQ0FBQztnQkFDTCxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEIsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLFdBQVcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEMsQ0FBQztRQUVMLENBQUM7UUFFTyx3Q0FBWSxHQUFwQixVQUFxQixHQUFHO1lBQ3BCLHNHQUFzRztZQUN0RyxJQUFJLFNBQVMsR0FBUSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQztZQUNoRCxJQUFJLElBQUksR0FBRyxTQUFTLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUM3QyxNQUFNLENBQUM7Z0JBQ0gsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUk7Z0JBQzFCLENBQUMsRUFBRSxHQUFHLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHO2FBQzVCLENBQUM7UUFDTixDQUFDO1FBR0Q7OztXQUdHO1FBQ0ssd0NBQVksR0FBcEIsVUFBcUIsT0FBNEI7WUFDN0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ3JCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsVUFBVSxDQUFZLE9BQU8sQ0FBQyxDQUFDO1lBQ3hDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsTUFBTSxDQUFVLE9BQU8sQ0FBQyxDQUFDO1lBQ2xDLENBQUM7UUFDTCxDQUFDO1FBRU8sd0NBQVksR0FBcEIsVUFBcUIsT0FBNEI7WUFDN0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ3JCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsT0FBTyxDQUFZLE9BQU8sQ0FBQyxDQUFDO1lBQ3JDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsR0FBRyxDQUFVLE9BQU8sQ0FBQyxDQUFDO1lBQy9CLENBQUM7UUFDTCxDQUFDO1FBN2lDTDtZQUFDLHlCQUF5QixDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQzs7NkJBQUE7UUFpakN4RCx3QkFBQztJQUFELENBaGpDQSxBQWdqQ0MsQ0FoakNzQyxpQkFBaUIsR0FnakN2RDtJQWhqQ1kseUJBQWlCLG9CQWdqQzdCLENBQUE7SUFnQkQ7UUFBQTtZQUdJLGtCQUFhLEdBQVUsRUFBRSxDQUFDO1lBQzFCLFlBQU8sR0FBVSxFQUFFLENBQUM7WUFDcEIsV0FBTSxHQUFVLEVBQUUsQ0FBQztRQUd2QixDQUFDO1FBQUQsa0JBQUM7SUFBRCxDQVJBLEFBUUMsSUFBQTtJQUdEO1FBQUE7UUFPQSxDQUFDO1FBQUQsY0FBQztJQUFELENBUEEsQUFPQyxJQUFBO0lBRUQ7UUFBQTtRQVFBLENBQUM7UUFBRCxZQUFDO0lBQUQsQ0FSQSxBQVFDLElBQUE7SUFFRDtRQVNJLHFCQUFZLFVBQWtCLEVBQUUsWUFBb0IsRUFBRSxNQUFhLEVBQUUscUJBQXNDO1lBQXRDLHFDQUFzQyxHQUF0Qyw2QkFBc0M7WUFDdkcsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7WUFDN0IsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7WUFDakMsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUM7WUFDN0IsSUFBSSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQixDQUFDO1FBQ3ZELENBQUM7UUFFTCxrQkFBQztJQUFELENBaEJBLEFBZ0JDLElBQUE7SUFoQlksbUJBQVcsY0FnQnZCLENBQUEiLCJmaWxlIjoiRmxhcmVDbHVzdGVyTGF5ZXJfdjQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cclxuXHJcblxyXG5pbXBvcnQgKiBhcyBHcmFwaGljc0xheWVyIGZyb20gXCJlc3JpL2xheWVycy9HcmFwaGljc0xheWVyXCI7XHJcbmltcG9ydCAqIGFzIENsYXNzQnJlYWtzUmVuZGVyZXIgZnJvbSBcImVzcmkvcmVuZGVyZXJzL0NsYXNzQnJlYWtzUmVuZGVyZXJcIjtcclxuaW1wb3J0ICogYXMgUG9wdXBUZW1wbGF0ZSBmcm9tIFwiZXNyaS9Qb3B1cFRlbXBsYXRlXCI7XHJcbmltcG9ydCAqIGFzIFNpbXBsZU1hcmtlclN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1NpbXBsZU1hcmtlclN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBUZXh0U3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvVGV4dFN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBTaW1wbGVMaW5lU3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvU2ltcGxlTGluZVN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBDb2xvciBmcm9tIFwiZXNyaS9Db2xvclwiO1xyXG5pbXBvcnQgKiBhcyB3YXRjaFV0aWxzIGZyb20gJ2VzcmkvY29yZS93YXRjaFV0aWxzJztcclxuaW1wb3J0ICogYXMgVmlldyBmcm9tICdlc3JpL3ZpZXdzL1ZpZXcnO1xyXG5pbXBvcnQgKiBhcyB3ZWJNZXJjYXRvclV0aWxzIGZyb20gXCJlc3JpL2dlb21ldHJ5L3N1cHBvcnQvd2ViTWVyY2F0b3JVdGlsc1wiO1xyXG5pbXBvcnQgKiBhcyBHcmFwaGljIGZyb20gXCJlc3JpL0dyYXBoaWNcIjtcclxuaW1wb3J0ICogYXMgUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgU2NyZWVuUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU2NyZWVuUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgTXVsdGlwb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9NdWx0aXBvaW50XCI7XHJcbmltcG9ydCAqIGFzIFBvbHlnb24gZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9seWdvblwiO1xyXG5pbXBvcnQgKiBhcyBnZW9tZXRyeUVuZ2luZSBmcm9tICdlc3JpL2dlb21ldHJ5L2dlb21ldHJ5RW5naW5lJztcclxuaW1wb3J0ICogYXMgU3BhdGlhbFJlZmVyZW5jZSBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TcGF0aWFsUmVmZXJlbmNlXCI7XHJcbmltcG9ydCAqIGFzIEV4dGVudCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9FeHRlbnRcIjtcclxuaW1wb3J0ICogYXMgZXh0ZXJuYWxSZW5kZXJlcnMgZnJvbSBcImVzcmkvdmlld3MvM2QvZXh0ZXJuYWxSZW5kZXJlcnNcIjtcclxuXHJcbmltcG9ydCAqIGFzIEdGWE9iamVjdCBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvR0ZYT2JqZWN0XCI7XHJcbmltcG9ydCAqIGFzIFByb2plY3RvciBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvUHJvamVjdG9yXCI7XHJcbiBcclxuaW1wb3J0ICogYXMgYWNjZXNzb3JTdXBwb3J0RGVjb3JhdG9ycyBmcm9tIFwiZXNyaS9jb3JlL2FjY2Vzc29yU3VwcG9ydC9kZWNvcmF0b3JzXCI7XHJcbiBcclxuaW1wb3J0ICogYXMgb24gZnJvbSAnZG9qby9vbic7XHJcbmltcG9ydCAqIGFzIGdmeCBmcm9tICdkb2pveC9nZngnO1xyXG5pbXBvcnQgKiBhcyBkb21Db25zdHJ1Y3QgZnJvbSAnZG9qby9kb20tY29uc3RydWN0JztcclxuaW1wb3J0ICogYXMgcXVlcnkgZnJvbSAnZG9qby9xdWVyeSc7XHJcbmltcG9ydCAqIGFzIGRvbSBmcm9tICdkb2pvL2RvbSc7XHJcbmltcG9ydCAqIGFzIGRvbUF0dHIgZnJvbSAnZG9qby9kb20tYXR0cic7XHJcbmltcG9ydCAqIGFzIGRvbVN0eWxlIGZyb20gJ2Rvam8vZG9tLXN0eWxlJztcclxuXHJcblxyXG5pbnRlcmZhY2UgRmxhcmVDbHVzdGVyTGF5ZXJQcm9wZXJ0aWVzIGV4dGVuZHMgX19lc3JpLkdyYXBoaWNzTGF5ZXJQcm9wZXJ0aWVzIHtcclxuXHJcbiAgICBjbHVzdGVyUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcblxyXG4gICAgc2luZ2xlUmVuZGVyZXI/OiBhbnk7XHJcbiAgICBzaW5nbGVTeW1ib2w/OiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBhcmVhUmVuZGVyZXI/OiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgZmxhcmVSZW5kZXJlcj86IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcblxyXG4gICAgc2luZ2xlUG9wdXBUZW1wbGF0ZT86IFBvcHVwVGVtcGxhdGU7XHJcbiAgICBzcGF0aWFsUmVmZXJlbmNlPzogU3BhdGlhbFJlZmVyZW5jZTtcclxuICAgICBcclxuICAgIGNsdXN0ZXJSYXRpbz86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJUb1NjYWxlPzogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50PzogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5Pzogc3RyaW5nO1xyXG5cclxuICAgIGRpc3BsYXlGbGFyZXM/OiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ/OiBudW1iZXI7XHJcbiAgICBzaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eT86IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sPzogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM/OiBudW1iZXI7XHJcbiAgICB0ZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbD86IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBzdWJUeXBlRmxhcmVQcm9wZXJ0eT86IHN0cmluZztcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgeVByb3BlcnR5TmFtZT86IHN0cmluZztcclxuICAgIHpQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcblxyXG4gICAgZmlsdGVycz86IFBvaW50RmlsdGVyW107XHJcblxyXG4gICAgZGF0YT86IGFueVtdO1xyXG5cclxufVxyXG5cclxuXHJcbi8vVGhpcyBpcyBob3cgeW91IGhhdmUgdG8gZXh0ZW5kIGNsYXNzZXMgaW4gYXJjZ2lzIGFwaSB0aGF0IGFyZSBhIHN1YmNsYXNzIG9mIEFjY2Vzc29yLlxyXG4vL1dpbGwgbGlrZWx5IGNoYW5nZSBpbiBmdXR1cmUgcmVsZWFzZXMuIFNlZSB0aGVzZSBsaW5rcyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc3JpL2pzYXBpLXJlc291cmNlcy9pc3N1ZXMvNDAgJiBodHRwczovL2dpdGh1Yi5jb20veWNhYm9uL2V4dGVuZC1hY2Nlc3Nvci1leGFtcGxlXHJcbmludGVyZmFjZSBCYXNlR3JhcGhpY3NMYXllciBleHRlbmRzIEdyYXBoaWNzTGF5ZXIgeyB9XHJcbmludGVyZmFjZSBCYXNlR3JhcGhpY3NMYXllckNvbnN0cnVjdG9yIHsgbmV3IChvcHRpb25zPzogX19lc3JpLkdyYXBoaWNzTGF5ZXJQcm9wZXJ0aWVzKTogQmFzZUdyYXBoaWNzTGF5ZXI7IH1cclxubGV0IGJhc2VHcmFwaGljc0xheWVyOiBCYXNlR3JhcGhpY3NMYXllckNvbnN0cnVjdG9yID0gYWNjZXNzb3JTdXBwb3J0RGVjb3JhdG9ycy5kZWNsYXJlZCg8YW55PkdyYXBoaWNzTGF5ZXIpO1xyXG5cclxuXHJcbkBhY2Nlc3NvclN1cHBvcnREZWNvcmF0b3JzLnN1YmNsYXNzKFwiRmxhcmVDbHVzdGVyTGF5ZXJcIilcclxuZXhwb3J0IGNsYXNzIEZsYXJlQ2x1c3RlckxheWVyIGV4dGVuZHMgYmFzZUdyYXBoaWNzTGF5ZXIge1xyXG5cclxuICAgIHNpbmdsZVJlbmRlcmVyOiBhbnk7XHJcbiAgICBzaW5nbGVTeW1ib2w6IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIHNpbmdsZVBvcHVwVGVtcGxhdGU6IFBvcHVwVGVtcGxhdGU7XHJcblxyXG4gICAgY2x1c3RlclJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgYXJlYVJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgZmxhcmVSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuXHJcbiAgICBzcGF0aWFsUmVmZXJlbmNlOiBTcGF0aWFsUmVmZXJlbmNlO1xyXG5cclxuICAgIGNsdXN0ZXJSYXRpbzogbnVtYmVyO1xyXG4gICAgY2x1c3RlclRvU2NhbGU6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJNaW5Db3VudDogbnVtYmVyO1xyXG4gICAgY2x1c3RlckFyZWFEaXNwbGF5OiBzdHJpbmc7XHJcblxyXG4gICAgZGlzcGxheUZsYXJlczogYm9vbGVhbjtcclxuICAgIG1heEZsYXJlQ291bnQ6IG51bWJlcjtcclxuICAgIG1heFNpbmdsZUZsYXJlQ291bnQ6IG51bWJlcjtcclxuICAgIHNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5OiBzdHJpbmc7XHJcbiAgICBmbGFyZVN5bWJvbDogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgZmxhcmVCdWZmZXJQaXhlbHM6IG51bWJlcjtcclxuICAgIHRleHRTeW1ib2w6IFRleHRTeW1ib2w7XHJcbiAgICBmbGFyZVRleHRTeW1ib2w6IFRleHRTeW1ib2w7XHJcbiAgICBkaXNwbGF5U3ViVHlwZUZsYXJlczogYm9vbGVhbjtcclxuICAgIHN1YlR5cGVGbGFyZVByb3BlcnR5OiBzdHJpbmc7XHJcblxyXG4gICAgeFByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG4gICAgeVByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG4gICAgelByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG5cclxuICAgIGZpbHRlcnM6IFBvaW50RmlsdGVyW107XHJcblxyXG4gICAgcHJpdmF0ZSBfZ3JpZENsdXN0ZXJzOiBHcmlkQ2x1c3RlcltdO1xyXG4gICAgcHJpdmF0ZSBfaXNDbHVzdGVyZWQ6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9hY3RpdmVWaWV3OiBBY3RpdmVWaWV3O1xyXG4gICAgcHJpdmF0ZSBfdmlld0xvYWRDb3VudDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBwcml2YXRlIF9yZWFkeVRvRHJhdzogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX3F1ZXVlZEluaXRpYWxEcmF3OiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfZGF0YTogYW55W107XHJcbiAgICBwcml2YXRlIF9pczJkOiBib29sZWFuO1xyXG4gICAgIFxyXG4gICAgcHJpdmF0ZSBfY2x1c3RlcnM6IHsgW2NsdXN0ZXJJZDogbnVtYmVyXTogQ2x1c3RlcjsgfSA9IHt9O1xyXG4gICAgcHJpdmF0ZSBfYWN0aXZlQ2x1c3RlcjogQ2x1c3RlcjtcclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXcyZDogYW55O1xyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3M2Q6IGFueTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zOiBGbGFyZUNsdXN0ZXJMYXllclByb3BlcnRpZXMpIHtcclxuXHJcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vc2V0IHRoZSBkZWZhdWx0c1xyXG4gICAgICAgIGlmICghb3B0aW9ucykge1xyXG4gICAgICAgICAgICAvL21pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyc1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiTWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzIHRvIGZsYXJlIGNsdXN0ZXIgbGF5ZXIgY29uc3RydWN0b3IuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnNpbmdsZVBvcHVwVGVtcGxhdGUgPSBvcHRpb25zLnNpbmdsZVBvcHVwVGVtcGxhdGU7XHJcblxyXG4gICAgICAgIC8vc2V0IHVwIHRoZSBjbHVzdGVyaW5nIHByb3BlcnRpZXNcclxuICAgICAgICB0aGlzLmNsdXN0ZXJSYXRpbyA9IG9wdGlvbnMuY2x1c3RlclJhdGlvIHx8IDc1O1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclRvU2NhbGUgPSBvcHRpb25zLmNsdXN0ZXJUb1NjYWxlIHx8IDIwMDAwMDA7XHJcbiAgICAgICAgdGhpcy5jbHVzdGVyTWluQ291bnQgPSBvcHRpb25zLmNsdXN0ZXJNaW5Db3VudCB8fCAyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHkgPSBvcHRpb25zLnNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5IHx8IFwibmFtZVwiO1xyXG4gICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJBcmVhRGlzcGxheSkge1xyXG4gICAgICAgICAgICB0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9IG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcIm5vbmVcIiA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5O1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLm1heEZsYXJlQ291bnQgPSBvcHRpb25zLm1heEZsYXJlQ291bnQgfHwgODtcclxuICAgICAgICB0aGlzLm1heFNpbmdsZUZsYXJlQ291bnQgPSBvcHRpb25zLm1heFNpbmdsZUZsYXJlQ291bnQgfHwgODtcclxuICAgICAgICB0aGlzLmRpc3BsYXlGbGFyZXMgPSBvcHRpb25zLmRpc3BsYXlGbGFyZXMgPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlOyAvL2RlZmF1bHQgdG8gdHJ1ZVxyXG4gICAgICAgIHRoaXMuZGlzcGxheVN1YlR5cGVGbGFyZXMgPSBvcHRpb25zLmRpc3BsYXlTdWJUeXBlRmxhcmVzID09PSB0cnVlO1xyXG4gICAgICAgIHRoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHkgPSBvcHRpb25zLnN1YlR5cGVGbGFyZVByb3BlcnR5IHx8IHVuZGVmaW5lZDtcclxuICAgICAgICB0aGlzLmZsYXJlQnVmZmVyUGl4ZWxzID0gb3B0aW9ucy5mbGFyZUJ1ZmZlclBpeGVscyB8fCA2O1xyXG5cclxuICAgICAgICAvL2RhdGEgc2V0IHByb3BlcnR5IG5hbWVzXHJcbiAgICAgICAgdGhpcy54UHJvcGVydHlOYW1lID0gb3B0aW9ucy54UHJvcGVydHlOYW1lIHx8IFwieFwiO1xyXG4gICAgICAgIHRoaXMueVByb3BlcnR5TmFtZSA9IG9wdGlvbnMueVByb3BlcnR5TmFtZSB8fCBcInlcIjtcclxuICAgICAgICB0aGlzLnpQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnpQcm9wZXJ0eU5hbWUgfHwgXCJ6XCI7XHJcblxyXG4gICAgICAgIC8vc2V0IHVwIHRoZSBzeW1ib2xvZ3kvcmVuZGVyZXIgcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclJlbmRlcmVyID0gb3B0aW9ucy5jbHVzdGVyUmVuZGVyZXI7XHJcbiAgICAgICAgdGhpcy5hcmVhUmVuZGVyZXIgPSBvcHRpb25zLmFyZWFSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLnNpbmdsZVJlbmRlcmVyID0gb3B0aW9ucy5zaW5nbGVSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLnNpbmdsZVN5bWJvbCA9IG9wdGlvbnMuc2luZ2xlU3ltYm9sO1xyXG4gICAgICAgIHRoaXMuZmxhcmVSZW5kZXJlciA9IG9wdGlvbnMuZmxhcmVSZW5kZXJlcjtcclxuXHJcbiAgICAgICAgLy9hZGQgc29tZSBkZWZhdWx0IHN5bWJvbHMgb3IgdXNlIHRoZSBvcHRpb25zIHZhbHVlcy5cclxuICAgICAgICB0aGlzLmZsYXJlU3ltYm9sID0gb3B0aW9ucy5mbGFyZVN5bWJvbCB8fCBuZXcgU2ltcGxlTWFya2VyU3ltYm9sKHtcclxuICAgICAgICAgICAgc2l6ZTogMTQsXHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzAsIDAsIDAsIDAuNV0pLFxyXG4gICAgICAgICAgICBvdXRsaW5lOiBuZXcgU2ltcGxlTGluZVN5bWJvbCh7IGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTUsIDAuNV0pLCB3aWR0aDogMSB9KVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnRleHRTeW1ib2wgPSBvcHRpb25zLnRleHRTeW1ib2wgfHwgbmV3IFRleHRTeW1ib2woe1xyXG4gICAgICAgICAgICBjb2xvcjogbmV3IENvbG9yKFsyNTUsIDI1NSwgMjU1XSksXHJcbiAgICAgICAgICAgIGZvbnQ6IHtcclxuICAgICAgICAgICAgICAgIHNpemU6IDEwLFxyXG4gICAgICAgICAgICAgICAgZmFtaWx5OiBcImFyaWFsXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeW9mZnNldDogLTNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5mbGFyZVRleHRTeW1ib2wgPSBvcHRpb25zLmZsYXJlVGV4dFN5bWJvbCB8fCBuZXcgVGV4dFN5bWJvbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTVdKSxcclxuICAgICAgICAgICAgZm9udDoge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogNixcclxuICAgICAgICAgICAgICAgIGZhbWlseTogXCJhcmlhbFwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHlvZmZzZXQ6IC0yXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vaW5pdGlhbCBkYXRhXHJcbiAgICAgICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIHRoaXMub24oXCJsYXllcnZpZXctY3JlYXRlXCIsIChldnQpID0+IHRoaXMuX2xheWVyVmlld0NyZWF0ZWQoZXZ0KSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9kYXRhKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3Q3JlYXRlZChldnQpIHtcclxuXHJcbiAgICAgICAgaWYgKGV2dC5sYXllclZpZXcudmlldy50eXBlID09PSBcIjJkXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGF5ZXJWaWV3MmQgPSBldnQubGF5ZXJWaWV3O1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fbGF5ZXJWaWV3M2QgPSBldnQubGF5ZXJWaWV3O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9hZGQgYSBzdGF0aW9uYXJ5IHdhdGNoIG9uIHRoZSB2aWV3IHRvIGRvIHNvbWUgc3R1ZmYuXHJcbiAgICAgICAgd2F0Y2hVdGlscy5wYXVzYWJsZShldnQubGF5ZXJWaWV3LnZpZXcsIFwic3RhdGlvbmFyeVwiLCAoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSA9PiB0aGlzLl92aWV3U3RhdGlvbmFyeShpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX3ZpZXdMb2FkQ291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy5fYWN0aXZlVmlldyA9IGV2dC5sYXllclZpZXcudmlldztcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX3JlYWR5VG9EcmF3ID0gdHJ1ZTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3KSB7XHJcbiAgICAgICAgICAgICAgICAvL3dlJ3ZlIGJlZW4gd2FpdGluZyBmb3IgdGhpcyB0byBoYXBwZW4gdG8gZHJhd1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3ZpZXdMb2FkQ291bnQrKztcclxuXHJcbiAgICAgICAgLy93aXJlIHVwIHNvbWUgdmlldyBldmVudHNcclxuICAgICAgICB0aGlzLl9hZGRWaWV3RXZlbnRzKGV2dC5sYXllclZpZXcudmlldyk7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9hZGRWaWV3RXZlbnRzKHZpZXc/OiBBY3RpdmVWaWV3KSB7XHJcbiAgICAgICAgbGV0IHYgPSB2aWV3ID8gdmlldyA6IHRoaXMuX2FjdGl2ZVZpZXc7XHJcbiAgICAgICAgaWYgKCF2LmZjbFBvaW50ZXJNb3ZlKSB7IFxyXG4gICAgICAgICAgICBsZXQgY29udGFpbmVyOiBhbnkgPSB2aWV3LmNvbnRhaW5lcjtcclxuXHJcbiAgICAgICAgICAgIC8vdXNpbmcgdGhlIGJ1aWx0IGluIHBvaW50ZXJtb3ZlIGV2ZW50IG9mIGEgdmlldyBkb2Vucyd0IHdvcmsgZm9yIHRvdWNoLiBEb2pvJ3MgbW91c2Vtb3ZlIHJlZ2lzdGVycyB0b3VjaGVzIGFzIHdlbGwuXHJcbiAgICAgICAgICAgIC8vdi5mY2xQb2ludGVyTW92ZSA9IHYub24oXCJwb2ludGVyLW1vdmVcIiwgKGV2dCkgPT4gdGhpcy5fdmlld1BvaW50ZXJNb3ZlKGV2dCkpO1xyXG4gICAgICAgICAgICB2LmZjbFBvaW50ZXJNb3ZlID0gb24oY29udGFpbmVyLCBcIm1vdXNlbW92ZVwiLCAoZXZ0KSA9PiB0aGlzLl92aWV3UG9pbnRlck1vdmUoZXZ0KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgIFxyXG5cclxuICAgIHByaXZhdGUgX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpc1N0YXRpb25hcnkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL3JlYWFzaWduIGV2ZW50cyBpZiBuZWVkZWRcclxuICAgICAgICAgICAgdGhpcy5fYWRkVmlld0V2ZW50cygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCFpc1N0YXRpb25hcnkgJiYgdGhpcy5fYWN0aXZlQ2x1c3Rlcikge1xyXG4gICAgICAgICAgICAvL2lmIG1vdmluZyBkZWFjdGl2YXRlIGNsdXN0ZXI7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBjbGVhcigpIHtcclxuICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzID0ge307XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHNldERhdGEoZGF0YTogYW55W10sIGRyYXdEYXRhOiBib29sZWFuID0gdHJ1ZSkge1xyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xyXG4gICAgICAgIGlmIChkcmF3RGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZHJhdyhhY3RpdmVWaWV3PzogYW55KSB7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVWaWV3KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBhY3RpdmVWaWV3O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9Ob3QgcmVhZHkgdG8gZHJhdyB5ZXQgc28gcXVldWUgb25lIHVwXHJcbiAgICAgICAgaWYgKCF0aGlzLl9yZWFkeVRvRHJhdykge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlVmlldyB8fCAhdGhpcy5fZGF0YSkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLl9pczJkID0gdGhpcy5fYWN0aXZlVmlldy50eXBlID09PSBcIjJkXCI7XHJcblxyXG4gICAgICAgIC8vY2hlY2sgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYW4gYXJlYSByZW5kZXJlciBzZXQgaWYgb25lIG5lZWRzIHRvIGJlXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ICYmICF0aGlzLmFyZWFSZW5kZXJlcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRmxhcmVDbHVzdGVyTGF5ZXI6IGFyZWFSZW5kZXJlciBtdXN0IGJlIHNldCBpZiBjbHVzdGVyQXJlYURpc3BsYXkgaXMgc2V0LlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIGNvbnNvbGUudGltZShcImRyYXctZGF0YS1cIiArIHRoaXMuX2FjdGl2ZVZpZXcudHlwZSk7XHJcblxyXG4gICAgICAgIHRoaXMuX2lzQ2x1c3RlcmVkID0gdGhpcy5jbHVzdGVyVG9TY2FsZSA8IHRoaXMuX3NjYWxlKCk7XHJcblxyXG4gICAgICAgIGxldCBncmFwaGljczogR3JhcGhpY1tdID0gW107XHJcblxyXG4gICAgICAgIC8vZ2V0IGFuIGV4dGVudCB0aGF0IGlzIGluIHdlYiBtZXJjYXRvciB0byBtYWtlIHN1cmUgaXQncyBmbGF0IGZvciBleHRlbnQgY2hlY2tpbmdcclxuICAgICAgICAvL1RoZSB3ZWJleHRlbnQgd2lsbCBuZWVkIHRvIGJlIG5vcm1hbGl6ZWQgc2luY2UgcGFubmluZyBvdmVyIHRoZSBpbnRlcm5hdGlvbmFsIGRhdGVsaW5lIHdpbGwgY2F1c2VcclxuICAgICAgICAvL2NhdXNlIHRoZSBleHRlbnQgdG8gc2hpZnQgb3V0c2lkZSB0aGUgLTE4MCB0byAxODAgZGVncmVlIHdpbmRvdy4gIElmIHdlIGRvbid0IG5vcm1hbGl6ZSB0aGVuIHRoZVxyXG4gICAgICAgIC8vY2x1c3RlcnMgd2lsbCBub3QgYmUgZHJhd24gaWYgdGhlIG1hcCBwYW5zIG92ZXIgdGhlIGludGVybmF0aW9uYWwgZGF0ZWxpbmUuXHJcbiAgICAgICAgbGV0IHdlYkV4dGVudDogYW55ID0gIXRoaXMuX2V4dGVudCgpLnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvciA/IDxFeHRlbnQ+d2ViTWVyY2F0b3JVdGlscy5wcm9qZWN0KHRoaXMuX2V4dGVudCgpLCBuZXcgU3BhdGlhbFJlZmVyZW5jZSh7IFwid2tpZFwiOiAxMDIxMDAgfSkpIDogdGhpcy5fZXh0ZW50KCk7XHJcbiAgICAgICAgbGV0IGV4dGVudElzVW5pb25lZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBsZXQgbm9ybWFsaXplZFdlYkV4dGVudCA9IHdlYkV4dGVudC5ub3JtYWxpemUoKTtcclxuICAgICAgICB3ZWJFeHRlbnQgPSBub3JtYWxpemVkV2ViRXh0ZW50WzBdO1xyXG4gICAgICAgIGlmIChub3JtYWxpemVkV2ViRXh0ZW50Lmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgd2ViRXh0ZW50ID0gd2ViRXh0ZW50LnVuaW9uKG5vcm1hbGl6ZWRXZWJFeHRlbnRbMV0pO1xyXG4gICAgICAgICAgICBleHRlbnRJc1VuaW9uZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudCwgZXh0ZW50SXNVbmlvbmVkKTtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBsZXQgd2ViOiBudW1iZXJbXSwgb2JqOiBhbnksIGRhdGFMZW5ndGggPSB0aGlzLl9kYXRhLmxlbmd0aCwgeFZhbDogbnVtYmVyLCB5VmFsOiBudW1iZXI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhTGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgb2JqID0gdGhpcy5fZGF0YVtpXTtcclxuXHJcbiAgICAgICAgICAgIC8vY2hlY2sgaWYgZmlsdGVycyBhcmUgc3BlY2lmaWVkIGFuZCBjb250aW51ZSBpZiB0aGlzIG9iamVjdCBkb2Vzbid0IHBhc3NcclxuICAgICAgICAgICAgaWYgKCF0aGlzLl9wYXNzZXNGaWx0ZXIob2JqKSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHhWYWwgPSBvYmpbdGhpcy54UHJvcGVydHlOYW1lXTtcclxuICAgICAgICAgICAgeVZhbCA9IG9ialt0aGlzLnlQcm9wZXJ0eU5hbWVdO1xyXG5cclxuICAgICAgICAgICAgLy9nZXQgYSB3ZWIgbWVyYyBsbmcvbGF0IGZvciBleHRlbnQgY2hlY2tpbmcuIFVzZSB3ZWIgbWVyYyBhcyBpdCdzIGZsYXQgdG8gY2F0ZXIgZm9yIGxvbmdpdHVkZSBwb2xlXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICAgICAgd2ViID0gW3hWYWwsIHlWYWxdO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgd2ViID0gd2ViTWVyY2F0b3JVdGlscy5sbmdMYXRUb1hZKHhWYWwsIHlWYWwpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL2NoZWNrIGlmIHRoZSBvYmogaXMgdmlzaWJsZSBpbiB0aGUgZXh0ZW50IGJlZm9yZSBwcm9jZWVkaW5nXHJcbiAgICAgICAgICAgIGlmICgod2ViWzBdIDw9IHdlYkV4dGVudC54bWluIHx8IHdlYlswXSA+IHdlYkV4dGVudC54bWF4KSB8fCAod2ViWzFdIDw9IHdlYkV4dGVudC55bWluIHx8IHdlYlsxXSA+IHdlYkV4dGVudC55bWF4KSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vbG9vcCBjbHVzdGVyIGdyaWQgdG8gc2VlIGlmIGl0IHNob3VsZCBiZSBhZGRlZCB0byBvbmVcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwLCBqTGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzLmxlbmd0aDsgaiA8IGpMZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBjbCA9IHRoaXMuX2dyaWRDbHVzdGVyc1tqXTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHdlYlswXSA8PSBjbC5leHRlbnQueG1pbiB8fCB3ZWJbMF0gPiBjbC5leHRlbnQueG1heCB8fCB3ZWJbMV0gPD0gY2wuZXh0ZW50LnltaW4gfHwgd2ViWzFdID4gY2wuZXh0ZW50LnltYXgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7IC8vbm90IGhlcmUgc28gY2Fycnkgb25cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vcmVjYWxjIHRoZSB4IGFuZCB5IG9mIHRoZSBjbHVzdGVyIGJ5IGF2ZXJhZ2luZyB0aGUgcG9pbnRzIGFnYWluXHJcbiAgICAgICAgICAgICAgICAgICAgY2wueCA9IGNsLmNsdXN0ZXJDb3VudCA+IDAgPyAoeFZhbCArIChjbC54ICogY2wuY2x1c3RlckNvdW50KSkgLyAoY2wuY2x1c3RlckNvdW50ICsgMSkgOiB4VmFsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNsLnkgPSBjbC5jbHVzdGVyQ291bnQgPiAwID8gKHlWYWwgKyAoY2wueSAqIGNsLmNsdXN0ZXJDb3VudCkpIC8gKGNsLmNsdXN0ZXJDb3VudCArIDEpIDogeVZhbDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9wdXNoIGV2ZXJ5IHBvaW50IGludG8gdGhlIGNsdXN0ZXIgc28gd2UgaGF2ZSBpdCBmb3IgYXJlYSBkaXNwbGF5IGlmIHJlcXVpcmVkLiBUaGlzIGNvdWxkIGJlIG9taXR0ZWQgaWYgbmV2ZXIgY2hlY2tpbmcgYXJlYXMsIG9yIG9uIGRlbWFuZCBhdCBsZWFzdFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5wb2ludHMucHVzaChbeFZhbCwgeVZhbF0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY2wuY2x1c3RlckNvdW50Kys7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzdWJUeXBlRXhpc3RzID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcyA9IDAsIHNMZW4gPSBjbC5zdWJUeXBlQ291bnRzLmxlbmd0aDsgcyA8IHNMZW47IHMrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2wuc3ViVHlwZUNvdW50c1tzXS5uYW1lID09PSBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsLnN1YlR5cGVDb3VudHNbc10uY291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YlR5cGVFeGlzdHMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghc3ViVHlwZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzLnB1c2goeyBuYW1lOiBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0sIGNvdW50OiAxIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9hZGQgdGhlIHNpbmdsZSBmaXggcmVjb3JkIGlmIHN0aWxsIHVuZGVyIHRoZSBtYXhTaW5nbGVGbGFyZUNvdW50XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsLmNsdXN0ZXJDb3VudCA8PSB0aGlzLm1heFNpbmdsZUZsYXJlQ291bnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc2luZ2xlcy5wdXNoKG9iaik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zaW5nbGVzID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vbm90IGNsdXN0ZXJlZCBzbyBqdXN0IGFkZCBldmVyeSBvYmpcclxuICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNpbmdsZShvYmopO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5jbHVzdGVyQ291bnQgPCB0aGlzLmNsdXN0ZXJNaW5Db3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwLCBqbGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzW2ldLnNpbmdsZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNpbmdsZSh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uc2luZ2xlc1tqXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLmNsdXN0ZXJDb3VudCA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVDbHVzdGVyKHRoaXMuX2dyaWRDbHVzdGVyc1tpXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vZW1pdCBhbiBldmVudCB0byBzaWduYWwgZHJhd2luZyBpcyBjb21wbGV0ZS5cclxuICAgICAgICB0aGlzLmVtaXQoXCJkcmF3LWNvbXBsZXRlXCIsIHt9KTtcclxuICAgICAgICBjb25zb2xlLnRpbWVFbmQoYGRyYXctZGF0YS0ke3RoaXMuX2FjdGl2ZVZpZXcudHlwZX1gKTtcclxuXHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVN1cmZhY2UoKTtcclxuICAgICAgICB9LCAxMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfcGFzc2VzRmlsdGVyKG9iajogYW55KTogYm9vbGVhbiB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmZpbHRlcnMgfHwgdGhpcy5maWx0ZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgbGV0IHBhc3NlcyA9IHRydWU7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuZmlsdGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgZmlsdGVyID0gdGhpcy5maWx0ZXJzW2ldO1xyXG4gICAgICAgICAgICBpZiAob2JqW2ZpbHRlci5wcm9wZXJ0eU5hbWVdID09IG51bGwpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgbGV0IHZhbEV4aXN0cyA9IGZpbHRlci5wcm9wZXJ0eVZhbHVlcy5pbmRleE9mKG9ialtmaWx0ZXIucHJvcGVydHlOYW1lXSkgIT09IC0xO1xyXG4gICAgICAgICAgICBpZiAodmFsRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBwYXNzZXMgPSBmaWx0ZXIua2VlcE9ubHlJZlZhbHVlRXhpc3RzOyAvL3RoZSB2YWx1ZSBleGlzdHMgc28gcmV0dXJuIHdoZXRoZXIgd2Ugc2hvdWxkIGJlIGtlZXBpbmcgaXQgb3Igbm90LlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKCF2YWxFeGlzdHMgJiYgZmlsdGVyLmtlZXBPbmx5SWZWYWx1ZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcGFzc2VzID0gZmFsc2U7IC8vcmV0dXJuIGZhbHNlIGFzIHRoZSB2YWx1ZSBkb2Vzbid0IGV4aXN0LCBhbmQgd2Ugc2hvdWxkIG9ubHkgYmUga2VlcGluZyBwb2ludCBvYmplY3RzIHdoZXJlIGl0IGRvZXMgZXhpc3QuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghcGFzc2VzKSByZXR1cm4gZmFsc2U7IC8vaWYgaXQgaGFzbid0IHBhc3NlZCBhbnkgb2YgdGhlIGZpbHRlcnMgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHBhc3NlcztcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTaW5nbGUob2JqKSB7XHJcbiAgICAgICAgbGV0IHBvaW50ID0gbmV3IFBvaW50KHtcclxuICAgICAgICAgICAgeDogb2JqW3RoaXMueFByb3BlcnR5TmFtZV0sIHk6IG9ialt0aGlzLnlQcm9wZXJ0eU5hbWVdLCB6OiBvYmpbdGhpcy56UHJvcGVydHlOYW1lXVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoIXBvaW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBwb2ludCA9IDxQb2ludD53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKHBvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBncmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnQsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IG9ialxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBncmFwaGljLnBvcHVwVGVtcGxhdGUgPSB0aGlzLnNpbmdsZVBvcHVwVGVtcGxhdGU7XHJcbiAgICAgICAgaWYgKHRoaXMuc2luZ2xlUmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgbGV0IHN5bWJvbCA9IHRoaXMuc2luZ2xlUmVuZGVyZXIuZ2V0U3ltYm9sKGdyYXBoaWMsIHRoaXMuX2FjdGl2ZVZpZXcpO1xyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHN5bWJvbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodGhpcy5zaW5nbGVTeW1ib2wpIHtcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLnNpbmdsZVN5bWJvbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vbm8gc3ltYm9sb2d5IGZvciBzaW5nbGVzIGRlZmluZWQsIHVzZSB0aGUgZGVmYXVsdCBzeW1ib2wgZnJvbSB0aGUgY2x1c3RlciByZW5kZXJlclxyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHRoaXMuY2x1c3RlclJlbmRlcmVyLmRlZmF1bHRTeW1ib2w7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFkZChncmFwaGljKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2x1c3RlcihncmlkQ2x1c3RlcjogR3JpZENsdXN0ZXIpIHtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXIgPSBuZXcgQ2x1c3RlcigpO1xyXG4gICAgICAgIGNsdXN0ZXIuZ3JpZENsdXN0ZXIgPSBncmlkQ2x1c3RlcjtcclxuXHJcbiAgICAgICAgLy9tYWtlIHN1cmUgYWxsIGdlb21ldHJpZXMgYWRkZWQgdG8gR3JhcGhpYyBvYmplY3RzIGFyZSBpbiB3ZWIgbWVyY2F0b3Igb3RoZXJ3aXNlIHdyYXAgYXJvdW5kIGRvZXNuJ3Qgd29yay5cclxuICAgICAgICBsZXQgcG9pbnQgPSBuZXcgUG9pbnQoeyB4OiBncmlkQ2x1c3Rlci54LCB5OiBncmlkQ2x1c3Rlci55IH0pO1xyXG4gICAgICAgIGlmICghcG9pbnQuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgIHBvaW50ID0gPFBvaW50PndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IocG9pbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGF0dHJpYnV0ZXM6IGFueSA9IHtcclxuICAgICAgICAgICAgeDogZ3JpZENsdXN0ZXIueCxcclxuICAgICAgICAgICAgeTogZ3JpZENsdXN0ZXIueSxcclxuICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQsXHJcbiAgICAgICAgICAgIGlzQ2x1c3RlcjogdHJ1ZSxcclxuICAgICAgICAgICAgY2x1c3Rlck9iamVjdDogZ3JpZENsdXN0ZXJcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGF0dHJpYnV0ZXMsXHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sID0gdGhpcy5jbHVzdGVyUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oY2x1c3Rlci5jbHVzdGVyR3JhcGhpYykuc3ltYm9sO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJJZCA9IGNsdXN0ZXIuY2x1c3RlckdyYXBoaWNbXCJ1aWRcIl07XHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZCA9IGNsdXN0ZXIuY2x1c3RlcklkO1xyXG5cclxuICAgICAgICAvL2Fsc28gY3JlYXRlIGEgdGV4dCBzeW1ib2wgdG8gZGlzcGxheSB0aGUgY2x1c3RlciBjb3VudFxyXG4gICAgICAgIGxldCB0ZXh0U3ltYm9sID0gdGhpcy50ZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgdGV4dFN5bWJvbC50ZXh0ID0gZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LnRvU3RyaW5nKCk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICB0ZXh0U3ltYm9sLmFuZ2xlID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIudGV4dEdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludCxcclxuICAgICAgICAgICAgYXR0cmlidXRlczoge1xyXG4gICAgICAgICAgICAgICAgaXNDbHVzdGVyVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJJZDogY2x1c3Rlci5jbHVzdGVySWRcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vYWRkIGFuIGFyZWEgZ3JhcGhpYyB0byBkaXNwbGF5IHRoZSBib3VuZHMgb2YgdGhlIGNsdXN0ZXIgaWYgY29uZmlndXJlZCB0b1xyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSAmJiBncmlkQ2x1c3Rlci5wb2ludHMgJiYgZ3JpZENsdXN0ZXIucG9pbnRzLmxlbmd0aCA+IDApIHtcclxuXHJcbiAgICAgICAgICAgIGxldCBtcCA9IG5ldyBNdWx0aXBvaW50KCk7XHJcbiAgICAgICAgICAgIG1wLnBvaW50cyA9IGdyaWRDbHVzdGVyLnBvaW50cztcclxuICAgICAgICAgICAgbGV0IGFyZWE6IGFueSA9IGdlb21ldHJ5RW5naW5lLmNvbnZleEh1bGwobXAsIHRydWUpOyAvL3VzZSBjb252ZXggaHVsbCBvbiB0aGUgcG9pbnRzIHRvIGdldCB0aGUgYm91bmRhcnlcclxuXHJcbiAgICAgICAgICAgIGxldCBhcmVhQXR0cjogYW55ID0ge1xyXG4gICAgICAgICAgICAgICAgeDogZ3JpZENsdXN0ZXIueCxcclxuICAgICAgICAgICAgICAgIHk6IGdyaWRDbHVzdGVyLnksXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJJZDogY2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBpc0NsdXN0ZXJBcmVhOiB0cnVlXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChhcmVhLnJpbmdzICYmIGFyZWEucmluZ3MubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGFyZWFQb2x5ID0gbmV3IFBvbHlnb24oKTsgLy9oYWQgdG8gY3JlYXRlIGEgbmV3IHBvbHlnb24gYW5kIGZpbGwgaXQgd2l0aCB0aGUgcmluZyBvZiB0aGUgY2FsY3VsYXRlZCBhcmVhIGZvciBTY2VuZVZpZXcgdG8gd29yay5cclxuICAgICAgICAgICAgICAgIGFyZWFQb2x5ID0gYXJlYVBvbHkuYWRkUmluZyhhcmVhLnJpbmdzWzBdKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIWFyZWFQb2x5LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGFyZWFQb2x5ID0gPFBvbHlnb24+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihhcmVhUG9seSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY2x1c3Rlci5hcmVhR3JhcGhpYyA9IG5ldyBHcmFwaGljKHsgZ2VvbWV0cnk6IGFyZWFQb2x5LCBhdHRyaWJ1dGVzOiBhcmVhQXR0ciB9KTtcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXIuYXJlYUdyYXBoaWMuc3ltYm9sID0gdGhpcy5hcmVhUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oY2x1c3Rlci5hcmVhR3JhcGhpYykuc3ltYm9sO1xyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9hZGQgdGhlIGdyYXBoaWNzIGluIG9yZGVyICAgICAgICBcclxuICAgICAgICBpZiAoY2x1c3Rlci5hcmVhR3JhcGhpYyAmJiB0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhbHdheXNcIikge1xyXG4gICAgICAgICAgICB0aGlzLmFkZChjbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci5jbHVzdGVyR3JhcGhpYyk7XHJcbiAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci50ZXh0R3JhcGhpYyk7XHJcblxyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzW2NsdXN0ZXIuY2x1c3RlcklkXSA9IGNsdXN0ZXI7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudDogRXh0ZW50LCBleHRlbnRJc1VuaW9uZWQ6IGJvb2xlYW4pIHtcclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHRvdGFsIGFtb3VudCBvZiBncmlkIHNwYWNlcyBiYXNlZCBvbiB0aGUgaGVpZ2h0IGFuZCB3aWR0aCBvZiB0aGUgbWFwIChkaXZpZGUgaXQgYnkgY2x1c3RlclJhdGlvKSAtIHRoZW4gZ2V0IHRoZSBkZWdyZWVzIGZvciB4IGFuZCB5IFxyXG4gICAgICAgIGxldCB4Q291bnQgPSBNYXRoLnJvdW5kKHRoaXMuX2FjdGl2ZVZpZXcud2lkdGggLyB0aGlzLmNsdXN0ZXJSYXRpbyk7XHJcbiAgICAgICAgbGV0IHlDb3VudCA9IE1hdGgucm91bmQodGhpcy5fYWN0aXZlVmlldy5oZWlnaHQgLyB0aGlzLmNsdXN0ZXJSYXRpbyk7XHJcblxyXG4gICAgICAgIC8vaWYgdGhlIGV4dGVudCBoYXMgYmVlbiB1bmlvbmVkIGR1ZSB0byBub3JtYWxpemF0aW9uLCBkb3VibGUgdGhlIGNvdW50IG9mIHggaW4gdGhlIGNsdXN0ZXIgZ3JpZCBhcyB0aGUgdW5pb25pbmcgd2lsbCBoYWx2ZSBpdC5cclxuICAgICAgICBpZiAoZXh0ZW50SXNVbmlvbmVkKSB7XHJcbiAgICAgICAgICAgIHhDb3VudCAqPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHh3ID0gKHdlYkV4dGVudC54bWF4IC0gd2ViRXh0ZW50LnhtaW4pIC8geENvdW50O1xyXG4gICAgICAgIGxldCB5aCA9ICh3ZWJFeHRlbnQueW1heCAtIHdlYkV4dGVudC55bWluKSAvIHlDb3VudDtcclxuXHJcbiAgICAgICAgbGV0IGdzeG1pbiwgZ3N4bWF4LCBnc3ltaW4sIGdzeW1heDtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgYW4gYXJyYXkgb2YgY2x1c3RlcnMgdGhhdCBpcyBhIGdyaWQgb3ZlciB0aGUgdmlzaWJsZSBleHRlbnQuIEVhY2ggY2x1c3RlciBjb250YWlucyB0aGUgZXh0ZW50IChpbiB3ZWIgbWVyYykgdGhhdCBib3VuZHMgdGhlIGdyaWQgc3BhY2UgZm9yIGl0LlxyXG4gICAgICAgIHRoaXMuX2dyaWRDbHVzdGVycyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgeENvdW50OyBpKyspIHtcclxuICAgICAgICAgICAgZ3N4bWluID0gd2ViRXh0ZW50LnhtaW4gKyAoeHcgKiBpKTtcclxuICAgICAgICAgICAgZ3N4bWF4ID0gZ3N4bWluICsgeHc7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgeUNvdW50OyBqKyspIHtcclxuICAgICAgICAgICAgICAgIGdzeW1pbiA9IHdlYkV4dGVudC55bWluICsgKHloICogaik7XHJcbiAgICAgICAgICAgICAgICBnc3ltYXggPSBnc3ltaW4gKyB5aDtcclxuICAgICAgICAgICAgICAgIGxldCBleHQgPSB7IHhtaW46IGdzeG1pbiwgeG1heDogZ3N4bWF4LCB5bWluOiBnc3ltaW4sIHltYXg6IGdzeW1heCB9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ3JpZENsdXN0ZXJzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIGV4dGVudDogZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogMCxcclxuICAgICAgICAgICAgICAgICAgICBzdWJUeXBlQ291bnRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICBzaW5nbGVzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludHM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHg6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgeTogMFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYW4gc3ZnIHN1cmZhY2Ugb24gdGhlIHZpZXcgaWYgaXQgZG9lc24ndCBhbHJlYWR5IGV4aXN0XHJcbiAgICAgKiBAcGFyYW0gdmlld1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTdXJmYWNlKCkge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQucGFyZW50RWxlbWVudCB8fCB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnROb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9hY3RpdmVWaWV3LmNhbnZhcy5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgc3VyZmFjZSA9IGdmeC5jcmVhdGVTdXJmYWNlKHN1cmZhY2VQYXJlbnRFbGVtZW50LCBcIjBcIiwgXCIwXCIpO1xyXG4gICAgICAgIHN1cmZhY2UuY29udGFpbmVyR3JvdXAgPSBzdXJmYWNlLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgcG9zaXRpb246IFwiYWJzb2x1dGVcIiwgdG9wOiBcIjBcIiwgekluZGV4OiAtMSB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJ2aXNpYmxlXCIpO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJjbGFzc1wiLCBcImZjbC1zdXJmYWNlXCIpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZSA9IHN1cmZhY2U7XHJcblxyXG4gICAgICAgIC8vVGhpcyBpcyBhIGhhY2sgZm9yIElFLiBoaXRUZXN0IG9uIHRoZSB2aWV3IGRvZW5zJ3QgcGljayB1cCBhbnkgcmVzdWx0cyB1bmxlc3MgdGhlIHotaW5kZXggb2YgdGhlIGxheWVyVmlldyBjb250YWluZXIgaXMgYXQgbGVhc3QgMS4gU28gc2V0IGl0IHRvIDEsIGJ1dCBhbHNvIGhhdmUgdG8gc2V0IHRoZSAuZXNyaS11aVxyXG4gICAgICAgIC8vY29udGFpbmVyIHRvIDIgb3RoZXJ3aXNlIGl0IGNhbid0IGJlIGNsaWNrZWQgb24gYXMgaXQncyBjb3ZlcmVkIGJ5IHRoZSBsYXllciB2aWV3IGNvbnRhaW5lci4gbWVoIVxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIGRvbVN0eWxlLnNldCh0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudCwgXCJ6LWluZGV4XCIsIFwiMVwiKTtcclxuICAgICAgICAgICAgcXVlcnkoXCIuZXNyaS11aVwiKS5mb3JFYWNoKGZ1bmN0aW9uIChub2RlOiBIVE1MRWxlbWVudCwgaW5kZXgpIHtcclxuICAgICAgICAgICAgICAgIGRvbVN0eWxlLnNldChub2RlLCBcInotaW5kZXhcIiwgXCIyXCIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1BvaW50ZXJNb3ZlKGV2dCkge1xyXG5cclxuICAgICAgICBsZXQgbW91c2VQb3MgPSB0aGlzLl9nZXRNb3VzZVBvcyhldnQpO1xyXG5cclxuICAgICAgICBsZXQgc3AgPSBuZXcgU2NyZWVuUG9pbnQoeyB4OiBtb3VzZVBvcy54LCB5OiBtb3VzZVBvcy55IH0pO1xyXG5cclxuICAgICAgICAvL2lmIHRoZXJlJ3MgYW4gYWN0aXZlIGNsdXN0ZXIgYW5kIHRoZSBjdXJyZW50IHNjcmVlbiBwb3MgaXMgd2l0aGluIHRoZSBib3VuZHMgb2YgdGhhdCBjbHVzdGVyJ3MgZ3JvdXAgY29udGFpbmVyLCBkb24ndCBkbyBhbnl0aGluZyBtb3JlLiBcclxuICAgICAgICAvL1RPRE86IHdvdWxkIHByb2JhYmx5IGJlIGJldHRlciB0byBjaGVjayBpZiB0aGUgcG9pbnQgaXMgaW4gdGhlIGFjdHVhbCBjaXJjbGUgb2YgdGhlIGNsdXN0ZXIgZ3JvdXAgYW5kIGl0J3MgZmxhcmVzIGluc3RlYWQgb2YgdXNpbmcgdGhlIHJlY3RhbmdsZSBib3VuZGluZyBib3guXHJcbiAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgbGV0IGJib3ggPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgICAgICBpZiAoYmJveCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG1vdXNlUG9zLnggPj0gYmJveC5sZWZ0ICYmIG1vdXNlUG9zLnggPD0gYmJveC5yaWdodCAmJiBtb3VzZVBvcy55ID49IGJib3gudG9wICYmIG1vdXNlUG9zLnkgPD0gYmJveC5ib3R0b20pIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlVmlldy5oaXRUZXN0KHNwKS50aGVuKChyZXNwb25zZSkgPT4ge1xyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgbGV0IGdyYXBoaWNzID0gcmVzcG9uc2UucmVzdWx0cztcclxuICAgICAgICAgICAgaWYgKGdyYXBoaWNzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBncmFwaGljcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGcgPSBncmFwaGljc1tpXS5ncmFwaGljO1xyXG4gICAgICAgICAgICAgICAgaWYgKGcgJiYgKGcuYXR0cmlidXRlcy5jbHVzdGVySWQgIT0gbnVsbCAmJiAhZy5hdHRyaWJ1dGVzLmlzQ2x1c3RlckFyZWEpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsdXN0ZXIgPSB0aGlzLl9jbHVzdGVyc1tnLmF0dHJpYnV0ZXMuY2x1c3RlcklkXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hY3RpdmF0ZUNsdXN0ZXIoY2x1c3Rlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSAgICBcclxuXHJcbiAgICBwcml2YXRlIF9hY3RpdmF0ZUNsdXN0ZXIoY2x1c3RlcjogQ2x1c3Rlcikge1xyXG4gICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPT09IGNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuOyAvL2FscmVhZHkgYWN0aXZlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPSBjbHVzdGVyO1xyXG4gICAgICAgIHRoaXMuX2luaXRTdXJmYWNlKCk7XHJcbiAgICAgICAgdGhpcy5faW5pdENsdXN0ZXIoKTtcclxuICAgICAgICB0aGlzLl9pbml0RmxhcmVzKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2hpZGVHcmFwaGljKFt0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljXSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhY3RpdmF0ZWRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9zaG93R3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJhY3RpdmF0ZSBjbHVzdGVyXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2RlYWN0aXZhdGVDbHVzdGVyKCkge1xyXG4gIFxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLl9zaG93R3JhcGhpYyhbdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpY10pO1xyXG4gICAgICAgIHRoaXMuX3JlbW92ZUNsYXNzRnJvbUVsZW1lbnQodGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIik7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhY3RpdmF0ZWRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9oaWRlR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX2NsZWFyU3VyZmFjZSgpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJERS1hY3RpdmF0ZSBjbHVzdGVyXCIpO1xyXG4gICAgICAgXHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2luaXRTdXJmYWNlKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgc3VyZmFjZSA9IHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZTtcclxuICAgICAgICBpZiAoIXN1cmZhY2UpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IHNwcDogU2NyZWVuUG9pbnQ7XHJcbiAgICAgICAgbGV0IHNwOiBTY3JlZW5Qb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9TY3JlZW4odGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSwgc3BwKTtcclxuXHJcbiAgICAgICAgLy90b1NjcmVlbigpIHJldHVybnMgdGhlIHdyb25nIHZhbHVlIGZvciB4IGlmIGEgMmQgbWFwIGhhcyBiZWVuIHdyYXBwZWQgYXJvdW5kIHRoZSBnbG9iZS4gTmVlZCB0byBjaGVjayBhbmQgY2F0ZXIgZm9yIHRoaXMuIEkgdGhpbmsgdGhpcyBhIGJ1ZyBpbiB0aGUgYXBpLlxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHZhciB3c3cgPSB0aGlzLl9hY3RpdmVWaWV3LnN0YXRlLndvcmxkU2NyZWVuV2lkdGg7XHJcbiAgICAgICAgICAgIGxldCByYXRpbyA9IHBhcnNlSW50KChzcC54IC8gd3N3KS50b0ZpeGVkKDApKTsgLy9nZXQgYSByYXRpbyB0byBkZXRlcm1pbmUgaG93IG1hbnkgdGltZXMgdGhlIG1hcCBoYXMgYmVlbiB3cmFwcGVkIGFyb3VuZC5cclxuICAgICAgICAgICAgaWYgKHNwLnggPCAwKSB7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy94IGlzIGxlc3MgdGhhbiAwLCBXVEYuIE5lZWQgdG8gYWRqdXN0IGJ5IHRoZSB3b3JsZCBzY3JlZW4gd2lkdGguXHJcbiAgICAgICAgICAgICAgICBzcC54ICs9IHdzdyAqIChyYXRpbyAqIC0xKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmIChzcC54ID4gd3N3KSB7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy94IGlzIHRvbyBiaWcsIFdURiBhcyB3ZWxsLCBjYXRlciBmb3IgaXQuXHJcbiAgICAgICAgICAgICAgICBzcC54IC09IHdzdyAqIHJhdGlvO1xyXG4gICAgICAgICAgICB9ICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHpJbmRleDogMTEsIG92ZXJmbG93OiBcInZpc2libGVcIiwgd2lkdGg6IFwiMXB4XCIsIGhlaWdodDogXCIxcHhcIiwgbGVmdDogc3AueCArIFwicHhcIiwgdG9wOiBzcC55ICsgXCJweFwiIH0pO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJvdmVyZmxvd1wiLCBcInZpc2libGVcIik7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NsZWFyU3VyZmFjZSgpIHtcclxuICAgICAgICBsZXQgc3VyZmFjZSA9IHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZTtcclxuICAgICAgICBxdWVyeShcIj5cIiwgc3VyZmFjZS5jb250YWluZXJHcm91cC5yYXdOb2RlKS5mb3JFYWNoKGRvbUNvbnN0cnVjdC5kZXN0cm95KTtcclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHpJbmRleDogLTEsIG92ZXJmbG93OiBcImhpZGRlblwiLCB0b3A6IFwiMHB4XCIsIGxlZnQ6IFwiMHB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwiaGlkZGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2luaXRDbHVzdGVyKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvL3dlJ3JlIGdvaW5nIHRvIHJlcGxpY2F0ZSBhIGNsdXN0ZXIgZ3JhcGhpYyBpbiB0aGUgc3ZnIGVsZW1lbnQgd2UgYWRkZWQgdG8gdGhlIGxheWVyIHZpZXcuIEp1c3Qgc28gaXQgY2FuIGJlIHN0eWxlZCBlYXNpbHkuIE5hdGl2ZSBXZWJHTCBmb3IgU2NlbmUgVmlld3Mgd291bGQgcHJvYmFibHkgYmUgYmV0dGVyLCBidXQgYXQgbGVhc3QgdGhpcyB3YXkgY3NzIGNhbiBzdGlsbCBiZSB1c2VkIHRvIHN0eWxlL2FuaW1hdGUgdGhpbmdzLlxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwID0gc3VyZmFjZS5jb250YWluZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUsIFwiY2x1c3Rlci1ncm91cFwiKTtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgdGhlIGNsdXN0ZXIgc2hhcGVcclxuICAgICAgICBsZXQgY2xvbmVkQ2x1c3RlckVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXApO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGNsb25lZENsdXN0ZXJFbGVtZW50LCBcImNsdXN0ZXJcIik7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIHRoZSBjbHVzdGVyIHRleHQgc2hhcGVcclxuICAgICAgICBsZXQgY2xvbmVkVGV4dEVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXApO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGNsb25lZFRleHRFbGVtZW50LCBcImNsdXN0ZXItdGV4dFwiKTtcclxuICAgICAgICBjbG9uZWRUZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoY2xvbmVkQ2x1c3RlckVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoY2xvbmVkVGV4dEVsZW1lbnQpO1xyXG4gICAgICAgXHJcbiAgICAgICAgLy9zZXQgdGhlIGdyb3VwIGNsYXNzICAgICBcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0RmxhcmVzKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlciB8fCAhdGhpcy5kaXNwbGF5RmxhcmVzKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBncmlkQ2x1c3RlciA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vY2hlY2sgaWYgd2UgbmVlZCB0byBjcmVhdGUgZmxhcmVzIGZvciB0aGUgY2x1c3RlclxyXG4gICAgICAgIGxldCBzaW5nbGVGbGFyZXMgPSAoZ3JpZENsdXN0ZXIuc2luZ2xlcyAmJiBncmlkQ2x1c3Rlci5zaW5nbGVzLmxlbmd0aCA+IDApICYmIChncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KTtcclxuICAgICAgICBsZXQgc3ViVHlwZUZsYXJlcyA9ICFzaW5nbGVGbGFyZXMgJiYgKGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMgJiYgZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5sZW5ndGggPiAwKTtcclxuXHJcbiAgICAgICAgaWYgKCFzaW5nbGVGbGFyZXMgJiYgIXN1YlR5cGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuOyAvL25vIGZsYXJlcyByZXF1aXJlZFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZsYXJlczogRmxhcmVbXSA9IFtdO1xyXG4gICAgICAgIGlmIChzaW5nbGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGdyaWRDbHVzdGVyLnNpbmdsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBmID0gbmV3IEZsYXJlKCk7XHJcbiAgICAgICAgICAgICAgICBmLnRvb2x0aXBUZXh0ID0gZ3JpZENsdXN0ZXIuc2luZ2xlc1tpXVt0aGlzLnNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5XTtcclxuICAgICAgICAgICAgICAgIGYuc2luZ2xlRGF0YSA9IGdyaWRDbHVzdGVyLnNpbmdsZXNbaV07XHJcbiAgICAgICAgICAgICAgICBmLmZsYXJlVGV4dCA9IFwiXCI7XHJcbiAgICAgICAgICAgICAgICBmbGFyZXMucHVzaChmKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChzdWJUeXBlRmxhcmVzKSB7XHJcblxyXG4gICAgICAgICAgICAvL3NvcnQgc3ViIHR5cGVzIGJ5IGhpZ2hlc3QgY291bnQgZmlyc3RcclxuICAgICAgICAgICAgdmFyIHN1YlR5cGVzID0gZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5jb3VudCAtIGEuY291bnQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN1YlR5cGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZiA9IG5ldyBGbGFyZSgpO1xyXG4gICAgICAgICAgICAgICAgZi50b29sdGlwVGV4dCA9IGAke3N1YlR5cGVzW2ldLm5hbWV9ICgke3N1YlR5cGVzW2ldLmNvdW50fSlgO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZVRleHQgPSBzdWJUeXBlc1tpXS5jb3VudDtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2lmIHRoZXJlIGFyZSBtb3JlIGZsYXJlIG9iamVjdHMgdG8gY3JlYXRlIHRoYW4gdGhlIG1heEZsYXJlQ291bnQgYW5kIHRoaXMgaXMgYSBvbmUgb2YgdGhvc2UgLSBjcmVhdGUgYSBzdW1tYXJ5IGZsYXJlIHRoYXQgY29udGFpbnMgJy4uLicgYXMgdGhlIHRleHQgYW5kIG1ha2UgdGhpcyBvbmUgcGFydCBvZiBpdCBcclxuICAgICAgICBsZXQgd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPSBmbGFyZXMubGVuZ3RoID4gdGhpcy5tYXhGbGFyZUNvdW50O1xyXG4gICAgICAgIGxldCBmbGFyZUNvdW50ID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPyB0aGlzLm1heEZsYXJlQ291bnQgOiBmbGFyZXMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvL2lmIHRoZXJlJ3MgYW4gZXZlbiBhbW91bnQgb2YgZmxhcmVzLCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgdG8gdGhlIGxlZnQsIG1pbnVzIDE4MCBmcm9tIGRlZ3JlZSB0byBkbyB0aGlzLlxyXG4gICAgICAgIC8vZm9yIGFuIGFkZCBhbW91bnQgcG9zaXRpb24gdGhlIGZpcnN0IGZsYXJlIG9uIHRvcCwgLTkwIHRvIGRvIHRoaXMuIExvb2tzIG1vcmUgc3ltbWV0cmljYWwgdGhpcyB3YXkuXHJcbiAgICAgICAgbGV0IGRlZ3JlZVZhcmlhbmNlID0gKGZsYXJlQ291bnQgJSAyID09PSAwKSA/IC0xODAgOiAtOTA7XHJcbiAgICAgICAgbGV0IHZpZXdSb3RhdGlvbiA9IHRoaXMuX2lzMmQgPyB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uIDogMDtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTY3JlZW5Qb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9TY3JlZW4odGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSk7XHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTeW1ib2xTaXplID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2wuZ2V0KFwic2l6ZVwiKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZsYXJlQ291bnQ7IGkrKykge1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlID0gZmxhcmVzW2ldO1xyXG5cclxuICAgICAgICAgICAgLy9zZXQgc29tZSBhdHRyaWJ1dGUgZGF0YVxyXG4gICAgICAgICAgICBsZXQgZmxhcmVBdHRyaWJ1dGVzID0ge1xyXG4gICAgICAgICAgICAgICAgaXNGbGFyZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzU3VtbWFyeUZsYXJlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0OiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgZmxhcmVUZXh0R3JhcGhpYzogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckdyYXBoaWNJZDogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxldCBmbGFyZVRleHRBdHRyaWJ1dGVzID0ge307XHJcblxyXG4gICAgICAgICAgICAvL0RvIGEgY291cGxlIG9mIHRoaW5ncyBkaWZmZXJlbnRseSBpZiB0aGlzIGlzIGEgc3VtbWFyeSBmbGFyZSBvciBub3RcclxuICAgICAgICAgICAgbGV0IGlzU3VtbWFyeUZsYXJlID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgJiYgaSA+PSB0aGlzLm1heEZsYXJlQ291bnQgLSAxO1xyXG4gICAgICAgICAgICBpZiAoaXNTdW1tYXJ5RmxhcmUpIHsgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGZsYXJlLmlzU3VtbWFyeSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBmbGFyZUF0dHJpYnV0ZXMuaXNTdW1tYXJ5RmxhcmUgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgbGV0IHRvb2x0aXBUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIC8vbXVsdGlsaW5lIHRvb2x0aXAgZm9yIHN1bW1hcnkgZmxhcmVzLCBpZTogZ3JlYXRlciB0aGFuIHRoaXMubWF4RmxhcmVDb3VudCBmbGFyZXMgcGVyIGNsdXN0ZXJcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSB0aGlzLm1heEZsYXJlQ291bnQgLSAxLCBqbGVuID0gZmxhcmVzLmxlbmd0aDsgaiA8IGpsZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGogPiAodGhpcy5tYXhGbGFyZUNvdW50IC0gMSkgPyBcIlxcblwiIDogXCJcIjtcclxuICAgICAgICAgICAgICAgICAgICB0b29sdGlwVGV4dCArPSBmbGFyZXNbal0udG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmbGFyZS50b29sdGlwVGV4dCA9IHRvb2x0aXBUZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy50b29sdGlwVGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG4gICAgICAgICAgIFxyXG4gICAgICAgICAgICAvL2NyZWF0ZSBhIGdyYXBoaWMgZm9yIHRoZSBmbGFyZSBhbmQgZm9yIHRoZSBmbGFyZSB0ZXh0XHJcbiAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiBmbGFyZUF0dHJpYnV0ZXMsXHJcbiAgICAgICAgICAgICAgICBnZW9tZXRyeTogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSxcclxuICAgICAgICAgICAgICAgIHBvcHVwVGVtcGxhdGU6IG51bGxcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBmbGFyZS5ncmFwaGljLnN5bWJvbCA9IHRoaXMuX2dldEZsYXJlU3ltYm9sKGZsYXJlLmdyYXBoaWMpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICBmbGFyZS5ncmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAwO1xyXG4gICAgICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICAgICAgaWYgKGZsYXJlLmZsYXJlVGV4dCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IHRleHRTeW1ib2wgPSB0aGlzLmZsYXJlVGV4dFN5bWJvbC5jbG9uZSgpO1xyXG4gICAgICAgICAgICAgICAgdGV4dFN5bWJvbC50ZXh0ID0gIWlzU3VtbWFyeUZsYXJlID8gZmxhcmUuZmxhcmVUZXh0LnRvU3RyaW5nKCkgOiBcIi4uLlwiO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0U3ltYm9sLmFuZ2xlID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBmbGFyZS50ZXh0R3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlckdyYXBoaWNJZDogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVySWRcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHN5bWJvbDogdGV4dFN5bWJvbCxcclxuICAgICAgICAgICAgICAgICAgICBnZW9tZXRyeTogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vZmxhcmVzIGhhdmUgYmVlbiBjcmVhdGVkIHNvIGFkZCB0aGVtIHRvIHRoZSBkb21cclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZmxhcmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBmID0gZmxhcmVzW2ldO1xyXG4gICAgICAgICAgICBpZiAoIWYuZ3JhcGhpYykgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICAvL2NyZWF0ZSBhIGdyb3VwIHRvIGhvbGQgZmxhcmUgb2JqZWN0IGFuZCB0ZXh0IGlmIG5lZWRlZC5cclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAuY3JlYXRlR3JvdXAoKTtcclxuICAgICAgICAgICAgbGV0IHBvc2l0aW9uID0gdGhpcy5fc2V0RmxhcmVQb3NpdGlvbihmLmZsYXJlR3JvdXAsIGNsdXN0ZXJTeW1ib2xTaXplLCBmbGFyZUNvdW50LCBpLCBkZWdyZWVWYXJpYW5jZSwgdmlld1JvdGF0aW9uKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImZsYXJlLWdyb3VwXCIpO1xyXG4gICAgICAgICAgICBsZXQgZmxhcmVFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYuZ3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVFbGVtZW50KTtcclxuICAgICAgICAgICAgaWYgKGYudGV4dEdyYXBoaWMpIHtcclxuICAgICAgICAgICAgICAgIGxldCBmbGFyZVRleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYudGV4dEdyYXBoaWMsIGYuZmxhcmVHcm91cCk7XHJcbiAgICAgICAgICAgICAgICBmbGFyZVRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGZsYXJlVGV4dEVsZW1lbnQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIiwgMTApO1xyXG5cclxuICAgICAgICAgICAgLy9hc3NpZ24gc29tZSBldmVudCBoYW5kbGVycyBmb3IgdGhlIHRvb2x0aXBzXHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5tb3VzZUVudGVyID0gb24ucGF1c2FibGUoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwibW91c2VlbnRlclwiLCAoKSA9PiB0aGlzLl9jcmVhdGVUb29sdGlwKGYpKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLm1vdXNlTGVhdmUgPSBvbi5wYXVzYWJsZShmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJtb3VzZWxlYXZlXCIsICgpID0+IHRoaXMuX2Rlc3Ryb3lUb29sdGlwKCkpO1xyXG4gICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zZXRGbGFyZVBvc2l0aW9uKGZsYXJlR3JvdXA6IGFueSwgY2x1c3RlclN5bWJvbFNpemU6IG51bWJlciwgZmxhcmVDb3VudDogbnVtYmVyLCBmbGFyZUluZGV4OiBudW1iZXIsIGRlZ3JlZVZhcmlhbmNlOiBudW1iZXIsIHZpZXdSb3RhdGlvbjogbnVtYmVyKSB7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSBwb3NpdGlvbiBvZiB0aGUgZmxhcmUgdG8gYmUgcGxhY2VkIGFyb3VuZCB0aGUgY29udGFpbmVyIGNpcmNsZS5cclxuICAgICAgICBsZXQgZGVncmVlID0gcGFyc2VJbnQoKCgzNjAgLyBmbGFyZUNvdW50KSAqIGZsYXJlSW5kZXgpLnRvRml4ZWQoKSk7XHJcbiAgICAgICAgZGVncmVlID0gZGVncmVlICsgZGVncmVlVmFyaWFuY2U7XHJcblxyXG4gICAgICAgIC8vdGFrZSBpbnRvIGFjY291bnQgYW55IHJvdGF0aW9uIG9uIHRoZSB2aWV3XHJcbiAgICAgICAgaWYgKHZpZXdSb3RhdGlvbiAhPT0gMCkge1xyXG4gICAgICAgICAgICBkZWdyZWUgLT0gdmlld1JvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHJhZGlhbiA9IGRlZ3JlZSAqIChNYXRoLlBJIC8gMTgwKTtcclxuICAgICAgICBsZXQgYnVmZmVyID0gdGhpcy5mbGFyZUJ1ZmZlclBpeGVscztcclxuXHJcbiAgICAgICAgLy9wb3NpdGlvbiB0aGUgZmxhcmUgZ3JvdXAgYXJvdW5kIHRoZSBjbHVzdGVyXHJcbiAgICAgICAgbGV0IHBvc2l0aW9uID0ge1xyXG4gICAgICAgICAgICB4OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5jb3MocmFkaWFuKSxcclxuICAgICAgICAgICAgeTogKGJ1ZmZlciArIGNsdXN0ZXJTeW1ib2xTaXplKSAqIE1hdGguc2luKHJhZGlhbilcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAuc2V0VHJhbnNmb3JtKHsgZHg6IHBvc2l0aW9uLngsIGR5OiBwb3NpdGlvbi55IH0pO1xyXG4gICAgICAgIHJldHVybiBwb3NpdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9nZXRGbGFyZVN5bWJvbChmbGFyZUdyYXBoaWM6IEdyYXBoaWMpOiBTaW1wbGVNYXJrZXJTeW1ib2wge1xyXG4gICAgICAgIHJldHVybiAhdGhpcy5mbGFyZVJlbmRlcmVyID8gdGhpcy5mbGFyZVN5bWJvbCA6IHRoaXMuZmxhcmVSZW5kZXJlci5nZXRDbGFzc0JyZWFrSW5mbyhmbGFyZUdyYXBoaWMpLnN5bWJvbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVUb29sdGlwKGZsYXJlOiBGbGFyZSkge1xyXG5cclxuICAgICAgICBsZXQgZmxhcmVHcm91cCA9IGZsYXJlLmZsYXJlR3JvdXA7XHJcbiAgICAgICAgdGhpcy5fZGVzdHJveVRvb2x0aXAoKTtcclxuXHJcbiAgICAgICAgbGV0IHRvb2x0aXBMZW5ndGggPSBxdWVyeShcIi50b29sdGlwLXRleHRcIiwgZmxhcmVHcm91cC5yYXdOb2RlKS5sZW5ndGg7XHJcbiAgICAgICAgaWYgKHRvb2x0aXBMZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSB0ZXh0IGZyb20gdGhlIGRhdGEtdG9vbHRpcCBhdHRyaWJ1dGUgb2YgdGhlIHNoYXBlIG9iamVjdFxyXG4gICAgICAgIGxldCB0ZXh0ID0gZmxhcmUudG9vbHRpcFRleHQ7XHJcbiAgICAgICAgaWYgKCF0ZXh0KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibm8gdG9vbHRpcCB0ZXh0IGZvciBmbGFyZS5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vc3BsaXQgb24gXFxuIGNoYXJhY3RlciB0aGF0IHNob3VsZCBiZSBpbiB0b29sdGlwIHRvIHNpZ25pZnkgbXVsdGlwbGUgbGluZXNcclxuICAgICAgICBsZXQgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpO1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSBhIGdyb3VwIHRvIGhvbGQgdGhlIHRvb2x0aXAgZWxlbWVudHNcclxuICAgICAgICBsZXQgdG9vbHRpcEdyb3VwID0gZmxhcmVHcm91cC5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICAvL2dldCB0aGUgZmxhcmUgc3ltYm9sLCB3ZSdsbCB1c2UgdGhpcyB0byBzdHlsZSB0aGUgdG9vbHRpcCBib3hcclxuICAgICAgICBsZXQgZmxhcmVTeW1ib2wgPSB0aGlzLl9nZXRGbGFyZVN5bWJvbChmbGFyZS5ncmFwaGljKTtcclxuXHJcbiAgICAgICAgLy9hbGlnbiBvbiB0b3AgZm9yIG5vcm1hbCBmbGFyZSwgYWxpZ24gb24gYm90dG9tIGZvciBzdW1tYXJ5IGZsYXJlcy5cclxuICAgICAgICBsZXQgaGVpZ2h0ID0gZmxhcmVTeW1ib2wuc2l6ZTtcclxuXHJcbiAgICAgICAgbGV0IHhQb3MgPSAxO1xyXG4gICAgICAgIGxldCB5UG9zID0gIWZsYXJlLmlzU3VtbWFyeSA/ICgoaGVpZ2h0KSAqIC0xKSA6IGhlaWdodCArIDU7XHJcblxyXG4gICAgICAgIHRvb2x0aXBHcm91cC5yYXdOb2RlLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwidG9vbHRpcC10ZXh0XCIpO1xyXG4gICAgICAgIGxldCB0ZXh0U2hhcGVzID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgdGV4dFNoYXBlID0gdG9vbHRpcEdyb3VwLmNyZWF0ZVRleHQoeyB4OiB4UG9zLCB5OiB5UG9zICsgKGkgKiAxMCksIHRleHQ6IGxpbmVzW2ldLCBhbGlnbjogJ21pZGRsZScgfSlcclxuICAgICAgICAgICAgICAgIC5zZXRGaWxsKHRoaXMuZmxhcmVUZXh0U3ltYm9sLmNvbG9yKVxyXG4gICAgICAgICAgICAgICAgLnNldEZvbnQoeyBzaXplOiAxMCwgZmFtaWx5OiB0aGlzLmZsYXJlVGV4dFN5bWJvbC5mb250LmdldChcImZhbWlseVwiKSwgd2VpZ2h0OiB0aGlzLmZsYXJlVGV4dFN5bWJvbC5mb250LmdldChcIndlaWdodFwiKSB9KTtcclxuXHJcbiAgICAgICAgICAgIHRleHRTaGFwZXMucHVzaCh0ZXh0U2hhcGUpO1xyXG4gICAgICAgICAgICB0ZXh0U2hhcGUucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcmVjdFBhZGRpbmcgPSAyO1xyXG4gICAgICAgIGxldCB0ZXh0Qm94ID0gdG9vbHRpcEdyb3VwLmdldEJvdW5kaW5nQm94KCk7XHJcblxyXG4gICAgICAgIGxldCByZWN0U2hhcGUgPSB0b29sdGlwR3JvdXAuY3JlYXRlUmVjdCh7IHg6IHRleHRCb3gueCAtIHJlY3RQYWRkaW5nLCB5OiB0ZXh0Qm94LnkgLSByZWN0UGFkZGluZywgd2lkdGg6IHRleHRCb3gud2lkdGggKyAocmVjdFBhZGRpbmcgKiAyKSwgaGVpZ2h0OiB0ZXh0Qm94LmhlaWdodCArIChyZWN0UGFkZGluZyAqIDIpLCByOiAwIH0pXHJcbiAgICAgICAgICAgIC5zZXRGaWxsKGZsYXJlU3ltYm9sLmNvbG9yKTtcclxuXHJcbiAgICAgICAgaWYgKGZsYXJlU3ltYm9sLm91dGxpbmUpIHtcclxuICAgICAgICAgICAgcmVjdFNoYXBlLnNldFN0cm9rZSh7IGNvbG9yOiBmbGFyZVN5bWJvbC5vdXRsaW5lLmNvbG9yLCB3aWR0aDogMC41IH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVjdFNoYXBlLnJhd05vZGUuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG5cclxuICAgICAgICBmbGFyZUdyb3VwLm1vdmVUb0Zyb250KCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRleHRTaGFwZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgdGV4dFNoYXBlc1tpXS5tb3ZlVG9Gcm9udCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9kZXN0cm95VG9vbHRpcCgpIHtcclxuICAgICAgICBxdWVyeShcIi50b29sdGlwLXRleHRcIiwgdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlLnJhd05vZGUpLmZvckVhY2goZG9tQ29uc3RydWN0LmRlc3Ryb3kpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gaGVscGVyIGZ1bmN0aW9uc1xyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyhncmFwaGljOiBHcmFwaGljLCBzdXJmYWNlOiBhbnkpOiBIVE1MRWxlbWVudCB7XHJcblxyXG4gICAgICAgIC8vZmFrZSBvdXQgYSBHRlhPYmplY3Qgc28gd2UgY2FuIGdlbmVyYXRlIGFuIHN2ZyBzaGFwZSB0aGF0IHRoZSBwYXNzZWQgaW4gZ3JhcGhpY3Mgc2hhcGVcclxuICAgICAgICBsZXQgZyA9IG5ldyBHRlhPYmplY3QoKTtcclxuICAgICAgICBnLmdyYXBoaWMgPSBncmFwaGljO1xyXG4gICAgICAgIGcucmVuZGVyaW5nSW5mbyA9IHsgc3ltYm9sOiBncmFwaGljLnN5bWJvbCB9O1xyXG5cclxuICAgICAgICAvL3NldCB1cCBwYXJhbWV0ZXJzIGZvciB0aGUgY2FsbCB0byByZW5kZXJcclxuICAgICAgICAvL3NldCB0aGUgdHJhbnNmb3JtIG9mIHRoZSBwcm9qZWN0b3IgdG8gMCdzIGFzIHdlJ3JlIGp1c3QgcGxhY2luZyB0aGUgZ2VuZXJhdGVkIGNsdXN0ZXIgc2hhcGUgYXQgZXhhY3RseSAwLDAuXHJcbiAgICAgICAgbGV0IHByb2plY3RvciA9IG5ldyBQcm9qZWN0b3IoKTtcclxuICAgICAgICBwcm9qZWN0b3IuX3RyYW5zZm9ybSA9IFswLCAwLCAwLCAwLCAwLCAwXTtcclxuICAgICAgICBwcm9qZWN0b3IuX3Jlc29sdXRpb24gPSAwO1xyXG5cclxuICAgICAgICBsZXQgc3RhdGUgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQpIHtcclxuICAgICAgICAgICAgc3RhdGUgPSB0aGlzLl9hY3RpdmVWaWV3LnN0YXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy9mYWtlIG91dCBhIHN0YXRlIG9iamVjdCBmb3IgM2Qgdmlld3MuXHJcbiAgICAgICAgICAgIHN0YXRlID0ge1xyXG4gICAgICAgICAgICAgICAgY2xpcHBlZEV4dGVudDogdGhpcy5fYWN0aXZlVmlldy5leHRlbnQsXHJcbiAgICAgICAgICAgICAgICByb3RhdGlvbjogMCxcclxuICAgICAgICAgICAgICAgIHNwYXRpYWxSZWZlcmVuY2U6IHRoaXMuX2FjdGl2ZVZpZXcuc3BhdGlhbFJlZmVyZW5jZSxcclxuICAgICAgICAgICAgICAgIHdvcmxkU2NyZWVuV2lkdGg6IDFcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBwYXIgPSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2U6IHN1cmZhY2UsXHJcbiAgICAgICAgICAgIHN0YXRlOiBzdGF0ZSxcclxuICAgICAgICAgICAgcHJvamVjdG9yOiBwcm9qZWN0b3JcclxuICAgICAgICB9O1xyXG4gICAgICAgIGcucmVuZGVyKHBhcik7XHJcbiAgICAgICAgcmV0dXJuIGcuX3NoYXBlLnJhd05vZGU7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2V4dGVudCgpOiBFeHRlbnQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5leHRlbnQgOiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2NhbGUoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYWN0aXZlVmlldyA/IHRoaXMuX2FjdGl2ZVZpZXcuc2NhbGUgOiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy9JRSAvIEVkZ2UgZG9uJ3QgaGF2ZSB0aGUgY2xhc3NMaXN0IHByb3BlcnR5IG9uIHN2ZyBlbGVtZW50cywgc28gd2UgY2FuJ3QgdXNlIHRoYXQgYWRkIC8gcmVtb3ZlIGNsYXNzZXMgLSBwcm9iYWJseSB3aHkgZG9qbyBkb21DbGFzcyBkb2Vzbid0IHdvcmsgZWl0aGVyLlxyXG4gICAgLy9zbyB0aGUgZm9sbG93aW5nIHR3byBmdW5jdGlvbnMgYXJlIGRvZGd5IHN0cmluZyBoYWNrcyB0byBhZGQgLyByZW1vdmUgY2xhc3Nlcy4gVXNlcyBhIHRpbWVvdXQgc28geW91IGNhbiBtYWtlIGNzcyB0cmFuc2l0aW9ucyB3b3JrIGlmIGRlc2lyZWQuXHJcbiAgICBwcml2YXRlIF9hZGRDbGFzc1RvRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCwgY2xhc3NOYW1lOiBzdHJpbmcsIHRpbWVvdXRNcz86IG51bWJlciwgY2FsbGJhY2s/OiBGdW5jdGlvbikge1xyXG5cclxuICAgICAgICBsZXQgYWRkQ2xhc3M6IEZ1bmN0aW9uID0gKF9lbGVtZW50LCBfY2xhc3NOYW1lKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjdXJyZW50Q2xhc3MgPSBfZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKTtcclxuICAgICAgICAgICAgaWYgKCFjdXJyZW50Q2xhc3MpIGN1cnJlbnRDbGFzcyA9IFwiXCI7XHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50Q2xhc3MuaW5kZXhPZihcIiBcIiArIF9jbGFzc05hbWUpICE9PSAtMSkgcmV0dXJuO1xyXG4gICAgICAgICAgICBsZXQgbmV3Q2xhc3MgPSAoY3VycmVudENsYXNzICsgXCIgXCIgKyBfY2xhc3NOYW1lKS50cmltKCk7XHJcbiAgICAgICAgICAgIF9lbGVtZW50LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIG5ld0NsYXNzKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodGltZW91dE1zKSB7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgYWRkQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIHRpbWVvdXRNcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfcmVtb3ZlQ2xhc3NGcm9tRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCwgY2xhc3NOYW1lOiBzdHJpbmcsIHRpbWVvdXRNcz86IG51bWJlciwgY2FsbGJhY2s/OiBGdW5jdGlvbikge1xyXG5cclxuICAgICAgICBsZXQgcmVtb3ZlQ2xhc3M6IEZ1bmN0aW9uID0gKF9lbGVtZW50LCBfY2xhc3NOYW1lKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjdXJyZW50Q2xhc3MgPSBfZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKTtcclxuICAgICAgICAgICAgaWYgKCFjdXJyZW50Q2xhc3MpIHJldHVybjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgPT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIF9lbGVtZW50LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIGN1cnJlbnRDbGFzcy5yZXBsYWNlKFwiIFwiICsgX2NsYXNzTmFtZSwgXCJcIikpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZW1vdmVDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9nZXRNb3VzZVBvcyhldnQpIHtcclxuICAgICAgICAvL2NvbnRhaW5lciBvbiB0aGUgdmlldyBpcyBhY3R1YWxseSBhIGh0bWwgZWxlbWVudCBhdCB0aGlzIHBvaW50LCBub3QgYSBzdHJpbmcgYXMgdGhlIHR5cGluZ3Mgc3VnZ2VzdC5cclxuICAgICAgICBsZXQgY29udGFpbmVyOiBhbnkgPSB0aGlzLl9hY3RpdmVWaWV3LmNvbnRhaW5lcjtcclxuICAgICAgICBsZXQgcmVjdCA9IGNvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB4OiBldnQuY2xpZW50WCAtIHJlY3QubGVmdCxcclxuICAgICAgICAgICAgeTogZXZ0LmNsaWVudFkgLSByZWN0LnRvcFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0dGluZyB2aXNpYmxlIHRvIGZhbHNlIG9uIGEgZ3JhcGhpYyBkb2Vzbid0IHdvcmsgaW4gNC4yIGZvciBzb21lIHJlYXNvbi4gUmVtb3ZpbmcgdGhlIGdyYXBoaWMgdG8gaGlkZSBpdCBpbnN0ZWFkLiBJIHRoaW5rIHZpc2libGUgcHJvcGVydHkgc2hvdWxkIHByb2JhYmx5IHdvcmsgdGhvdWdoLlxyXG4gICAgICogQHBhcmFtIGdyYXBoaWNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfaGlkZUdyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYyB8IEdyYXBoaWNbXSkge1xyXG4gICAgICAgIGlmICghZ3JhcGhpYykgcmV0dXJuO1xyXG4gICAgICAgIGlmIChncmFwaGljLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTWFueSg8R3JhcGhpY1tdPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmUoPEdyYXBoaWM+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Nob3dHcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMgfCBHcmFwaGljW10pIHtcclxuICAgICAgICBpZiAoIWdyYXBoaWMpIHJldHVybjtcclxuICAgICAgICBpZiAoZ3JhcGhpYy5oYXNPd25Qcm9wZXJ0eShcImxlbmd0aFwiKSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZE1hbnkoPEdyYXBoaWNbXT5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkKDxHcmFwaGljPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyNlbmRyZWdpb25cclxuXHJcbn1cclxuXHJcblxyXG5pbnRlcmZhY2UgQWN0aXZlVmlldyBleHRlbmRzIF9fZXNyaS5WaWV3IHtcclxuICAgIGNhbnZhczogYW55O1xyXG4gICAgc3RhdGU6IGFueTtcclxuICAgIGV4dGVudDogRXh0ZW50O1xyXG4gICAgc2NhbGU6IG51bWJlcjtcclxuICAgIGZjbFN1cmZhY2U6IGFueTtcclxuICAgIGZjbFBvaW50ZXJNb3ZlOiBJSGFuZGxlOyAgICBcclxuICAgIHJvdGF0aW9uOiBudW1iZXI7XHJcblxyXG4gICAgdG9TY3JlZW4oZ2VvbWV0cnk6IF9fZXNyaS5HZW9tZXRyeSwgc3A/OiBTY3JlZW5Qb2ludCk6IFNjcmVlblBvaW50O1xyXG4gICAgaGl0VGVzdChzY3JyZW5Qb2ludDogU2NyZWVuUG9pbnQpOiBhbnk7XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRDbHVzdGVyIHtcclxuICAgIGV4dGVudDogYW55O1xyXG4gICAgY2x1c3RlckNvdW50OiBudW1iZXI7XHJcbiAgICBzdWJUeXBlQ291bnRzOiBhbnlbXSA9IFtdO1xyXG4gICAgc2luZ2xlczogYW55W10gPSBbXTtcclxuICAgIHBvaW50czogYW55W10gPSBbXTtcclxuICAgIHg6IG51bWJlcjtcclxuICAgIHk6IG51bWJlcjtcclxufVxyXG5cclxuXHJcbmNsYXNzIENsdXN0ZXIge1xyXG4gICAgY2x1c3RlckdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0ZXh0R3JhcGhpYzogR3JhcGhpYztcclxuICAgIGFyZWFHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgY2x1c3RlcklkOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyR3JvdXA6IGFueTtcclxuICAgIGdyaWRDbHVzdGVyOiBHcmlkQ2x1c3RlcjtcclxufVxyXG5cclxuY2xhc3MgRmxhcmUgeyBcclxuICAgIGdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0ZXh0R3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRvb2x0aXBUZXh0OiBzdHJpbmc7XHJcbiAgICBmbGFyZVRleHQ6IHN0cmluZztcclxuICAgIHNpbmdsZURhdGE6IGFueVtdO1xyXG4gICAgZmxhcmVHcm91cDogYW55O1xyXG4gICAgaXNTdW1tYXJ5OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUG9pbnRGaWx0ZXIge1xyXG4gICAgZmlsdGVyTmFtZTogc3RyaW5nO1xyXG4gICAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICBwcm9wZXJ0eVZhbHVlczogYW55W107XHJcblxyXG4gICAgLy9kZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGZpbHRlciBpbmNsdWRlcyBvciBleGNsdWRlcyB0aGUgcG9pbnQgZGVwZW5kaW5nIG9uIHdoZXRoZXIgaXQgY29udGFpbnMgdGhlIHByb3BlcnR5IHZhbHVlLlxyXG4gICAgLy9mYWxzZSBtZWFucyB0aGUgcG9pbnQgd2lsbCBiZSBleGNsdWRlZCBpZiB0aGUgdmFsdWUgZG9lcyBleGlzdCBpbiB0aGUgb2JqZWN0LCB0cnVlIG1lYW5zIGl0IHdpbGwgYmUgZXhjbHVkZWQgaWYgaXQgZG9lc24ndC5cclxuICAgIGtlZXBPbmx5SWZWYWx1ZUV4aXN0czogYm9vbGVhbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihmaWx0ZXJOYW1lOiBzdHJpbmcsIHByb3BlcnR5TmFtZTogc3RyaW5nLCB2YWx1ZXM6IGFueVtdLCBrZWVwT25seUlmVmFsdWVFeGlzdHM6IGJvb2xlYW4gPSBmYWxzZSkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVyTmFtZSA9IGZpbHRlck5hbWU7XHJcbiAgICAgICAgdGhpcy5wcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eU5hbWU7XHJcbiAgICAgICAgdGhpcy5wcm9wZXJ0eVZhbHVlcyA9IHZhbHVlcztcclxuICAgICAgICB0aGlzLmtlZXBPbmx5SWZWYWx1ZUV4aXN0cyA9IGtlZXBPbmx5SWZWYWx1ZUV4aXN0cztcclxuICAgIH1cclxuXHJcbn1cclxuXHJcbiJdfQ==
