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
    // - why is chrome on my pc fucked.
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkZsYXJlQ2x1c3RlckxheWVyX3Y0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhDQUE4Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFnRjlDLElBQUksaUJBQWlCLEdBQWlDLHlCQUF5QixDQUFDLFFBQVEsQ0FBTSxhQUFhLENBQUMsQ0FBQztJQUc3RyxRQUFRO0lBQ1IsbUNBQW1DO0lBR25DO1FBQXVDLHFDQUFpQjtRQW9EcEQsMkJBQVksT0FBb0M7WUFwRHBELGlCQThoQ0M7WUF4K0JPLGtCQUFNLE9BQU8sQ0FBQyxDQUFDO1lBakJYLG1CQUFjLEdBQVcsQ0FBQyxDQUFDO1lBUzNCLGNBQVMsR0FBc0MsRUFBRSxDQUFDO1lBVXRELGtCQUFrQjtZQUNsQixFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsNkJBQTZCO2dCQUM3QixPQUFPLENBQUMsS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7Z0JBQ2pGLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1lBRXZELGtDQUFrQztZQUNsQyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO1lBQy9DLElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUM7WUFDeEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxJQUFJLENBQUMsQ0FBQztZQUNwRCxJQUFJLENBQUMsMEJBQTBCLEdBQUcsT0FBTyxDQUFDLDBCQUEwQixJQUFJLE1BQU0sQ0FBQztZQUMvRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixLQUFLLE1BQU0sR0FBRyxTQUFTLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDO1lBQzdHLENBQUM7WUFDRCxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO1lBQ2hELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsbUJBQW1CLElBQUksQ0FBQyxDQUFDO1lBQzVELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsS0FBSyxLQUFLLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLGlCQUFpQjtZQUN0RixJQUFJLENBQUMsb0JBQW9CLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixLQUFLLElBQUksQ0FBQztZQUNsRSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixJQUFJLFNBQVMsQ0FBQztZQUN0RSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixJQUFJLENBQUMsQ0FBQztZQUV4RCx5QkFBeUI7WUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxJQUFJLEdBQUcsQ0FBQztZQUNsRCxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDO1lBQ2xELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxHQUFHLENBQUM7WUFFbEQsMENBQTBDO1lBQzFDLElBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQztZQUMvQyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUM7WUFDekMsSUFBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDO1lBQzdDLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQztZQUN6QyxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7WUFFM0MscURBQXFEO1lBQ3JELElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLFdBQVcsSUFBSSxJQUFJLGtCQUFrQixDQUFDO2dCQUM3RCxJQUFJLEVBQUUsRUFBRTtnQkFDUixLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDaEMsT0FBTyxFQUFFLElBQUksZ0JBQWdCLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQzthQUN0RixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLElBQUksSUFBSSxVQUFVLENBQUM7Z0JBQ25ELEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ2pDLElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsRUFBRTtvQkFDUixNQUFNLEVBQUUsT0FBTztpQkFDbEI7Z0JBQ0QsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUNkLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsSUFBSSxJQUFJLFVBQVUsQ0FBQztnQkFDN0QsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDakMsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxDQUFDO29CQUNQLE1BQU0sRUFBRSxPQUFPO2lCQUNsQjtnQkFDRCxPQUFPLEVBQUUsQ0FBQyxDQUFDO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsY0FBYztZQUNkLElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxTQUFTLENBQUM7WUFFdkMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxVQUFDLEdBQUcsSUFBSyxPQUFBLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBM0IsQ0FBMkIsQ0FBQyxDQUFDO1lBRWxFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNiLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoQixDQUFDO1FBQ0wsQ0FBQztRQUdPLDZDQUFpQixHQUF6QixVQUEwQixHQUFHO1lBQTdCLGlCQTZCQztZQTNCRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO1lBQ3RDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7WUFDdEMsQ0FBQztZQUVELHNEQUFzRDtZQUN0RCxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxVQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksSUFBSyxPQUFBLEtBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQTlDLENBQThDLENBQUMsQ0FBQztZQUVwSSxJQUFJLENBQUMsdUJBQXVCLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQztZQUV2RSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7Z0JBRXRDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO29CQUMxQiwrQ0FBK0M7b0JBQy9DLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDWixJQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO2dCQUNwQyxDQUFDO1lBQ0wsQ0FBQztZQUNELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV0QiwwQkFBMEI7WUFDMUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTVDLENBQUM7UUFHTywwQ0FBYyxHQUF0QixVQUF1QixJQUFpQjtZQUF4QyxpQkFLQztZQUpHLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUN2QyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUNwQixDQUFDLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsY0FBYyxFQUFFLFVBQUMsR0FBRyxJQUFLLE9BQUEsS0FBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxFQUExQixDQUEwQixDQUFDLENBQUM7WUFDakYsQ0FBQztRQUNMLENBQUM7UUFHTywyQ0FBZSxHQUF2QixVQUF3QixZQUFZLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJO1lBRTVDLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ2YsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ2IsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNoQixDQUFDO2dCQUVELDJCQUEyQjtnQkFDM0IsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQzFCLENBQUM7WUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsK0JBQStCO2dCQUMvQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM5QixDQUFDO1FBQ0wsQ0FBQztRQUdELGlDQUFLLEdBQUw7WUFDSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDeEIsQ0FBQztRQUdELG1DQUFPLEdBQVAsVUFBUSxJQUFXLEVBQUUsUUFBd0I7WUFBeEIsd0JBQXdCLEdBQXhCLGVBQXdCO1lBQ3pDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2xCLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2hCLENBQUM7UUFDTCxDQUFDO1FBRUQsZ0NBQUksR0FBSixVQUFLLFVBQWdCO1lBQXJCLGlCQStJQztZQTdJRyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUNiLElBQUksQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDO1lBQ2xDLENBQUM7WUFFRCx1Q0FBdUM7WUFDdkMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDckIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztnQkFDL0IsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBRTdDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDO1lBRTVDLG9FQUFvRTtZQUNwRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDaEQsT0FBTyxDQUFDLEtBQUssQ0FBQywyRUFBMkUsQ0FBQyxDQUFDO2dCQUMzRixNQUFNLENBQUM7WUFDWCxDQUFDO1lBRUQsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVuRCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBRXhELElBQUksUUFBUSxHQUFjLEVBQUUsQ0FBQztZQUU3QixrRkFBa0Y7WUFDbEYsbUdBQW1HO1lBQ25HLGtHQUFrRztZQUNsRyw2RUFBNkU7WUFDN0UsSUFBSSxTQUFTLEdBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxHQUFXLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxnQkFBZ0IsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2xMLElBQUksZUFBZSxHQUFHLEtBQUssQ0FBQztZQUU1QixJQUFJLG1CQUFtQixHQUFHLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNoRCxTQUFTLEdBQUcsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkMsRUFBRSxDQUFDLENBQUMsbUJBQW1CLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLFNBQVMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BELGVBQWUsR0FBRyxJQUFJLENBQUM7WUFDM0IsQ0FBQztZQUVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNwQixJQUFJLENBQUMsa0JBQWtCLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3hELENBQUM7WUFHRCxJQUFJLEdBQWEsRUFBRSxHQUFRLEVBQUUsVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLElBQVksRUFBRSxJQUFZLENBQUM7WUFDeEYsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDbEMsR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRXBCLHlFQUF5RTtnQkFDekUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDM0IsUUFBUSxDQUFDO2dCQUNiLENBQUM7Z0JBRUQsSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQy9CLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUUvQixtR0FBbUc7Z0JBQ25HLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO29CQUN0QyxHQUFHLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3ZCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ0osR0FBRyxHQUFHLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2xELENBQUM7Z0JBRUQsNkRBQTZEO2dCQUM3RCxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDakgsUUFBUSxDQUFDO2dCQUNiLENBQUM7Z0JBRUQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7b0JBRXBCLHVEQUF1RDtvQkFDdkQsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQzlELElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBRS9CLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7NEJBQzdHLFFBQVEsQ0FBQyxDQUFDLHNCQUFzQjt3QkFDcEMsQ0FBQzt3QkFFRCxpRUFBaUU7d0JBQ2pFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7d0JBQzlGLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7d0JBRTlGLG9KQUFvSjt3QkFDcEosRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQzs0QkFDMUIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQzt3QkFDakMsQ0FBQzt3QkFFRCxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUM7d0JBRWxCLElBQUksYUFBYSxHQUFHLEtBQUssQ0FBQzt3QkFDMUIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7NEJBQzVELEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0NBQzlELEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7Z0NBQzVCLGFBQWEsR0FBRyxJQUFJLENBQUM7Z0NBQ3JCLEtBQUssQ0FBQzs0QkFDVixDQUFDO3dCQUNMLENBQUM7d0JBRUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDOzRCQUNqQixFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7d0JBQzlFLENBQUM7d0JBRUQsa0VBQWtFO3dCQUNsRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7NEJBQzlDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUN6QixDQUFDO3dCQUNELElBQUksQ0FBQyxDQUFDOzRCQUNGLEVBQUUsQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO3dCQUNwQixDQUFDO3dCQUVELEtBQUssQ0FBQztvQkFDVixDQUFDO2dCQUNMLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLENBQUM7b0JBQ0YscUNBQXFDO29CQUNyQyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM1QixDQUFDO1lBQ0wsQ0FBQztZQUVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNwQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDNUQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7d0JBQzVELEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQzs0QkFDekUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUN6RCxDQUFDO29CQUNMLENBQUM7b0JBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzlDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUMvQyxDQUFDO2dCQUNMLENBQUM7WUFDTCxDQUFDO1lBRUQsOENBQThDO1lBQzlDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQy9CLE9BQU8sQ0FBQyxPQUFPLENBQUMsZUFBYSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQU0sQ0FBQyxDQUFDO1lBRXRELFVBQVUsQ0FBQztnQkFDUCxLQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDMUIsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztRQUVPLHlDQUFhLEdBQXJCLFVBQXNCLEdBQVE7WUFDMUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztnQkFBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1lBQzVELElBQUksTUFBTSxHQUFHLElBQUksQ0FBQztZQUNsQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDdEQsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0IsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxJQUFJLENBQUM7b0JBQUMsUUFBUSxDQUFDO2dCQUUvQyxJQUFJLFNBQVMsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQy9FLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7b0JBQ1osTUFBTSxHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLG9FQUFvRTtnQkFDL0csQ0FBQztnQkFDRCxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztvQkFDbEQsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLDJHQUEyRztnQkFDL0gsQ0FBQztnQkFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztvQkFBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsc0RBQXNEO1lBQ3JGLENBQUM7WUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ2xCLENBQUM7UUFFTyx5Q0FBYSxHQUFyQixVQUFzQixHQUFHO1lBQ3JCLElBQUksS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDO2dCQUNsQixDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7YUFDckYsQ0FBQyxDQUFDO1lBRUgsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztnQkFDeEMsS0FBSyxHQUFVLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25FLENBQUM7WUFFRCxJQUFJLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDdEIsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsVUFBVSxFQUFFLEdBQUc7YUFDbEIsQ0FBQyxDQUFDO1lBRUgsT0FBTyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUM7WUFDakQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3RFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQzVCLENBQUM7WUFDRCxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ3pCLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUN2QyxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUM7Z0JBQ0Ysb0ZBQW9GO2dCQUNwRixPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDO1lBQ3hELENBQUM7WUFFRCxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3RCLENBQUM7UUFHTywwQ0FBYyxHQUF0QixVQUF1QixXQUF3QjtZQUUzQyxJQUFJLE9BQU8sR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQzVCLE9BQU8sQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1lBRWxDLDJHQUEyRztZQUMzRyxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM5RCxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUN4QyxLQUFLLEdBQVUsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkUsQ0FBQztZQUVELElBQUksVUFBVSxHQUFRO2dCQUNsQixDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBQ2hCLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQztnQkFDaEIsWUFBWSxFQUFFLFdBQVcsQ0FBQyxZQUFZO2dCQUN0QyxTQUFTLEVBQUUsSUFBSTtnQkFDZixhQUFhLEVBQUUsV0FBVzthQUM3QixDQUFBO1lBRUQsT0FBTyxDQUFDLGNBQWMsR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDakMsVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLFFBQVEsRUFBRSxLQUFLO2FBQ2xCLENBQUMsQ0FBQztZQUNILE9BQU8sQ0FBQyxjQUFjLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUV0RyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDMUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDO1lBQzdFLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDL0MsQ0FBQztZQUVELE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNsRCxPQUFPLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQztZQUVoRSx3REFBd0Q7WUFDeEQsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN6QyxVQUFVLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDO1lBQ3ZELENBQUM7WUFFRCxPQUFPLENBQUMsV0FBVyxHQUFHLElBQUksT0FBTyxDQUFDO2dCQUM5QixRQUFRLEVBQUUsS0FBSztnQkFDZixVQUFVLEVBQUU7b0JBQ1IsYUFBYSxFQUFFLElBQUk7b0JBQ25CLE1BQU0sRUFBRSxJQUFJO29CQUNaLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztpQkFDL0I7Z0JBQ0QsTUFBTSxFQUFFLFVBQVU7YUFDckIsQ0FBQyxDQUFDO1lBRUgsMkVBQTJFO1lBQzNFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRWpGLElBQUksRUFBRSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQzFCLEVBQUUsQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztnQkFDL0IsSUFBSSxJQUFJLEdBQVEsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxtREFBbUQ7Z0JBRXhHLElBQUksUUFBUSxHQUFRO29CQUNoQixDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7b0JBQ2hCLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFDaEIsWUFBWSxFQUFFLFdBQVcsQ0FBQyxZQUFZO29CQUN0QyxTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7b0JBQzVCLGFBQWEsRUFBRSxJQUFJO2lCQUN0QixDQUFBO2dCQUVELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEMsSUFBSSxRQUFRLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDLHFHQUFxRztvQkFDbkksUUFBUSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUUzQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO3dCQUMzQyxRQUFRLEdBQVksZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQzNFLENBQUM7b0JBRUQsT0FBTyxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7b0JBQ2hGLE9BQU8sQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFFakcsQ0FBQztZQUNMLENBQUM7WUFFRCxtQ0FBbUM7WUFDbkMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDOUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUNELElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBRTlCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLE9BQU8sQ0FBQztRQUNoRCxDQUFDO1FBR08sOENBQWtCLEdBQTFCLFVBQTJCLFNBQWlCLEVBQUUsZUFBd0I7WUFFbEUsOElBQThJO1lBQzlJLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3BFLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRXJFLCtIQUErSDtZQUMvSCxFQUFFLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO2dCQUNsQixNQUFNLElBQUksQ0FBQyxDQUFDO1lBQ2hCLENBQUM7WUFFRCxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUNwRCxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUVwRCxJQUFJLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQztZQUVuQyx1SkFBdUo7WUFDdkosSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7WUFDeEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ25DLE1BQU0sR0FBRyxNQUFNLEdBQUcsRUFBRSxDQUFDO2dCQUNyQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUM5QixNQUFNLEdBQUcsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDbkMsTUFBTSxHQUFHLE1BQU0sR0FBRyxFQUFFLENBQUM7b0JBQ3JCLElBQUksR0FBRyxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO29CQUNyRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQzt3QkFDcEIsTUFBTSxFQUFFLEdBQUc7d0JBQ1gsWUFBWSxFQUFFLENBQUM7d0JBQ2YsYUFBYSxFQUFFLEVBQUU7d0JBQ2pCLE9BQU8sRUFBRSxFQUFFO3dCQUNYLE1BQU0sRUFBRSxFQUFFO3dCQUNWLENBQUMsRUFBRSxDQUFDO3dCQUNKLENBQUMsRUFBRSxDQUFDO3FCQUNQLENBQUMsQ0FBQztnQkFDUCxDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUM7UUFFRDs7O1dBR0c7UUFDSywwQ0FBYyxHQUF0QjtZQUVJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUN4QyxJQUFJLG9CQUFvQixHQUFHLFNBQVMsQ0FBQztZQUNyQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixvQkFBb0IsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7WUFDL0gsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLG9CQUFvQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7WUFDdkcsQ0FBQztZQUVELElBQUksT0FBTyxHQUFHLEdBQUcsQ0FBQyxhQUFhLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ2hFLE9BQU8sQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBRS9DLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzlFLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUM7WUFFdEMsdUxBQXVMO1lBQ3ZMLG1HQUFtRztZQUNuRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ2xFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFpQixFQUFFLEtBQUs7b0JBQ3hELFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDdkMsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDO1FBQ0wsQ0FBQztRQUVPLDRDQUFnQixHQUF4QixVQUF5QixHQUFHO1lBQTVCLGlCQWtDQztZQWhDRyxJQUFJLEVBQUUsR0FBRyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUVqRCwwSUFBMEk7WUFDMUksZ0tBQWdLO1lBQ2hLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDNUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDUCxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUM7d0JBQUMsTUFBTSxDQUFDO2dCQUN2RyxDQUFDO1lBQ0wsQ0FBQztZQUVELElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFDLFFBQVE7Z0JBQ3ZDLHdCQUF3QjtnQkFDeEIsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQztnQkFDaEMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN4QixLQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDMUIsTUFBTSxDQUFDO2dCQUNYLENBQUM7Z0JBR0QsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztvQkFDNUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3ZFLElBQUksT0FBTyxHQUFHLEtBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDckQsS0FBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO3dCQUMvQixNQUFNLENBQUM7b0JBQ1gsQ0FBQztvQkFDRCxJQUFJLENBQUMsQ0FBQzt3QkFDRixLQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDOUIsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO1FBRU8sNENBQWdCLEdBQXhCLFVBQXlCLE9BQWdCO1lBRXJDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDbEMsTUFBTSxDQUFDLENBQUMsZ0JBQWdCO1lBQzVCLENBQUM7WUFDRCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUUxQixJQUFJLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQztZQUM5QixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUVuQixJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBRXpGLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkQsQ0FBQztZQUVELGtDQUFrQztRQUN0QyxDQUFDO1FBRU8sOENBQWtCLEdBQTFCO1lBRUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVqQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQ3pGLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFFcEYsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBRUQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO1lBRWhDLHFDQUFxQztRQUV6QyxDQUFDO1FBR08sd0NBQVksR0FBcEI7WUFDSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBRWpDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVyQixJQUFJLEVBQUUsR0FBZ0IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDN0YsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNySSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXhELENBQUM7UUFFTyx5Q0FBYSxHQUFyQjtZQUNJLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3pFLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDM0YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBRU8sd0NBQVksR0FBcEI7WUFDSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ2pDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQzFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUVyQix3UEFBd1A7WUFDeFAsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN4RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBRW5GLDBCQUEwQjtZQUMxQixJQUFJLG9CQUFvQixHQUFHLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3RJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUV6RCwrQkFBK0I7WUFDL0IsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNoSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDM0QsaUJBQWlCLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUMzRSxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFFeEUsMEJBQTBCO1lBQzFCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXZGLENBQUM7UUFHTyx1Q0FBVyxHQUFuQjtZQUFBLGlCQThJQztZQTdJRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUV4RCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQztZQUVsRCxtREFBbUQ7WUFDbkQsSUFBSSxZQUFZLEdBQUcsQ0FBQyxXQUFXLENBQUMsT0FBTyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUNySSxJQUFJLGFBQWEsR0FBRyxDQUFDLFlBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLElBQUksV0FBVyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFFekcsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLENBQUMsQ0FBQyxvQkFBb0I7WUFDaEMsQ0FBQztZQUVELElBQUksTUFBTSxHQUFZLEVBQUUsQ0FBQztZQUN6QixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUM3RCxJQUFJLENBQUMsR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNwQixDQUFDLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7b0JBQ3hFLENBQUMsQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7b0JBQ2pCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25CLENBQUM7WUFDTCxDQUFDO1lBQ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7Z0JBRXJCLHVDQUF1QztnQkFDdkMsSUFBSSxRQUFRLEdBQUcsV0FBVyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFDN0IsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDcEIsQ0FBQyxDQUFDLFdBQVcsR0FBTSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQUcsQ0FBQztvQkFDN0QsQ0FBQyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO29CQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQixDQUFDO1lBQ0wsQ0FBQztZQUVELG9MQUFvTDtZQUNwTCxJQUFJLHVCQUF1QixHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUNqRSxJQUFJLFVBQVUsR0FBRyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFFOUUsOEdBQThHO1lBQzlHLHFHQUFxRztZQUNyRyxJQUFJLGNBQWMsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDekQsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7WUFFOUQsSUFBSSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNoRyxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUUsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUMsR0FBRyxVQUFVLEVBQUUsR0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFFbEMsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUMsQ0FBQyxDQUFDO2dCQUV0Qix5QkFBeUI7Z0JBQ3pCLElBQUksZUFBZSxHQUFHO29CQUNsQixPQUFPLEVBQUUsSUFBSTtvQkFDYixjQUFjLEVBQUUsS0FBSztvQkFDckIsV0FBVyxFQUFFLEVBQUU7b0JBQ2YsZ0JBQWdCLEVBQUUsU0FBUztvQkFDM0IsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTO29CQUMvQyxZQUFZLEVBQUUsV0FBVyxDQUFDLFlBQVk7aUJBQ3pDLENBQUM7Z0JBRUYsSUFBSSxtQkFBbUIsR0FBRyxFQUFFLENBQUM7Z0JBRTdCLHFFQUFxRTtnQkFDckUsSUFBSSxjQUFjLEdBQUcsdUJBQXVCLElBQUksR0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO2dCQUM1RSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO29CQUNqQixLQUFLLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztvQkFDdkIsZUFBZSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7b0JBQ3RDLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztvQkFDckIsOEZBQThGO29CQUM5RixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQ3ZFLFdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7d0JBQ3hELFdBQVcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO29CQUN6QyxDQUFDO29CQUNELEtBQUssQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO2dCQUNwQyxDQUFDO2dCQUVELGVBQWUsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztnQkFFaEQsdURBQXVEO2dCQUN2RCxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDO29CQUN4QixVQUFVLEVBQUUsZUFBZTtvQkFDM0IsUUFBUSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLFFBQVE7b0JBQ3JELGFBQWEsRUFBRSxJQUFJO2lCQUN0QixDQUFDLENBQUM7Z0JBRUgsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzNELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUMxQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7Z0JBQ3BFLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLENBQUM7b0JBQ0YsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QyxDQUFDO2dCQUdELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUNsQixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUM5QyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDO29CQUV2RSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzt3QkFDMUMsVUFBVSxDQUFDLEtBQUssR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7b0JBQ3ZELENBQUM7b0JBRUQsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLE9BQU8sQ0FBQzt3QkFDNUIsVUFBVSxFQUFFOzRCQUNSLE1BQU0sRUFBRSxJQUFJOzRCQUNaLGdCQUFnQixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUzt5QkFDbEQ7d0JBQ0QsTUFBTSxFQUFFLFVBQVU7d0JBQ2xCLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxRQUFRO3FCQUN4RCxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7WUFFRCxpREFBaUQ7WUFDakQ7Z0JBQ0ksSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUMsQ0FBQyxDQUFDO2dCQUNsQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7b0JBQUMsa0JBQVM7Z0JBRXpCLHlEQUF5RDtnQkFDekQsQ0FBQyxDQUFDLFVBQVUsR0FBRyxNQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDOUQsSUFBSSxRQUFRLEdBQUcsTUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsVUFBVSxFQUFFLEdBQUMsRUFBRSxjQUFjLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBRXBILE1BQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztnQkFDN0QsSUFBSSxZQUFZLEdBQUcsTUFBSSxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNqRixDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQy9DLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO29CQUNoQixJQUFJLGdCQUFnQixHQUFHLE1BQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDekYsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUN4RCxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDdkQsQ0FBQztnQkFFRCxNQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUUvRCw2Q0FBNkM7Z0JBQzdDLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUF0QixDQUFzQixDQUFDLENBQUM7Z0JBQ3hHLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsZUFBZSxFQUFFLEVBQXRCLENBQXNCLENBQUMsQ0FBQzs7O1lBckI1RyxHQUFHLENBQUMsQ0FBQyxJQUFJLEdBQUMsR0FBRyxDQUFDLEVBQUUsS0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBQyxHQUFHLEtBQUcsRUFBRSxHQUFDLEVBQUU7OzthQXVCaEQ7UUFFTCxDQUFDO1FBRU8sNkNBQWlCLEdBQXpCLFVBQTBCLFVBQWUsRUFBRSxpQkFBeUIsRUFBRSxVQUFrQixFQUFFLFVBQWtCLEVBQUUsY0FBc0IsRUFBRSxZQUFvQjtZQUV0Six5RUFBeUU7WUFDekUsSUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNuRSxNQUFNLEdBQUcsTUFBTSxHQUFHLGNBQWMsQ0FBQztZQUVqQyw0Q0FBNEM7WUFDNUMsRUFBRSxDQUFDLENBQUMsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLE1BQU0sSUFBSSxZQUFZLENBQUM7WUFDM0IsQ0FBQztZQUVELElBQUksTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDdEMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1lBRXBDLDZDQUE2QztZQUM3QyxJQUFJLFFBQVEsR0FBRztnQkFDWCxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztnQkFDbEQsQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7YUFDckQsQ0FBQTtZQUVELFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUQsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNwQixDQUFDO1FBRU8sMkNBQWUsR0FBdkIsVUFBd0IsWUFBcUI7WUFDekMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQzlHLENBQUM7UUFFTywwQ0FBYyxHQUF0QixVQUF1QixLQUFZO1lBRS9CLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7WUFDbEMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBRXZCLElBQUksYUFBYSxHQUFHLEtBQUssQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUN0RSxFQUFFLENBQUMsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEIsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELGtFQUFrRTtZQUNsRSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO1lBQzdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDUixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7Z0JBQzFDLE1BQU0sQ0FBQztZQUNYLENBQUM7WUFFRCwyRUFBMkU7WUFDM0UsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU3Qiw2Q0FBNkM7WUFDN0MsSUFBSSxZQUFZLEdBQUcsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBRTVDLCtEQUErRDtZQUMvRCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUV0RCxvRUFBb0U7WUFDcEUsSUFBSSxNQUFNLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztZQUU5QixJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7WUFDYixJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUUzRCxZQUFZLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDM0QsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBRS9DLElBQUksU0FBUyxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUM7cUJBQ3BHLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztxQkFDbkMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUU3SCxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQixTQUFTLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM3RCxDQUFDO1lBRUQsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBQ3BCLElBQUksT0FBTyxHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUU1QyxJQUFJLFNBQVMsR0FBRyxZQUFZLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxHQUFHLFdBQVcsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7aUJBQzFMLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFaEMsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDMUUsQ0FBQztZQUVELFNBQVMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN6QixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNwRCxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDaEMsQ0FBQztRQUVMLENBQUM7UUFFTywyQ0FBZSxHQUF2QjtZQUNJLEtBQUssQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5RixDQUFDO1FBR0QsMEJBQTBCO1FBRWxCLDJEQUErQixHQUF2QyxVQUF3QyxPQUFnQixFQUFFLE9BQVk7WUFFbEUsd0ZBQXdGO1lBQ3hGLElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7WUFDeEIsQ0FBQyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7WUFDcEIsQ0FBQyxDQUFDLGFBQWEsR0FBRyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFFN0MsMENBQTBDO1lBQzFDLDZHQUE2RztZQUM3RyxJQUFJLFNBQVMsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBRTFCLElBQUksS0FBSyxHQUFHLFNBQVMsQ0FBQztZQUN0QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDYixLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUM7WUFDbkMsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLHVDQUF1QztnQkFDdkMsS0FBSyxHQUFHO29CQUNKLGFBQWEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU07b0JBQ3RDLFFBQVEsRUFBRSxDQUFDO29CQUNYLGdCQUFnQixFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCO29CQUNuRCxnQkFBZ0IsRUFBRSxDQUFDO2lCQUN0QixDQUFDO1lBQ04sQ0FBQztZQUVELElBQUksR0FBRyxHQUFHO2dCQUNOLE9BQU8sRUFBRSxPQUFPO2dCQUNoQixLQUFLLEVBQUUsS0FBSztnQkFDWixTQUFTLEVBQUUsU0FBUzthQUN2QixDQUFDO1lBQ0YsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNkLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUM1QixDQUFDO1FBR08sbUNBQU8sR0FBZjtZQUNJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztRQUNsRSxDQUFDO1FBRU8sa0NBQU0sR0FBZDtZQUNJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUNqRSxDQUFDO1FBRUQsMEpBQTBKO1FBQzFKLGdKQUFnSjtRQUN4SSw4Q0FBa0IsR0FBMUIsVUFBMkIsT0FBb0IsRUFBRSxTQUFpQixFQUFFLFNBQWtCLEVBQUUsUUFBbUI7WUFFdkcsSUFBSSxRQUFRLEdBQWEsVUFBQyxRQUFRLEVBQUUsVUFBVTtnQkFDMUMsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7b0JBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztnQkFDckMsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQUMsTUFBTSxDQUFDO2dCQUMxRCxJQUFJLFFBQVEsR0FBRyxDQUFDLFlBQVksR0FBRyxHQUFHLEdBQUcsVUFBVSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ3hELFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQzdDLENBQUMsQ0FBQztZQUVGLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1osVUFBVSxDQUFDO29CQUNQLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQzdCLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQ1gsUUFBUSxFQUFFLENBQUM7b0JBQ2YsQ0FBQztnQkFDTCxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEIsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDakMsQ0FBQztRQUNMLENBQUM7UUFHTyxtREFBdUIsR0FBL0IsVUFBZ0MsT0FBb0IsRUFBRSxTQUFpQixFQUFFLFNBQWtCLEVBQUUsUUFBbUI7WUFFNUcsSUFBSSxXQUFXLEdBQWEsVUFBQyxRQUFRLEVBQUUsVUFBVTtnQkFDN0MsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7b0JBQUMsTUFBTSxDQUFDO2dCQUMxQixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFBQyxNQUFNLENBQUM7Z0JBQzFELFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQy9FLENBQUMsQ0FBQztZQUVGLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1osVUFBVSxDQUFDO29CQUNQLFdBQVcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQ2hDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQ1gsUUFBUSxFQUFFLENBQUM7b0JBQ2YsQ0FBQztnQkFDTCxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEIsQ0FBQztZQUNELElBQUksQ0FBQyxDQUFDO2dCQUNGLFdBQVcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEMsQ0FBQztRQUVMLENBQUM7UUFFTyx3Q0FBWSxHQUFwQixVQUFxQixHQUFHO1lBQ3BCLHNHQUFzRztZQUN0RyxJQUFJLFNBQVMsR0FBUSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQztZQUNoRCxJQUFJLElBQUksR0FBRyxTQUFTLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUM3QyxNQUFNLENBQUM7Z0JBQ0gsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUk7Z0JBQzFCLENBQUMsRUFBRSxHQUFHLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHO2FBQzVCLENBQUM7UUFDTixDQUFDO1FBR0Q7OztXQUdHO1FBQ0ssd0NBQVksR0FBcEIsVUFBcUIsT0FBNEI7WUFDN0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ3JCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsVUFBVSxDQUFZLE9BQU8sQ0FBQyxDQUFDO1lBQ3hDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsTUFBTSxDQUFVLE9BQU8sQ0FBQyxDQUFDO1lBQ2xDLENBQUM7UUFDTCxDQUFDO1FBRU8sd0NBQVksR0FBcEIsVUFBcUIsT0FBNEI7WUFDN0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQ3JCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsT0FBTyxDQUFZLE9BQU8sQ0FBQyxDQUFDO1lBQ3JDLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQztnQkFDRixJQUFJLENBQUMsR0FBRyxDQUFVLE9BQU8sQ0FBQyxDQUFDO1lBQy9CLENBQUM7UUFDTCxDQUFDO1FBM2hDTDtZQUFDLHlCQUF5QixDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQzs7NkJBQUE7UUEraEN4RCx3QkFBQztJQUFELENBOWhDQSxBQThoQ0MsQ0E5aENzQyxpQkFBaUIsR0E4aEN2RDtJQTloQ1kseUJBQWlCLG9CQThoQzdCLENBQUE7SUFpQkQ7UUFBQTtZQUdJLGtCQUFhLEdBQVUsRUFBRSxDQUFDO1lBQzFCLFlBQU8sR0FBVSxFQUFFLENBQUM7WUFDcEIsV0FBTSxHQUFVLEVBQUUsQ0FBQztRQUd2QixDQUFDO1FBQUQsa0JBQUM7SUFBRCxDQVJBLEFBUUMsSUFBQTtJQUdEO1FBQUE7UUFPQSxDQUFDO1FBQUQsY0FBQztJQUFELENBUEEsQUFPQyxJQUFBO0lBRUQ7UUFBQTtRQVFBLENBQUM7UUFBRCxZQUFDO0lBQUQsQ0FSQSxBQVFDLElBQUE7SUFFRDtRQVNJLHFCQUFZLFVBQWtCLEVBQUUsWUFBb0IsRUFBRSxNQUFhLEVBQUUscUJBQXNDO1lBQXRDLHFDQUFzQyxHQUF0Qyw2QkFBc0M7WUFDdkcsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7WUFDN0IsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7WUFDakMsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUM7WUFDN0IsSUFBSSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQixDQUFDO1FBQ3ZELENBQUM7UUFFTCxrQkFBQztJQUFELENBaEJBLEFBZ0JDLElBQUE7SUFoQlksbUJBQVcsY0FnQnZCLENBQUEiLCJmaWxlIjoiRmxhcmVDbHVzdGVyTGF5ZXJfdjQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cclxuXHJcblxyXG5pbXBvcnQgKiBhcyBHcmFwaGljc0xheWVyIGZyb20gXCJlc3JpL2xheWVycy9HcmFwaGljc0xheWVyXCI7XHJcbmltcG9ydCAqIGFzIENsYXNzQnJlYWtzUmVuZGVyZXIgZnJvbSBcImVzcmkvcmVuZGVyZXJzL0NsYXNzQnJlYWtzUmVuZGVyZXJcIjtcclxuaW1wb3J0ICogYXMgUG9wdXBUZW1wbGF0ZSBmcm9tIFwiZXNyaS9Qb3B1cFRlbXBsYXRlXCI7XHJcbmltcG9ydCAqIGFzIFNpbXBsZU1hcmtlclN5bWJvbCBmcm9tIFwiZXNyaS9zeW1ib2xzL1NpbXBsZU1hcmtlclN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBUZXh0U3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvVGV4dFN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBTaW1wbGVMaW5lU3ltYm9sIGZyb20gXCJlc3JpL3N5bWJvbHMvU2ltcGxlTGluZVN5bWJvbFwiO1xyXG5pbXBvcnQgKiBhcyBDb2xvciBmcm9tIFwiZXNyaS9Db2xvclwiO1xyXG5pbXBvcnQgKiBhcyB3YXRjaFV0aWxzIGZyb20gJ2VzcmkvY29yZS93YXRjaFV0aWxzJztcclxuaW1wb3J0ICogYXMgVmlldyBmcm9tICdlc3JpL3ZpZXdzL1ZpZXcnO1xyXG5pbXBvcnQgKiBhcyB3ZWJNZXJjYXRvclV0aWxzIGZyb20gXCJlc3JpL2dlb21ldHJ5L3N1cHBvcnQvd2ViTWVyY2F0b3JVdGlsc1wiO1xyXG5pbXBvcnQgKiBhcyBHcmFwaGljIGZyb20gXCJlc3JpL0dyYXBoaWNcIjtcclxuaW1wb3J0ICogYXMgUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgU2NyZWVuUG9pbnQgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU2NyZWVuUG9pbnRcIjtcclxuaW1wb3J0ICogYXMgTXVsdGlwb2ludCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9NdWx0aXBvaW50XCI7XHJcbmltcG9ydCAqIGFzIFBvbHlnb24gZnJvbSBcImVzcmkvZ2VvbWV0cnkvUG9seWdvblwiO1xyXG5pbXBvcnQgKiBhcyBnZW9tZXRyeUVuZ2luZSBmcm9tICdlc3JpL2dlb21ldHJ5L2dlb21ldHJ5RW5naW5lJztcclxuaW1wb3J0ICogYXMgU3BhdGlhbFJlZmVyZW5jZSBmcm9tIFwiZXNyaS9nZW9tZXRyeS9TcGF0aWFsUmVmZXJlbmNlXCI7XHJcbmltcG9ydCAqIGFzIEV4dGVudCBmcm9tIFwiZXNyaS9nZW9tZXRyeS9FeHRlbnRcIjtcclxuaW1wb3J0ICogYXMgZXh0ZXJuYWxSZW5kZXJlcnMgZnJvbSBcImVzcmkvdmlld3MvM2QvZXh0ZXJuYWxSZW5kZXJlcnNcIjtcclxuXHJcbmltcG9ydCAqIGFzIEdGWE9iamVjdCBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvR0ZYT2JqZWN0XCI7XHJcbmltcG9ydCAqIGFzIFByb2plY3RvciBmcm9tIFwiZXNyaS92aWV3cy8yZC9lbmdpbmUvZ3JhcGhpY3MvUHJvamVjdG9yXCI7XHJcbiBcclxuaW1wb3J0ICogYXMgYWNjZXNzb3JTdXBwb3J0RGVjb3JhdG9ycyBmcm9tIFwiZXNyaS9jb3JlL2FjY2Vzc29yU3VwcG9ydC9kZWNvcmF0b3JzXCI7XHJcbiBcclxuaW1wb3J0ICogYXMgb24gZnJvbSAnZG9qby9vbic7XHJcbmltcG9ydCAqIGFzIGdmeCBmcm9tICdkb2pveC9nZngnO1xyXG5pbXBvcnQgKiBhcyBkb21Db25zdHJ1Y3QgZnJvbSAnZG9qby9kb20tY29uc3RydWN0JztcclxuaW1wb3J0ICogYXMgcXVlcnkgZnJvbSAnZG9qby9xdWVyeSc7XHJcbmltcG9ydCAqIGFzIGRvbSBmcm9tICdkb2pvL2RvbSc7XHJcbmltcG9ydCAqIGFzIGRvbUF0dHIgZnJvbSAnZG9qby9kb20tYXR0cic7XHJcbmltcG9ydCAqIGFzIGRvbVN0eWxlIGZyb20gJ2Rvam8vZG9tLXN0eWxlJztcclxuXHJcblxyXG5pbnRlcmZhY2UgRmxhcmVDbHVzdGVyTGF5ZXJQcm9wZXJ0aWVzIGV4dGVuZHMgX19lc3JpLkdyYXBoaWNzTGF5ZXJQcm9wZXJ0aWVzIHtcclxuXHJcbiAgICBjbHVzdGVyUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcblxyXG4gICAgc2luZ2xlUmVuZGVyZXI/OiBhbnk7XHJcbiAgICBzaW5nbGVTeW1ib2w/OiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBhcmVhUmVuZGVyZXI/OiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG4gICAgZmxhcmVSZW5kZXJlcj86IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcblxyXG4gICAgc2luZ2xlUG9wdXBUZW1wbGF0ZT86IFBvcHVwVGVtcGxhdGU7XHJcbiAgICBzcGF0aWFsUmVmZXJlbmNlPzogU3BhdGlhbFJlZmVyZW5jZTtcclxuXHJcbiAgICBjbHVzdGVyUmF0aW8/OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyVG9TY2FsZT86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJNaW5Db3VudD86IG51bWJlcjtcclxuICAgIGNsdXN0ZXJBcmVhRGlzcGxheT86IHN0cmluZztcclxuXHJcbiAgICBkaXNwbGF5RmxhcmVzPzogYm9vbGVhbjtcclxuICAgIG1heEZsYXJlQ291bnQ/OiBudW1iZXI7XHJcbiAgICBtYXhTaW5nbGVGbGFyZUNvdW50PzogbnVtYmVyO1xyXG4gICAgc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHk/OiBzdHJpbmc7XHJcbiAgICBmbGFyZVN5bWJvbD86IFNpbXBsZU1hcmtlclN5bWJvbDtcclxuICAgIGZsYXJlQnVmZmVyUGl4ZWxzPzogbnVtYmVyO1xyXG4gICAgdGV4dFN5bWJvbD86IFRleHRTeW1ib2w7XHJcbiAgICBmbGFyZVRleHRTeW1ib2w/OiBUZXh0U3ltYm9sO1xyXG4gICAgZGlzcGxheVN1YlR5cGVGbGFyZXM/OiBib29sZWFuO1xyXG4gICAgc3ViVHlwZUZsYXJlUHJvcGVydHk/OiBzdHJpbmc7XHJcblxyXG4gICAgeFByb3BlcnR5TmFtZT86IHN0cmluZztcclxuICAgIHlQcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcbiAgICB6UHJvcGVydHlOYW1lPzogc3RyaW5nO1xyXG5cclxuICAgIGZpbHRlcnM/OiBQb2ludEZpbHRlcltdO1xyXG5cclxuICAgIGRhdGE/OiBhbnlbXTtcclxuXHJcbn1cclxuXHJcblxyXG4vL1RoaXMgaXMgaG93IHlvdSBoYXZlIHRvIGV4dGVuZCBjbGFzc2VzIGluIGFyY2dpcyBhcGkgdGhhdCBhcmUgYSBzdWJjbGFzcyBvZiBBY2Nlc3Nvci5cclxuLy9XaWxsIGxpa2VseSBjaGFuZ2UgaW4gZnV0dXJlIHJlbGVhc2VzLiBTZWUgdGhlc2UgbGlua3MgLSBodHRwczovL2dpdGh1Yi5jb20vRXNyaS9qc2FwaS1yZXNvdXJjZXMvaXNzdWVzLzQwICYgaHR0cHM6Ly9naXRodWIuY29tL3ljYWJvbi9leHRlbmQtYWNjZXNzb3ItZXhhbXBsZVxyXG5pbnRlcmZhY2UgQmFzZUdyYXBoaWNzTGF5ZXIgZXh0ZW5kcyBHcmFwaGljc0xheWVyIHsgfVxyXG5pbnRlcmZhY2UgQmFzZUdyYXBoaWNzTGF5ZXJDb25zdHJ1Y3RvciB7IG5ldyAob3B0aW9ucz86IF9fZXNyaS5HcmFwaGljc0xheWVyUHJvcGVydGllcyk6IEJhc2VHcmFwaGljc0xheWVyOyB9XHJcbmxldCBiYXNlR3JhcGhpY3NMYXllcjogQmFzZUdyYXBoaWNzTGF5ZXJDb25zdHJ1Y3RvciA9IGFjY2Vzc29yU3VwcG9ydERlY29yYXRvcnMuZGVjbGFyZWQoPGFueT5HcmFwaGljc0xheWVyKTtcclxuXHJcblxyXG4vL1RPRE86IFxyXG4vLyAtIHdoeSBpcyBjaHJvbWUgb24gbXkgcGMgZnVja2VkLlxyXG5cclxuQGFjY2Vzc29yU3VwcG9ydERlY29yYXRvcnMuc3ViY2xhc3MoXCJGbGFyZUNsdXN0ZXJMYXllclwiKVxyXG5leHBvcnQgY2xhc3MgRmxhcmVDbHVzdGVyTGF5ZXIgZXh0ZW5kcyBiYXNlR3JhcGhpY3NMYXllciB7XHJcblxyXG4gICAgc2luZ2xlUmVuZGVyZXI6IGFueTtcclxuICAgIHNpbmdsZVN5bWJvbDogU2ltcGxlTWFya2VyU3ltYm9sO1xyXG4gICAgc2luZ2xlUG9wdXBUZW1wbGF0ZTogUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICBjbHVzdGVyUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBhcmVhUmVuZGVyZXI6IENsYXNzQnJlYWtzUmVuZGVyZXI7XHJcbiAgICBmbGFyZVJlbmRlcmVyOiBDbGFzc0JyZWFrc1JlbmRlcmVyO1xyXG5cclxuICAgIHNwYXRpYWxSZWZlcmVuY2U6IFNwYXRpYWxSZWZlcmVuY2U7XHJcblxyXG4gICAgY2x1c3RlclJhdGlvOiBudW1iZXI7XHJcbiAgICBjbHVzdGVyVG9TY2FsZTogbnVtYmVyO1xyXG4gICAgY2x1c3Rlck1pbkNvdW50OiBudW1iZXI7XHJcbiAgICBjbHVzdGVyQXJlYURpc3BsYXk6IHN0cmluZztcclxuXHJcbiAgICBkaXNwbGF5RmxhcmVzOiBib29sZWFuO1xyXG4gICAgbWF4RmxhcmVDb3VudDogbnVtYmVyO1xyXG4gICAgbWF4U2luZ2xlRmxhcmVDb3VudDogbnVtYmVyO1xyXG4gICAgc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHk6IHN0cmluZztcclxuICAgIGZsYXJlU3ltYm9sOiBTaW1wbGVNYXJrZXJTeW1ib2w7XHJcbiAgICBmbGFyZUJ1ZmZlclBpeGVsczogbnVtYmVyO1xyXG4gICAgdGV4dFN5bWJvbDogVGV4dFN5bWJvbDtcclxuICAgIGZsYXJlVGV4dFN5bWJvbDogVGV4dFN5bWJvbDtcclxuICAgIGRpc3BsYXlTdWJUeXBlRmxhcmVzOiBib29sZWFuO1xyXG4gICAgc3ViVHlwZUZsYXJlUHJvcGVydHk6IHN0cmluZztcclxuXHJcbiAgICB4UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB5UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB6UHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcblxyXG4gICAgZmlsdGVyczogUG9pbnRGaWx0ZXJbXTtcclxuXHJcbiAgICBwcml2YXRlIF9ncmlkQ2x1c3RlcnM6IEdyaWRDbHVzdGVyW107XHJcbiAgICBwcml2YXRlIF9pc0NsdXN0ZXJlZDogYm9vbGVhbjtcclxuICAgIHByaXZhdGUgX2FjdGl2ZVZpZXc6IEFjdGl2ZVZpZXc7XHJcbiAgICBwcml2YXRlIF92aWV3TG9hZENvdW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIHByaXZhdGUgX3JlYWR5VG9EcmF3OiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkSW5pdGlhbERyYXc6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9kYXRhOiBhbnlbXTtcclxuICAgIHByaXZhdGUgX2lzMmQ6IGJvb2xlYW47XHJcblxyXG4gICAgcHJpdmF0ZSB2aWV3UG9wdXBNZXNzYWdlRW5hYmxlZDtcclxuXHJcbiAgICBwcml2YXRlIF9jbHVzdGVyczogeyBbY2x1c3RlcklkOiBudW1iZXJdOiBDbHVzdGVyOyB9ID0ge307XHJcbiAgICBwcml2YXRlIF9hY3RpdmVDbHVzdGVyOiBDbHVzdGVyO1xyXG5cclxuICAgIHByaXZhdGUgX2xheWVyVmlldzJkOiBhbnk7XHJcbiAgICBwcml2YXRlIF9sYXllclZpZXczZDogYW55O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEZsYXJlQ2x1c3RlckxheWVyUHJvcGVydGllcykge1xyXG5cclxuICAgICAgICBzdXBlcihvcHRpb25zKTtcclxuXHJcbiAgICAgICAgLy9zZXQgdGhlIGRlZmF1bHRzXHJcbiAgICAgICAgaWYgKCFvcHRpb25zKSB7XHJcbiAgICAgICAgICAgIC8vbWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzXHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJNaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnMgdG8gZmxhcmUgY2x1c3RlciBsYXllciBjb25zdHJ1Y3Rvci5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuc2luZ2xlUG9wdXBUZW1wbGF0ZSA9IG9wdGlvbnMuc2luZ2xlUG9wdXBUZW1wbGF0ZTtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgdGhlIGNsdXN0ZXJpbmcgcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2x1c3RlclJhdGlvID0gb3B0aW9ucy5jbHVzdGVyUmF0aW8gfHwgNzU7XHJcbiAgICAgICAgdGhpcy5jbHVzdGVyVG9TY2FsZSA9IG9wdGlvbnMuY2x1c3RlclRvU2NhbGUgfHwgMjAwMDAwMDtcclxuICAgICAgICB0aGlzLmNsdXN0ZXJNaW5Db3VudCA9IG9wdGlvbnMuY2x1c3Rlck1pbkNvdW50IHx8IDI7XHJcbiAgICAgICAgdGhpcy5zaW5nbGVGbGFyZVRvb2x0aXBQcm9wZXJ0eSA9IG9wdGlvbnMuc2luZ2xlRmxhcmVUb29sdGlwUHJvcGVydHkgfHwgXCJuYW1lXCI7XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlckFyZWFEaXNwbGF5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID0gb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwibm9uZVwiID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jbHVzdGVyQXJlYURpc3BsYXk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubWF4RmxhcmVDb3VudCA9IG9wdGlvbnMubWF4RmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMubWF4U2luZ2xlRmxhcmVDb3VudCA9IG9wdGlvbnMubWF4U2luZ2xlRmxhcmVDb3VudCB8fCA4O1xyXG4gICAgICAgIHRoaXMuZGlzcGxheUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheUZsYXJlcyA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7IC8vZGVmYXVsdCB0byB0cnVlXHJcbiAgICAgICAgdGhpcy5kaXNwbGF5U3ViVHlwZUZsYXJlcyA9IG9wdGlvbnMuZGlzcGxheVN1YlR5cGVGbGFyZXMgPT09IHRydWU7XHJcbiAgICAgICAgdGhpcy5zdWJUeXBlRmxhcmVQcm9wZXJ0eSA9IG9wdGlvbnMuc3ViVHlwZUZsYXJlUHJvcGVydHkgfHwgdW5kZWZpbmVkO1xyXG4gICAgICAgIHRoaXMuZmxhcmVCdWZmZXJQaXhlbHMgPSBvcHRpb25zLmZsYXJlQnVmZmVyUGl4ZWxzIHx8IDY7XHJcblxyXG4gICAgICAgIC8vZGF0YSBzZXQgcHJvcGVydHkgbmFtZXNcclxuICAgICAgICB0aGlzLnhQcm9wZXJ0eU5hbWUgPSBvcHRpb25zLnhQcm9wZXJ0eU5hbWUgfHwgXCJ4XCI7XHJcbiAgICAgICAgdGhpcy55UHJvcGVydHlOYW1lID0gb3B0aW9ucy55UHJvcGVydHlOYW1lIHx8IFwieVwiO1xyXG4gICAgICAgIHRoaXMuelByb3BlcnR5TmFtZSA9IG9wdGlvbnMuelByb3BlcnR5TmFtZSB8fCBcInpcIjtcclxuXHJcbiAgICAgICAgLy9zZXQgdXAgdGhlIHN5bWJvbG9neS9yZW5kZXJlciBwcm9wZXJ0aWVzXHJcbiAgICAgICAgdGhpcy5jbHVzdGVyUmVuZGVyZXIgPSBvcHRpb25zLmNsdXN0ZXJSZW5kZXJlcjtcclxuICAgICAgICB0aGlzLmFyZWFSZW5kZXJlciA9IG9wdGlvbnMuYXJlYVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlUmVuZGVyZXIgPSBvcHRpb25zLnNpbmdsZVJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuc2luZ2xlU3ltYm9sID0gb3B0aW9ucy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgdGhpcy5mbGFyZVJlbmRlcmVyID0gb3B0aW9ucy5mbGFyZVJlbmRlcmVyO1xyXG5cclxuICAgICAgICAvL2FkZCBzb21lIGRlZmF1bHQgc3ltYm9scyBvciB1c2UgdGhlIG9wdGlvbnMgdmFsdWVzLlxyXG4gICAgICAgIHRoaXMuZmxhcmVTeW1ib2wgPSBvcHRpb25zLmZsYXJlU3ltYm9sIHx8IG5ldyBTaW1wbGVNYXJrZXJTeW1ib2woe1xyXG4gICAgICAgICAgICBzaXplOiAxNCxcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMCwgMCwgMCwgMC41XSksXHJcbiAgICAgICAgICAgIG91dGxpbmU6IG5ldyBTaW1wbGVMaW5lU3ltYm9sKHsgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NSwgMC41XSksIHdpZHRoOiAxIH0pXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMudGV4dFN5bWJvbCA9IG9wdGlvbnMudGV4dFN5bWJvbCB8fCBuZXcgVGV4dFN5bWJvbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBuZXcgQ29sb3IoWzI1NSwgMjU1LCAyNTVdKSxcclxuICAgICAgICAgICAgZm9udDoge1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogMTAsXHJcbiAgICAgICAgICAgICAgICBmYW1pbHk6IFwiYXJpYWxcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5b2Zmc2V0OiAtM1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmZsYXJlVGV4dFN5bWJvbCA9IG9wdGlvbnMuZmxhcmVUZXh0U3ltYm9sIHx8IG5ldyBUZXh0U3ltYm9sKHtcclxuICAgICAgICAgICAgY29sb3I6IG5ldyBDb2xvcihbMjU1LCAyNTUsIDI1NV0pLFxyXG4gICAgICAgICAgICBmb250OiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiA2LFxyXG4gICAgICAgICAgICAgICAgZmFtaWx5OiBcImFyaWFsXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeW9mZnNldDogLTJcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy9pbml0aWFsIGRhdGFcclxuICAgICAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgdGhpcy5vbihcImxheWVydmlldy1jcmVhdGVcIiwgKGV2dCkgPT4gdGhpcy5fbGF5ZXJWaWV3Q3JlYXRlZChldnQpKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2RhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9sYXllclZpZXdDcmVhdGVkKGV2dCkge1xyXG5cclxuICAgICAgICBpZiAoZXZ0LmxheWVyVmlldy52aWV3LnR5cGUgPT09IFwiMmRcIikge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXcyZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllclZpZXczZCA9IGV2dC5sYXllclZpZXc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2FkZCBhIHN0YXRpb25hcnkgd2F0Y2ggb24gdGhlIHZpZXcgdG8gZG8gc29tZSBzdHVmZi5cclxuICAgICAgICB3YXRjaFV0aWxzLnBhdXNhYmxlKGV2dC5sYXllclZpZXcudmlldywgXCJzdGF0aW9uYXJ5XCIsIChpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpID0+IHRoaXMuX3ZpZXdTdGF0aW9uYXJ5KGlzU3RhdGlvbmFyeSwgYiwgYywgdmlldykpO1xyXG5cclxuICAgICAgICB0aGlzLnZpZXdQb3B1cE1lc3NhZ2VFbmFibGVkID0gZXZ0LmxheWVyVmlldy52aWV3LnBvcHVwLm1lc3NhZ2VFbmFibGVkO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fdmlld0xvYWRDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gZXZ0LmxheWVyVmlldy52aWV3O1xyXG5cclxuICAgICAgICAgICAgdGhpcy5fcmVhZHlUb0RyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkSW5pdGlhbERyYXcpIHtcclxuICAgICAgICAgICAgICAgIC8vd2UndmUgYmVlbiB3YWl0aW5nIGZvciB0aGlzIHRvIGhhcHBlbiB0byBkcmF3XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZEluaXRpYWxEcmF3ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdmlld0xvYWRDb3VudCsrO1xyXG5cclxuICAgICAgICAvL3dpcmUgdXAgc29tZSB2aWV3IGV2ZW50c1xyXG4gICAgICAgIHRoaXMuX2FkZFZpZXdFdmVudHMoZXZ0LmxheWVyVmlldy52aWV3KTtcclxuXHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2FkZFZpZXdFdmVudHModmlldz86IEFjdGl2ZVZpZXcpIHtcclxuICAgICAgICBsZXQgdiA9IHZpZXcgPyB2aWV3IDogdGhpcy5fYWN0aXZlVmlldztcclxuICAgICAgICBpZiAoIXYuZmNsUG9pbnRlck1vdmUpIHtcclxuICAgICAgICAgICAgdi5mY2xQb2ludGVyTW92ZSA9IHYub24oXCJwb2ludGVyLW1vdmVcIiwgKGV2dCkgPT4gdGhpcy5fdmlld1BvaW50ZXJNb3ZlKGV2dCkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgICBcclxuXHJcbiAgICBwcml2YXRlIF92aWV3U3RhdGlvbmFyeShpc1N0YXRpb25hcnksIGIsIGMsIHZpZXcpIHtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaXNTdGF0aW9uYXJ5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9kYXRhKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy9yZWFhc2lnbiBldmVudHMgaWYgbmVlZGVkXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZFZpZXdFdmVudHMoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghaXNTdGF0aW9uYXJ5ICYmIHRoaXMuX2FjdGl2ZUNsdXN0ZXIpIHtcclxuICAgICAgICAgICAgLy9pZiBtb3ZpbmcgZGVhY3RpdmF0ZSBjbHVzdGVyO1xyXG4gICAgICAgICAgICB0aGlzLl9kZWFjdGl2YXRlQ2x1c3RlcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgY2xlYXIoKSB7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVBbGwoKTtcclxuICAgICAgICB0aGlzLl9jbHVzdGVycyA9IHt9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBzZXREYXRhKGRhdGE6IGFueVtdLCBkcmF3RGF0YTogYm9vbGVhbiA9IHRydWUpIHtcclxuICAgICAgICB0aGlzLl9kYXRhID0gZGF0YTtcclxuICAgICAgICBpZiAoZHJhd0RhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kcmF3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGRyYXcoYWN0aXZlVmlldz86IGFueSkge1xyXG5cclxuICAgICAgICBpZiAoYWN0aXZlVmlldykge1xyXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWaWV3ID0gYWN0aXZlVmlldztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vTm90IHJlYWR5IHRvIGRyYXcgeWV0IHNvIHF1ZXVlIG9uZSB1cFxyXG4gICAgICAgIGlmICghdGhpcy5fcmVhZHlUb0RyYXcpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkSW5pdGlhbERyYXcgPSB0cnVlO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIXRoaXMuX2FjdGl2ZVZpZXcgfHwgIXRoaXMuX2RhdGEpIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5faXMyZCA9IHRoaXMuX2FjdGl2ZVZpZXcudHlwZSA9PT0gXCIyZFwiO1xyXG5cclxuICAgICAgICAvL2NoZWNrIHRvIG1ha2Ugc3VyZSB3ZSBoYXZlIGFuIGFyZWEgcmVuZGVyZXIgc2V0IGlmIG9uZSBuZWVkcyB0byBiZVxyXG4gICAgICAgIGlmICh0aGlzLmNsdXN0ZXJBcmVhRGlzcGxheSAmJiAhdGhpcy5hcmVhUmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkZsYXJlQ2x1c3RlckxheWVyOiBhcmVhUmVuZGVyZXIgbXVzdCBiZSBzZXQgaWYgY2x1c3RlckFyZWFEaXNwbGF5IGlzIHNldC5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2xlYXIoKTtcclxuICAgICAgICBjb25zb2xlLnRpbWUoXCJkcmF3LWRhdGEtXCIgKyB0aGlzLl9hY3RpdmVWaWV3LnR5cGUpO1xyXG5cclxuICAgICAgICB0aGlzLl9pc0NsdXN0ZXJlZCA9IHRoaXMuY2x1c3RlclRvU2NhbGUgPCB0aGlzLl9zY2FsZSgpO1xyXG5cclxuICAgICAgICBsZXQgZ3JhcGhpY3M6IEdyYXBoaWNbXSA9IFtdO1xyXG5cclxuICAgICAgICAvL2dldCBhbiBleHRlbnQgdGhhdCBpcyBpbiB3ZWIgbWVyY2F0b3IgdG8gbWFrZSBzdXJlIGl0J3MgZmxhdCBmb3IgZXh0ZW50IGNoZWNraW5nXHJcbiAgICAgICAgLy9UaGUgd2ViZXh0ZW50IHdpbGwgbmVlZCB0byBiZSBub3JtYWxpemVkIHNpbmNlIHBhbm5pbmcgb3ZlciB0aGUgaW50ZXJuYXRpb25hbCBkYXRlbGluZSB3aWxsIGNhdXNlXHJcbiAgICAgICAgLy9jYXVzZSB0aGUgZXh0ZW50IHRvIHNoaWZ0IG91dHNpZGUgdGhlIC0xODAgdG8gMTgwIGRlZ3JlZSB3aW5kb3cuICBJZiB3ZSBkb24ndCBub3JtYWxpemUgdGhlbiB0aGVcclxuICAgICAgICAvL2NsdXN0ZXJzIHdpbGwgbm90IGJlIGRyYXduIGlmIHRoZSBtYXAgcGFucyBvdmVyIHRoZSBpbnRlcm5hdGlvbmFsIGRhdGVsaW5lLlxyXG4gICAgICAgIGxldCB3ZWJFeHRlbnQ6IGFueSA9ICF0aGlzLl9leHRlbnQoKS5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IgPyA8RXh0ZW50PndlYk1lcmNhdG9yVXRpbHMucHJvamVjdCh0aGlzLl9leHRlbnQoKSwgbmV3IFNwYXRpYWxSZWZlcmVuY2UoeyBcIndraWRcIjogMTAyMTAwIH0pKSA6IHRoaXMuX2V4dGVudCgpO1xyXG4gICAgICAgIGxldCBleHRlbnRJc1VuaW9uZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgbGV0IG5vcm1hbGl6ZWRXZWJFeHRlbnQgPSB3ZWJFeHRlbnQubm9ybWFsaXplKCk7XHJcbiAgICAgICAgd2ViRXh0ZW50ID0gbm9ybWFsaXplZFdlYkV4dGVudFswXTtcclxuICAgICAgICBpZiAobm9ybWFsaXplZFdlYkV4dGVudC5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgIHdlYkV4dGVudCA9IHdlYkV4dGVudC51bmlvbihub3JtYWxpemVkV2ViRXh0ZW50WzFdKTtcclxuICAgICAgICAgICAgZXh0ZW50SXNVbmlvbmVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9pc0NsdXN0ZXJlZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVDbHVzdGVyR3JpZCh3ZWJFeHRlbnQsIGV4dGVudElzVW5pb25lZCk7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgbGV0IHdlYjogbnVtYmVyW10sIG9iajogYW55LCBkYXRhTGVuZ3RoID0gdGhpcy5fZGF0YS5sZW5ndGgsIHhWYWw6IG51bWJlciwgeVZhbDogbnVtYmVyO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YUxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG9iaiA9IHRoaXMuX2RhdGFbaV07XHJcblxyXG4gICAgICAgICAgICAvL2NoZWNrIGlmIGZpbHRlcnMgYXJlIHNwZWNpZmllZCBhbmQgY29udGludWUgaWYgdGhpcyBvYmplY3QgZG9lc24ndCBwYXNzXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fcGFzc2VzRmlsdGVyKG9iaikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB4VmFsID0gb2JqW3RoaXMueFByb3BlcnR5TmFtZV07XHJcbiAgICAgICAgICAgIHlWYWwgPSBvYmpbdGhpcy55UHJvcGVydHlOYW1lXTtcclxuXHJcbiAgICAgICAgICAgIC8vZ2V0IGEgd2ViIG1lcmMgbG5nL2xhdCBmb3IgZXh0ZW50IGNoZWNraW5nLiBVc2Ugd2ViIG1lcmMgYXMgaXQncyBmbGF0IHRvIGNhdGVyIGZvciBsb25naXR1ZGUgcG9sZVxyXG4gICAgICAgICAgICBpZiAodGhpcy5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgICAgIHdlYiA9IFt4VmFsLCB5VmFsXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHdlYiA9IHdlYk1lcmNhdG9yVXRpbHMubG5nTGF0VG9YWSh4VmFsLCB5VmFsKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy9jaGVjayBpZiB0aGUgb2JqIGlzIHZpc2libGUgaW4gdGhlIGV4dGVudCBiZWZvcmUgcHJvY2VlZGluZ1xyXG4gICAgICAgICAgICBpZiAoKHdlYlswXSA8PSB3ZWJFeHRlbnQueG1pbiB8fCB3ZWJbMF0gPiB3ZWJFeHRlbnQueG1heCkgfHwgKHdlYlsxXSA8PSB3ZWJFeHRlbnQueW1pbiB8fCB3ZWJbMV0gPiB3ZWJFeHRlbnQueW1heCkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNDbHVzdGVyZWQpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAvL2xvb3AgY2x1c3RlciBncmlkIHRvIHNlZSBpZiBpdCBzaG91bGQgYmUgYWRkZWQgdG8gb25lXHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgakxlbiA9IHRoaXMuX2dyaWRDbHVzdGVycy5sZW5ndGg7IGogPCBqTGVuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY2wgPSB0aGlzLl9ncmlkQ2x1c3RlcnNbal07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh3ZWJbMF0gPD0gY2wuZXh0ZW50LnhtaW4gfHwgd2ViWzBdID4gY2wuZXh0ZW50LnhtYXggfHwgd2ViWzFdIDw9IGNsLmV4dGVudC55bWluIHx8IHdlYlsxXSA+IGNsLmV4dGVudC55bWF4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvL25vdCBoZXJlIHNvIGNhcnJ5IG9uXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvL3JlY2FsYyB0aGUgeCBhbmQgeSBvZiB0aGUgY2x1c3RlciBieSBhdmVyYWdpbmcgdGhlIHBvaW50cyBhZ2FpblxyXG4gICAgICAgICAgICAgICAgICAgIGNsLnggPSBjbC5jbHVzdGVyQ291bnQgPiAwID8gKHhWYWwgKyAoY2wueCAqIGNsLmNsdXN0ZXJDb3VudCkpIC8gKGNsLmNsdXN0ZXJDb3VudCArIDEpIDogeFZhbDtcclxuICAgICAgICAgICAgICAgICAgICBjbC55ID0gY2wuY2x1c3RlckNvdW50ID4gMCA/ICh5VmFsICsgKGNsLnkgKiBjbC5jbHVzdGVyQ291bnQpKSAvIChjbC5jbHVzdGVyQ291bnQgKyAxKSA6IHlWYWw7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vcHVzaCBldmVyeSBwb2ludCBpbnRvIHRoZSBjbHVzdGVyIHNvIHdlIGhhdmUgaXQgZm9yIGFyZWEgZGlzcGxheSBpZiByZXF1aXJlZC4gVGhpcyBjb3VsZCBiZSBvbWl0dGVkIGlmIG5ldmVyIGNoZWNraW5nIGFyZWFzLCBvciBvbiBkZW1hbmQgYXQgbGVhc3RcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wucG9pbnRzLnB1c2goW3hWYWwsIHlWYWxdKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNsLmNsdXN0ZXJDb3VudCsrO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3ViVHlwZUV4aXN0cyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHMgPSAwLCBzTGVuID0gY2wuc3ViVHlwZUNvdW50cy5sZW5ndGg7IHMgPCBzTGVuOyBzKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsLnN1YlR5cGVDb3VudHNbc10ubmFtZSA9PT0gb2JqW3RoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbC5zdWJUeXBlQ291bnRzW3NdLmNvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJUeXBlRXhpc3RzID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXN1YlR5cGVFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc3ViVHlwZUNvdW50cy5wdXNoKHsgbmFtZTogb2JqW3RoaXMuc3ViVHlwZUZsYXJlUHJvcGVydHldLCBjb3VudDogMSB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vYWRkIHRoZSBzaW5nbGUgZml4IHJlY29yZCBpZiBzdGlsbCB1bmRlciB0aGUgbWF4U2luZ2xlRmxhcmVDb3VudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbC5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsLnNpbmdsZXMucHVzaChvYmopO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2wuc2luZ2xlcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvL25vdCBjbHVzdGVyZWQgc28ganVzdCBhZGQgZXZlcnkgb2JqXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVTaW5nbGUob2JqKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzQ2x1c3RlcmVkKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9ncmlkQ2x1c3RlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9ncmlkQ2x1c3RlcnNbaV0uY2x1c3RlckNvdW50IDwgdGhpcy5jbHVzdGVyTWluQ291bnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgamxlbiA9IHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5zaW5nbGVzLmxlbmd0aDsgaiA8IGpsZW47IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVTaW5nbGUodGhpcy5fZ3JpZENsdXN0ZXJzW2ldLnNpbmdsZXNbal0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuX2dyaWRDbHVzdGVyc1tpXS5jbHVzdGVyQ291bnQgPiAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlQ2x1c3Rlcih0aGlzLl9ncmlkQ2x1c3RlcnNbaV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2VtaXQgYW4gZXZlbnQgdG8gc2lnbmFsIGRyYXdpbmcgaXMgY29tcGxldGUuXHJcbiAgICAgICAgdGhpcy5lbWl0KFwiZHJhdy1jb21wbGV0ZVwiLCB7fSk7XHJcbiAgICAgICAgY29uc29sZS50aW1lRW5kKGBkcmF3LWRhdGEtJHt0aGlzLl9hY3RpdmVWaWV3LnR5cGV9YCk7XHJcblxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVTdXJmYWNlKCk7XHJcbiAgICAgICAgfSwgMTApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Bhc3Nlc0ZpbHRlcihvYmo6IGFueSk6IGJvb2xlYW4ge1xyXG4gICAgICAgIGlmICghdGhpcy5maWx0ZXJzIHx8IHRoaXMuZmlsdGVycy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgICAgIGxldCBwYXNzZXMgPSB0cnVlO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmZpbHRlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRoaXMuZmlsdGVyc1tpXTtcclxuICAgICAgICAgICAgaWYgKG9ialtmaWx0ZXIucHJvcGVydHlOYW1lXSA9PSBudWxsKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGxldCB2YWxFeGlzdHMgPSBmaWx0ZXIucHJvcGVydHlWYWx1ZXMuaW5kZXhPZihvYmpbZmlsdGVyLnByb3BlcnR5TmFtZV0pICE9PSAtMTtcclxuICAgICAgICAgICAgaWYgKHZhbEV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcGFzc2VzID0gZmlsdGVyLmtlZXBPbmx5SWZWYWx1ZUV4aXN0czsgLy90aGUgdmFsdWUgZXhpc3RzIHNvIHJldHVybiB3aGV0aGVyIHdlIHNob3VsZCBiZSBrZWVwaW5nIGl0IG9yIG5vdC5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmICghdmFsRXhpc3RzICYmIGZpbHRlci5rZWVwT25seUlmVmFsdWVFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIHBhc3NlcyA9IGZhbHNlOyAvL3JldHVybiBmYWxzZSBhcyB0aGUgdmFsdWUgZG9lc24ndCBleGlzdCwgYW5kIHdlIHNob3VsZCBvbmx5IGJlIGtlZXBpbmcgcG9pbnQgb2JqZWN0cyB3aGVyZSBpdCBkb2VzIGV4aXN0LlxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIXBhc3NlcykgcmV0dXJuIGZhbHNlOyAvL2lmIGl0IGhhc24ndCBwYXNzZWQgYW55IG9mIHRoZSBmaWx0ZXJzIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBwYXNzZXM7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlU2luZ2xlKG9iaikge1xyXG4gICAgICAgIGxldCBwb2ludCA9IG5ldyBQb2ludCh7XHJcbiAgICAgICAgICAgIHg6IG9ialt0aGlzLnhQcm9wZXJ0eU5hbWVdLCB5OiBvYmpbdGhpcy55UHJvcGVydHlOYW1lXSwgejogb2JqW3RoaXMuelByb3BlcnR5TmFtZV1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKCFwb2ludC5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgcG9pbnQgPSA8UG9pbnQ+d2ViTWVyY2F0b3JVdGlscy5nZW9ncmFwaGljVG9XZWJNZXJjYXRvcihwb2ludCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IHBvaW50LFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBvYmpcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgZ3JhcGhpYy5wb3B1cFRlbXBsYXRlID0gdGhpcy5zaW5nbGVQb3B1cFRlbXBsYXRlO1xyXG4gICAgICAgIGlmICh0aGlzLnNpbmdsZVJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIGxldCBzeW1ib2wgPSB0aGlzLnNpbmdsZVJlbmRlcmVyLmdldFN5bWJvbChncmFwaGljLCB0aGlzLl9hY3RpdmVWaWV3KTtcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSBzeW1ib2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHRoaXMuc2luZ2xlU3ltYm9sKSB7XHJcbiAgICAgICAgICAgIGdyYXBoaWMuc3ltYm9sID0gdGhpcy5zaW5nbGVTeW1ib2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL25vIHN5bWJvbG9neSBmb3Igc2luZ2xlcyBkZWZpbmVkLCB1c2UgdGhlIGRlZmF1bHQgc3ltYm9sIGZyb20gdGhlIGNsdXN0ZXIgcmVuZGVyZXJcclxuICAgICAgICAgICAgZ3JhcGhpYy5zeW1ib2wgPSB0aGlzLmNsdXN0ZXJSZW5kZXJlci5kZWZhdWx0U3ltYm9sO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5hZGQoZ3JhcGhpYyk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZUNsdXN0ZXIoZ3JpZENsdXN0ZXI6IEdyaWRDbHVzdGVyKSB7XHJcblxyXG4gICAgICAgIGxldCBjbHVzdGVyID0gbmV3IENsdXN0ZXIoKTtcclxuICAgICAgICBjbHVzdGVyLmdyaWRDbHVzdGVyID0gZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vbWFrZSBzdXJlIGFsbCBnZW9tZXRyaWVzIGFkZGVkIHRvIEdyYXBoaWMgb2JqZWN0cyBhcmUgaW4gd2ViIG1lcmNhdG9yIG90aGVyd2lzZSB3cmFwIGFyb3VuZCBkb2Vzbid0IHdvcmsuXHJcbiAgICAgICAgbGV0IHBvaW50ID0gbmV3IFBvaW50KHsgeDogZ3JpZENsdXN0ZXIueCwgeTogZ3JpZENsdXN0ZXIueSB9KTtcclxuICAgICAgICBpZiAoIXBvaW50LnNwYXRpYWxSZWZlcmVuY2UuaXNXZWJNZXJjYXRvcikge1xyXG4gICAgICAgICAgICBwb2ludCA9IDxQb2ludD53ZWJNZXJjYXRvclV0aWxzLmdlb2dyYXBoaWNUb1dlYk1lcmNhdG9yKHBvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBhdHRyaWJ1dGVzOiBhbnkgPSB7XHJcbiAgICAgICAgICAgIHg6IGdyaWRDbHVzdGVyLngsXHJcbiAgICAgICAgICAgIHk6IGdyaWRDbHVzdGVyLnksXHJcbiAgICAgICAgICAgIGNsdXN0ZXJDb3VudDogZ3JpZENsdXN0ZXIuY2x1c3RlckNvdW50LFxyXG4gICAgICAgICAgICBpc0NsdXN0ZXI6IHRydWUsXHJcbiAgICAgICAgICAgIGNsdXN0ZXJPYmplY3Q6IGdyaWRDbHVzdGVyXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBhdHRyaWJ1dGVzLFxyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnRcclxuICAgICAgICB9KTtcclxuICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbCA9IHRoaXMuY2x1c3RlclJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMpLnN5bWJvbDtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljLnN5bWJvbFtcImFuZ2xlXCJdID0gMzYwIC0gdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAwO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2x1c3Rlci5jbHVzdGVySWQgPSBjbHVzdGVyLmNsdXN0ZXJHcmFwaGljW1widWlkXCJdO1xyXG4gICAgICAgIGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMuYXR0cmlidXRlcy5jbHVzdGVySWQgPSBjbHVzdGVyLmNsdXN0ZXJJZDtcclxuXHJcbiAgICAgICAgLy9hbHNvIGNyZWF0ZSBhIHRleHQgc3ltYm9sIHRvIGRpc3BsYXkgdGhlIGNsdXN0ZXIgY291bnRcclxuICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMudGV4dFN5bWJvbC5jbG9uZSgpO1xyXG4gICAgICAgIHRleHRTeW1ib2wudGV4dCA9IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudC50b1N0cmluZygpO1xyXG4gICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgdGV4dFN5bWJvbC5hbmdsZSA9IDM2MCAtIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjbHVzdGVyLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICBnZW9tZXRyeTogcG9pbnQsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgIGlzQ2x1c3RlclRleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBpc1RleHQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVySWQ6IGNsdXN0ZXIuY2x1c3RlcklkXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN5bWJvbDogdGV4dFN5bWJvbFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvL2FkZCBhbiBhcmVhIGdyYXBoaWMgdG8gZGlzcGxheSB0aGUgYm91bmRzIG9mIHRoZSBjbHVzdGVyIGlmIGNvbmZpZ3VyZWQgdG9cclxuICAgICAgICBpZiAodGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgJiYgZ3JpZENsdXN0ZXIucG9pbnRzICYmIGdyaWRDbHVzdGVyLnBvaW50cy5sZW5ndGggPiAwKSB7XHJcblxyXG4gICAgICAgICAgICBsZXQgbXAgPSBuZXcgTXVsdGlwb2ludCgpO1xyXG4gICAgICAgICAgICBtcC5wb2ludHMgPSBncmlkQ2x1c3Rlci5wb2ludHM7XHJcbiAgICAgICAgICAgIGxldCBhcmVhOiBhbnkgPSBnZW9tZXRyeUVuZ2luZS5jb252ZXhIdWxsKG1wLCB0cnVlKTsgLy91c2UgY29udmV4IGh1bGwgb24gdGhlIHBvaW50cyB0byBnZXQgdGhlIGJvdW5kYXJ5XHJcblxyXG4gICAgICAgICAgICBsZXQgYXJlYUF0dHI6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgIHg6IGdyaWRDbHVzdGVyLngsXHJcbiAgICAgICAgICAgICAgICB5OiBncmlkQ2x1c3Rlci55LFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckNvdW50OiBncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVySWQ6IGNsdXN0ZXIuY2x1c3RlcklkLFxyXG4gICAgICAgICAgICAgICAgaXNDbHVzdGVyQXJlYTogdHJ1ZVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoYXJlYS5yaW5ncyAmJiBhcmVhLnJpbmdzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGxldCBhcmVhUG9seSA9IG5ldyBQb2x5Z29uKCk7IC8vaGFkIHRvIGNyZWF0ZSBhIG5ldyBwb2x5Z29uIGFuZCBmaWxsIGl0IHdpdGggdGhlIHJpbmcgb2YgdGhlIGNhbGN1bGF0ZWQgYXJlYSBmb3IgU2NlbmVWaWV3IHRvIHdvcmsuXHJcbiAgICAgICAgICAgICAgICBhcmVhUG9seSA9IGFyZWFQb2x5LmFkZFJpbmcoYXJlYS5yaW5nc1swXSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFhcmVhUG9seS5zcGF0aWFsUmVmZXJlbmNlLmlzV2ViTWVyY2F0b3IpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcmVhUG9seSA9IDxQb2x5Z29uPndlYk1lcmNhdG9yVXRpbHMuZ2VvZ3JhcGhpY1RvV2ViTWVyY2F0b3IoYXJlYVBvbHkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNsdXN0ZXIuYXJlYUdyYXBoaWMgPSBuZXcgR3JhcGhpYyh7IGdlb21ldHJ5OiBhcmVhUG9seSwgYXR0cmlidXRlczogYXJlYUF0dHIgfSk7XHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyLmFyZWFHcmFwaGljLnN5bWJvbCA9IHRoaXMuYXJlYVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGNsdXN0ZXIuYXJlYUdyYXBoaWMpLnN5bWJvbDtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vYWRkIHRoZSBncmFwaGljcyBpbiBvcmRlciAgICAgICAgXHJcbiAgICAgICAgaWYgKGNsdXN0ZXIuYXJlYUdyYXBoaWMgJiYgdGhpcy5jbHVzdGVyQXJlYURpc3BsYXkgPT09IFwiYWx3YXlzXCIpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGQoY2x1c3Rlci5hcmVhR3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIuY2x1c3RlckdyYXBoaWMpO1xyXG4gICAgICAgIHRoaXMuYWRkKGNsdXN0ZXIudGV4dEdyYXBoaWMpO1xyXG5cclxuICAgICAgICB0aGlzLl9jbHVzdGVyc1tjbHVzdGVyLmNsdXN0ZXJJZF0gPSBjbHVzdGVyO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9jcmVhdGVDbHVzdGVyR3JpZCh3ZWJFeHRlbnQ6IEV4dGVudCwgZXh0ZW50SXNVbmlvbmVkOiBib29sZWFuKSB7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSB0b3RhbCBhbW91bnQgb2YgZ3JpZCBzcGFjZXMgYmFzZWQgb24gdGhlIGhlaWdodCBhbmQgd2lkdGggb2YgdGhlIG1hcCAoZGl2aWRlIGl0IGJ5IGNsdXN0ZXJSYXRpbykgLSB0aGVuIGdldCB0aGUgZGVncmVlcyBmb3IgeCBhbmQgeSBcclxuICAgICAgICBsZXQgeENvdW50ID0gTWF0aC5yb3VuZCh0aGlzLl9hY3RpdmVWaWV3LndpZHRoIC8gdGhpcy5jbHVzdGVyUmF0aW8pO1xyXG4gICAgICAgIGxldCB5Q291bnQgPSBNYXRoLnJvdW5kKHRoaXMuX2FjdGl2ZVZpZXcuaGVpZ2h0IC8gdGhpcy5jbHVzdGVyUmF0aW8pO1xyXG5cclxuICAgICAgICAvL2lmIHRoZSBleHRlbnQgaGFzIGJlZW4gdW5pb25lZCBkdWUgdG8gbm9ybWFsaXphdGlvbiwgZG91YmxlIHRoZSBjb3VudCBvZiB4IGluIHRoZSBjbHVzdGVyIGdyaWQgYXMgdGhlIHVuaW9uaW5nIHdpbGwgaGFsdmUgaXQuXHJcbiAgICAgICAgaWYgKGV4dGVudElzVW5pb25lZCkge1xyXG4gICAgICAgICAgICB4Q291bnQgKj0gMjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB4dyA9ICh3ZWJFeHRlbnQueG1heCAtIHdlYkV4dGVudC54bWluKSAvIHhDb3VudDtcclxuICAgICAgICBsZXQgeWggPSAod2ViRXh0ZW50LnltYXggLSB3ZWJFeHRlbnQueW1pbikgLyB5Q291bnQ7XHJcblxyXG4gICAgICAgIGxldCBnc3htaW4sIGdzeG1heCwgZ3N5bWluLCBnc3ltYXg7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIGFuIGFycmF5IG9mIGNsdXN0ZXJzIHRoYXQgaXMgYSBncmlkIG92ZXIgdGhlIHZpc2libGUgZXh0ZW50LiBFYWNoIGNsdXN0ZXIgY29udGFpbnMgdGhlIGV4dGVudCAoaW4gd2ViIG1lcmMpIHRoYXQgYm91bmRzIHRoZSBncmlkIHNwYWNlIGZvciBpdC5cclxuICAgICAgICB0aGlzLl9ncmlkQ2x1c3RlcnMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHhDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGdzeG1pbiA9IHdlYkV4dGVudC54bWluICsgKHh3ICogaSk7XHJcbiAgICAgICAgICAgIGdzeG1heCA9IGdzeG1pbiArIHh3O1xyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHlDb3VudDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBnc3ltaW4gPSB3ZWJFeHRlbnQueW1pbiArICh5aCAqIGopO1xyXG4gICAgICAgICAgICAgICAgZ3N5bWF4ID0gZ3N5bWluICsgeWg7XHJcbiAgICAgICAgICAgICAgICBsZXQgZXh0ID0geyB4bWluOiBnc3htaW4sIHhtYXg6IGdzeG1heCwgeW1pbjogZ3N5bWluLCB5bWF4OiBnc3ltYXggfTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2dyaWRDbHVzdGVycy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICBleHRlbnQ6IGV4dCxcclxuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgc3ViVHlwZUNvdW50czogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgc2luZ2xlczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICB4OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6IDBcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIGFuIHN2ZyBzdXJmYWNlIG9uIHRoZSB2aWV3IGlmIGl0IGRvZXNuJ3QgYWxyZWFkeSBleGlzdFxyXG4gICAgICogQHBhcmFtIHZpZXdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfY3JlYXRlU3VyZmFjZSgpIHtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZSkgcmV0dXJuO1xyXG4gICAgICAgIGxldCBzdXJmYWNlUGFyZW50RWxlbWVudCA9IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICBzdXJmYWNlUGFyZW50RWxlbWVudCA9IHRoaXMuX2xheWVyVmlldzJkLmNvbnRhaW5lci5lbGVtZW50LnBhcmVudEVsZW1lbnQgfHwgdGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQucGFyZW50Tm9kZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHN1cmZhY2VQYXJlbnRFbGVtZW50ID0gdGhpcy5fYWN0aXZlVmlldy5jYW52YXMucGFyZW50RWxlbWVudCB8fCB0aGlzLl9hY3RpdmVWaWV3LmNhbnZhcy5wYXJlbnROb2RlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHN1cmZhY2UgPSBnZnguY3JlYXRlU3VyZmFjZShzdXJmYWNlUGFyZW50RWxlbWVudCwgXCIwXCIsIFwiMFwiKTtcclxuICAgICAgICBzdXJmYWNlLmNvbnRhaW5lckdyb3VwID0gc3VyZmFjZS5jcmVhdGVHcm91cCgpO1xyXG5cclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHBvc2l0aW9uOiBcImFic29sdXRlXCIsIHRvcDogXCIwXCIsIHpJbmRleDogLTEgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwidmlzaWJsZVwiKTtcclxuICAgICAgICBkb21BdHRyLnNldChzdXJmYWNlLnJhd05vZGUsIFwiY2xhc3NcIiwgXCJmY2wtc3VyZmFjZVwiKTtcclxuICAgICAgICB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UgPSBzdXJmYWNlO1xyXG5cclxuICAgICAgICAvL1RoaXMgaXMgYSBoYWNrIGZvciBJRS4gaGl0VGVzdCBvbiB0aGUgdmlldyBkb2Vucyd0IHBpY2sgdXAgYW55IHJlc3VsdHMgdW5sZXNzIHRoZSB6LWluZGV4IG9mIHRoZSBsYXllclZpZXcgY29udGFpbmVyIGlzIGF0IGxlYXN0IDEuIFNvIHNldCBpdCB0byAxLCBidXQgYWxzbyBoYXZlIHRvIHNldCB0aGUgLmVzcmktdWlcclxuICAgICAgICAvL2NvbnRhaW5lciB0byAyIG90aGVyd2lzZSBpdCBjYW4ndCBiZSBjbGlja2VkIG9uIGFzIGl0J3MgY292ZXJlZCBieSB0aGUgbGF5ZXIgdmlldyBjb250YWluZXIuIG1laCFcclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICBkb21TdHlsZS5zZXQodGhpcy5fbGF5ZXJWaWV3MmQuY29udGFpbmVyLmVsZW1lbnQsIFwiei1pbmRleFwiLCBcIjFcIik7XHJcbiAgICAgICAgICAgIHF1ZXJ5KFwiLmVzcmktdWlcIikuZm9yRWFjaChmdW5jdGlvbiAobm9kZTogSFRNTEVsZW1lbnQsIGluZGV4KSB7XHJcbiAgICAgICAgICAgICAgICBkb21TdHlsZS5zZXQobm9kZSwgXCJ6LWluZGV4XCIsIFwiMlwiKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3ZpZXdQb2ludGVyTW92ZShldnQpIHtcclxuICAgICAgICBcclxuICAgICAgICBsZXQgc3AgPSBuZXcgU2NyZWVuUG9pbnQoeyB4OiBldnQueCwgeTogZXZ0LnkgfSk7XHJcblxyXG4gICAgICAgIC8vaWYgdGhlcmUncyBhbiBhY3RpdmUgY2x1c3RlciBhbmQgdGhlIGN1cnJlbnQgc2NyZWVuIHBvcyBpcyB3aXRoaW4gdGhlIGJvdW5kcyBvZiB0aGF0IGNsdXN0ZXIncyBncm91cCBjb250YWluZXIsIGRvbid0IGRvIGFueXRoaW5nIG1vcmUuIFxyXG4gICAgICAgIC8vVE9ETzogd291bGQgcHJvYmFibHkgYmUgYmV0dGVyIHRvIGNoZWNrIGlmIHRoZSBwb2ludCBpcyBpbiB0aGUgYWN0dWFsIGNpcmNsZSBvZiB0aGUgY2x1c3RlciBncm91cCBhbmQgaXQncyBmbGFyZXMgaW5zdGVhZCBvZiB1c2luZyB0aGUgcmVjdGFuZ2xlIGJvdW5kaW5nIGJveC5cclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ2x1c3Rlcikge1xyXG4gICAgICAgICAgICBsZXQgYmJveCA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgICAgIGlmIChiYm94KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZXZ0LnggPj0gYmJveC5sZWZ0ICYmIGV2dC54IDw9IGJib3gucmlnaHQgJiYgZXZ0LnkgPj0gYmJveC50b3AgJiYgZXZ0LnkgPD0gYmJveC5ib3R0b20pIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlVmlldy5oaXRUZXN0KHNwKS50aGVuKChyZXNwb25zZSkgPT4ge1xyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgbGV0IGdyYXBoaWNzID0gcmVzcG9uc2UucmVzdWx0cztcclxuICAgICAgICAgICAgaWYgKGdyYXBoaWNzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBncmFwaGljcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGcgPSBncmFwaGljc1tpXS5ncmFwaGljO1xyXG4gICAgICAgICAgICAgICAgaWYgKGcgJiYgKGcuYXR0cmlidXRlcy5jbHVzdGVySWQgIT0gbnVsbCAmJiAhZy5hdHRyaWJ1dGVzLmlzQ2x1c3RlckFyZWEpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsdXN0ZXIgPSB0aGlzLl9jbHVzdGVyc1tnLmF0dHJpYnV0ZXMuY2x1c3RlcklkXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hY3RpdmF0ZUNsdXN0ZXIoY2x1c3Rlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2FjdGl2YXRlQ2x1c3RlcihjbHVzdGVyOiBDbHVzdGVyKSB7XHJcbiAgICAgICBcclxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlQ2x1c3RlciA9PT0gY2x1c3Rlcikge1xyXG4gICAgICAgICAgICByZXR1cm47IC8vYWxyZWFkeSBhY3RpdmVcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fZGVhY3RpdmF0ZUNsdXN0ZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IGNsdXN0ZXI7XHJcbiAgICAgICAgdGhpcy5faW5pdFN1cmZhY2UoKTtcclxuICAgICAgICB0aGlzLl9pbml0Q2x1c3RlcigpO1xyXG4gICAgICAgIHRoaXMuX2luaXRGbGFyZXMoKTtcclxuXHJcbiAgICAgICAgdGhpcy5faGlkZUdyYXBoaWMoW3RoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3RlckdyYXBoaWMsIHRoaXMuX2FjdGl2ZUNsdXN0ZXIudGV4dEdyYXBoaWNdKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGVhY3RpdmF0ZUNsdXN0ZXIoKSB7XHJcbiAgXHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMuX3Nob3dHcmFwaGljKFt0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLCB0aGlzLl9hY3RpdmVDbHVzdGVyLnRleHRHcmFwaGljXSk7XHJcbiAgICAgICAgdGhpcy5fcmVtb3ZlQ2xhc3NGcm9tRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY2x1c3RlckFyZWFEaXNwbGF5ID09PSBcImFjdGl2YXRlZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2hpZGVHcmFwaGljKHRoaXMuX2FjdGl2ZUNsdXN0ZXIuYXJlYUdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fY2xlYXJTdXJmYWNlKCk7XHJcbiAgICAgICAgdGhpcy5fYWN0aXZlQ2x1c3RlciA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIkRFLWFjdGl2YXRlIGNsdXN0ZXJcIik7XHJcbiAgICAgICBcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfaW5pdFN1cmZhY2UoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9hY3RpdmVDbHVzdGVyKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBsZXQgc3A6IFNjcmVlblBvaW50ID0gdGhpcy5fYWN0aXZlVmlldy50b1NjcmVlbih0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5KTtcclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHpJbmRleDogMTEsIG92ZXJmbG93OiBcInZpc2libGVcIiwgd2lkdGg6IFwiMXB4XCIsIGhlaWdodDogXCIxcHhcIiwgbGVmdDogc3AueCArIFwicHhcIiwgdG9wOiBzcC55ICsgXCJweFwiIH0pO1xyXG4gICAgICAgIGRvbUF0dHIuc2V0KHN1cmZhY2UucmF3Tm9kZSwgXCJvdmVyZmxvd1wiLCBcInZpc2libGVcIik7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NsZWFyU3VyZmFjZSgpIHtcclxuICAgICAgICBsZXQgc3VyZmFjZSA9IHRoaXMuX2FjdGl2ZVZpZXcuZmNsU3VyZmFjZTtcclxuICAgICAgICBxdWVyeShcIj5cIiwgc3VyZmFjZS5jb250YWluZXJHcm91cC5yYXdOb2RlKS5mb3JFYWNoKGRvbUNvbnN0cnVjdC5kZXN0cm95KTtcclxuICAgICAgICBkb21TdHlsZS5zZXQoc3VyZmFjZS5yYXdOb2RlLCB7IHpJbmRleDogLTEsIG92ZXJmbG93OiBcImhpZGRlblwiLCB0b3A6IFwiMHB4XCIsIGxlZnQ6IFwiMHB4XCIgfSk7XHJcbiAgICAgICAgZG9tQXR0ci5zZXQoc3VyZmFjZS5yYXdOb2RlLCBcIm92ZXJmbG93XCIsIFwiaGlkZGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2luaXRDbHVzdGVyKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlcikgcmV0dXJuO1xyXG4gICAgICAgIGxldCBzdXJmYWNlID0gdGhpcy5fYWN0aXZlVmlldy5mY2xTdXJmYWNlO1xyXG4gICAgICAgIGlmICghc3VyZmFjZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvL3dlJ3JlIGdvaW5nIHRvIHJlcGxpY2F0ZSBhIGNsdXN0ZXIgZ3JhcGhpYyBpbiB0aGUgc3ZnIGVsZW1lbnQgd2UgYWRkZWQgdG8gdGhlIGxheWVyIHZpZXcuIEp1c3Qgc28gaXQgY2FuIGJlIHN0eWxlZCBlYXNpbHkuIE5hdGl2ZSBXZWJHTCBmb3IgU2NlbmUgVmlld3Mgd291bGQgcHJvYmFibHkgYmUgYmV0dGVyLCBidXQgYXQgbGVhc3QgdGhpcyB3YXkgY3NzIGNhbiBzdGlsbCBiZSB1c2VkIHRvIHN0eWxlL2FuaW1hdGUgdGhpbmdzLlxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwID0gc3VyZmFjZS5jb250YWluZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUsIFwiY2x1c3Rlci1ncm91cFwiKTtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgdGhlIGNsdXN0ZXIgc2hhcGVcclxuICAgICAgICBsZXQgY2xvbmVkQ2x1c3RlckVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXApO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGNsb25lZENsdXN0ZXJFbGVtZW50LCBcImNsdXN0ZXJcIik7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIHRoZSBjbHVzdGVyIHRleHQgc2hhcGVcclxuICAgICAgICBsZXQgY2xvbmVkVGV4dEVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWModGhpcy5fYWN0aXZlQ2x1c3Rlci50ZXh0R3JhcGhpYywgdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JvdXApO1xyXG4gICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGNsb25lZFRleHRFbGVtZW50LCBcImNsdXN0ZXItdGV4dFwiKTtcclxuICAgICAgICBjbG9uZWRUZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoY2xvbmVkQ2x1c3RlckVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMuX2FjdGl2ZUNsdXN0ZXIuY2x1c3Rlckdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoY2xvbmVkVGV4dEVsZW1lbnQpO1xyXG4gICAgICAgXHJcbiAgICAgICAgLy9zZXQgdGhlIGdyb3VwIGNsYXNzICAgICBcclxuICAgICAgICB0aGlzLl9hZGRDbGFzc1RvRWxlbWVudCh0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9pbml0RmxhcmVzKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fYWN0aXZlQ2x1c3RlciB8fCAhdGhpcy5kaXNwbGF5RmxhcmVzKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxldCBncmlkQ2x1c3RlciA9IHRoaXMuX2FjdGl2ZUNsdXN0ZXIuZ3JpZENsdXN0ZXI7XHJcblxyXG4gICAgICAgIC8vY2hlY2sgaWYgd2UgbmVlZCB0byBjcmVhdGUgZmxhcmVzIGZvciB0aGUgY2x1c3RlclxyXG4gICAgICAgIGxldCBzaW5nbGVGbGFyZXMgPSAoZ3JpZENsdXN0ZXIuc2luZ2xlcyAmJiBncmlkQ2x1c3Rlci5zaW5nbGVzLmxlbmd0aCA+IDApICYmIChncmlkQ2x1c3Rlci5jbHVzdGVyQ291bnQgPD0gdGhpcy5tYXhTaW5nbGVGbGFyZUNvdW50KTtcclxuICAgICAgICBsZXQgc3ViVHlwZUZsYXJlcyA9ICFzaW5nbGVGbGFyZXMgJiYgKGdyaWRDbHVzdGVyLnN1YlR5cGVDb3VudHMgJiYgZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5sZW5ndGggPiAwKTtcclxuXHJcbiAgICAgICAgaWYgKCFzaW5nbGVGbGFyZXMgJiYgIXN1YlR5cGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuOyAvL25vIGZsYXJlcyByZXF1aXJlZFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZsYXJlczogRmxhcmVbXSA9IFtdO1xyXG4gICAgICAgIGlmIChzaW5nbGVGbGFyZXMpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGdyaWRDbHVzdGVyLnNpbmdsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBmID0gbmV3IEZsYXJlKCk7XHJcbiAgICAgICAgICAgICAgICBmLnRvb2x0aXBUZXh0ID0gZ3JpZENsdXN0ZXIuc2luZ2xlc1tpXVt0aGlzLnNpbmdsZUZsYXJlVG9vbHRpcFByb3BlcnR5XTtcclxuICAgICAgICAgICAgICAgIGYuc2luZ2xlRGF0YSA9IGdyaWRDbHVzdGVyLnNpbmdsZXNbaV07XHJcbiAgICAgICAgICAgICAgICBmLmZsYXJlVGV4dCA9IFwiXCI7XHJcbiAgICAgICAgICAgICAgICBmbGFyZXMucHVzaChmKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChzdWJUeXBlRmxhcmVzKSB7XHJcblxyXG4gICAgICAgICAgICAvL3NvcnQgc3ViIHR5cGVzIGJ5IGhpZ2hlc3QgY291bnQgZmlyc3RcclxuICAgICAgICAgICAgdmFyIHN1YlR5cGVzID0gZ3JpZENsdXN0ZXIuc3ViVHlwZUNvdW50cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5jb3VudCAtIGEuY291bnQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN1YlR5cGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZiA9IG5ldyBGbGFyZSgpO1xyXG4gICAgICAgICAgICAgICAgZi50b29sdGlwVGV4dCA9IGAke3N1YlR5cGVzW2ldLm5hbWV9ICgke3N1YlR5cGVzW2ldLmNvdW50fSlgO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZVRleHQgPSBzdWJUeXBlc1tpXS5jb3VudDtcclxuICAgICAgICAgICAgICAgIGZsYXJlcy5wdXNoKGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2lmIHRoZXJlIGFyZSBtb3JlIGZsYXJlIG9iamVjdHMgdG8gY3JlYXRlIHRoYW4gdGhlIG1heEZsYXJlQ291bnQgYW5kIHRoaXMgaXMgYSBvbmUgb2YgdGhvc2UgLSBjcmVhdGUgYSBzdW1tYXJ5IGZsYXJlIHRoYXQgY29udGFpbnMgJy4uLicgYXMgdGhlIHRleHQgYW5kIG1ha2UgdGhpcyBvbmUgcGFydCBvZiBpdCBcclxuICAgICAgICBsZXQgd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPSBmbGFyZXMubGVuZ3RoID4gdGhpcy5tYXhGbGFyZUNvdW50O1xyXG4gICAgICAgIGxldCBmbGFyZUNvdW50ID0gd2lsbENvbnRhaW5TdW1tYXJ5RmxhcmUgPyB0aGlzLm1heEZsYXJlQ291bnQgOiBmbGFyZXMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvL2lmIHRoZXJlJ3MgYW4gZXZlbiBhbW91bnQgb2YgZmxhcmVzLCBwb3NpdGlvbiB0aGUgZmlyc3QgZmxhcmUgdG8gdGhlIGxlZnQsIG1pbnVzIDE4MCBmcm9tIGRlZ3JlZSB0byBkbyB0aGlzLlxyXG4gICAgICAgIC8vZm9yIGFuIGFkZCBhbW91bnQgcG9zaXRpb24gdGhlIGZpcnN0IGZsYXJlIG9uIHRvcCwgLTkwIHRvIGRvIHRoaXMuIExvb2tzIG1vcmUgc3ltbWV0cmljYWwgdGhpcyB3YXkuXHJcbiAgICAgICAgbGV0IGRlZ3JlZVZhcmlhbmNlID0gKGZsYXJlQ291bnQgJSAyID09PSAwKSA/IC0xODAgOiAtOTA7XHJcbiAgICAgICAgbGV0IHZpZXdSb3RhdGlvbiA9IHRoaXMuX2lzMmQgPyB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uIDogMDtcclxuXHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTY3JlZW5Qb2ludCA9IHRoaXMuX2FjdGl2ZVZpZXcudG9TY3JlZW4odGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5nZW9tZXRyeSk7XHJcbiAgICAgICAgbGV0IGNsdXN0ZXJTeW1ib2xTaXplID0gdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVyR3JhcGhpYy5zeW1ib2wuZ2V0KFwic2l6ZVwiKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZsYXJlQ291bnQ7IGkrKykge1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlID0gZmxhcmVzW2ldO1xyXG5cclxuICAgICAgICAgICAgLy9zZXQgc29tZSBhdHRyaWJ1dGUgZGF0YVxyXG4gICAgICAgICAgICBsZXQgZmxhcmVBdHRyaWJ1dGVzID0ge1xyXG4gICAgICAgICAgICAgICAgaXNGbGFyZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGlzU3VtbWFyeUZsYXJlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0OiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgZmxhcmVUZXh0R3JhcGhpYzogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgY2x1c3RlckdyYXBoaWNJZDogdGhpcy5fYWN0aXZlQ2x1c3Rlci5jbHVzdGVySWQsXHJcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnQ6IGdyaWRDbHVzdGVyLmNsdXN0ZXJDb3VudFxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgbGV0IGZsYXJlVGV4dEF0dHJpYnV0ZXMgPSB7fTtcclxuXHJcbiAgICAgICAgICAgIC8vRG8gYSBjb3VwbGUgb2YgdGhpbmdzIGRpZmZlcmVudGx5IGlmIHRoaXMgaXMgYSBzdW1tYXJ5IGZsYXJlIG9yIG5vdFxyXG4gICAgICAgICAgICBsZXQgaXNTdW1tYXJ5RmxhcmUgPSB3aWxsQ29udGFpblN1bW1hcnlGbGFyZSAmJiBpID49IHRoaXMubWF4RmxhcmVDb3VudCAtIDE7XHJcbiAgICAgICAgICAgIGlmIChpc1N1bW1hcnlGbGFyZSkgeyAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgZmxhcmUuaXNTdW1tYXJ5ID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGZsYXJlQXR0cmlidXRlcy5pc1N1bW1hcnlGbGFyZSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBsZXQgdG9vbHRpcFRleHQgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgLy9tdWx0aWxpbmUgdG9vbHRpcCBmb3Igc3VtbWFyeSBmbGFyZXMsIGllOiBncmVhdGVyIHRoYW4gdGhpcy5tYXhGbGFyZUNvdW50IGZsYXJlcyBwZXIgY2x1c3RlclxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IHRoaXMubWF4RmxhcmVDb3VudCAtIDEsIGpsZW4gPSBmbGFyZXMubGVuZ3RoOyBqIDwgamxlbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHRpcFRleHQgKz0gaiA+ICh0aGlzLm1heEZsYXJlQ291bnQgLSAxKSA/IFwiXFxuXCIgOiBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2x0aXBUZXh0ICs9IGZsYXJlc1tqXS50b29sdGlwVGV4dDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRvb2x0aXBUZXh0ID0gdG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICBcclxuICAgICAgICAgICAgZmxhcmVBdHRyaWJ1dGVzLnRvb2x0aXBUZXh0ID0gZmxhcmUudG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vY3JlYXRlIGEgZ3JhcGhpYyBmb3IgdGhlIGZsYXJlIGFuZCBmb3IgdGhlIGZsYXJlIHRleHRcclxuICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYyA9IG5ldyBHcmFwaGljKHtcclxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGZsYXJlQXR0cmlidXRlcyxcclxuICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5LFxyXG4gICAgICAgICAgICAgICAgcG9wdXBUZW1wbGF0ZTogbnVsbFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sID0gdGhpcy5fZ2V0RmxhcmVTeW1ib2woZmxhcmUuZ3JhcGhpYyk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9pczJkICYmIHRoaXMuX2FjdGl2ZVZpZXcucm90YXRpb24pIHtcclxuICAgICAgICAgICAgICAgIGZsYXJlLmdyYXBoaWMuc3ltYm9sW1wiYW5nbGVcIl0gPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZmxhcmUuZ3JhcGhpYy5zeW1ib2xbXCJhbmdsZVwiXSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgICAgICBpZiAoZmxhcmUuZmxhcmVUZXh0KSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgdGV4dFN5bWJvbCA9IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmNsb25lKCk7XHJcbiAgICAgICAgICAgICAgICB0ZXh0U3ltYm9sLnRleHQgPSAhaXNTdW1tYXJ5RmxhcmUgPyBmbGFyZS5mbGFyZVRleHQudG9TdHJpbmcoKSA6IFwiLi4uXCI7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzMmQgJiYgdGhpcy5fYWN0aXZlVmlldy5yb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHRTeW1ib2wuYW5nbGUgPSAzNjAgLSB0aGlzLl9hY3RpdmVWaWV3LnJvdGF0aW9uO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGZsYXJlLnRleHRHcmFwaGljID0gbmV3IEdyYXBoaWMoe1xyXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNUZXh0OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyR3JhcGhpY0lkOiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJJZFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc3ltYm9sOiB0ZXh0U3ltYm9sLFxyXG4gICAgICAgICAgICAgICAgICAgIGdlb21ldHJ5OiB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcmFwaGljLmdlb21ldHJ5XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9mbGFyZXMgaGF2ZSBiZWVuIGNyZWF0ZWQgc28gYWRkIHRoZW0gdG8gdGhlIGRvbVxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBmbGFyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGYgPSBmbGFyZXNbaV07XHJcbiAgICAgICAgICAgIGlmICghZi5ncmFwaGljKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIC8vY3JlYXRlIGEgZ3JvdXAgdG8gaG9sZCBmbGFyZSBvYmplY3QgYW5kIHRleHQgaWYgbmVlZGVkLlxyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAgPSB0aGlzLl9hY3RpdmVDbHVzdGVyLmNsdXN0ZXJHcm91cC5jcmVhdGVHcm91cCgpO1xyXG4gICAgICAgICAgICBsZXQgcG9zaXRpb24gPSB0aGlzLl9zZXRGbGFyZVBvc2l0aW9uKGYuZmxhcmVHcm91cCwgY2x1c3RlclN5bWJvbFNpemUsIGZsYXJlQ291bnQsIGksIGRlZ3JlZVZhcmlhbmNlLCB2aWV3Um90YXRpb24pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5fYWRkQ2xhc3NUb0VsZW1lbnQoZi5mbGFyZUdyb3VwLnJhd05vZGUsIFwiZmxhcmUtZ3JvdXBcIik7XHJcbiAgICAgICAgICAgIGxldCBmbGFyZUVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWMoZi5ncmFwaGljLCBmLmZsYXJlR3JvdXApO1xyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAucmF3Tm9kZS5hcHBlbmRDaGlsZChmbGFyZUVsZW1lbnQpO1xyXG4gICAgICAgICAgICBpZiAoZi50ZXh0R3JhcGhpYykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGZsYXJlVGV4dEVsZW1lbnQgPSB0aGlzLl9jcmVhdGVDbG9uZWRFbGVtZW50RnJvbUdyYXBoaWMoZi50ZXh0R3JhcGhpYywgZi5mbGFyZUdyb3VwKTtcclxuICAgICAgICAgICAgICAgIGZsYXJlVGV4dEVsZW1lbnQuc2V0QXR0cmlidXRlKFwicG9pbnRlci1ldmVudHNcIiwgXCJub25lXCIpO1xyXG4gICAgICAgICAgICAgICAgZi5mbGFyZUdyb3VwLnJhd05vZGUuYXBwZW5kQ2hpbGQoZmxhcmVUZXh0RWxlbWVudCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZENsYXNzVG9FbGVtZW50KGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcImFjdGl2YXRlZFwiLCAxMCk7XHJcblxyXG4gICAgICAgICAgICAvL2Fzc2lnbiBzb21lIGV2ZW50IGhhbmRsZXJzIGZvciB0aGUgdG9vbHRpcHNcclxuICAgICAgICAgICAgZi5mbGFyZUdyb3VwLm1vdXNlRW50ZXIgPSBvbi5wYXVzYWJsZShmLmZsYXJlR3JvdXAucmF3Tm9kZSwgXCJtb3VzZWVudGVyXCIsICgpID0+IHRoaXMuX2NyZWF0ZVRvb2x0aXAoZikpO1xyXG4gICAgICAgICAgICBmLmZsYXJlR3JvdXAubW91c2VMZWF2ZSA9IG9uLnBhdXNhYmxlKGYuZmxhcmVHcm91cC5yYXdOb2RlLCBcIm1vdXNlbGVhdmVcIiwgKCkgPT4gdGhpcy5fZGVzdHJveVRvb2x0aXAoKSk7XHJcbiAgICAgICAgICAgICBcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NldEZsYXJlUG9zaXRpb24oZmxhcmVHcm91cDogYW55LCBjbHVzdGVyU3ltYm9sU2l6ZTogbnVtYmVyLCBmbGFyZUNvdW50OiBudW1iZXIsIGZsYXJlSW5kZXg6IG51bWJlciwgZGVncmVlVmFyaWFuY2U6IG51bWJlciwgdmlld1JvdGF0aW9uOiBudW1iZXIpIHtcclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHBvc2l0aW9uIG9mIHRoZSBmbGFyZSB0byBiZSBwbGFjZWQgYXJvdW5kIHRoZSBjb250YWluZXIgY2lyY2xlLlxyXG4gICAgICAgIGxldCBkZWdyZWUgPSBwYXJzZUludCgoKDM2MCAvIGZsYXJlQ291bnQpICogZmxhcmVJbmRleCkudG9GaXhlZCgpKTtcclxuICAgICAgICBkZWdyZWUgPSBkZWdyZWUgKyBkZWdyZWVWYXJpYW5jZTtcclxuXHJcbiAgICAgICAgLy90YWtlIGludG8gYWNjb3VudCBhbnkgcm90YXRpb24gb24gdGhlIHZpZXdcclxuICAgICAgICBpZiAodmlld1JvdGF0aW9uICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGRlZ3JlZSAtPSB2aWV3Um90YXRpb247XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmFkaWFuID0gZGVncmVlICogKE1hdGguUEkgLyAxODApO1xyXG4gICAgICAgIGxldCBidWZmZXIgPSB0aGlzLmZsYXJlQnVmZmVyUGl4ZWxzO1xyXG5cclxuICAgICAgICAvL3Bvc2l0aW9uIHRoZSBmbGFyZSBncm91cCBhcm91bmQgdGhlIGNsdXN0ZXJcclxuICAgICAgICBsZXQgcG9zaXRpb24gPSB7XHJcbiAgICAgICAgICAgIHg6IChidWZmZXIgKyBjbHVzdGVyU3ltYm9sU2l6ZSkgKiBNYXRoLmNvcyhyYWRpYW4pLFxyXG4gICAgICAgICAgICB5OiAoYnVmZmVyICsgY2x1c3RlclN5bWJvbFNpemUpICogTWF0aC5zaW4ocmFkaWFuKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmxhcmVHcm91cC5zZXRUcmFuc2Zvcm0oeyBkeDogcG9zaXRpb24ueCwgZHk6IHBvc2l0aW9uLnkgfSk7XHJcbiAgICAgICAgcmV0dXJuIHBvc2l0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldEZsYXJlU3ltYm9sKGZsYXJlR3JhcGhpYzogR3JhcGhpYyk6IFNpbXBsZU1hcmtlclN5bWJvbCB7XHJcbiAgICAgICAgcmV0dXJuICF0aGlzLmZsYXJlUmVuZGVyZXIgPyB0aGlzLmZsYXJlU3ltYm9sIDogdGhpcy5mbGFyZVJlbmRlcmVyLmdldENsYXNzQnJlYWtJbmZvKGZsYXJlR3JhcGhpYykuc3ltYm9sO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NyZWF0ZVRvb2x0aXAoZmxhcmU6IEZsYXJlKSB7XHJcblxyXG4gICAgICAgIGxldCBmbGFyZUdyb3VwID0gZmxhcmUuZmxhcmVHcm91cDtcclxuICAgICAgICB0aGlzLl9kZXN0cm95VG9vbHRpcCgpO1xyXG5cclxuICAgICAgICBsZXQgdG9vbHRpcExlbmd0aCA9IHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCBmbGFyZUdyb3VwLnJhd05vZGUpLmxlbmd0aDtcclxuICAgICAgICBpZiAodG9vbHRpcExlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9nZXQgdGhlIHRleHQgZnJvbSB0aGUgZGF0YS10b29sdGlwIGF0dHJpYnV0ZSBvZiB0aGUgc2hhcGUgb2JqZWN0XHJcbiAgICAgICAgbGV0IHRleHQgPSBmbGFyZS50b29sdGlwVGV4dDtcclxuICAgICAgICBpZiAoIXRleHQpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJubyB0b29sdGlwIHRleHQgZm9yIGZsYXJlLlwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9zcGxpdCBvbiBcXG4gY2hhcmFjdGVyIHRoYXQgc2hvdWxkIGJlIGluIHRvb2x0aXAgdG8gc2lnbmlmeSBtdWx0aXBsZSBsaW5lc1xyXG4gICAgICAgIGxldCBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIik7XHJcblxyXG4gICAgICAgIC8vY3JlYXRlIGEgZ3JvdXAgdG8gaG9sZCB0aGUgdG9vbHRpcCBlbGVtZW50c1xyXG4gICAgICAgIGxldCB0b29sdGlwR3JvdXAgPSBmbGFyZUdyb3VwLmNyZWF0ZUdyb3VwKCk7XHJcblxyXG4gICAgICAgIC8vZ2V0IHRoZSBmbGFyZSBzeW1ib2wsIHdlJ2xsIHVzZSB0aGlzIHRvIHN0eWxlIHRoZSB0b29sdGlwIGJveFxyXG4gICAgICAgIGxldCBmbGFyZVN5bWJvbCA9IHRoaXMuX2dldEZsYXJlU3ltYm9sKGZsYXJlLmdyYXBoaWMpO1xyXG5cclxuICAgICAgICAvL2FsaWduIG9uIHRvcCBmb3Igbm9ybWFsIGZsYXJlLCBhbGlnbiBvbiBib3R0b20gZm9yIHN1bW1hcnkgZmxhcmVzLlxyXG4gICAgICAgIGxldCBoZWlnaHQgPSBmbGFyZVN5bWJvbC5zaXplO1xyXG5cclxuICAgICAgICBsZXQgeFBvcyA9IDE7XHJcbiAgICAgICAgbGV0IHlQb3MgPSAhZmxhcmUuaXNTdW1tYXJ5ID8gKChoZWlnaHQpICogLTEpIDogaGVpZ2h0ICsgNTtcclxuXHJcbiAgICAgICAgdG9vbHRpcEdyb3VwLnJhd05vZGUuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJ0b29sdGlwLXRleHRcIik7XHJcbiAgICAgICAgbGV0IHRleHRTaGFwZXMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHJcbiAgICAgICAgICAgIGxldCB0ZXh0U2hhcGUgPSB0b29sdGlwR3JvdXAuY3JlYXRlVGV4dCh7IHg6IHhQb3MsIHk6IHlQb3MgKyAoaSAqIDEwKSwgdGV4dDogbGluZXNbaV0sIGFsaWduOiAnbWlkZGxlJyB9KVxyXG4gICAgICAgICAgICAgICAgLnNldEZpbGwodGhpcy5mbGFyZVRleHRTeW1ib2wuY29sb3IpXHJcbiAgICAgICAgICAgICAgICAuc2V0Rm9udCh7IHNpemU6IDEwLCBmYW1pbHk6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwiZmFtaWx5XCIpLCB3ZWlnaHQ6IHRoaXMuZmxhcmVUZXh0U3ltYm9sLmZvbnQuZ2V0KFwid2VpZ2h0XCIpIH0pO1xyXG5cclxuICAgICAgICAgICAgdGV4dFNoYXBlcy5wdXNoKHRleHRTaGFwZSk7XHJcbiAgICAgICAgICAgIHRleHRTaGFwZS5yYXdOb2RlLnNldEF0dHJpYnV0ZShcInBvaW50ZXItZXZlbnRzXCIsIFwibm9uZVwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByZWN0UGFkZGluZyA9IDI7XHJcbiAgICAgICAgbGV0IHRleHRCb3ggPSB0b29sdGlwR3JvdXAuZ2V0Qm91bmRpbmdCb3goKTtcclxuXHJcbiAgICAgICAgbGV0IHJlY3RTaGFwZSA9IHRvb2x0aXBHcm91cC5jcmVhdGVSZWN0KHsgeDogdGV4dEJveC54IC0gcmVjdFBhZGRpbmcsIHk6IHRleHRCb3gueSAtIHJlY3RQYWRkaW5nLCB3aWR0aDogdGV4dEJveC53aWR0aCArIChyZWN0UGFkZGluZyAqIDIpLCBoZWlnaHQ6IHRleHRCb3guaGVpZ2h0ICsgKHJlY3RQYWRkaW5nICogMiksIHI6IDAgfSlcclxuICAgICAgICAgICAgLnNldEZpbGwoZmxhcmVTeW1ib2wuY29sb3IpO1xyXG5cclxuICAgICAgICBpZiAoZmxhcmVTeW1ib2wub3V0bGluZSkge1xyXG4gICAgICAgICAgICByZWN0U2hhcGUuc2V0U3Ryb2tlKHsgY29sb3I6IGZsYXJlU3ltYm9sLm91dGxpbmUuY29sb3IsIHdpZHRoOiAwLjUgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWN0U2hhcGUucmF3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJwb2ludGVyLWV2ZW50c1wiLCBcIm5vbmVcIik7XHJcblxyXG4gICAgICAgIGZsYXJlR3JvdXAubW92ZVRvRnJvbnQoKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGV4dFNoYXBlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICB0ZXh0U2hhcGVzW2ldLm1vdmVUb0Zyb250KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2Rlc3Ryb3lUb29sdGlwKCkge1xyXG4gICAgICAgIHF1ZXJ5KFwiLnRvb2x0aXAtdGV4dFwiLCB0aGlzLl9hY3RpdmVWaWV3LmZjbFN1cmZhY2UucmF3Tm9kZSkuZm9yRWFjaChkb21Db25zdHJ1Y3QuZGVzdHJveSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8vI3JlZ2lvbiBoZWxwZXIgZnVuY3Rpb25zXHJcblxyXG4gICAgcHJpdmF0ZSBfY3JlYXRlQ2xvbmVkRWxlbWVudEZyb21HcmFwaGljKGdyYXBoaWM6IEdyYXBoaWMsIHN1cmZhY2U6IGFueSk6IEhUTUxFbGVtZW50IHtcclxuXHJcbiAgICAgICAgLy9mYWtlIG91dCBhIEdGWE9iamVjdCBzbyB3ZSBjYW4gZ2VuZXJhdGUgYW4gc3ZnIHNoYXBlIHRoYXQgdGhlIHBhc3NlZCBpbiBncmFwaGljcyBzaGFwZVxyXG4gICAgICAgIGxldCBnID0gbmV3IEdGWE9iamVjdCgpO1xyXG4gICAgICAgIGcuZ3JhcGhpYyA9IGdyYXBoaWM7XHJcbiAgICAgICAgZy5yZW5kZXJpbmdJbmZvID0geyBzeW1ib2w6IGdyYXBoaWMuc3ltYm9sIH07XHJcblxyXG4gICAgICAgIC8vc2V0IHVwIHBhcmFtZXRlcnMgZm9yIHRoZSBjYWxsIHRvIHJlbmRlclxyXG4gICAgICAgIC8vc2V0IHRoZSB0cmFuc2Zvcm0gb2YgdGhlIHByb2plY3RvciB0byAwJ3MgYXMgd2UncmUganVzdCBwbGFjaW5nIHRoZSBnZW5lcmF0ZWQgY2x1c3RlciBzaGFwZSBhdCBleGFjdGx5IDAsMC5cclxuICAgICAgICBsZXQgcHJvamVjdG9yID0gbmV3IFByb2plY3RvcigpO1xyXG4gICAgICAgIHByb2plY3Rvci5fdHJhbnNmb3JtID0gWzAsIDAsIDAsIDAsIDAsIDBdO1xyXG4gICAgICAgIHByb2plY3Rvci5fcmVzb2x1dGlvbiA9IDA7XHJcblxyXG4gICAgICAgIGxldCBzdGF0ZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAodGhpcy5faXMyZCkge1xyXG4gICAgICAgICAgICBzdGF0ZSA9IHRoaXMuX2FjdGl2ZVZpZXcuc3RhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvL2Zha2Ugb3V0IGEgc3RhdGUgb2JqZWN0IGZvciAzZCB2aWV3cy5cclxuICAgICAgICAgICAgc3RhdGUgPSB7XHJcbiAgICAgICAgICAgICAgICBjbGlwcGVkRXh0ZW50OiB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCxcclxuICAgICAgICAgICAgICAgIHJvdGF0aW9uOiAwLFxyXG4gICAgICAgICAgICAgICAgc3BhdGlhbFJlZmVyZW5jZTogdGhpcy5fYWN0aXZlVmlldy5zcGF0aWFsUmVmZXJlbmNlLFxyXG4gICAgICAgICAgICAgICAgd29ybGRTY3JlZW5XaWR0aDogMVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHBhciA9IHtcclxuICAgICAgICAgICAgc3VyZmFjZTogc3VyZmFjZSxcclxuICAgICAgICAgICAgc3RhdGU6IHN0YXRlLFxyXG4gICAgICAgICAgICBwcm9qZWN0b3I6IHByb2plY3RvclxyXG4gICAgICAgIH07XHJcbiAgICAgICAgZy5yZW5kZXIocGFyKTtcclxuICAgICAgICByZXR1cm4gZy5fc2hhcGUucmF3Tm9kZTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBfZXh0ZW50KCk6IEV4dGVudCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVZpZXcgPyB0aGlzLl9hY3RpdmVWaWV3LmV4dGVudCA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zY2FsZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVWaWV3ID8gdGhpcy5fYWN0aXZlVmlldy5zY2FsZSA6IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvL0lFIC8gRWRnZSBkb24ndCBoYXZlIHRoZSBjbGFzc0xpc3QgcHJvcGVydHkgb24gc3ZnIGVsZW1lbnRzLCBzbyB3ZSBjYW4ndCB1c2UgdGhhdCBhZGQgLyByZW1vdmUgY2xhc3NlcyAtIHByb2JhYmx5IHdoeSBkb2pvIGRvbUNsYXNzIGRvZXNuJ3Qgd29yayBlaXRoZXIuXHJcbiAgICAvL3NvIHRoZSBmb2xsb3dpbmcgdHdvIGZ1bmN0aW9ucyBhcmUgZG9kZ3kgc3RyaW5nIGhhY2tzIHRvIGFkZCAvIHJlbW92ZSBjbGFzc2VzLiBVc2VzIGEgdGltZW91dCBzbyB5b3UgY2FuIG1ha2UgY3NzIHRyYW5zaXRpb25zIHdvcmsgaWYgZGVzaXJlZC5cclxuICAgIHByaXZhdGUgX2FkZENsYXNzVG9FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCBhZGRDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgY3VycmVudENsYXNzID0gXCJcIjtcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRDbGFzcy5pbmRleE9mKFwiIFwiICsgX2NsYXNzTmFtZSkgIT09IC0xKSByZXR1cm47XHJcbiAgICAgICAgICAgIGxldCBuZXdDbGFzcyA9IChjdXJyZW50Q2xhc3MgKyBcIiBcIiArIF9jbGFzc05hbWUpLnRyaW0oKTtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgbmV3Q2xhc3MpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aW1lb3V0TXMpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhZGRDbGFzcyhlbGVtZW50LCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGltZW91dE1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGFkZENsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIF9yZW1vdmVDbGFzc0Zyb21FbGVtZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZywgdGltZW91dE1zPzogbnVtYmVyLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XHJcblxyXG4gICAgICAgIGxldCByZW1vdmVDbGFzczogRnVuY3Rpb24gPSAoX2VsZW1lbnQsIF9jbGFzc05hbWUpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnRDbGFzcyA9IF9lbGVtZW50LmdldEF0dHJpYnV0ZShcImNsYXNzXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRDbGFzcykgcmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudENsYXNzLmluZGV4T2YoXCIgXCIgKyBfY2xhc3NOYW1lKSA9PT0gLTEpIHJldHVybjtcclxuICAgICAgICAgICAgX2VsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgY3VycmVudENsYXNzLnJlcGxhY2UoXCIgXCIgKyBfY2xhc3NOYW1lLCBcIlwiKSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKHRpbWVvdXRNcykge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlbW92ZUNsYXNzKGVsZW1lbnQsIGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCB0aW1lb3V0TXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmVtb3ZlQ2xhc3MoZWxlbWVudCwgY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldE1vdXNlUG9zKGV2dCkge1xyXG4gICAgICAgIC8vY29udGFpbmVyIG9uIHRoZSB2aWV3IGlzIGFjdHVhbGx5IGEgaHRtbCBlbGVtZW50IGF0IHRoaXMgcG9pbnQsIG5vdCBhIHN0cmluZyBhcyB0aGUgdHlwaW5ncyBzdWdnZXN0LlxyXG4gICAgICAgIGxldCBjb250YWluZXI6IGFueSA9IHRoaXMuX2FjdGl2ZVZpZXcuY29udGFpbmVyO1xyXG4gICAgICAgIGxldCByZWN0ID0gY29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHg6IGV2dC5jbGllbnRYIC0gcmVjdC5sZWZ0LFxyXG4gICAgICAgICAgICB5OiBldnQuY2xpZW50WSAtIHJlY3QudG9wXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXR0aW5nIHZpc2libGUgdG8gZmFsc2Ugb24gYSBncmFwaGljIGRvZXNuJ3Qgd29yayBpbiA0LjIgZm9yIHNvbWUgcmVhc29uLiBSZW1vdmluZyB0aGUgZ3JhcGhpYyB0byBoaWRlIGl0IGluc3RlYWQuIEkgdGhpbmsgdmlzaWJsZSBwcm9wZXJ0eSBzaG91bGQgcHJvYmFibHkgd29yayB0aG91Z2guXHJcbiAgICAgKiBAcGFyYW0gZ3JhcGhpY1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9oaWRlR3JhcGhpYyhncmFwaGljOiBHcmFwaGljIHwgR3JhcGhpY1tdKSB7XHJcbiAgICAgICAgaWYgKCFncmFwaGljKSByZXR1cm47XHJcbiAgICAgICAgaWYgKGdyYXBoaWMuaGFzT3duUHJvcGVydHkoXCJsZW5ndGhcIikpIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNYW55KDxHcmFwaGljW10+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSg8R3JhcGhpYz5ncmFwaGljKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2hvd0dyYXBoaWMoZ3JhcGhpYzogR3JhcGhpYyB8IEdyYXBoaWNbXSkge1xyXG4gICAgICAgIGlmICghZ3JhcGhpYykgcmV0dXJuO1xyXG4gICAgICAgIGlmIChncmFwaGljLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkTWFueSg8R3JhcGhpY1tdPmdyYXBoaWMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5hZGQoPEdyYXBoaWM+Z3JhcGhpYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vI2VuZHJlZ2lvblxyXG5cclxufVxyXG5cclxuXHJcbmludGVyZmFjZSBBY3RpdmVWaWV3IGV4dGVuZHMgX19lc3JpLlZpZXcge1xyXG4gICAgY2FudmFzOiBhbnk7XHJcbiAgICBzdGF0ZTogYW55O1xyXG4gICAgZXh0ZW50OiBFeHRlbnQ7XHJcbiAgICBzY2FsZTogbnVtYmVyO1xyXG4gICAgZmNsU3VyZmFjZTogYW55O1xyXG4gICAgZmNsUG9pbnRlck1vdmU6IElIYW5kbGU7XHJcbiAgICBmY2xSZXNpemU6IElIYW5kbGU7XHJcbiAgICByb3RhdGlvbjogbnVtYmVyO1xyXG5cclxuICAgIHRvU2NyZWVuKGdlb21ldHJ5OiBfX2VzcmkuR2VvbWV0cnkpOiBTY3JlZW5Qb2ludDtcclxuICAgIGhpdFRlc3Qoc2NycmVuUG9pbnQ6IFNjcmVlblBvaW50KTogYW55O1xyXG59XHJcblxyXG5jbGFzcyBHcmlkQ2x1c3RlciB7XHJcbiAgICBleHRlbnQ6IGFueTtcclxuICAgIGNsdXN0ZXJDb3VudDogbnVtYmVyO1xyXG4gICAgc3ViVHlwZUNvdW50czogYW55W10gPSBbXTtcclxuICAgIHNpbmdsZXM6IGFueVtdID0gW107XHJcbiAgICBwb2ludHM6IGFueVtdID0gW107XHJcbiAgICB4OiBudW1iZXI7XHJcbiAgICB5OiBudW1iZXI7XHJcbn1cclxuXHJcblxyXG5jbGFzcyBDbHVzdGVyIHtcclxuICAgIGNsdXN0ZXJHcmFwaGljOiBHcmFwaGljO1xyXG4gICAgdGV4dEdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICBhcmVhR3JhcGhpYzogR3JhcGhpYztcclxuICAgIGNsdXN0ZXJJZDogbnVtYmVyO1xyXG4gICAgY2x1c3Rlckdyb3VwOiBhbnk7XHJcbiAgICBncmlkQ2x1c3RlcjogR3JpZENsdXN0ZXI7XHJcbn1cclxuXHJcbmNsYXNzIEZsYXJlIHsgXHJcbiAgICBncmFwaGljOiBHcmFwaGljO1xyXG4gICAgdGV4dEdyYXBoaWM6IEdyYXBoaWM7XHJcbiAgICB0b29sdGlwVGV4dDogc3RyaW5nO1xyXG4gICAgZmxhcmVUZXh0OiBzdHJpbmc7XHJcbiAgICBzaW5nbGVEYXRhOiBhbnlbXTtcclxuICAgIGZsYXJlR3JvdXA6IGFueTtcclxuICAgIGlzU3VtbWFyeTogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFBvaW50RmlsdGVyIHtcclxuICAgIGZpbHRlck5hbWU6IHN0cmluZztcclxuICAgIHByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG4gICAgcHJvcGVydHlWYWx1ZXM6IGFueVtdO1xyXG5cclxuICAgIC8vZGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBmaWx0ZXIgaW5jbHVkZXMgb3IgZXhjbHVkZXMgdGhlIHBvaW50IGRlcGVuZGluZyBvbiB3aGV0aGVyIGl0IGNvbnRhaW5zIHRoZSBwcm9wZXJ0eSB2YWx1ZS5cclxuICAgIC8vZmFsc2UgbWVhbnMgdGhlIHBvaW50IHdpbGwgYmUgZXhjbHVkZWQgaWYgdGhlIHZhbHVlIGRvZXMgZXhpc3QgaW4gdGhlIG9iamVjdCwgdHJ1ZSBtZWFucyBpdCB3aWxsIGJlIGV4Y2x1ZGVkIGlmIGl0IGRvZXNuJ3QuXHJcbiAgICBrZWVwT25seUlmVmFsdWVFeGlzdHM6IGJvb2xlYW47XHJcblxyXG4gICAgY29uc3RydWN0b3IoZmlsdGVyTmFtZTogc3RyaW5nLCBwcm9wZXJ0eU5hbWU6IHN0cmluZywgdmFsdWVzOiBhbnlbXSwga2VlcE9ubHlJZlZhbHVlRXhpc3RzOiBib29sZWFuID0gZmFsc2UpIHtcclxuICAgICAgICB0aGlzLmZpbHRlck5hbWUgPSBmaWx0ZXJOYW1lO1xyXG4gICAgICAgIHRoaXMucHJvcGVydHlOYW1lID0gcHJvcGVydHlOYW1lO1xyXG4gICAgICAgIHRoaXMucHJvcGVydHlWYWx1ZXMgPSB2YWx1ZXM7XHJcbiAgICAgICAgdGhpcy5rZWVwT25seUlmVmFsdWVFeGlzdHMgPSBrZWVwT25seUlmVmFsdWVFeGlzdHM7XHJcbiAgICB9XHJcblxyXG59XHJcblxyXG4iXX0=
