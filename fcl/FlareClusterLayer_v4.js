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
    //TODO: 
    //  - resizing window throws out the clusters surface, need to force a redraw on window resize.
    //  - why is chrome on my pc fucked.
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
            this.viewPopupMessageEnabled = evt.layerView.view.popup.messageEnabled;
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
                v.fclPointerMove = v.on("pointer-move", function (evt) { return _this._viewPointerMove(evt); });
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
            var sp = new ScreenPoint({ x: evt.x, y: evt.y });
            //if there's an active cluster and the current screen pos is within the bounds of that cluster's group container, don't do anything more. 
            //TODO: would probably be better to check if the point is in the actual circle of the cluster group and it's flares instead of using the rectangle bounding box.
            if (this._activeCluster) {
                var bbox = this._activeCluster.clusterGroup.rawNode.getBoundingClientRect();
                if (bbox) {
                    if (evt.x >= bbox.left && evt.x <= bbox.right && evt.y >= bbox.top && evt.y <= bbox.bottom)
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
            var sp = this._activeView.toScreen(this._activeCluster.clusterGraphic.geometry);
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
                //let flarePoint = this._getFlarePoint(clusterScreenPoint, clusterSymbolSize, flareCount, i, degreeVariance, viewRotation);
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
            //set the position by adding a transform
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkZsYXJlQ2x1c3RlckxheWVyX3Y0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhDQUE4Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFnRjlDLElBQUksaUJBQWlCLEdBQWlDLHlCQUF5QixDQUFDLFFBQVEsQ0FBTSxhQUFhLENBQUMsQ0FBQztJQUc3RyxRQUFRO0lBQ1IsK0ZBQStGO0lBQy9GLG9DQUFvQztJQUdwQztRQUF1QyxxQ0FBaUI7UUFvRHBELDJCQUFZLE9BQW9DO1lBcERwRCxpQkFpaUNDO1lBMytCTyxrQkFBTSxPQUFPLENBQUMsQ0FBQztZQWpCWCxtQkFBYyxHQUFXLENBQUMsQ0FBQztZQVMzQixjQUFTLEdBQXNDLEVBQUUsQ0FBQztZQVV0RCxrQkFBa0I7WUFDbEIsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNYLDZCQUE2QjtnQkFDN0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxpRUFBaUUsQ0FBQyxDQUFDO2dCQUNqRixNQUFNLENBQUM7WUFDWCxDQUFDO1lBRUQsSUFBSSxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQztZQUV2RCxrQ0FBa0M7WUFDbEMsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQztZQUMvQyxJQUFJLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQyxjQUFjLElBQUksT0FBTyxDQUFDO1lBQ3hELElBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsSUFBSSxDQUFDLENBQUM7WUFDcEQsSUFBSSxDQUFDLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywwQkFBMEIsSUFBSSxNQUFNLENBQUM7WUFDL0UsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsS0FBSyxNQUFNLEdBQUcsU0FBUyxHQUFHLE9BQU8sQ0FB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LElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1lBQ2pDLElBQUksQ0FBQyxjQUFjLEdBQUcsTUFBTSxDQUFDO1lBQzdCLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxxQkFBcUIsQ0FBQztRQUN2RCxDQUFDO1FBRUwsa0JBQUM7SUFBRCxDQWhCQSxBQWdCQyxJQUFBO0lBaEJZLG1CQUFXLGNBZ0J2QixDQUFBIiwiZmlsZSI6IkZsYXJlQ2x1c3RlckxheWVyX3Y0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL3R5cGluZ3MvaW5kZXguZC50c1wiIC8+XHJcblxyXG5cclxuaW1wb3J0ICogYXMgR3JhcGhpY3NMYXllciBmcm9tIFwiZXNyaS9sYXllcnMvR3JhcGhpY3NMYXllclwiO1xyXG5pbXBvcnQgKiBhcyBDbGFzc0JyZWFrc1JlbmRlcmVyIGZyb20gXCJlc3JpL3JlbmRlcmVycy9DbGFzc0JyZWFrc1JlbmRlcmVyXCI7XHJcbmltcG9ydCAqIGFzIFBvcHVwVGVtcGxhdGUgZnJvbSBcImVzcmkvUG9wdXBUZW1wbGF0ZVwiO1xyXG5pbXBvcnQgKiBhcyBTaW1wbGVNYXJrZXJTeW1ib2wgZnJvbSBcImVzcmkvc3ltYm9scy9TaW1wbGVNYXJrZXJTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgVGV4dFN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1RleHRTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgU2ltcGxlTGluZVN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1NpbXBsZUxpbmVTeW1ib2xcIjtcclxuaW1wb3J0ICogYXMgQ29sb3IgZnJvbSBcImVzcmkvQ29sb3JcIjtcclxuaW1wb3J0ICogYXMgd2F0Y2hVdGlscyBmcm9tICdlc3JpL2NvcmUvd2F0Y2hVdGlscyc7XHJcbmltcG9ydCAqIGFzIFZpZXcgZnJvbSAnZXNyaS92aWV3cy9WaWV3JztcclxuaW1wb3J0ICogYXMgd2ViTWVyY2F0b3JVdGlscyBmcm9tIFwiZXNyaS9nZW9tZXRyeS9zdXBwb3J0L3dlYk1lcmNhdG9yVXRpbHNcIjtcclxuaW1wb3J0ICogYXMgR3JhcGhpYyBmcm9tIFwiZXNyaS9HcmFwaGljXCI7XHJcbmltcG9ydCAqIGFzIFBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvaW50XCI7XHJcbmltcG9ydCAqIGFzIFNjcmVlblBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1NjcmVlblBvaW50XCI7XHJcbmltcG9ydCAqIGFzIE11bHRpcG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvTXVsdGlwb2ludFwiO1xyXG5pbXBvcnQgKiBhcyBQb2x5Z29uIGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvbHlnb25cIjtcclxuaW1wb3J0ICogYXMgZ2VvbWV0cnlFbmdpbmUgZnJvbSAnZXNyaS9nZW9tZXRyeS9nZW9tZXRyeUVuZ2luZSc7XHJcbmltcG9ydCAqIGFzIFNwYXRpYWxSZWZlcmVuY2UgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU3BhdGlhbFJlZmVyZW5jZVwiO1xyXG5pbXBvcnQgKiBhcyBFeHRlbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvRXh0ZW50XCI7XHJcbmltcG9ydCAqIGFzIGV4dGVybmFsUmVuZGVyZXJzIGZyb20gXCJlc3JpL3ZpZXdzLzNkL2V4dGVybmFsUmVuZGVyZXJzXCI7XHJcblxyXG5pbXBvcnQgKiBhcyBHRlhPYmplY3QgZnJvbSBcImVzcmkvdmlld3MvMmQvZW5naW5lL2dyYXBoaWNzL0dGWE9iamVjdFwiO1xyXG5pbXBvcnQgKiBhcyBQcm9qZWN0b3IgZnJvbSBcImVzcmkvdmlld3MvMmQvZW5naW5lL2dyYXBoaWNzL1Byb2plY3RvclwiO1xyXG4gXHJcbmltcG9ydCAqIGFzIGFjY2Vzc29yU3VwcG9ydERlY29yYXRvcnMgZnJvbSBcImVzcmkvY29yZS9hY2Nlc3NvclN1cHBvcnQvZGVjb3JhdG9yc1wiO1xyXG4gXHJcbmltcG9ydCAqIGFzIG9uIGZyb20gJ2Rvam8vb24nO1xyXG5pbXBvcnQgKiBhcyBnZnggZnJvbSAnZG9qb3gvZ2Z4JztcclxuaW1wb3J0ICogYXMgZG9tQ29uc3RydWN0IGZyb20gJ2Rvam8vZG9tLWNvbnN0cnVjdCc7XHJcbmltcG9ydCAqIGFzIHF1ZXJ5IGZyb20gJ2Rvam8vcXVlcnknO1xyXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnZG9qby9kb20nO1xyXG5pbXBvcnQgKiBhcyBkb21BdHRyIGZyb20gJ2Rvam8vZG9tLWF0dHInO1xyXG5pbXBvcnQgKiBhcyBkb21TdHlsZSBmcm9tICdkb2pvL2RvbS1zdHlsZSc7XHJcblxyXG5cclxuaW50ZXJmYWNlIEZsYXJlQ2x1c3RlckxheWVyUHJvcGVydGllcyBleHRlbmRzIF9fZXNyaS5HcmFwaGljc0xheWVyUHJvcGVydGllcyB7XHJcblxyXG4gICAgY2x1c3RlclJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNpbmdsZVJlbmRlcmVyPzogYW55O1xyXG4gICAgc2luZ2xlU3ltYm9sPzogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgYXJlYVJlbmRlcmVyPzogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuICAgIGZsYXJlUmVuZGVyZXI/OiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNpbmdsZVBvcHVwVGVtcGxhdGU/OiBQb3B1cFRlbXBsYXRlO1xyXG4gICAgc3BhdGlhbFJlZmVyZW5jZT86IFNwYXRpYWxSZWZlcmVuY2U7XHJcblxyXG4gICAgY2x1c3RlclJhdGlvPzogbnVtYmVyO1xyXG4gICAgY2x1c3RlclRvU2NhbGU/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyTWluQ291bnQ/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyQXJlYURpc3BsYXk/OiBzdHJpbmc7XHJcblxyXG4gICAgZGlzcGxheUZsYXJlcz86IGJvb2xlYW47XHJcbiAgICBtYXhGbGFyZUNvdW50PzogbnVtYmVyO1xyXG4gICAgbWF4U2luZ2xlRmxhcmVDb3VudD86IG51bWJlcjtcclxuICAgIHNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5Pzogc3RyaW5nO1xyXG4gICAgZmxhcmVTeW1ib2w/OiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBmbGFyZUJ1ZmZlclBpeGVscz86IG51bWJlcjtcclxuICAgIHRleHRTeW1ib2w/OiBUZXh0U3ltYm9sO1xyXG4gICAgZmxhcmVUZXh0U3ltYm9sPzogVGV4dFN5bWJvbDtcclxuICAgIGRpc3BsYXlTdWJUeXBlRmxhcmVzPzogYm9vbGVhbjtcclxuICAgIHN1YlR5cGVGbGFyZVByb3BlcnR5Pzogc3RyaW5nO1xyXG5cclxuICAgIHhQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG4gICAgelByb3BlcnR5TmFtZT86IHN0cmluZztcclxuXHJcbiAgICBmaWx0ZXJzPzogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBkYXRhPzogYW55W107XHJcblxyXG59XHJcblxyXG5cclxuLy9UaGlzIGlzIGhvdyB5b3UgaGF2ZSB0byBleHRlbmQgY2xhc3NlcyBpbiBhcmNnaXMgYXBpIHRoYXQgYXJlIGEgc3ViY2xhc3Mgb2YgQWNjZXNzb3IuXHJcbi8vV2lsbCBsaWtlbHkgY2hhbmdlIGluIGZ1dHVyZSByZWxlYXNlcy4gU2VlIHRoZXNlIGxpbmtzIC0gaHR0cHM6Ly9naXRodWIuY29tL0VzcmkvanNhcGktcmVzb3VyY2VzL2lzc3Vlcy80MCAmIGh0dHBzOi8vZ2l0aHViLmNvbS95Y2Fib24vZXh0ZW5kLWFjY2Vzc29yLWV4YW1wbGVcclxuaW50ZXJmYWNlIEJhc2VHcmFwaGljc0xheWVyIGV4dGVuZHMgR3JhcGhpY3NMYXllciB7IH1cclxuaW50ZXJmYWNlIEJhc2VHcmFwaGljc0xheWVyQ29uc3RydWN0b3IgeyBuZXcgKG9wdGlvbnM/OiBfX2VzcmkuR3JhcGhpY3NMYXllclByb3BlcnRpZXMpOiBCYXNlR3JhcGhpY3NMYXllcjsgfVxyXG5sZXQgYmFzZUdyYXBoaWNzTGF5ZXI6IEJhc2VHcmFwaGljc0xheWVyQ29uc3RydWN0b3IgPSBhY2Nlc3NvclN1cHBvcnREZWNvcmF0b3JzLmRlY2xhcmVkKDxhbnk+R3JhcGhpY3NMYXllcik7XHJcblxyXG5cclxuLy9UT0RPOiBcclxuLy8gIC0gcmVzaXppbmcgd2luZG93IHRocm93cyBvdXQgdGhlIGNsdXN0ZXJzIHN1cmZhY2UsIG5lZWQgdG8gZm9yY2UgYSByZWRyYXcgb24gd2luZG93IHJlc2l6ZS5cclxuLy8gIC0gd2h5IGlzIGNocm9tZSBvbiBteSBwYyBmdWNrZWQuXHJcblxyXG5AYWNjZXNzb3JTdXBwb3J0RGVjb3JhdG9ycy5zdWJjbGFzcyhcIkZsYXJlQ2x1c3RlckxheWVyXCIpXHJcbmV4cG9ydCBjbGFzcyBGbGFyZUNsdXN0ZXJMYXllciBleHRlbmRzIGJhc2VHcmFwaGljc0xheWVyIHtcclxuXHJcbiAgICBzaW5nbGVSZW5kZXJlcjogYW55O1xyXG4gICAgc2luZ2xlU3ltYm9sOiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBzaW5nbGVQb3B1cFRlbXBsYXRlOiBQb3B1cFRlbXBsYXRlO1xyXG5cclxuICAgIGNsdXN0ZXJSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuICAgIGFyZWFSZW5kZXJlcjogQ2xhc3NCcmVha3NSZW5kZXJlcjtcclxuICAgIGZsYXJlUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcblxyXG4gICAgc3BhdGlhbFJlZmVyZW5jZTogU3BhdGlhbFJlZmVyZW5jZTtcclxuXHJcbiAgICBjbHVzdGVyUmF0aW86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJUb1NjYWxlOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyTWluQ291bnQ6IG51bWJlcjtcclxuICAgIGNsdXN0ZXJBcmVhRGlzcGxheTogc3RyaW5nO1xyXG5cclxuICAgIGRpc3BsYXlGbGFyZXM6IGJvb2xlYW47XHJcbiAgICBtYXhGbGFyZUNvdW50OiBudW1iZXI7XHJcbiAgICBtYXhTaW5nbGVGbGFyZUNvdW50OiBudW1iZXI7XHJcbiAgICBzaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eTogc3RyaW5nO1xyXG4gICAgZmxhcmVTeW1ib2w6IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIGZsYXJlQnVmZmVyUGl4ZWxzOiBudW1iZXI7XHJcbiAgICB0ZXh0U3ltYm9sOiBUZXh0U3ltYm9sO1xyXG4gICAgZmxhcmVUZXh0U3ltYm9sOiBUZXh0U3ltYm9sO1xyXG4gICAgZGlzcGxheVN1YlR5cGVGbGFyZXM6IGJvb2xlYW47XHJcbiAgICBzdWJUeXBlRmxhcmVQcm9wZXJ0eTogc3RyaW5nO1xyXG5cclxuICAgIHhQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHlQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIHpQcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuXHJcbiAgICBmaWx0ZXJzOiBQb2ludEZpbHRlcltdO1xyXG5cclxuICAgIHByaXZhdGUgX2dyaWRDbHVzdGVyczogR3JpZENsdXN0ZXJbXTtcclxuICAgIHByaXZhdGUgX2lzQ2x1c3RlcmVkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfYWN0aXZlVmlldzogQWN0aXZlVmlldztcclxuICAgIHByaXZhdGUgX3ZpZXdMb2FkQ291bnQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgcHJpdmF0ZSBfcmVhZHlUb0RyYXc6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9xdWV1ZWRJbml0aWFsRHJhdzogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX2RhdGE6IGFueVtdO1xyXG4gICAgcHJpdmF0ZSBfaXMyZDogYm9vbGVhbjtcclxuXHJcbiAgICBwcml2YXRlIHZpZXdQb3B1cE1lc3NhZ2VFbmFibGVkO1xyXG5cclxuICAgIHByaXZhdGUgX2NsdXN0ZXJzOiB7IFtjbHVzdGVySWQ6IG51bWJlcl06IENsdXN0ZXI7IH0gPSB7fTtcclxuICAgIHByaXZhdGUgX2FjdGl2ZUNsdXN0ZXI6IENsdXN0ZXI7XHJcblxyXG4gICAgcHJpdmF0ZSBfbGF5ZXJWaWV3MmQ6IGFueTtcclxuICAgIHByaXZhdGUgX2xheWVyVmlldzNkOiBhbnk7XHJcblxyXG4gICAgY29uc3RydWN0b3Iob3B0aW9uczogRmxhcmVDbHVzdGVyTGF5ZXJQcm9wZXJ0aWVzKSB7XHJcblxyXG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAvL3NldCB0aGUgZGVmYXVsdHNcclxuICAgICAgICBpZiAoIW9wdGlvbnMpIHtcclxuICAgICAgICAgICAgLy9taXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnNcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIk1pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVycyB0byBmbGFyZSBjbHVzdGVyIGxheWVyIGNvbnN0cnVjdG9yLlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zaW5nbGVQb3B1cFRlbXBsYXRlID0gb3B0aW9ucy5zaW5nbGVQb3B1cFRlbXBsYXRlO1xyXG5cclxuICAgICAgICAvL3NldCB1cCB0aGUgY2x1c3RlcmluZyBwcm9wZXJ0aWVzXHJcbiAgICAgICAgdGhpcy5jbHVzdGVyUmF0aW8gPSBvcHRpb25zLmNsdXN0ZXJSYXRpbyB8fCA3NTtcclxuICAgICAgICB0aGlzLmNsdXN0ZXJUb1NjYWxlID0gb3B0aW9ucy5jbHVzdGVyVG9TY2FsZSB8fCAyMDAwMDAwO1xyXG4gICAgICAgIHRoaXMuY2x1c3Rlck1pbkNvdW50ID0gb3B0aW9ucy5jbHVzdGVyTWluQ291bnQgfHwgMjtcclxuICAgICAgICB0aGlzLnNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5ID0gb3B0aW9ucy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eSB8fCBcIm5hbWVcIjtcclxuICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXkpIHtcclxuICAgICAgICAgICAgdGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPSBvcHRpb25zLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJub25lXCIgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNsdXN0ZXJBcmVhRGlzcGxheTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5tYXhGbGFyZUNvdW50ID0gb3B0aW9ucy5tYXhGbGFyZUNvdW50IHx8IDg7XHJcbiAgICAgICAgdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50ID0gb3B0aW9ucy5tYXhTaW5nbGVGbGFyZUNvdW50IHx8IDg7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5RmxhcmVzID0gb3B0aW9ucy5kaXNwbGF5RmxhcmVzID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZTsgLy9kZWZhdWx0IHRvIHRydWVcclxuICAgICAgICB0aGlzLmRpc3BsYXlTdWJUeXBlRmxhcmVzID0gb3B0aW9ucy5kaXNwbGF5U3ViVHlwZUZsYXJlcyA9PT0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnN1YlR5cGVGbGFyZVByb3BlcnR5ID0gb3B0aW9ucy5zdWJUeXBlRmxhcmVQcm9wZXJ0eSB8fCB1bmRlZmluZWQ7XHJcbiAgICAgICAgdGhpcy5mbGFyZUJ1ZmZlclBpeGVscyA9IG9wdGlvbnMuZmxhcmVCdWZmZXJQaXhlbHMgfHwgNjtcclxuXHJcbiAgICAgICAgLy9kYXRhIHNldCBwcm9wZXJ0eSBuYW1lc1xyXG4gICAgICAgIHRoaXMueFByb3BlcnR5TmFtZSA9IG9wdGlvbnMueFByb3BlcnR5TmFtZSB8fCBcInhcIjtcclxuICAgICAgICB0aGlzLnlQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnlQcm9wZXJ0eU5hbWUgfHwgXCJ5XCI7XHJcbiAgICAgICAgdGhpcy56UHJvcGVydHlOYW1lID0gb3B0aW9ucy56UHJvcGVydHlOYW1lIHx8IFwielwiO1xyXG5cclxuICAgICAgICAvL3NldCB1cCB0aGUgc3ltYm9sb2d5L3JlbmRlcmVyIHByb3BlcnRpZXNcclxuICAgICAgICB0aGlzLmNsdXN0ZXJSZW5kZXJlciA9IG9wdGlvbnMuY2x1c3RlclJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuYXJlYVJlbmRlcmVyID0gb3B0aW9ucy5hcmVhUmVuZGVyZXI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVSZW5kZXJlciA9IG9wdGlvbnMuc2luZ2xlUmVuZGVyZXI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVTeW1ib2wgPSBvcHRpb25zLnNpbmdsZVN5bWJvbDtcclxuICAgICAgICB0aGlzLmZsYXJlUmVuZGVyZXIgPSBvcHRpb25zLmZsYXJlUmVuZGVyZXI7XHJcblxyXG4gICAgICAgIC8vYWRkIHNvbWUgZGVmYXVsdCBzeW1ib2xzIG9yIHVzZSB0aGUgb3B0aW9ucyB2YWx1ZXMuXHJcbiAgICAgICAgdGhpcy5mbGFyZVN5bWJvbCA9IG9wdGlvbnMuZmxhcmVTeW1ib2wgfHwgbmV3IFNpbXBsZU1hcmtlclN5bWJvbCh7XHJcbiAgICAgICAgICAgIHNpemU6IDE0LFxyXG4gICAgICAgICAgICBjb2xvcjogbmV3IENvbG9yKFswLCAwLCAwLCAwLjVdKSxcclxuICAgICAgICAgICAgb3V0bGluZTogbmV3IFNpbXBsZUxpbmVTeW1ib2woeyBjb2xvcjogbmV3IENvbG9yKFsyNTUsIDI1NSwgMjU1LCAwLjVdKSwgd2lkdGg6IDEgfSlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy50ZXh0U3ltYm9sID0gb3B0aW9ucy50ZXh0U3ltYm9sIHx8IG5ldyBUZXh0U3ltYm9sKHtcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NV0pLFxyXG4gICAgICAgICAgICBmb250OiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiAxMCxcclxuICAgICAgICAgICAgICAgIGZhbWlseTogXCJhcmlhbFwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHlvZmZzZXQ6IC0zXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuZmxhcmVUZXh0U3ltYm9sID0gb3B0aW9ucy5mbGFyZVRleHRTeW1ib2wgfHwgbmV3IFRleHRTeW1ib2woe1xyXG4gICAgICAgICAgICBjb2xvcjogbmV3IENvbG9yKFsyNTUsIDI1NSwgMjU1XSksXHJcbiAgICAgICAgICAgIGZvbnQ6IHtcclxuICAgICAgICAgICAgICAgIHNpemU6IDYsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtMlxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvL2luaXRpYWwgZGF0YVxyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICB0aGlzLm9uKFwibGF5ZXJ2aWV3LWNyZWF0ZVwiLCAoZXZ0KSA9PiB0aGlzLl9sYXllclZpZXdDcmVhdGVkKGV2dCkpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fZGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlld0NyZWF0ZWQoZXZ0KSB7XHJcblxyXG4gICAgICAgIGlmIChldnQubGF5ZXJWaWV3LnZpZXcudHlwZSA9PT0gXCIyZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzJkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyVmlldzNkID0gZXZ0LmxheWVyVmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vYWRkIGEgc3RhdGlvbmFyeSB3YXRjaCBvbiB0aGUgdmlldyB0byBkbyBzb21lIHN0dWZmLlxyXG4gICAgICAgIHdhdGNoVXRpbHMucGF1c2FibGUoZXZ0LmxheWVyVmlldy52aWV3LCBcInN0YXRpb25hcnlcIiwgKGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykgPT4gdGhpcy5fdmlld1N0YXRpb25hcnkoaXNTdGF0aW9uYXJ5LCBiLCBjLCB2aWV3KSk7XHJcblxyXG4gICAgICAgIHRoaXMudmlld1BvcHVwTWVzc2FnZUVuYWJsZWQgPSBldnQubGF5ZXJWaWV3LnZpZXcucG9wdXAubWVzc2FnZUVuYWJsZWQ7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl92aWV3TG9hZENvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBldnQubGF5ZXJWaWV3LnZpZXc7XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9yZWFkeVRvRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdykge1xyXG4gICAgICAgICAgICAgICAgLy93ZSd2ZSBiZWVuIHdhaXRpbmcgZm9yIHRoaXMgdG8gaGFwcGVuIHRvIGRyYXdcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkSW5pdGlhbERyYXcgPSBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl92aWV3TG9hZENvdW50Kys7XHJcblxyXG4gICAgICAgIC8vd2lyZSB1cCBzb21lIHZpZXcgZXZlbnRzXHJcbiAgICAgICAgdGhpcy5fYWRkVmlld0V2ZW50cyhldnQubGF5ZXJWaWV3LnZpZXcpO1xyXG5cclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfYWRkVmlld0V2ZW50cyh2aWV3PzogQWN0aXZlVmlldykge1xyXG4gICAgICAgIGxldCB2ID0gdmlldyA/IHZpZXcgOiB0aGlzLl9hY3RpdmVWaWV3O1xyXG4gICAgICAgIGlmICghdi5mY2xQb2ludGVyTW92ZSkge1xyXG4gICAgICAgICAgICB2LmZjbFBvaW50ZXJNb3ZlID0gdi5vbihcInBvaW50ZXItbW92ZVwiLCAoZXZ0KSA9PiB0aGlzLl92aWV3UG9pbnRlck1vdmUoZXZ0KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgIFxyXG5cclxuICAgIHByaXZhdGUgX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpc1N0YXRpb25hcnkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL3JlYWFzaWduIGV2ZW50cyBpZiBuZWVkZWRcclxuICAgICAgICAgICAgdGhpcy5fYWRkVmlld0V2ZW50cygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCFpc1N0YXRpb25hcnkgJiYgdGhpcy5fYWN0aXZlQ2x1c3Rlcikge1xyXG4gICAgICAgICAgICAvL2lmIG1vdmluZyBkZWFjdGl2YXRlIGNsdXN0ZXI7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlYWN0aXZhdGVDbHVzdGVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBjbGVhcigpIHtcclxuICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzID0ge307XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHNldERhdGEoZGF0YTogYW55W10sIGRyYXdEYXRhOiBib29sZWFuID0gdHJ1ZSkge1xyXG4gICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xyXG4gICAgICAgIGlmIChkcmF3RGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZHJhdyhhY3RpdmVWaWV3PzogYW55KSB7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVWaWV3KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcgPSBhY3RpdmVWaWV3O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9Ob3QgcmVhZHkgdG8gZHJhdyB5ZXQgc28gcXVldWUgb25lIHVwXHJcbiAgICAgICAgaWYgKCF0aGlzLl9yZWFkeVRvRHJhdykge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRJbml0aWFsRHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlVmlldyB8fCAhdGhpcy5fZGF0YSkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLl9pczJkID0gdGhpcy5fYWN0aXZlVmlldy50eXBlID09PSBcIjJkXCI7XHJcblxyXG4gICAgICAgIC8vY2hlY2sgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYW4gYXJlYSByZW5kZXJlciBzZXQgaWYgb25lIG5lZWRzIHRvIGJlXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ICYmICF0aGlzLmFyZWFSZW5kZXJlcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRmxhcmVDbHVzdGVyTGF5ZXI6IGFyZWFSZW5kZXJlciBtdXN0IGJlIHNldCBpZiBjbHVzdGVyQXJlYURpc3BsYXkgaXMgc2V0LlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIGNvbnNvbGUudGltZShcImRyYXctZGF0YS1cIiArIHRoaXMuX2FjdGl2ZVZpZXcudHlwZSk7XHJcblxyXG4gICAgICAgIHRoaXMuX2lzQ2x1c3RlcmVkID0gdGhpcy5jbHVzdGVyVG9TY2FsZSA8IHRoaXMuX3NjYWxlKCk7XHJcblxyXG4gICAgICAgIGxldCBncmFwaGljczogR3JhcGhpY1tdID0gW107XHJcblxyXG4gICAgICAgIC8vZ2V0IGFuIGV4dGVudCB0aGF0IGlzIGluIHdlYiBtZXJjYXRvciB0byBtYWtlIHN1cmUgaXQncyBmbGF0IGZvciBleHRlbnQgY2hlY2tpbmdcclxuICAgICAgICAvL1RoZSB3ZWJleHRlbnQgd2lsbCBuZWVkIHRvIGJlIG5vcm1hbGl6ZWQgc2luY2UgcGFubmluZyBvdmVyIHRoZSBpbnRlcm5hdGlvbmFsIGRhdGVsaW5lIHdpbGwgY2F1c2VcclxuICAgICAgICAvL2NhdXNlIHRoZSBleHRlbnQgdG8gc2hpZnQgb3V0c2lkZSB0aGUgLTE4MCB0byAxODAgZGVncmVlIHdpbmRvdy4gIElmIHdlIGRvbid0IG5vcm1hbGl6ZSB0aGVuIHRoZVxyXG4gICAgICAgIC8vY2x1c3RlcnMgd2lsbCBub3QgYmUgZHJhd24gaWYgdGhlIG1hcCBwYW5zIG92ZXIgdGhlIGludGVybmF0aW9uYWwgZGF0ZWxpbmUuXHJcbiAgICAgICAgbGV0IHdlYkV4dGVudDogYW55ID0gIXRoaXMuX2V4dGVudCgpLnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvciA/IDxFeHRlbnQ+d2ViTWVyY2F0b3JVdGlscy5wcm9qZWN0KHRoaXMuX2V4dGVudCgpLCBuZXcgU3BhdGlhbFJlZmVyZW5jZSh7IFwid2tpZFwiOiAxMDIxMDAgfSkpIDogdGhpcy5fZXh0ZW50KCk7XHJcbiAgICAgICAgbGV0IGV4dGVudElzVW5pb25lZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBsZXQgbm9ybWFsaXplZFdlYkV4dGVudCA9IHdlYkV4dGVudC5ub3JtYWxpemUoKTtcclxuICAgICAgICB3ZWJFeHRlbnQgPSBub3JtYWxpemVkV2ViRXh0ZW50WzBdO1xyXG4gICAgICAgIGlmIChub3JtYWxpemVkV2ViRXh0ZW50Lmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgd2ViRXh0ZW50ID0gd2ViRXh0ZW50LnVuaW9uKG5vcm1hbGl6ZWRXZWJFeHRlbnRbMV0pO1xyXG4gICAgICAgICAgICBleHRlbnRJc1VuaW9uZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudCwgZXh0ZW50SXNVbmlvbmVkKTtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICBsZXQgd2ViOiBudW1iZXJbXSwgb2JqOiBhbnksIGRhdGFMZW5ndGggPSB0aGlzLl9kYXRhLmxlbmd0aCwgeFZhbDogbnVtYmVyLCB5VmFsOiBudW1iZXI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhTGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgb2JqID0gdGhpcy5fZGF0YVtpXTtcclxuXHJcbiAgICAgICAgICAgIC8vY2hlY2sgaWYgZmlsdGVycyBhcmUgc3BlY2lmaWVkIGFuZCBjb250aW51ZSBpZiB0aGlzIG9iamVjdCBkb2Vzbid0IHBhc3NcclxuICAgICAgICAgICAgaWYgKCF0aGlzLl9wYXNzZXNGaWx0ZXIob2JqKSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHhWYWwgPSBvYmpbdGhpcy54UHJvcGVydHlOYW1lXTtcclxuICAgICAgICAgICAgeVZhbCA9IG9ialt0aGlzLnlQcm9wZXJ0eU5hbWVdO1xyXG5cclxuICAgICAgICAgICAgLy9nZXQgYSB3ZWIgbWVyYyBsbmcvbGF0IGZvciBleHRlbnQgY2hlY2tpbmcuIFVzZSB3ZWIgbWVyYyBhcyBpdCdzIGZsYXQgdG8gY2F0ZXIgZm9yIGxvbmdpdHVkZSBwb2xlXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICAgICAgd2ViID0gW3hWYWwsIHlWYWxdO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgd2ViID0gd2ViTWVyY2F0b3JVdGlscy5sbmdMYXRUb1hZKHhWYWwsIHlWYWwpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvL2NoZWNrIGlmIHRoZSBvYmogaXMgdmlzaWJsZSBpbiB0aGUgZXh0ZW50IGJlZm9yZSBwcm9jZWVkaW5nXHJcbiAgICAgICAgICAgIGlmICgod2ViWzBdIDw9IHdlYkV4dGVudC54bWluIHx8IHdlYlswXSA+IHdlYkV4dGVudC54bWF4KSB8fCAod2ViWzFdIDw9IHdlYkV4dGVudC55bWluIHx8IHdlYlsxXSA+IHdlYkV4dGVudC55bWF4KSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vbG9vcCBjbHVzdGVyIGdyaWQgdG8gc2VlIGlmIGl0IHNob3VsZCBiZSBhZGRlZCB0byBvbmVcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwLCBqTGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzLmxlbmd0aDsgaiA8IGpMZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBjbCA9IHRoaXMuX2dyaWRDbHVzdGVyc1tqXTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHdlYlswXSA8PSBjbC5leHRlbnQueG1pbiB8fCB3ZWJbMF0gPiBjbC5leHRlbnQueG1heCB8fCB3ZWJbMV0gPD0gY2wuZXh0ZW50LnltaW4gfHwgd2ViWzFdID4gY2wuZXh0ZW50LnltYXgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7IC8vbm90IGhlcmUgc28gY2Fycnkgb25cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vcmVjYWxjIHRoZSB4IGFuZCB5IG9mIHRoZSBjbHVzdGVyIGJ5IGF2ZXJhZ2luZyB0aGUgcG9pbnRzIGFnYWluXHJcbiAgICAgICAgICAgICAgICAgICAgY2wueCA9IGNsLmNsdXN0ZXJDb3VudCA+IDAgPyAoeFZhbCArIChjbC54ICogY2wuY2x1c3RlckNvdW50KSkgLyAoY2wuY2x1c3RlckNvdW50ICsgMSkgOiB4VmFsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNsLnkgPSBjbC5jbHVzdGVyQ291bnQgPiAwID8gKHlWYWwgKyAoY2wueSAqIGNsLmNsdXN0ZXJDb3VudCkpIC8gKGNsLmNsdXN0ZXJDb3VudCArIDEpIDogeVZhbDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9wdXNoIGV2ZXJ5IHBvaW50IGludG8gdGhlIGNsdXN0ZXIgc28gd2UgaGF2ZSBpdCBmb3IgYXJlYSBkaXNwbGF5IGlmIHJlcXVpcmVkLiBUaGlzIGNvdWxkIGJlIG9taXR0ZWQgaWYgbmV2ZXIgY2hlY2tpbmcgYXJlYXMsIG9yIG9uIGRlbWFuZCBhdCBsZWFzdFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5wb2ludHMucHVzaChbeFZhbCwgeVZhbF0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY2wuY2x1c3RlckNvdW50Kys7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzdWJUeXBlRXhpc3RzID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcyA9IDAsIHNMZW4gPSBjbC5zdWJUeXBlQ291bnRzLmxlbmd0aDsgcyA8IHNMZW47IHMrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2wuc3ViVHlwZUNvdW50c1tzXS5uYW1lID09PSBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsLnN1YlR5cGVDb3VudHNbc10uY291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YlR5cGVFeGlzdHMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghc3ViVHlwZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzLnB1c2goeyBuYW1lOiBvYmpbdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eV0sIGNvdW50OiAxIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy9hZGQgdGhlIHNpbmdsZSBmaXggcmVjb3JkIGlmIHN0aWxsIHVuZGVyIHRoZSBtYXhTaW5nbGVGbGFyZUNvdW50XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsLmNsdXN0ZXJDb3VudCA8PSB0aGlzLm1heFNpbmdsZUZsYXJlQ291bnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc2luZ2xlcy5wdXNoKG9iaik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbC5zaW5nbGVzID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vbm90IGNsdXN0ZXJlZCBzbyBqdXN0IGFkZCBldmVyeSBvYmpcclxuICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNpbmdsZShvYmopO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5jbHVzdGVyQ291bnQgPCB0aGlzLmNsdXN0ZXJNaW5Db3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwLCBqbGVuID0gdGhpcy5fZ3JpZENsdXN0ZXJzW2ldLnNpbmdsZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNpbmdsZSh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uc2luZ2xlc1tqXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLmNsdXN0ZXJDb3VudCA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVDbHVzdGVyKHRoaXMuX2dyaWRDbHVzdGVyc1tpXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vZW1pdCBhbiBldmVudCB0byBzaWduYWwgZHJhd2luZyBpcyBjb21wbGV0ZS5cclxuICAgICAgICB0aGlzLmVtaXQoXCJkcmF3LWNvbXBsZXRlXCIsIHt9KTtcclxuICAgICAgICBjb25zb2xlLnRpbWVFbmQoYGRyYXctZGF0YS0ke3RoaXMuX2FjdGl2ZVZpZXcudHlwZX1gKTtcclxuXHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVN1cmZhY2UoKTtcclxuICAgICAgICB9LCAxMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfcGFzc2VzRmlsdGVyKG9iajogYW55KTogYm9vbGVhbiB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmZpbHRlcnMgfHwgdGhpcy5maWx0ZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgbGV0IHBhc3NlcyA9IHRydWU7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuZmlsdGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgZmlsdGVyID0gdGhpcy5maWx0ZXJzW2ldO1xyXG4gICAgICAgICAgICBpZiAob2JqW2ZpbHRlci5wcm9wZXJ0eU5hbWVdID09IG51bGwpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgbGV0IHZhbEV4aXN0cyA9IGZpbHRlci5wcm9wZXJ0eVZhbHVlcy5pbmRleE9mKG9ialtmaWx0ZXIucHJvcGVydHlOYW1lXSkgIT09IC0xO1xyXG4gICAgICAgICAgICBpZiAodmFsRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBwYXNzZXMgPSBmaWx0ZXIua2VlcE9ubHlJZlZhbHVlRXhpc3RzOyAvL3RoZSB2YWx1ZSBleGlzdHMgc28gcmV0dXJuIHdoZXRoZXIgd2Ugc2hvdWxkIGJlIGtlZXBpbmcgaXQgb3Igbm90LlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKCF2YWxFeGlzdHMgJiYgZmlsdGVyLmtlZXBPbmx5SWZWYWx1ZUV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcGFzc2VzID0gZmFsc2U7IC8vcmV0dXJuIGZhbHNlIGFzIHRoZSB2YWx1ZSBkb2Vzbid0IGV4aXN0LCBhbmQgd2Ugc2hvdWxkIG9ubHkgYmUga2VlcGluZyBwb2ludCBvYmplY3RzIHdoZXJlIGl0IGRvZXMgZXhpc3QuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghcGFzc2VzKSByZXR1cm4gZmFsc2U7IC8vaWYgaXQgaGFzbid0IHBhc3NlZCBhbnkgb2YgdGhlIGZpbHRlcnMgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHBhc3NlcztcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTaW5nbGUob2JqKSB7XHJcbiAgICAgICAgbGV0IHBvaW50ID0gbmV3IFBvaW50KHtcclxuICAgICAgICAgICAgeDogb2JqW3RoaXMueFByb3BlcnR5TmFtZV0sIHk6IG9ialt0aGlzLnlQcm9wZXJ0eU5hbWVdLCB6OiBvYmpbdGhpcy56UHJvcGVydHlOYW1lXVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoIXBvaW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBwb2ludCA9IDxQb2ludD53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKHBvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBncmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnQsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IG9ialxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBncmFwaGljLnBvcHVwVGVtcGxhdGUgPSB0aGlzLnNpbmdsZVBvcHVwVGVtcGxhdGU7XHJcbiAgICAgICAgaWYgKHRoaXMuc2luZ2xlUmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgbGV0IHN5bWJvbCA9IHRoaXMuc2luZ2xlUmVuZGVyZXIuZ2V0U3ltYm9sKGdyYXBoaWMsIHRoaXMuX2FjdGl2ZVZpZXcpO1xyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHN5bWJvbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodGhpcy5zaW5nbGVTeW1ib2wpIHtcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLnNpbmdsZVN5bWJvbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vbm8gc3ltYm9sb2d5IGZvciBzaW5nbGVzIGRlZmluZWQsIHVzZSB0aGUgZGVmYXVsdCBzeW1ib2wgZnJvbSB0aGUgY2x1c3RlciByZW5kZXJlclxyXG4gICAgICAgICAgICBncmFwaGljLnN5bWJvbCA9IHRoaXMuY2x1c3RlclJlbmRlcmVyLmRlZmF1bHRTeW1ib2w7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFkZChncmFwaGljKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2x1c3RlcihncmlkQ2x1c3RlcjogR3JpZENsdXN0ZXIpIHtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXIgPSBuZXcgQ2x1c3RlcigpO1xyXG4gICAgICAgIGNsdXN0ZXIuZ3JpZENsdXN0ZXIgPSBncmlkQ2x1c3RlcjtcclxuXHJcbiAgICAgICAgLy9tYWtlIHN1cmUgYWxsIGdlb21ldHJpZXMgYWRkZWQgdG8gR3JhcGhpYyBvYmplY3RzIGFyZSBpbiB3ZWIgbWVyY2F0b3Igb3RoZXJ3aXNlIHdyYXAgYXJvdW5kIGRvZXNuJ3Qgd29yay5cclxuICAgICAgICBsZXQgcG9pbnQgPSBuZXcgUG9pbnQoeyB4OiBncmlkQ2x1c3Rlci54LCB5OiBncmlkQ2x1c3Rlci55IH0pO1xyXG4gICAgICAgIGlmICghcG9pbnQuc3BhdGlhbFJlZmVyZW5jZS5pc1dlYk1lcmNhdG9yKSB7XHJcbiAgICAgICAgICAgIHBvaW50ID0gPFBvaW50PndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IocG9pbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGF0dHJpYnV0ZXM6IGFueSA9IHtcclxuICAgICAgICAgICAgeDogZ3JpZENsdXN0ZXIueCxcclxuICAgICAgICAgICAgeTogZ3JpZENsdXN0ZXIueSxcclxuICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQsXHJcbiAgICAgICAgICAgIGlzQ2x1c3RlcjogdHJ1ZSxcclxuICAgICAgICAgICAgY2x1c3Rlck9iamVjdDogZ3JpZENsdXN0ZXJcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGF0dHJpYnV0ZXMsXHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sID0gdGhpcy5jbHVzdGVyUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oY2x1c3Rlci5jbHVzdGVyR3JhcGhpYykuc3ltYm9sO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJJZCA9IGNsdXN0ZXIuY2x1c3RlckdyYXBoaWNbXCJ1aWRcIl07XHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZCA9IGNsdXN0ZXIuY2x1c3RlcklkO1xyXG5cclxuICAgICAgICAvL2Fsc28gY3JlYXRlIGEgdGV4dCBzeW1ib2wgdG8gZGlzcGxheSB0aGUgY2x1c3RlciBjb3VudFxyXG4gICAgICAgIGxldCB0ZXh0U3ltYm9sID0gdGhpcy50ZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgdGV4dFN5bWJvbC50ZXh0ID0gZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LnRvU3RyaW5nKCk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICB0ZXh0U3ltYm9sLmFuZ2xlID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNsdXN0ZXIudGV4dEdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBwb2ludCxcclxuICAgICAgICAgICAgYXR0cmlidXRlczoge1xyXG4gICAgICAgICAgICAgICAgaXNDbHVzdGVyVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJJZDogY2x1c3Rlci5jbHVzdGVySWRcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vYWRkIGFuIGFyZWEgZ3JhcGhpYyB0byBkaXNwbGF5IHRoZSBib3VuZHMgb2YgdGhlIGNsdXN0ZXIgaWYgY29uZmlndXJlZCB0b1xyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSAmJiBncmlkQ2x1c3Rlci5wb2ludHMgJiYgZ3JpZENsdXN0ZXIucG9pbnRzLmxlbmd0aCA+IDApIHtcclxuXHJcbiAgICAgICAgICAgIGxldCBtcCA9IG5ldyBNdWx0aXBvaW50KCk7XHJcbiAgICAgICAgICAgIG1wLnBvaW50cyA9IGdyaWRDbHVzdGVyLnBvaW50cztcclxuICAgICAgICAgICAgbGV0IGFyZWE6IGFueSA9IGdlb21ldHJ5RW5naW5lLmNvbnZleEh1bGwobXAsIHRydWUpOyAvL3VzZSBjb252ZXggaHVsbCBvbiB0aGUgcG9pbnRzIHRvIGdldCB0aGUgYm91bmRhcnlcclxuXHJcbiAgICAgICAgICAgIGxldCBhcmVhQXR0cjogYW55ID0ge1xyXG4gICAgICAgICAgICAgICAgeDogZ3JpZENsdXN0ZXIueCxcclxuICAgICAgICAgICAgICAgIHk6IGdyaWRDbHVzdGVyLnksXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJJZDogY2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBpc0NsdXN0ZXJBcmVhOiB0cnVlXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChhcmVhLnJpbmdzICYmIGFyZWEucmluZ3MubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGFyZWFQb2x5ID0gbmV3IFBvbHlnb24oKTsgLy9oYWQgdG8gY3JlYXRlIGEgbmV3IHBvbHlnb24gYW5kIGZpbGwgaXQgd2l0aCB0aGUgcmluZyBvZiB0aGUgY2FsY3VsYXRlZCBhcmVhIGZvciBTY2VuZVZpZXcgdG8gd29yay5cclxuICAgICAgICAgICAgICAgIGFyZWFQb2x5ID0gYXJlYVBvbHkuYWRkUmluZyhhcmVhLnJpbmdzWzBdKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIWFyZWFQb2x5LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGFyZWFQb2x5ID0gPFBvbHlnb24+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihhcmVhUG9seSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY2x1c3Rlci5hcmVhR3JhcGhpYyA9IG5ldyBHcmFwaGljKHsgZ2VvbWV0cnk6IGFyZWFQb2x5LCBhdHRyaWJ1dGVzOiBhcmVhQXR0ciB9KTtcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXIuYXJlYUdyYXBoaWMuc3ltYm9sID0gdGhpcy5hcmVhUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oY2x1c3Rlci5hcmVhR3JhcGhpYykuc3ltYm9sO1xyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9hZGQgdGhlIGdyYXBoaWNzIGluIG9yZGVyICAgICAgICBcclxuICAgICAgICBpZiAoY2x1c3Rlci5hcmVhR3JhcGhpYyAmJiB0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSA9PT0gXCJhbHdheXNcIikge1xyXG4gICAgICAgICAgICB0aGlzLmFkZChjbHVzdGVyLmFyZWFHcmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci5jbHVzdGVyR3JhcGhpYyk7XHJcbiAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci50ZXh0R3JhcGhpYyk7XHJcblxyXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJzW2NsdXN0ZXIuY2x1c3RlcklkXSA9IGNsdXN0ZXI7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsdXN0ZXJHcmlkKHdlYkV4dGVudDogRXh0ZW50LCBleHRlbnRJc1VuaW9uZWQ6IGJvb2xlYW4pIHtcclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHRvdGFsIGFtb3VudCBvZiBncmlkIHNwYWNlcyBiYXNlZCBvbiB0aGUgaGVpZ2h0IGFuZCB3aWR0aCBvZiB0aGUgbWFwIChkaXZpZGUgaXQgYnkgY2x1c3RlclJhdGlvKSAtIHRoZW4gZ2V0IHRoZSBkZWdyZWVzIGZvciB4IGFuZCB5IFxyXG4gICAgICAgIGxldCB4Q291bnQgPSBNYXRoLnJvdW5kKHRoaXMuX2FjdGl2ZVZpZXcud2lkdGggLyB0aGlzLmNsdXN0ZXJSYXRpbyk7XHJcbiAgICAgICAgbGV0IHlDb3VudCA9IE1hdGgucm91bmQodGhpcy5fYWN0aXZlVmlldy5oZWlnaHQgLyB0aGlzLmNsdXN0ZXJSYXRpbyk7XHJcblxyXG4gICAgICAgIC8vaWYgdGhlIGV4dGVudCBoYXMgYmVlbiB1bmlvbmVkIGR1ZSB0byBub3JtYWxpemF0aW9uLCBkb3VibGUgdGhlIGNvdW50IG9mIHggaW4gdGhlIGNsdXN0ZXIgZ3JpZCBhcyB0aGUgdW5pb25pbmcgd2lsbCBoYWx2ZSBpdC5cclxuICAgICAgICBpZiAoZXh0ZW50SXNVbmlvbmVkKSB7XHJcbiAgICAgICAgICAgIHhDb3VudCAqPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHh3ID0gKHdlYkV4dGVudC54bWF4IC0gd2ViRXh0ZW50LnhtaW4pIC8geENvdW50O1xyXG4gICAgICAgIGxldCB5aCA9ICh3ZWJFeHRlbnQueW1heCAtIHdlYkV4dGVudC55bWluKSAvIHlDb3VudDtcclxuXHJcbiAgICAgICAgbGV0IGdzeG1pbiwgZ3N4bWF4LCBnc3ltaW4sIGdzeW1heDtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgYW4gYXJyYXkgb2YgY2x1c3RlcnMgdGhhdCBpcyBhIGdyaWQgb3ZlciB0aGUgdmlzaWJsZSBleHRlbnQuIEVhY2ggY2x1c3RlciBjb250YWlucyB0aGUgZXh0ZW50IChpbiB3ZWIgbWVyYykgdGhhdCBib3VuZHMgdGhlIGdyaWQgc3BhY2UgZm9yIGl0LlxyXG4gICAgICAgIHRoaXMuX2dyaWRDbHVzdGVycyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgeENvdW50OyBpKyspIHtcclxuICAgICAgICAgICAgZ3N4bWluID0gd2ViRXh0ZW50LnhtaW4gKyAoeHcgKiBpKTtcclxuICAgICAgICAgICAgZ3N4bWF4ID0gZ3N4bWluICsgeHc7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgeUNvdW50OyBqKyspIHtcclxuICAgICAgICAgICAgICAgIGdzeW1pbiA9IHdlYkV4dGVudC55bWluICsgKHloICogaik7XHJcbiAgICAgICAgICAgICAgICBnc3ltYXggPSBnc3ltaW4gKyB5aDtcclxuICAgICAgICAgICAgICAgIGxldCBleHQgPSB7IHhtaW46IGdzeG1pbiwgeG1heDogZ3N4bWF4LCB5bWluOiBnc3ltaW4sIHltYXg6IGdzeW1heCB9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ3JpZENsdXN0ZXJzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIGV4dGVudDogZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogMCxcclxuICAgICAgICAgICAgICAgICAgICBzdWJUeXBlQ291bnRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICBzaW5nbGVzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludHM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIHg6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgeTogMFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYW4gc3ZnIHN1cmZhY2Ugb24gdGhlIHZpZXcgaWYgaXQgZG9lc24ndCBhbHJlYWR5IGV4aXN0XHJcbiAgICAgKiBAcGFyYW0gdmlld1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9jcmVhdGVTdXJmYWNlKCkge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQucGFyZW50RWxlbWVudCB8fCB0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudC5wYXJlbnROb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgc3VyZmFjZVBhcmVudEVsZW1lbnQgPSB0aGlzLl9hY3RpdmVWaWV3LmNhbnZhcy5wYXJlbnRFbGVtZW50IHx8IHRoaXMuX2FjdGl2ZVZpZXcuY2FudmFzLnBhcmVudE5vZGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgc3VyZmFjZSA9IGdmeC5jcmVhdGVTdXJmYWNlKHN1cmZhY2VQYXJlbnRFbGVtZW50LCBcIjBcIiwgXCIwXCIpO1xyXG4gICAgICAgIHN1cmZhY2UuY29udGFpbmVyR3JvdXAgPSBzdXJmYWNlLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgcG9zaXRpb246IFwiYWJzb2x1dGVcIiwgdG9wOiBcIjBcIiwgekluZGV4OiAtMSB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJ2aXNpYmxlXCIpO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJjbGFzc1wiLCBcImZjbC1zdXJmYWNlXCIpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZSA9IHN1cmZhY2U7XHJcblxyXG4gICAgICAgIC8vVGhpcyBpcyBhIGhhY2sgZm9yIElFLiBoaXRUZXN0IG9uIHRoZSB2aWV3IGRvZW5zJ3QgcGljayB1cCBhbnkgcmVzdWx0cyB1bmxlc3MgdGhlIHotaW5kZXggb2YgdGhlIGxheWVyVmlldyBjb250YWluZXIgaXMgYXQgbGVhc3QgMS4gU28gc2V0IGl0IHRvIDEsIGJ1dCBhbHNvIGhhdmUgdG8gc2V0IHRoZSAuZXNyaS11aVxyXG4gICAgICAgIC8vY29udGFpbmVyIHRvIDIgb3RoZXJ3aXNlIGl0IGNhbid0IGJlIGNsaWNrZWQgb24gYXMgaXQncyBjb3ZlcmVkIGJ5IHRoZSBsYXllciB2aWV3IGNvbnRhaW5lci4gbWVoIVxyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIGRvbVN0eWxlLnNldCh0aGlzLl9sYXllclZpZXcyZC5jb250YWluZXIuZWxlbWVudCwgXCJ6LWluZGV4XCIsIFwiMVwiKTtcclxuICAgICAgICAgICAgcXVlcnkoXCIuZXNyaS11aVwiKS5mb3JFYWNoKGZ1bmN0aW9uIChub2RlOiBIVE1MRWxlbWVudCwgaW5kZXgpIHtcclxuICAgICAgICAgICAgICAgIGRvbVN0eWxlLnNldChub2RlLCBcInotaW5kZXhcIiwgXCIyXCIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfdmlld1BvaW50ZXJNb3ZlKGV2dCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBzcCA9IG5ldyBTY3JlZW5Qb2ludCh7IHg6IGV2dC54LCB5OiBldnQueSB9KTtcclxuXHJcbiAgICAgICAgLy9pZiB0aGVyZSdzIGFuIGFjdGl2ZSBjbHVzdGVyIGFuZCB0aGUgY3VycmVudCBzY3JlZW4gcG9zIGlzIHdpdGhpbiB0aGUgYm91bmRzIG9mIHRoYXQgY2x1c3RlcidzIGdyb3VwIGNvbnRhaW5lciwgZG9uJ3QgZG8gYW55dGhpbmcgbW9yZS4gXHJcbiAgICAgICAgLy9UT0RPOiB3b3VsZCBwcm9iYWJseSBiZSBiZXR0ZXIgdG8gY2hlY2sgaWYgdGhlIHBvaW50IGlzIGluIHRoZSBhY3R1YWwgY2lyY2xlIG9mIHRoZSBjbHVzdGVyIGdyb3VwIGFuZCBpdCdzIGZsYXJlcyBpbnN0ZWFkIG9mIHVzaW5nIHRoZSByZWN0YW5nbGUgYm91bmRpbmcgYm94LlxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVDbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIGxldCBiYm94ID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICAgICAgaWYgKGJib3gpIHtcclxuICAgICAgICAgICAgICAgIGlmIChldnQueCA+PSBiYm94LmxlZnQgJiYgZXZ0LnggPD0gYmJveC5yaWdodCAmJiBldnQueSA+PSBiYm94LnRvcCAmJiBldnQueSA8PSBiYm94LmJvdHRvbSkgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3LmhpdFRlc3Qoc3ApLnRoZW4oKHJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2cocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICBsZXQgZ3JhcGhpY3MgPSByZXNwb25zZS5yZXN1bHRzO1xyXG4gICAgICAgICAgICBpZiAoZ3JhcGhpY3MubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGdyYXBoaWNzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZyA9IGdyYXBoaWNzW2ldLmdyYXBoaWM7XHJcbiAgICAgICAgICAgICAgICBpZiAoZyAmJiAoZy5hdHRyaWJ1dGVzLmNsdXN0ZXJJZCAhPSBudWxsICYmICFnLmF0dHJpYnV0ZXMuaXNDbHVzdGVyQXJlYSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2x1c3RlciA9IHRoaXMuX2NsdXN0ZXJzW2cuYXR0cmlidXRlcy5jbHVzdGVySWRdO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FjdGl2YXRlQ2x1c3RlcihjbHVzdGVyKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfYWN0aXZhdGVDbHVzdGVyKGNsdXN0ZXI6IENsdXN0ZXIpIHtcclxuICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVDbHVzdGVyID09PSBjbHVzdGVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybjsgLy9hbHJlYWR5IGFjdGl2ZVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG5cclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyID0gY2x1c3RlcjtcclxuICAgICAgICB0aGlzLl9pbml0U3VyZmFjZSgpO1xyXG4gICAgICAgIHRoaXMuX2luaXRDbHVzdGVyKCk7XHJcbiAgICAgICAgdGhpcy5faW5pdEZsYXJlcygpO1xyXG5cclxuICAgICAgICB0aGlzLl9oaWRlR3JhcGhpYyhbdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpY10pO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwiYWN0aXZhdGVkXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5fc2hvd0dyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci5hcmVhR3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiYWN0aXZhdGUgY2x1c3RlclwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9kZWFjdGl2YXRlQ2x1c3RlcigpIHtcclxuICBcclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5fc2hvd0dyYXBoaWMoW3RoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWNdKTtcclxuICAgICAgICB0aGlzLl9yZW1vdmVDbGFzc0Zyb21FbGVtZW50KHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUsIFwiYWN0aXZhdGVkXCIpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwiYWN0aXZhdGVkXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5faGlkZUdyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci5hcmVhR3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9jbGVhclN1cmZhY2UoKTtcclxuICAgICAgICB0aGlzLl9hY3RpdmVDbHVzdGVyID0gdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiREUtYWN0aXZhdGUgY2x1c3RlclwiKTtcclxuICAgICAgIFxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0U3VyZmFjZSgpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgaWYgKCFzdXJmYWNlKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBzcDogU2NyZWVuUG9pbnQgPSB0aGlzLl9hY3RpdmVWaWV3LnRvU2NyZWVuKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuZ2VvbWV0cnkpO1xyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAxMSwgb3ZlcmZsb3c6IFwidmlzaWJsZVwiLCB3aWR0aDogXCIxcHhcIiwgaGVpZ2h0OiBcIjFweFwiLCBsZWZ0OiBzcC54ICsgXCJweFwiLCB0b3A6IHNwLnkgKyBcInB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwidmlzaWJsZVwiKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY2xlYXJTdXJmYWNlKCkge1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIHF1ZXJ5KFwiPlwiLCBzdXJmYWNlLmNvbnRhaW5lckdyb3VwLnJhd05vZGUpLmZvckVhY2goZG9tQ29uc3RydWN0LmRlc3Ryb3kpO1xyXG4gICAgICAgIGRvbVN0eWxlLnNldChzdXJmYWNlLnJhd05vZGUsIHsgekluZGV4OiAtMSwgb3ZlcmZsb3c6IFwiaGlkZGVuXCIsIHRvcDogXCIwcHhcIiwgbGVmdDogXCIwcHhcIiB9KTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwib3ZlcmZsb3dcIiwgXCJoaWRkZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdENsdXN0ZXIoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2U7XHJcbiAgICAgICAgaWYgKCFzdXJmYWNlKSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vd2UncmUgZ29pbmcgdG8gcmVwbGljYXRlIGEgY2x1c3RlciBncmFwaGljIGluIHRoZSBzdmcgZWxlbWVudCB3ZSBhZGRlZCB0byB0aGUgbGF5ZXIgdmlldy4gSnVzdCBzbyBpdCBjYW4gYmUgc3R5bGVkIGVhc2lseS4gTmF0aXZlIFdlYkdMIGZvciBTY2VuZSBWaWV3cyB3b3VsZCBwcm9iYWJseSBiZSBiZXR0ZXIsIGJ1dCBhdCBsZWFzdCB0aGlzIHdheSBjc3MgY2FuIHN0aWxsIGJlIHVzZWQgdG8gc3R5bGUvYW5pbWF0ZSB0aGluZ3MuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAgPSBzdXJmYWNlLmNvbnRhaW5lckdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQodGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZSwgXCJjbHVzdGVyLWdyb3VwXCIpO1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSB0aGUgY2x1c3RlciBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRDbHVzdGVyRWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkQ2x1c3RlckVsZW1lbnQsIFwiY2x1c3RlclwiKTtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgdGhlIGNsdXN0ZXIgdGV4dCBzaGFwZVxyXG4gICAgICAgIGxldCBjbG9uZWRUZXh0RWxlbWVudCA9IHRoaXMuX2NyZWF0ZUNsb25lZEVsZW1lbnRGcm9tR3JhcGhpYyh0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cCk7XHJcbiAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoY2xvbmVkVGV4dEVsZW1lbnQsIFwiY2x1c3Rlci10ZXh0XCIpO1xyXG4gICAgICAgIGNsb25lZFRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChjbG9uZWRDbHVzdGVyRWxlbWVudCk7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChjbG9uZWRUZXh0RWxlbWVudCk7XHJcbiAgICAgICBcclxuICAgICAgICAvL3NldCB0aGUgZ3JvdXAgY2xhc3MgICAgIFxyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUsIFwiYWN0aXZhdGVkXCIsIDEwKTtcclxuXHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2luaXRGbGFyZXMoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyIHx8ICF0aGlzLmRpc3BsYXlGbGFyZXMpIHJldHVybjtcclxuXHJcbiAgICAgICAgbGV0IGdyaWRDbHVzdGVyID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5ncmlkQ2x1c3RlcjtcclxuXHJcbiAgICAgICAgLy9jaGVjayBpZiB3ZSBuZWVkIHRvIGNyZWF0ZSBmbGFyZXMgZm9yIHRoZSBjbHVzdGVyXHJcbiAgICAgICAgbGV0IHNpbmdsZUZsYXJlcyA9IChncmlkQ2x1c3Rlci5zaW5nbGVzICYmIGdyaWRDbHVzdGVyLnNpbmdsZXMubGVuZ3RoID4gMCkgJiYgKGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudCA8PSB0aGlzLm1heFNpbmdsZUZsYXJlQ291bnQpO1xyXG4gICAgICAgIGxldCBzdWJUeXBlRmxhcmVzID0gIXNpbmdsZUZsYXJlcyAmJiAoZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cyAmJiBncmlkQ2x1c3Rlci5zdWJUeXBlQ291bnRzLmxlbmd0aCA+IDApO1xyXG5cclxuICAgICAgICBpZiAoIXNpbmdsZUZsYXJlcyAmJiAhc3ViVHlwZUZsYXJlcykge1xyXG4gICAgICAgICAgICByZXR1cm47IC8vbm8gZmxhcmVzIHJlcXVpcmVkXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZmxhcmVzOiBGbGFyZVtdID0gW107XHJcbiAgICAgICAgaWYgKHNpbmdsZUZsYXJlcykge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZ3JpZENsdXN0ZXIuc2luZ2xlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGYgPSBuZXcgRmxhcmUoKTtcclxuICAgICAgICAgICAgICAgIGYudG9vbHRpcFRleHQgPSBncmlkQ2x1c3Rlci5zaW5nbGVzW2ldW3RoaXMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHldO1xyXG4gICAgICAgICAgICAgICAgZi5zaW5nbGVEYXRhID0gZ3JpZENsdXN0ZXIuc2luZ2xlc1tpXTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHN1YlR5cGVGbGFyZXMpIHtcclxuXHJcbiAgICAgICAgICAgIC8vc29ydCBzdWIgdHlwZXMgYnkgaGlnaGVzdCBjb3VudCBmaXJzdFxyXG4gICAgICAgICAgICB2YXIgc3ViVHlwZXMgPSBncmlkQ2x1c3Rlci5zdWJUeXBlQ291bnRzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBiLmNvdW50IC0gYS5jb3VudDtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gc3ViVHlwZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBmID0gbmV3IEZsYXJlKCk7XHJcbiAgICAgICAgICAgICAgICBmLnRvb2x0aXBUZXh0ID0gYCR7c3ViVHlwZXNbaV0ubmFtZX0gKCR7c3ViVHlwZXNbaV0uY291bnR9KWA7XHJcbiAgICAgICAgICAgICAgICBmLmZsYXJlVGV4dCA9IHN1YlR5cGVzW2ldLmNvdW50O1xyXG4gICAgICAgICAgICAgICAgZmxhcmVzLnB1c2goZik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vaWYgdGhlcmUgYXJlIG1vcmUgZmxhcmUgb2JqZWN0cyB0byBjcmVhdGUgdGhhbiB0aGUgbWF4RmxhcmVDb3VudCBhbmQgdGhpcyBpcyBhIG9uZSBvZiB0aG9zZSAtIGNyZWF0ZSBhIHN1bW1hcnkgZmxhcmUgdGhhdCBjb250YWlucyAnLi4uJyBhcyB0aGUgdGV4dCBhbmQgbWFrZSB0aGlzIG9uZSBwYXJ0IG9mIGl0IFxyXG4gICAgICAgIGxldCB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSA9IGZsYXJlcy5sZW5ndGggPiB0aGlzLm1heEZsYXJlQ291bnQ7XHJcbiAgICAgICAgbGV0IGZsYXJlQ291bnQgPSB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSA/IHRoaXMubWF4RmxhcmVDb3VudCA6IGZsYXJlcy5sZW5ndGg7XHJcblxyXG4gICAgICAgIC8vaWYgdGhlcmUncyBhbiBldmVuIGFtb3VudCBvZiBmbGFyZXMsIHBvc2l0aW9uIHRoZSBmaXJzdCBmbGFyZSB0byB0aGUgbGVmdCwgbWludXMgMTgwIGZyb20gZGVncmVlIHRvIGRvIHRoaXMuXHJcbiAgICAgICAgLy9mb3IgYW4gYWRkIGFtb3VudCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgb24gdG9wLCAtOTAgdG8gZG8gdGhpcy4gTG9va3MgbW9yZSBzeW1tZXRyaWNhbCB0aGlzIHdheS5cclxuICAgICAgICBsZXQgZGVncmVlVmFyaWFuY2UgPSAoZmxhcmVDb3VudCAlIDIgPT09IDApID8gLTE4MCA6IC05MDtcclxuICAgICAgICBsZXQgdmlld1JvdGF0aW9uID0gdGhpcy5faXMyZCA/IHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24gOiAwO1xyXG5cclxuICAgICAgICBsZXQgY2x1c3RlclNjcmVlblBvaW50ID0gdGhpcy5fYWN0aXZlVmlldy50b1NjcmVlbih0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5KTtcclxuICAgICAgICBsZXQgY2x1c3RlclN5bWJvbFNpemUgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbC5nZXQoXCJzaXplXCIpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmxhcmVDb3VudDsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICAvL2xldCBmbGFyZVBvaW50ID0gdGhpcy5fZ2V0RmxhcmVQb2ludChjbHVzdGVyU2NyZWVuUG9pbnQsIGNsdXN0ZXJTeW1ib2xTaXplLCBmbGFyZUNvdW50LCBpLCBkZWdyZWVWYXJpYW5jZSwgdmlld1JvdGF0aW9uKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBmbGFyZSA9IGZsYXJlc1tpXTtcclxuXHJcbiAgICAgICAgICAgIC8vc2V0IHNvbWUgYXR0cmlidXRlIGRhdGFcclxuICAgICAgICAgICAgbGV0IGZsYXJlQXR0cmlidXRlcyA9IHtcclxuICAgICAgICAgICAgICAgIGlzRmxhcmU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBpc1N1bW1hcnlGbGFyZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICB0b29sdGlwVGV4dDogXCJcIixcclxuICAgICAgICAgICAgICAgIGZsYXJlVGV4dEdyYXBoaWM6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIGNsdXN0ZXJHcmFwaGljSWQ6IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlcklkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnRcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGxldCBmbGFyZVRleHRBdHRyaWJ1dGVzID0ge307XHJcblxyXG4gICAgICAgICAgICAvL0RvIGEgY291cGxlIG9mIHRoaW5ncyBkaWZmZXJlbnRseSBpZiB0aGlzIGlzIGEgc3VtbWFyeSBmbGFyZSBvciBub3RcclxuICAgICAgICAgICAgbGV0IGlzU3VtbWFyeUZsYXJlID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgJiYgaSA+PSB0aGlzLm1heEZsYXJlQ291bnQgLSAxO1xyXG4gICAgICAgICAgICBpZiAoaXNTdW1tYXJ5RmxhcmUpIHsgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGZsYXJlLmlzU3VtbWFyeSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBmbGFyZUF0dHJpYnV0ZXMuaXNTdW1tYXJ5RmxhcmUgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgbGV0IHRvb2x0aXBUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIC8vbXVsdGlsaW5lIHRvb2x0aXAgZm9yIHN1bW1hcnkgZmxhcmVzLCBpZTogZ3JlYXRlciB0aGFuIHRoaXMubWF4RmxhcmVDb3VudCBmbGFyZXMgcGVyIGNsdXN0ZXJcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSB0aGlzLm1heEZsYXJlQ291bnQgLSAxLCBqbGVuID0gZmxhcmVzLmxlbmd0aDsgaiA8IGpsZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGogPiAodGhpcy5tYXhGbGFyZUNvdW50IC0gMSkgPyBcIlxcblwiIDogXCJcIjtcclxuICAgICAgICAgICAgICAgICAgICB0b29sdGlwVGV4dCArPSBmbGFyZXNbal0udG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmbGFyZS50b29sdGlwVGV4dCA9IHRvb2x0aXBUZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy50b29sdGlwVGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG4gICAgICAgICAgIFxyXG4gICAgICAgICAgICAvL2NyZWF0ZSBhIGdyYXBoaWMgZm9yIHRoZSBmbGFyZSBhbmQgZm9yIHRoZSBmbGFyZSB0ZXh0XHJcbiAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7XHJcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiBmbGFyZUF0dHJpYnV0ZXMsXHJcbiAgICAgICAgICAgICAgICBnZW9tZXRyeTogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSxcclxuICAgICAgICAgICAgICAgIHBvcHVwVGVtcGxhdGU6IG51bGxcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBmbGFyZS5ncmFwaGljLnN5bWJvbCA9IHRoaXMuX2dldEZsYXJlU3ltYm9sKGZsYXJlLmdyYXBoaWMpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faXMyZCAmJiB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICBmbGFyZS5ncmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAwO1xyXG4gICAgICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICAgICAgaWYgKGZsYXJlLmZsYXJlVGV4dCkge1xyXG4gICAgICAgICAgICAgICAgbGV0IHRleHRTeW1ib2wgPSB0aGlzLmZsYXJlVGV4dFN5bWJvbC5jbG9uZSgpO1xyXG4gICAgICAgICAgICAgICAgdGV4dFN5bWJvbC50ZXh0ID0gIWlzU3VtbWFyeUZsYXJlID8gZmxhcmUuZmxhcmVUZXh0LnRvU3RyaW5nKCkgOiBcIi4uLlwiO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0U3ltYm9sLmFuZ2xlID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBmbGFyZS50ZXh0R3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzVGV4dDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlckdyYXBoaWNJZDogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVySWRcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHN5bWJvbDogdGV4dFN5bWJvbCxcclxuICAgICAgICAgICAgICAgICAgICBnZW9tZXRyeTogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vZmxhcmVzIGhhdmUgYmVlbiBjcmVhdGVkIHNvIGFkZCB0aGVtIHRvIHRoZSBkb21cclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZmxhcmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBmID0gZmxhcmVzW2ldO1xyXG4gICAgICAgICAgICBpZiAoIWYuZ3JhcGhpYykgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICAvL2NyZWF0ZSBhIGdyb3VwIHRvIGhvbGQgZmxhcmUgb2JqZWN0IGFuZCB0ZXh0IGlmIG5lZWRlZC5cclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXAuY3JlYXRlR3JvdXAoKTtcclxuICAgICAgICAgICAgbGV0IHBvc2l0aW9uID0gdGhpcy5fc2V0RmxhcmVQb3NpdGlvbihmLmZsYXJlR3JvdXAsIGNsdXN0ZXJTeW1ib2xTaXplLCBmbGFyZUNvdW50LCBpLCBkZWdyZWVWYXJpYW5jZSwgdmlld1JvdGF0aW9uKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImZsYXJlLWdyb3VwXCIpO1xyXG4gICAgICAgICAgICBsZXQgZmxhcmVFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYuZ3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVFbGVtZW50KTtcclxuICAgICAgICAgICAgaWYgKGYudGV4dEdyYXBoaWMpIHtcclxuICAgICAgICAgICAgICAgIGxldCBmbGFyZVRleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGYudGV4dEdyYXBoaWMsIGYuZmxhcmVHcm91cCk7XHJcbiAgICAgICAgICAgICAgICBmbGFyZVRleHRFbGVtZW50LnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICAgICAgICAgIGYuZmxhcmVHcm91cC5yYXdOb2RlLmFwcGVuZENoaWxkKGZsYXJlVGV4dEVsZW1lbnQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudChmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJhY3RpdmF0ZWRcIiwgMTApO1xyXG5cclxuICAgICAgICAgICAgLy9hc3NpZ24gc29tZSBldmVudCBoYW5kbGVycyBmb3IgdGhlIHRvb2x0aXBzXHJcbiAgICAgICAgICAgIGYuZmxhcmVHcm91cC5tb3VzZUVudGVyID0gb24ucGF1c2FibGUoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwibW91c2VlbnRlclwiLCAoKSA9PiB0aGlzLl9jcmVhdGVUb29sdGlwKGYpKTtcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLm1vdXNlTGVhdmUgPSBvbi5wYXVzYWJsZShmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJtb3VzZWxlYXZlXCIsICgpID0+IHRoaXMuX2Rlc3Ryb3lUb29sdGlwKCkpO1xyXG4gICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zZXRGbGFyZVBvc2l0aW9uKGZsYXJlR3JvdXA6IGFueSwgY2x1c3RlclN5bWJvbFNpemU6IG51bWJlciwgZmxhcmVDb3VudDogbnVtYmVyLCBmbGFyZUluZGV4OiBudW1iZXIsIGRlZ3JlZVZhcmlhbmNlOiBudW1iZXIsIHZpZXdSb3RhdGlvbjogbnVtYmVyKSB7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSBwb3NpdGlvbiBvZiB0aGUgZmxhcmUgdG8gYmUgcGxhY2VkIGFyb3VuZCB0aGUgY29udGFpbmVyIGNpcmNsZS5cclxuICAgICAgICBsZXQgZGVncmVlID0gcGFyc2VJbnQoKCgzNjAgLyBmbGFyZUNvdW50KSAqIGZsYXJlSW5kZXgpLnRvRml4ZWQoKSk7XHJcbiAgICAgICAgZGVncmVlID0gZGVncmVlICsgZGVncmVlVmFyaWFuY2U7XHJcblxyXG4gICAgICAgIC8vdGFrZSBpbnRvIGFjY291bnQgYW55IHJvdGF0aW9uIG9uIHRoZSB2aWV3XHJcbiAgICAgICAgaWYgKHZpZXdSb3RhdGlvbiAhPT0gMCkge1xyXG4gICAgICAgICAgICBkZWdyZWUgLT0gdmlld1JvdGF0aW9uO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHJhZGlhbiA9IGRlZ3JlZSAqIChNYXRoLlBJIC8gMTgwKTtcclxuICAgICAgICBsZXQgYnVmZmVyID0gdGhpcy5mbGFyZUJ1ZmZlclBpeGVscztcclxuXHJcbiAgICAgICAgLy9wb3NpdGlvbiB0aGUgZmxhcmUgZ3JvdXAgYXJvdW5kIHRoZSBjbHVzdGVyXHJcbiAgICAgICAgbGV0IHBvc2l0aW9uID0ge1xyXG4gICAgICAgICAgICB4OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5jb3MocmFkaWFuKSxcclxuICAgICAgICAgICAgeTogKGJ1ZmZlciArIGNsdXN0ZXJTeW1ib2xTaXplKSAqIE1hdGguc2luKHJhZGlhbilcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vc2V0IHRoZSBwb3NpdGlvbiBieSBhZGRpbmcgYSB0cmFuc2Zvcm1cclxuICAgICAgICBmbGFyZUdyb3VwLnNldFRyYW5zZm9ybSh7IGR4OiBwb3NpdGlvbi54LCBkeTogcG9zaXRpb24ueSB9KTtcclxuICAgICAgICByZXR1cm4gcG9zaXRpb247XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZ2V0RmxhcmVTeW1ib2woZmxhcmVHcmFwaGljOiBHcmFwaGljKTogU2ltcGxlTWFya2VyU3ltYm9sIHtcclxuICAgICAgICByZXR1cm4gIXRoaXMuZmxhcmVSZW5kZXJlciA/IHRoaXMuZmxhcmVTeW1ib2wgOiB0aGlzLmZsYXJlUmVuZGVyZXIuZ2V0Q2xhc3NCcmVha0luZm8oZmxhcmVHcmFwaGljKS5zeW1ib2w7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlVG9vbHRpcChmbGFyZTogRmxhcmUpIHtcclxuXHJcbiAgICAgICAgbGV0IGZsYXJlR3JvdXAgPSBmbGFyZS5mbGFyZUdyb3VwO1xyXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lUb29sdGlwKCk7XHJcblxyXG4gICAgICAgIGxldCB0b29sdGlwTGVuZ3RoID0gcXVlcnkoXCIudG9vbHRpcC10ZXh0XCIsIGZsYXJlR3JvdXAucmF3Tm9kZSkubGVuZ3RoO1xyXG4gICAgICAgIGlmICh0b29sdGlwTGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2dldCB0aGUgdGV4dCBmcm9tIHRoZSBkYXRhLXRvb2x0aXAgYXR0cmlidXRlIG9mIHRoZSBzaGFwZSBvYmplY3RcclxuICAgICAgICBsZXQgdGV4dCA9IGZsYXJlLnRvb2x0aXBUZXh0O1xyXG4gICAgICAgIGlmICghdGV4dCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm5vIHRvb2x0aXAgdGV4dCBmb3IgZmxhcmUuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3NwbGl0IG9uIFxcbiBjaGFyYWN0ZXIgdGhhdCBzaG91bGQgYmUgaW4gdG9vbHRpcCB0byBzaWduaWZ5IG11bHRpcGxlIGxpbmVzXHJcbiAgICAgICAgbGV0IGxpbmVzID0gdGV4dC5zcGxpdChcIlxcblwiKTtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgYSBncm91cCB0byBob2xkIHRoZSB0b29sdGlwIGVsZW1lbnRzXHJcbiAgICAgICAgbGV0IHRvb2x0aXBHcm91cCA9IGZsYXJlR3JvdXAuY3JlYXRlR3JvdXAoKTtcclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIGZsYXJlIHN5bWJvbCwgd2UnbGwgdXNlIHRoaXMgdG8gc3R5bGUgdGhlIHRvb2x0aXAgYm94XHJcbiAgICAgICAgbGV0IGZsYXJlU3ltYm9sID0gdGhpcy5fZ2V0RmxhcmVTeW1ib2woZmxhcmUuZ3JhcGhpYyk7XHJcblxyXG4gICAgICAgIC8vYWxpZ24gb24gdG9wIGZvciBub3JtYWwgZmxhcmUsIGFsaWduIG9uIGJvdHRvbSBmb3Igc3VtbWFyeSBmbGFyZXMuXHJcbiAgICAgICAgbGV0IGhlaWdodCA9IGZsYXJlU3ltYm9sLnNpemU7XHJcblxyXG4gICAgICAgIGxldCB4UG9zID0gMTtcclxuICAgICAgICBsZXQgeVBvcyA9ICFmbGFyZS5pc1N1bW1hcnkgPyAoKGhlaWdodCkgKiAtMSkgOiBoZWlnaHQgKyA1O1xyXG5cclxuICAgICAgICB0b29sdGlwR3JvdXAucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcInRvb2x0aXAtdGV4dFwiKTtcclxuICAgICAgICBsZXQgdGV4dFNoYXBlcyA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cclxuICAgICAgICAgICAgbGV0IHRleHRTaGFwZSA9IHRvb2x0aXBHcm91cC5jcmVhdGVUZXh0KHsgeDogeFBvcywgeTogeVBvcyArIChpICogMTApLCB0ZXh0OiBsaW5lc1tpXSwgYWxpZ246ICdtaWRkbGUnIH0pXHJcbiAgICAgICAgICAgICAgICAuc2V0RmlsbCh0aGlzLmZsYXJlVGV4dFN5bWJvbC5jb2xvcilcclxuICAgICAgICAgICAgICAgIC5zZXRGb250KHsgc2l6ZTogMTAsIGZhbWlseTogdGhpcy5mbGFyZVRleHRTeW1ib2wuZm9udC5nZXQoXCJmYW1pbHlcIiksIHdlaWdodDogdGhpcy5mbGFyZVRleHRTeW1ib2wuZm9udC5nZXQoXCJ3ZWlnaHRcIikgfSk7XHJcblxyXG4gICAgICAgICAgICB0ZXh0U2hhcGVzLnB1c2godGV4dFNoYXBlKTtcclxuICAgICAgICAgICAgdGV4dFNoYXBlLnJhd05vZGUuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHJlY3RQYWRkaW5nID0gMjtcclxuICAgICAgICBsZXQgdGV4dEJveCA9IHRvb2x0aXBHcm91cC5nZXRCb3VuZGluZ0JveCgpO1xyXG5cclxuICAgICAgICBsZXQgcmVjdFNoYXBlID0gdG9vbHRpcEdyb3VwLmNyZWF0ZVJlY3QoeyB4OiB0ZXh0Qm94LnggLSByZWN0UGFkZGluZywgeTogdGV4dEJveC55IC0gcmVjdFBhZGRpbmcsIHdpZHRoOiB0ZXh0Qm94LndpZHRoICsgKHJlY3RQYWRkaW5nICogMiksIGhlaWdodDogdGV4dEJveC5oZWlnaHQgKyAocmVjdFBhZGRpbmcgKiAyKSwgcjogMCB9KVxyXG4gICAgICAgICAgICAuc2V0RmlsbChmbGFyZVN5bWJvbC5jb2xvcik7XHJcblxyXG4gICAgICAgIGlmIChmbGFyZVN5bWJvbC5vdXRsaW5lKSB7XHJcbiAgICAgICAgICAgIHJlY3RTaGFwZS5zZXRTdHJva2UoeyBjb2xvcjogZmxhcmVTeW1ib2wub3V0bGluZS5jb2xvciwgd2lkdGg6IDAuNSB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlY3RTaGFwZS5yYXdOb2RlLnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuXHJcbiAgICAgICAgZmxhcmVHcm91cC5tb3ZlVG9Gcm9udCgpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0ZXh0U2hhcGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRleHRTaGFwZXNbaV0ubW92ZVRvRnJvbnQoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGVzdHJveVRvb2x0aXAoKSB7XHJcbiAgICAgICAgcXVlcnkoXCIudG9vbHRpcC10ZXh0XCIsIHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZS5yYXdOb2RlKS5mb3JFYWNoKGRvbUNvbnN0cnVjdC5kZXN0cm95KTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLy8jcmVnaW9uIGhlbHBlciBmdW5jdGlvbnNcclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYywgc3VyZmFjZTogYW55KTogSFRNTEVsZW1lbnQge1xyXG5cclxuICAgICAgICAvL2Zha2Ugb3V0IGEgR0ZYT2JqZWN0IHNvIHdlIGNhbiBnZW5lcmF0ZSBhbiBzdmcgc2hhcGUgdGhhdCB0aGUgcGFzc2VkIGluIGdyYXBoaWNzIHNoYXBlXHJcbiAgICAgICAgbGV0IGcgPSBuZXcgR0ZYT2JqZWN0KCk7XHJcbiAgICAgICAgZy5ncmFwaGljID0gZ3JhcGhpYztcclxuICAgICAgICBnLnJlbmRlcmluZ0luZm8gPSB7IHN5bWJvbDogZ3JhcGhpYy5zeW1ib2wgfTtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgcGFyYW1ldGVycyBmb3IgdGhlIGNhbGwgdG8gcmVuZGVyXHJcbiAgICAgICAgLy9zZXQgdGhlIHRyYW5zZm9ybSBvZiB0aGUgcHJvamVjdG9yIHRvIDAncyBhcyB3ZSdyZSBqdXN0IHBsYWNpbmcgdGhlIGdlbmVyYXRlZCBjbHVzdGVyIHNoYXBlIGF0IGV4YWN0bHkgMCwwLlxyXG4gICAgICAgIGxldCBwcm9qZWN0b3IgPSBuZXcgUHJvamVjdG9yKCk7XHJcbiAgICAgICAgcHJvamVjdG9yLl90cmFuc2Zvcm0gPSBbMCwgMCwgMCwgMCwgMCwgMF07XHJcbiAgICAgICAgcHJvamVjdG9yLl9yZXNvbHV0aW9uID0gMDtcclxuXHJcbiAgICAgICAgbGV0IHN0YXRlID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkKSB7XHJcbiAgICAgICAgICAgIHN0YXRlID0gdGhpcy5fYWN0aXZlVmlldy5zdGF0ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vZmFrZSBvdXQgYSBzdGF0ZSBvYmplY3QgZm9yIDNkIHZpZXdzLlxyXG4gICAgICAgICAgICBzdGF0ZSA9IHtcclxuICAgICAgICAgICAgICAgIGNsaXBwZWRFeHRlbnQ6IHRoaXMuX2FjdGl2ZVZpZXcuZXh0ZW50LFxyXG4gICAgICAgICAgICAgICAgcm90YXRpb246IDAsXHJcbiAgICAgICAgICAgICAgICBzcGF0aWFsUmVmZXJlbmNlOiB0aGlzLl9hY3RpdmVWaWV3LnNwYXRpYWxSZWZlcmVuY2UsXHJcbiAgICAgICAgICAgICAgICB3b3JsZFNjcmVlbldpZHRoOiAxXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcGFyID0ge1xyXG4gICAgICAgICAgICBzdXJmYWNlOiBzdXJmYWNlLFxyXG4gICAgICAgICAgICBzdGF0ZTogc3RhdGUsXHJcbiAgICAgICAgICAgIHByb2plY3RvcjogcHJvamVjdG9yXHJcbiAgICAgICAgfTtcclxuICAgICAgICBnLnJlbmRlcihwYXIpO1xyXG4gICAgICAgIHJldHVybiBnLl9zaGFwZS5yYXdOb2RlO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9leHRlbnQoKTogRXh0ZW50IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYWN0aXZlVmlldyA/IHRoaXMuX2FjdGl2ZVZpZXcuZXh0ZW50IDogdW5kZWZpbmVkO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NjYWxlKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVZpZXcgPyB0aGlzLl9hY3RpdmVWaWV3LnNjYWxlIDogdW5kZWZpbmVkO1xyXG4gICAgfVxyXG5cclxuICAgIC8vSUUgLyBFZGdlIGRvbid0IGhhdmUgdGhlIGNsYXNzTGlzdCBwcm9wZXJ0eSBvbiBzdmcgZWxlbWVudHMsIHNvIHdlIGNhbid0IHVzZSB0aGF0IGFkZCAvIHJlbW92ZSBjbGFzc2VzIC0gcHJvYmFibHkgd2h5IGRvam8gZG9tQ2xhc3MgZG9lc24ndCB3b3JrIGVpdGhlci5cclxuICAgIC8vc28gdGhlIGZvbGxvd2luZyB0d28gZnVuY3Rpb25zIGFyZSBkb2RneSBzdHJpbmcgaGFja3MgdG8gYWRkIC8gcmVtb3ZlIGNsYXNzZXMuIFVzZXMgYSB0aW1lb3V0IHNvIHlvdSBjYW4gbWFrZSBjc3MgdHJhbnNpdGlvbnMgd29yayBpZiBkZXNpcmVkLlxyXG4gICAgcHJpdmF0ZSBfYWRkQ2xhc3NUb0VsZW1lbnQoZWxlbWVudDogSFRNTEVsZW1lbnQsIGNsYXNzTmFtZTogc3RyaW5nLCB0aW1lb3V0TXM/OiBudW1iZXIsIGNhbGxiYWNrPzogRnVuY3Rpb24pIHtcclxuXHJcbiAgICAgICAgbGV0IGFkZENsYXNzOiBGdW5jdGlvbiA9IChfZWxlbWVudCwgX2NsYXNzTmFtZSkgPT4ge1xyXG4gICAgICAgICAgICBsZXQgY3VycmVudENsYXNzID0gX2VsZW1lbnQuZ2V0QXR0cmlidXRlKFwiY2xhc3NcIik7XHJcbiAgICAgICAgICAgIGlmICghY3VycmVudENsYXNzKSBjdXJyZW50Q2xhc3MgPSBcIlwiO1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudENsYXNzLmluZGV4T2YoXCIgXCIgKyBfY2xhc3NOYW1lKSAhPT0gLTEpIHJldHVybjtcclxuICAgICAgICAgICAgbGV0IG5ld0NsYXNzID0gKGN1cnJlbnRDbGFzcyArIFwiIFwiICsgX2NsYXNzTmFtZSkudHJpbSgpO1xyXG4gICAgICAgICAgICBfZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBuZXdDbGFzcyk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKHRpbWVvdXRNcykge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIGFkZENsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCB0aW1lb3V0TXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgYWRkQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX3JlbW92ZUNsYXNzRnJvbUVsZW1lbnQoZWxlbWVudDogSFRNTEVsZW1lbnQsIGNsYXNzTmFtZTogc3RyaW5nLCB0aW1lb3V0TXM/OiBudW1iZXIsIGNhbGxiYWNrPzogRnVuY3Rpb24pIHtcclxuXHJcbiAgICAgICAgbGV0IHJlbW92ZUNsYXNzOiBGdW5jdGlvbiA9IChfZWxlbWVudCwgX2NsYXNzTmFtZSkgPT4ge1xyXG4gICAgICAgICAgICBsZXQgY3VycmVudENsYXNzID0gX2VsZW1lbnQuZ2V0QXR0cmlidXRlKFwiY2xhc3NcIik7XHJcbiAgICAgICAgICAgIGlmICghY3VycmVudENsYXNzKSByZXR1cm47XHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50Q2xhc3MuaW5kZXhPZihcIiBcIiArIF9jbGFzc05hbWUpID09PSAtMSkgcmV0dXJuO1xyXG4gICAgICAgICAgICBfZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBjdXJyZW50Q2xhc3MucmVwbGFjZShcIiBcIiArIF9jbGFzc05hbWUsIFwiXCIpKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodGltZW91dE1zKSB7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVtb3ZlQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIHRpbWVvdXRNcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICByZW1vdmVDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZ2V0TW91c2VQb3MoZXZ0KSB7XHJcbiAgICAgICAgLy9jb250YWluZXIgb24gdGhlIHZpZXcgaXMgYWN0dWFsbHkgYSBodG1sIGVsZW1lbnQgYXQgdGhpcyBwb2ludCwgbm90IGEgc3RyaW5nIGFzIHRoZSB0eXBpbmdzIHN1Z2dlc3QuXHJcbiAgICAgICAgbGV0IGNvbnRhaW5lcjogYW55ID0gdGhpcy5fYWN0aXZlVmlldy5jb250YWluZXI7XHJcbiAgICAgICAgbGV0IHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgeDogZXZ0LmNsaWVudFggLSByZWN0LmxlZnQsXHJcbiAgICAgICAgICAgIHk6IGV2dC5jbGllbnRZIC0gcmVjdC50b3BcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNldHRpbmcgdmlzaWJsZSB0byBmYWxzZSBvbiBhIGdyYXBoaWMgZG9lc24ndCB3b3JrIGluIDQuMiBmb3Igc29tZSByZWFzb24uIFJlbW92aW5nIHRoZSBncmFwaGljIHRvIGhpZGUgaXQgaW5zdGVhZC4gSSB0aGluayB2aXNpYmxlIHByb3BlcnR5IHNob3VsZCBwcm9iYWJseSB3b3JrIHRob3VnaC5cclxuICAgICAqIEBwYXJhbSBncmFwaGljXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2hpZGVHcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMgfCBHcmFwaGljW10pIHtcclxuICAgICAgICBpZiAoIWdyYXBoaWMpIHJldHVybjtcclxuICAgICAgICBpZiAoZ3JhcGhpYy5oYXNPd25Qcm9wZXJ0eShcImxlbmd0aFwiKSkge1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1hbnkoPEdyYXBoaWNbXT5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKDxHcmFwaGljPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zaG93R3JhcGhpYyhncmFwaGljOiBHcmFwaGljIHwgR3JhcGhpY1tdKSB7XHJcbiAgICAgICAgaWYgKCFncmFwaGljKSByZXR1cm47XHJcbiAgICAgICAgaWYgKGdyYXBoaWMuaGFzT3duUHJvcGVydHkoXCJsZW5ndGhcIikpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGRNYW55KDxHcmFwaGljW10+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmFkZCg8R3JhcGhpYz5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8jZW5kcmVnaW9uXHJcblxyXG59XHJcblxyXG5cclxuaW50ZXJmYWNlIEFjdGl2ZVZpZXcgZXh0ZW5kcyBfX2VzcmkuVmlldyB7XHJcbiAgICBjYW52YXM6IGFueTtcclxuICAgIHN0YXRlOiBhbnk7XHJcbiAgICBleHRlbnQ6IEV4dGVudDtcclxuICAgIHNjYWxlOiBudW1iZXI7XHJcbiAgICBmY2xTdXJmYWNlOiBhbnk7XHJcbiAgICBmY2xQb2ludGVyTW92ZTogSUhhbmRsZTtcclxuICAgIGZjbFJlc2l6ZTogSUhhbmRsZTtcclxuICAgIHJvdGF0aW9uOiBudW1iZXI7XHJcblxyXG4gICAgdG9TY3JlZW4oZ2VvbWV0cnk6IF9fZXNyaS5HZW9tZXRyeSk6IFNjcmVlblBvaW50O1xyXG4gICAgaGl0VGVzdChzY3JyZW5Qb2ludDogU2NyZWVuUG9pbnQpOiBhbnk7XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRDbHVzdGVyIHtcclxuICAgIGV4dGVudDogYW55O1xyXG4gICAgY2x1c3RlckNvdW50OiBudW1iZXI7XHJcbiAgICBzdWJUeXBlQ291bnRzOiBhbnlbXSA9IFtdO1xyXG4gICAgc2luZ2xlczogYW55W10gPSBbXTtcclxuICAgIHBvaW50czogYW55W10gPSBbXTtcclxuICAgIHg6IG51bWJlcjtcclxuICAgIHk6IG51bWJlcjtcclxufVxyXG5cclxuXHJcbmNsYXNzIENsdXN0ZXIge1xyXG4gICAgY2x1c3RlckdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0ZXh0R3JhcGhpYzogR3JhcGhpYztcclxuICAgIGFyZWFHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgY2x1c3RlcklkOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyR3JvdXA6IGFueTtcclxuICAgIGdyaWRDbHVzdGVyOiBHcmlkQ2x1c3RlcjtcclxufVxyXG5cclxuY2xhc3MgRmxhcmUgeyBcclxuICAgIGdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0ZXh0R3JhcGhpYzogR3JhcGhpYztcclxuICAgIHRvb2x0aXBUZXh0OiBzdHJpbmc7XHJcbiAgICBmbGFyZVRleHQ6IHN0cmluZztcclxuICAgIHNpbmdsZURhdGE6IGFueVtdO1xyXG4gICAgZmxhcmVHcm91cDogYW55O1xyXG4gICAgaXNTdW1tYXJ5OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUG9pbnRGaWx0ZXIge1xyXG4gICAgZmlsdGVyTmFtZTogc3RyaW5nO1xyXG4gICAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICBwcm9wZXJ0eVZhbHVlczogYW55W107XHJcblxyXG4gICAgLy9kZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGZpbHRlciBpbmNsdWRlcyBvciBleGNsdWRlcyB0aGUgcG9pbnQgZGVwZW5kaW5nIG9uIHdoZXRoZXIgaXQgY29udGFpbnMgdGhlIHByb3BlcnR5IHZhbHVlLlxyXG4gICAgLy9mYWxzZSBtZWFucyB0aGUgcG9pbnQgd2lsbCBiZSBleGNsdWRlZCBpZiB0aGUgdmFsdWUgZG9lcyBleGlzdCBpbiB0aGUgb2JqZWN0LCB0cnVlIG1lYW5zIGl0IHdpbGwgYmUgZXhjbHVkZWQgaWYgaXQgZG9lc24ndC5cclxuICAgIGtlZXBPbmx5SWZWYWx1ZUV4aXN0czogYm9vbGVhbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihmaWx0ZXJOYW1lOiBzdHJpbmcsIHByb3BlcnR5TmFtZTogc3RyaW5nLCB2YWx1ZXM6IGFueVtdLCBrZWVwT25seUlmVmFsdWVFeGlzdHM6IGJvb2xlYW4gPSBmYWxzZSkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVyTmFtZSA9IGZpbHRlck5hbWU7XHJcbiAgICAgICAgdGhpcy5wcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eU5hbWU7XHJcbiAgICAgICAgdGhpcy5wcm9wZXJ0eVZhbHVlcyA9IHZhbHVlcztcclxuICAgICAgICB0aGlzLmtlZXBPbmx5SWZWYWx1ZUV4aXN0cyA9IGtlZXBPbmx5SWZWYWx1ZUV4aXN0cztcclxuICAgIH1cclxuXHJcbn1cclxuXHJcbiJdfQ==
