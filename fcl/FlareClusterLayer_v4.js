/// <reference path="../typings/index.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", "esri/layers/GraphicsLayer", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/TextSymbol", "esri/symbols/SimpleLineSymbol", "esri/Color", 'esri/core/watchUtils', "esri/geometry/support/webMercatorUtils", "esri/Graphic", "esri/geometry/Point", "esri/geometry/Multipoint", "esri/geometry/Polygon", 'esri/geometry/geometryEngine', "esri/geometry/SpatialReference", 'esri/views/3d/externalRenderers', "esri/views/2d/VectorGroup", 'dojo/on', 'dojox/gfx', 'dojo/dom-construct', 'dojo/query', 'dojo/dom-attr', 'dojo/dom-style'], function (require, exports, GraphicsLayer, SimpleMarkerSymbol, TextSymbol, SimpleLineSymbol, Color, watchUtils, webMercatorUtils, Graphic, Point, Multipoint, Polygon, geometryEngine, SpatialReference, externalRenderers, VectorGroup, on, gfx, domConstruct, query, domAttr, domStyle) {
    "use strict";
    var FlareClusterLayer = (function (_super) {
        __extends(FlareClusterLayer, _super);
        function FlareClusterLayer(options) {
            var _this = this;
            _super.call(this, options);
            this.layerViews = [];
            this.viewLoadCount = 0;
            this.viewPopupMessageEnabled = true;
            //set the defaults
            if (!options) {
                options = {};
            }
            this.singlePopupTemplate = options.singlePopupTemplate;
            this.clusterRatio = options.clusterRatio || 75;
            this.clusterToScale = options.clusterToScale || 2000000;
            this.clusterMinCount = options.clusterMinCount || 2;
            this.clusterAreaDisplay = options.clusterAreaDisplay || "activated";
            this.singleFlareTooltipProperty = options.singleFlareTooltipProperty || "name";
            this.maxFlareCount = options.maxFlareCount || 8;
            this.maxSingleFlareCount = options.maxSingleFlareCount || 8;
            this.areaRenderer = options.areaRenderer;
            this.renderer = options.renderer;
            this.singleRenderer = options.singleRenderer;
            this.xPropertyName = options.xPropertyName || "x";
            this.yPropertyName = options.yPropertyName || "y";
            this.zPropertyName = options.zPropertyName || "z";
            this.filters = options.filters || [];
            this.displaySubTypeFlares = options.displaySubTypeFlares === true;
            this.subTypeFlareProperty = options.subTypeFlareProperty || undefined;
            this.refreshOnStationary = options.refreshOnStationary === false ? false : true;
            this.flareSymbol = options.flareSymbol || new SimpleMarkerSymbol({
                size: 13,
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
                }
            });
            this.data = options.data || undefined;
            this.on("layerview-create", function (evt) { return _this.layerViewCreated(evt); });
            if (this.data) {
                this.drawData();
            }
        }
        FlareClusterLayer.prototype.layerViewCreated = function (evt) {
            var _this = this;
            if (evt.layerView.view.type === "2d") {
                //this is map view so set up a watch to find out when the vector group has been created
                watchUtils.once(evt.layerView._graphicsView, "group", function (vectorGroup, b, c, graphicsView) { return _this.vectorGroupCreated(vectorGroup, b, c, graphicsView); });
            }
            else {
                //this is 3d so add a custom external rendeder to hook into webgl pipeline to do things.
                var fclExternalRenderer = new FlareClusterLayerExternalRenderer(evt.layerView);
                externalRenderers.add(evt.layerView.view, fclExternalRenderer);
            }
            //Refresh the data when the view is stationary if not set to false in options.
            if (this.refreshOnStationary) {
                watchUtils.pausable(evt.layerView.view, "stationary", function (isStationary, b, c, view) { return _this.viewStationary(isStationary, b, c, view); });
            }
            this.viewPopupMessageEnabled = evt.layerView.view.popup.messageEnabled;
            //watch this property so we can not display popups for graphics we don't want to.
            watchUtils.watch(evt.layerView.view.popup.viewModel, "selectedFeature", function (selectedFeature, b, c, viewModel) { return _this.viewPopupSelectedFeatureChange(selectedFeature, b, c, viewModel); });
            this.layerViews.push(evt.layerView);
            if (this.viewLoadCount === 0) {
                this.activeView = evt.layerView.view;
            }
            this.viewLoadCount++;
        };
        FlareClusterLayer.prototype.viewPopupSelectedFeatureChange = function (selectedFeature, b, c, viewModel) {
            //There has got to be an better way to not show popups for certain graphics!
            if (!selectedFeature) {
                //reset the popup message for the view so this layer doens't affect other layers.
                viewModel.view.popup.messageEnabled = this.viewPopupMessageEnabled;
                return;
            }
            //if this is a cluster type graphic then hide the popup
            if (selectedFeature.attributes.isFlare || selectedFeature.attributes.isCluster || selectedFeature.attributes.isClusterArea) {
                viewModel.features = [];
                viewModel.view.popup.messageEnabled = false;
                viewModel.view.popup.close();
            }
        };
        FlareClusterLayer.prototype.viewStationary = function (isStationary, b, c, view) {
            if (this.data && isStationary) {
                this.activeView = view;
                this.drawData();
            }
        };
        FlareClusterLayer.prototype.vectorGroupCreated = function (vectorGroup, b, c, graphicsView) {
            //need to set the z-index of the layer view container to something higher than the basemap container so it will receive events. This is a hack I think.
            var parentDiv = graphicsView.gfx._parent;
            var newStyle = parentDiv.getAttribute("style") + ";z-index:10";
            parentDiv.setAttribute("style", newStyle);
            graphicsView.group = new FlareClusterVectorGroup({
                view: vectorGroup.view,
                x: vectorGroup.x,
                y: vectorGroup.y,
                resolution: vectorGroup.resolution,
                rotation: vectorGroup.rotation,
                surface: vectorGroup.surface,
                layer: vectorGroup.layer
            });
            this.readyToDraw = true;
            if (this.queuedInitialDraw) {
                this.drawData();
                this.queuedInitialDraw = false;
            }
        };
        FlareClusterLayer.prototype.removeAll = function () {
            _super.prototype.removeAll.call(this);
            for (var _i = 0, _a = this.layerViews; _i < _a.length; _i++) {
                var lv = _a[_i];
                if (lv._graphicsView && lv._graphicsView.group) {
                    //this is a 2d layer view so clear the vector groups vector array
                    lv._graphicsView.group.vectors = [];
                }
            }
        };
        FlareClusterLayer.prototype.setData = function (data, drawData) {
            if (drawData === void 0) { drawData = true; }
            this.data = data;
            if (drawData) {
                this.drawData();
            }
        };
        FlareClusterLayer.prototype.drawData = function (activeView) {
            //Not ready to draw yet so queue one up
            if (!this.readyToDraw) {
                this.queuedInitialDraw = true;
                return;
            }
            if (activeView) {
                this.activeView = activeView;
            }
            //no data set and no active (visible) view found so return
            if (!this.data || !this.activeView)
                return;
            this.removeAll();
            console.time("draw-data");
            this.isClustered = this.clusterToScale < this.activeView["scale"];
            console.log("draw data " + this.activeView.type);
            var graphics = [];
            //get an extent that is in web mercator to make sure it's flat for extent checking
            //The webextent will need to be normalized since panning over the international dateline will cause
            //cause the extent to shift outside the -180 to 180 degree window.  If we don't normalize then the
            //clusters will not be drawn if the map pans over the international dateline.
            var webExtent = !this.activeView.extent.spatialReference.isWebMercator ? webMercatorUtils.project(this.activeView.extent, new SpatialReference({ "wkid": 102100 })) : this.activeView.extent;
            var extentIsUnioned = false;
            //TODO: normalizing not working in 4.0 yet.
            //var normalizedWebExtent = webExtent.normalize();
            //webExtent = normalizedWebExtent[0];
            //if (normalizedWebExtent.length > 1) {
            //    webExtent = webExtent.union(normalizedWebExtent[1]);
            //    extentIsUnioned = true;
            //}
            if (this.isClustered) {
                this.createClusterGrid(webExtent, extentIsUnioned);
            }
            var web, obj, dataLength = this.data.length, xVal, yVal;
            for (var i = 0; i < dataLength; i++) {
                obj = this.data[i];
                //check if filters are specified and continue if this object doesn't pass
                if (!this.passesFilter(obj)) {
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
                if (this.isClustered) {
                    //loop cluster grid to see if it should be added to one
                    for (var j = 0, jLen = this.gridClusters.length; j < jLen; j++) {
                        var cl = this.gridClusters[j];
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
                    this.createSingle(obj);
                }
            }
            if (this.isClustered) {
                for (var i = 0, len = this.gridClusters.length; i < len; i++) {
                    if (this.gridClusters[i].clusterCount < this.clusterMinCount) {
                        for (var j = 0, jlen = this.gridClusters[i].singles.length; j < jlen; j++) {
                            this.createSingle(this.gridClusters[i].singles[j]);
                        }
                    }
                    else if (this.gridClusters[i].clusterCount > 1) {
                        this.createCluster(this.gridClusters[i]);
                    }
                }
            }
            //emit an event to signal drawing is complete.
            this.emit("draw-complete", {});
            console.timeEnd("draw-data");
        };
        FlareClusterLayer.prototype.passesFilter = function (obj) {
            if (!this.filters || this.filters.length === 0)
                return true;
            for (var i = 0, len = this.filters.length; i < len; i++) {
                var filter = this.filters[i];
                if (obj[filter.propertyName] == null)
                    continue;
                if (filter.propertyValues.indexOf(obj[filter.propertyName]) !== -1) {
                    return false; //return false as the object contains a property with this filters name and the value is contained within the filters value array.
                }
            }
            return true;
        };
        FlareClusterLayer.prototype.createSingle = function (obj) {
            var graphic = new Graphic({
                geometry: new Point({
                    x: obj[this.xPropertyName], y: obj[this.yPropertyName], z: obj[this.zPropertyName]
                }),
                attributes: obj
            });
            graphic.popupTemplate = this.singlePopupTemplate;
            if (this.singleRenderer) {
                var symbol = this.singleRenderer.getSymbol(graphic, this.activeView);
                graphic.symbol = symbol;
            }
            this.add(graphic);
        };
        FlareClusterLayer.prototype.createCluster = function (cluster) {
            var point = new Point({ x: cluster.x, y: cluster.y });
            var attributes = {
                x: cluster.x,
                y: cluster.y,
                clusterCount: cluster.clusterCount,
                isCluster: true,
                clusterObject: cluster
            };
            var graphic = new Graphic({
                attributes: attributes,
                geometry: point
            });
            graphic.popupTemplate = null;
            this.add(graphic);
            //also create a text symbol to display the cluster count
            var textSymbol = this.textSymbol.clone();
            textSymbol.text = cluster.clusterCount.toString();
            var tg = new Graphic({
                geometry: point,
                attributes: {
                    isClusterText: true,
                    clusterGraphicId: graphic["id"]
                },
                symbol: textSymbol
            });
            tg.popupTemplate = null;
            this.add(tg);
            graphic.attributes.textGraphic = tg;
            //add an area graphic to display the bounds of the cluster if configured to
            var areaGraphic;
            if (this.clusterAreaDisplay && cluster.points && cluster.points.length > 0) {
                if (!this.areaRenderer) {
                    console.error("_createCluster: areaRenderer must be set if clusterAreaDisplay is set.");
                    return;
                }
                var mp = new Multipoint();
                mp.points = cluster.points;
                var area = geometryEngine.convexHull(mp, true); //use convex hull on the points to get the boundary
                var areaAttr = {
                    x: cluster.x,
                    y: cluster.y,
                    clusterCount: cluster.clusterCount,
                    clusterGraphicId: graphic["id"],
                    isClusterArea: true
                };
                if (area.rings && area.rings.length > 0) {
                    var areaPoly = new Polygon(); //had to create a new polygon and fill it with the ring of the calculated area for SceneView to work.
                    areaPoly = areaPoly.addRing(area.rings[0]);
                    areaGraphic = new Graphic({ geometry: areaPoly, attributes: areaAttr });
                    var areaInfo = this.areaRenderer.getClassBreakInfo(areaGraphic);
                    areaGraphic.symbol = areaInfo.symbol;
                    areaGraphic.cluster = cluster;
                    areaGraphic.popupTemplate = null;
                    this.add(areaGraphic);
                    graphic.attributes.areaGraphic = areaGraphic;
                }
            }
            //create the graphics for the flares and assign to attribute
            var flareGraphics = this.createFlares(cluster, graphic);
            graphic.attributes.flareGraphics = flareGraphics;
        };
        FlareClusterLayer.prototype.createFlares = function (clusterObject, clusterGraphic) {
            var flareGraphics = [];
            //check if we need to create flares for the cluster
            var singleFlares = (clusterObject.singles && clusterObject.singles.length > 0) && (clusterObject.clusterCount <= this.maxSingleFlareCount);
            var subTypeFlares = !singleFlares && (clusterObject.subTypeCounts && clusterObject.subTypeCounts.length > 0);
            if (!singleFlares && !subTypeFlares) {
                return flareGraphics; //no flares required
            }
            var flareObjects = [];
            if (singleFlares) {
                for (var i = 0, len = clusterObject.singles.length; i < len; i++) {
                    flareObjects.push({
                        tooltipText: clusterObject.singles[i][this.singleFlareTooltipProperty],
                        flareText: "",
                        singleData: clusterObject.singles[i]
                    });
                }
            }
            else if (subTypeFlares) {
                //sort sub types by highest count first
                var subTypes = clusterObject.subTypeCounts.sort(function (a, b) {
                    return b.count - a.count;
                });
                for (var i = 0, len = subTypes.length; i < len; i++) {
                    flareObjects.push({
                        tooltipText: subTypes[i].count + " - " + subTypes[i].name,
                        flareText: subTypes[i].count
                    });
                }
            }
            //if there are more flare objects to create that the maxFlareCount and this is a one of those - create a summary flare that contains '...' as the text and make this one part of it 
            var willContainSummaryFlare = flareObjects.length > this.maxFlareCount;
            var flareCount = willContainSummaryFlare ? this.maxFlareCount : flareObjects.length;
            for (var i_1 = 0; i_1 < flareCount; i_1++) {
                //exit if we've hit the maxFlareCount - a summary would have been created on the last one
                if (i_1 >= this.maxFlareCount) {
                    break;
                }
                var fo = flareObjects[i_1];
                //set some attribute data
                var flareAttributes = {
                    isFlare: true,
                    isSummaryFlare: false,
                    tooltipText: "",
                    flareTextGraphic: undefined,
                    clusterGraphicId: clusterGraphic["id"]
                };
                var flareTextAttributes = {};
                //Do a couple of things differently if this is a summary flare or not
                var tooltipText = "";
                var isSummaryFlare = willContainSummaryFlare && i_1 >= this.maxFlareCount - 1;
                if (isSummaryFlare) {
                    flareAttributes.isSummaryFlare = true;
                    //multiline tooltip for summary flares, ie: greater than this.maxFlareCount flares per cluster
                    for (var j = this.maxFlareCount - 1, jlen = flareObjects.length; j < jlen; j++) {
                        tooltipText += j > (this.maxFlareCount - 1) ? "\n" : "";
                        tooltipText += flareObjects[j].tooltipText;
                    }
                }
                else {
                    tooltipText = fo.tooltipText;
                }
                flareAttributes.tooltipText = tooltipText;
                //create a graphic for the flare and for the flare text, don't worry about positioning though, it will be set in the view specific code
                var flareGraphic = new Graphic({
                    attributes: flareAttributes,
                    symbol: this.flareSymbol,
                    geometry: clusterGraphic.geometry,
                    popupTemplate: null
                });
                //flareGraphic.popupTemplate = null;
                flareGraphics.push(flareGraphic);
                if (fo.flareText) {
                    var textSymbol = this.flareTextSymbol.clone();
                    textSymbol.text = !isSummaryFlare ? fo.flareText.toString() : "...";
                    var flareTextGraphic = new Graphic({
                        attributes: {
                            isFlareText: true,
                            clusterGraphicId: clusterGraphic["id"],
                            flareGraphicId: flareGraphic["id"]
                        },
                        symbol: textSymbol,
                        geometry: clusterGraphic.geometry //default geometry to be cluster point
                    });
                    //add text to attributes of flare graphic
                    flareGraphic.attributes.flareTextGraphic = flareTextGraphic;
                    flareGraphics.push(flareTextGraphic);
                }
            }
            this.addMany(flareGraphics);
            return flareGraphics;
        };
        FlareClusterLayer.prototype.createClusterGrid = function (webExtent, extentIsUnioned) {
            //get the total amount of grid spaces based on the height and width of the map (divide it by clusterRatio) - then get the degrees for x and y 
            var xCount = Math.round(this.activeView.width / this.clusterRatio);
            var yCount = Math.round(this.activeView.height / this.clusterRatio);
            //if the extent has been unioned due to normalization, double the count of x in the cluster grid as the unioning will halve it.
            if (extentIsUnioned) {
                xCount *= 2;
            }
            var xw = (webExtent.xmax - webExtent.xmin) / xCount;
            var yh = (webExtent.ymax - webExtent.ymin) / yCount;
            var gsxmin, gsxmax, gsymin, gsymax;
            //create an array of clusters that is a grid over the visible extent. Each cluster contains the extent (in web merc) that bounds the grid space for it.
            this.gridClusters = [];
            for (var i = 0; i < xCount; i++) {
                gsxmin = webExtent.xmin + (xw * i);
                gsxmax = gsxmin + xw;
                for (var j = 0; j < yCount; j++) {
                    gsymin = webExtent.ymin + (yh * j);
                    gsymax = gsymin + yh;
                    var ext = { xmin: gsxmin, xmax: gsxmax, ymin: gsymin, ymax: gsymax };
                    this.gridClusters.push({
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
        return FlareClusterLayer;
    }(GraphicsLayer));
    exports.FlareClusterLayer = FlareClusterLayer;
    var GridCluster = (function () {
        function GridCluster() {
            this.subTypeCounts = [];
            this.singles = [];
            this.points = [];
        }
        return GridCluster;
    }());
    var PointFilter = (function () {
        function PointFilter(name, values) {
            this.propertyName = name;
            this.propertyValues = values;
        }
        return PointFilter;
    }());
    exports.PointFilter = PointFilter;
    var FlareClusterVectorGroup = (function (_super) {
        __extends(FlareClusterVectorGroup, _super);
        function FlareClusterVectorGroup(options) {
            _super.call(this, options);
            this.eventHandles = [];
            this.animationsRunning = [];
            this.clusterVectors = [];
        }
        FlareClusterVectorGroup.prototype.removeVector = function (a) {
            if (!a)
                return;
            if (a.clusterGroup) {
                domConstruct.destroy(a.clusterGroup.rawNode);
            }
            else if (a.shape) {
                domConstruct.destroy(a.shape.rawNode);
            }
            return _super.prototype.removeVector.call(this, a);
        };
        FlareClusterVectorGroup.prototype.draw = function () {
            var _this = this;
            //only applies to 2d and only if there's vectors to draw
            if (this.layer.activeView.type !== "2d" || this.vectors.length === 0) {
                return;
            }
            //destroy all cluster objects
            query(".cluster-object", this.surface.rawNode).forEach(domConstruct.destroy);
            this.clusterVectors = [];
            this.transform || _super.prototype._updateTransform.call(this);
            this.surface.openBatch();
            var a, c, b;
            c = 0;
            for (b = this.vectors.length; c < b; c++) {
                (a = this.vectors[c]) && this.drawVector(a);
                var v = this.vectors[c];
                if (!v.shape)
                    continue;
                if (v.graphic.attributes.isCluster) {
                    v.shape.rawNode.setAttribute("class", "cluster"); //this is a cluster
                    v.flareVectors = [];
                    v.flareTextVectors = [];
                    this.clusterVectors.push(v);
                }
                else if (v.graphic.attributes.isClusterText) {
                    //this is cluster text
                    v.shape.rawNode.setAttribute("class", "cluster-text");
                    v.shape.rawNode.setAttribute("pointer-events", "none");
                    //assign to a property on the cluster vector
                    var cv = this.getClusterVectorByGraphicId(v.graphic.attributes.clusterGraphicId);
                    if (cv) {
                        cv.textVector = v;
                    }
                }
                else if (v.graphic.attributes.isClusterArea) {
                    v.shape.rawNode.setAttribute("class", "cluster-area");
                    v.shape.moveToBack();
                    if (this.layer.clusterAreaDisplay === "activated") {
                        //remove the node from the dom (try and keep it as light as possible)
                        this.removeNodeFromDom(v.shape.rawNode);
                    }
                    //assign to a property on the cluster vector
                    var cv = this.getClusterVectorByGraphicId(v.graphic.attributes.clusterGraphicId);
                    if (cv) {
                        cv.areaVector = v;
                    }
                }
                else if (v.graphic.attributes.isFlare) {
                    //remove the node from the dom (try and keep it as light as possible)
                    this.removeNodeFromDom(v.shape.rawNode);
                    //assign to a property on the cluster vector
                    var cv = this.getClusterVectorByGraphicId(v.graphic.attributes.clusterGraphicId);
                    if (cv) {
                        cv.flareVectors.push(v);
                    }
                }
                else if (v.graphic.attributes.isFlareText) {
                    v.shape.rawNode.setAttribute("pointer-events", "none");
                    //remove the node from the dom (try and keep it as light as possible)
                    this.removeNodeFromDom(v.shape.rawNode);
                    //assign to a property on the flare shape vector - the flare shape vector should be the previous entry in the array
                    var flareShapeVector = this.vectors[c - 1];
                    if (flareShapeVector.graphic.attributes.isFlare) {
                        flareShapeVector.textVector = v;
                    }
                }
            }
            this.surface.closeBatch();
            if (!this.layer.clusterAreaDisplay) {
                //area should not be displayed at all so destroy the nodes
                query(".cluster-area", this.surface.rawNode).forEach(domConstruct.destroy);
            }
            //remove any event handlers added previously
            for (var _i = 0, _a = this.eventHandles; _i < _a.length; _i++) {
                var evtHandle = _a[_i];
                evtHandle.remove();
            }
            for (var _b = 0, _c = this.clusterVectors; _b < _c.length; _b++) {
                var cv = _c[_b];
                this.initCluster(cv);
            }
            var clusterGroups = query(".cluster-group", this.surface.rawNode);
            this.eventHandles.push(on.pausable(clusterGroups, "mouseenter", function (evt) { return _this.clusterMouseEnter(evt); }));
            this.eventHandles.push(on.pausable(clusterGroups, "mouseleave", function (evt) { return _this.clusterMouseLeave(evt); }));
        };
        FlareClusterVectorGroup.prototype.initCluster = function (clusterVector) {
            if (!clusterVector.shape || !clusterVector.textVector.shape) {
                return;
            }
            //for each clusterVector create an svg group that contains the cluster circle and the cluster text shapes.
            var group = this.surface.createGroup();
            group.rawNode.setAttribute("class", "cluster-group");
            group.add(clusterVector.shape);
            group.add(clusterVector.textVector.shape);
            this.addClassToNode(group.rawNode, "created", 5);
            clusterVector.clusterGroup = group;
        };
        FlareClusterVectorGroup.prototype.clusterMouseEnter = function (evt) {
            //get the cluster vector from the vectors array
            var vector = this.getClusterVectorFromGroupNode(evt.target);
            this.activateCluster(vector);
        };
        FlareClusterVectorGroup.prototype.activateCluster = function (vector) {
            if (vector === this.activeClusterVector)
                return; //already active
            if (this.activeClusterVector) {
                this.deactivateCluster(this.activeClusterVector);
            }
            this.addClassToNode(vector.clusterGroup.rawNode, "activated", 5);
            var center = this.getShapeCenter(vector.shape);
            vector.center = center;
            //Handle scaling and moving to front as well.
            vector.clusterGroup.moveToFront();
            var scaleAnims = [];
            if (vector.areaVector && this.layer.clusterAreaDisplay === "activated") {
                //add the area vector shape into the dom and add an activated class
                this.surface.rawNode.appendChild(vector.areaVector.shape.rawNode);
                vector.areaVector.shape.moveToBack();
                this.addClassToNode(vector.areaVector.shape.rawNode, "activated", 5);
            }
            this.createFlares(vector);
            this.activeClusterVector = vector;
        };
        FlareClusterVectorGroup.prototype.clusterMouseLeave = function (evt) {
            var vector = this.getClusterVectorFromGroupNode(evt.target);
            this.deactivateCluster(vector);
        };
        FlareClusterVectorGroup.prototype.deactivateCluster = function (vector) {
            var center = vector.center;
            //remove any flare shapes from the DOM
            for (var i = 0, len = vector.flareVectors.length; i < len; i++) {
                this.removeClassFromNode(vector.flareVectors[i].shape.rawNode, "activated", 5);
                this.removeNodeFromDom(vector.flareVectors[i].shape.rawNode);
            }
            //destroy all flare objects in this cluster group
            query(".cluster-object", this.surface.rawNode).forEach(domConstruct.destroy);
            this.removeClassFromNode(vector.clusterGroup.rawNode, "activated", 5);
            if (vector.areaVector && this.layer.clusterAreaDisplay === "activated") {
                //remove the area vector from the dom
                this.removeClassFromNode(vector.areaVector.shape.rawNode, "activated", 5);
                this.removeNodeFromDom(vector.areaVector.shape.rawNode);
            }
            this.activeClusterVector = null;
        };
        FlareClusterVectorGroup.prototype.fixMouseEnter = function (evt) {
            this.surface.rawNode.style.cursor = "pointer";
        };
        FlareClusterVectorGroup.prototype.fixMouseLeave = function (evt) {
            this.surface.rawNode.style.cursor = "default";
        };
        FlareClusterVectorGroup.prototype.createFlares = function (clusterVector) {
            var _this = this;
            var flareVectors = clusterVector.flareVectors;
            if (!flareVectors || flareVectors.length === 0)
                return;
            var flareCount = flareVectors.length;
            //create and add a graphic to represent the flare circle
            var bbox = clusterVector.shape.getBoundingBox();
            var radius = 8;
            var buffer = 8;
            var clusterGroup = clusterVector.clusterGroup;
            //create a transparent circle that contains the boundary of the flares, this is to make sure the mouse events don't fire moving in between flares
            var conCircleRadius = (clusterVector.center.x - (bbox.x - radius - buffer)) + radius; //get the radius of the circle to contain everything
            var containerCircle = clusterGroup.createCircle({ cx: clusterVector.center.x, cy: clusterVector.center.y, r: conCircleRadius })
                .setFill([0, 0, 0, 0]);
            containerCircle.rawNode.setAttribute("class", "flare-container cluster-object");
            //if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
            //for an add amount position the first flare on top, -90 to do this. Looks more symmetrical this way.
            var degreeVariance = (flareCount % 2 === 0) ? -180 : -90;
            var viewRotation = this.view.rotation;
            //array to hold the animations for displaying flares
            var stAnims = [];
            for (var i = 0; i < flareCount; i++) {
                var flareVector = flareVectors[i];
                //get the position of the flare to be placed around the container circle.
                var degree = parseInt(((360 / flareCount) * i).toFixed());
                degree = degree + degreeVariance;
                //take into account any rotation on the view
                if (viewRotation !== 0) {
                    degree -= viewRotation;
                }
                var radian = degree * (Math.PI / 180);
                //calc the center point of the flare
                var screenPoint = {
                    x: clusterVector.center.x + (conCircleRadius - radius - 5) * Math.cos(radian),
                    y: clusterVector.center.y + (conCircleRadius - radius - 5) * Math.sin(radian)
                };
                //create a group to hold the flare an possibly the text for the flare
                var flareGroup = clusterGroup.createGroup({ x: screenPoint.x, y: screenPoint.y });
                flareGroup.rawNode.setAttribute("class", "cluster-object flare-group");
                flareGroup.add(flareVector.shape);
                //if this flare hasn't had it's position set, set it now. Transforming the exsiting location - cluster location to the actual screen location using dx and dy on the shape.
                if (!flareVector.shape.positionSet) {
                    var transform = flareVector.shape.getTransform();
                    var flareCenter = this.getShapeCenter(flareVector.shape);
                    var diff = {
                        x: screenPoint.x - flareCenter.x,
                        y: screenPoint.y - flareCenter.y
                    };
                    transform.dx = transform.dx + diff.x;
                    transform.dy = transform.dy + diff.y;
                    flareVector.shape.setTransform(transform);
                    flareVector.shape.positionSet = true;
                }
                //if this flare has a text graphic add it and position as well
                if (flareVector.textVector) {
                    flareGroup.add(flareVector.textVector.shape);
                    if (!flareVector.textVector.shape.positionSet) {
                        var textTransform = flareVector.textVector.shape.getTransform();
                        var flareCenter = this.getShapeCenter(flareVector.textVector.shape);
                        var diff = {
                            x: screenPoint.x - flareCenter.x,
                            y: screenPoint.y - flareCenter.y
                        };
                        textTransform.dx = textTransform.dx + diff.x;
                        textTransform.dy = textTransform.dy + diff.y;
                        flareVector.textVector.shape.setTransform(textTransform);
                        flareVector.textVector.shape.positionSet = true;
                    }
                }
                //set the group to be scaled to 0 by default.
                flareGroup.rawNode.setAttribute("data-tooltip", flareVector.graphic.attributes.tooltipText);
                flareGroup.rawNode.setAttribute("data-center-x", screenPoint.x);
                flareGroup.rawNode.setAttribute("data-center-y", screenPoint.y);
                flareGroup.isSummaryFlare = flareVector.graphic.attributes.isSummaryFlare;
                //add activated class for styling/transitions
                this.addClassToNode(flareGroup.rawNode, "activated", 10);
                flareGroup.mouseEnter = on.pausable(flareGroup.rawNode, "mouseenter", function (e) { return _this.createTooltip(e); });
                flareGroup.mouseLeave = on.pausable(flareGroup.rawNode, "mouseleave", function (e) { return _this.destroyTooltip(e); });
            }
        };
        FlareClusterVectorGroup.prototype.createTooltip = function (e) {
            if (!this.layer)
                return;
            var flareGroupNode = e.gfxTarget ? e.gfxTarget.rawNode : e.target;
            var shape = flareGroupNode.__gfxObject__;
            //destory any existing tooltips.
            query(".tooltip-text", this.surface.rawNode).forEach(domConstruct.destroy);
            var tooltipLength = query(".tooltip-text", shape.rawNode).length;
            if (tooltipLength > 0) {
                return;
            }
            //get the text from the data-tooltip attribute of the shape object
            var text = shape.rawNode.getAttribute("data-tooltip");
            if (!text) {
                console.log("no data-tooltip attribute on element");
                return;
            }
            //split on /n character that should be in tooltip to signify multiple lines
            var lines = text.split("\n");
            //read the center positions from the shape, attributes must be set on whatever node is being passed in. Calculating from getboundingBox wasn't working for some reason
            var xPos = parseInt(shape.rawNode.getAttribute("data-center-x"));
            //align on top for normal flare, align on bottom for summary flares.
            var centerY = parseInt(shape.rawNode.getAttribute("data-center-y"));
            var yPos = !shape.isSummaryFlare ? centerY - 12 : centerY + 17;
            //create a group to hold the tooltip elements
            var tooltipGroup = shape.createGroup({ x: xPos, y: yPos });
            tooltipGroup.rawNode.setAttribute("class", "tooltip-text");
            var textShapes = [];
            for (var i = 0, len = lines.length; i < len; i++) {
                var textShape = tooltipGroup.createText({ x: xPos, y: yPos + (i * 10), text: lines[i], align: 'middle' })
                    .setFill("#000")
                    .setFont({ size: 8, family: this.layer.textSymbol.font.family, weight: this.layer.textSymbol.font.weight });
                textShapes.push(textShape);
                textShape.rawNode.setAttribute("pointer-events", "none");
            }
            var rectPadding = 2;
            var textBox = tooltipGroup.getBoundingBox();
            var rectShape = tooltipGroup.createRect({ x: textBox.x - rectPadding, y: textBox.y - rectPadding, width: textBox.width + (rectPadding * 2), height: textBox.height + (rectPadding * 2), r: 0 })
                .setFill([255, 255, 255, 0.9])
                .setStroke({ color: "#000", width: 0.5 });
            rectShape.rawNode.setAttribute("pointer-events", "none");
            //handle any view rotation
            if (this.view.rotation !== 0) {
                var m = gfx.matrix;
                var ttc = this.getShapeCenter(rectShape);
                rectShape.applyTransform(m.rotategAt(360 - this.view.rotation, ttc.x, ttc.y));
            }
            shape.moveToFront();
            for (var i = 0, len = textShapes.length; i < len; i++) {
                textShapes[i].moveToFront();
                //handle any view rotation
                if (this.view.rotation !== 0) {
                    var m = gfx.matrix;
                    var ttc = this.getShapeCenter(textShapes[i]);
                    textShapes[i].applyTransform(m.rotategAt(360 - this.view.rotation, ttc.x, ttc.y));
                }
            }
        };
        FlareClusterVectorGroup.prototype.destroyTooltip = function (e) {
            query(".tooltip-text", this.surface.rawNode).forEach(domConstruct.destroy);
        };
        FlareClusterVectorGroup.prototype.removeNodeFromDom = function (node) {
            var parent = node.parentNode || node.parentElement;
            if (parent)
                parent.removeChild(node);
        };
        FlareClusterVectorGroup.prototype.getClusterVectorByGraphicId = function (id) {
            for (var i = 0, len = this.clusterVectors.length; i < len; i++) {
                if (this.clusterVectors[i].graphic.id === id)
                    return this.clusterVectors[i];
            }
            return undefined;
        };
        FlareClusterVectorGroup.prototype.getClusterVectorFromGroupNode = function (groupNode) {
            for (var _i = 0, _a = this.clusterVectors; _i < _a.length; _i++) {
                var v = _a[_i];
                if (v.clusterGroup.rawNode === groupNode) {
                    return v;
                }
            }
        };
        FlareClusterVectorGroup.prototype.getShapeCenter = function (shape) {
            var bbox = shape.getBoundingBox();
            var x = bbox.x + bbox.width / 2;
            var y = bbox.y + bbox.height / 2;
            return { x: x, y: y };
        };
        //IE / Edge don't have the classList property on svg elements, so we can'tuse that add / remove classes - probably why dojo domClass doesn't work either.
        //so do the following two functions are dodgy string hacks to add / remove classes. Uses a timeout for any css transitions to work correctly.
        FlareClusterVectorGroup.prototype.addClassToNode = function (node, className, timeoutMs) {
            setTimeout(function () {
                node.setAttribute("class", node.getAttribute("class") + " " + className);
            }, timeoutMs);
        };
        FlareClusterVectorGroup.prototype.removeClassFromNode = function (node, className, timeoutMs) {
            var currentClass = node.getAttribute("class");
            if (!currentClass)
                return;
            setTimeout(function () {
                node.setAttribute("class", currentClass.replace(" " + className, ""));
            }, timeoutMs);
        };
        return FlareClusterVectorGroup;
    }(VectorGroup));
    var FlareClusterLayerExternalRenderer = (function () {
        function FlareClusterLayerExternalRenderer(layerView) {
            var _this = this;
            this.layerView = layerView;
            on.pausable(this.layerView.view.canvas, "mousemove", function (e) { return _this.mouseMove(e); });
            this.vectorGroup = new VectorGroup();
        }
        Object.defineProperty(FlareClusterLayerExternalRenderer.prototype, "loadedGraphics", {
            get: function () {
                return this.layerView.loadedGraphics;
            },
            enumerable: true,
            configurable: true
        });
        FlareClusterLayerExternalRenderer.prototype.setup = function (context) {
            this.parentDiv = this.layerView.view.canvas.parentElement || this.layerView.view.canvas.parentNode;
            this.surface = gfx.createSurface(this.parentDiv, "0", "0");
            domStyle.set(this.surface.rawNode, { position: "absolute", top: "0", zIndex: -1 });
            domAttr.set(this.surface.rawNode, "overflow", "visible");
            //init some props of the temp vector group to make
            this.vectorGroup.surface = this.surface;
            this.vectorGroup.view = this.layerView.view;
            this.vectorGroup.view.rotation = 0;
            this.vectorGroup.transform = [0, 0, 0, 0, 0, 0];
        };
        FlareClusterLayerExternalRenderer.prototype.render = function (context) {
            this.graphics = this.layerView.layerViewCore.graphicsCore.graphics;
            var layer = this.layerView.layer;
            //hide the area shapes and flare shapes by default
            for (var _i = 0, _a = this.loadedGraphics.items; _i < _a.length; _i++) {
                var g = _a[_i];
                if (g.attributes.isFlare || g.attributes.isFlareText) {
                    g.visible = false;
                }
                //hide the area unless it's set to always display
                if (g.attributes.isClusterArea && layer.clusterAreaDisplay !== "always") {
                    g.visible = false;
                }
            }
            if (this.activeCluster) {
                //if a cluster is active make and teh area grpahic shold be displayed then make it visible.
                if (this.activeCluster.areaGraphic && layer.clusterAreaDisplay === "activated") {
                    this.activeCluster.areaGraphic.visible = true;
                }
                externalRenderers.requestRender(this.layerView.view);
            }
        };
        FlareClusterLayerExternalRenderer.prototype.activateCluster = function (clusterGraphic) {
            if (this.activeCluster !== clusterGraphic) {
                this.deactivateCluster();
            }
            else {
                return;
            }
            if (!clusterGraphic)
                return;
            this.activeCluster = clusterGraphic;
            this.activeCluster.textGraphic = this.activeCluster.attributes.textGraphic;
            this.activeCluster.areaGraphic = this.activeCluster.attributes.areaGraphic;
            this.activeCluster.flareGraphics = this.activeCluster.attributes.flareGraphics;
            this.setupSurface(this.activeCluster);
            this.setupClusterGraphic(this.activeCluster);
            this.createFlares(this.activeCluster);
            externalRenderers.requestRender(this.layerView.view);
        };
        FlareClusterLayerExternalRenderer.prototype.setupClusterGraphic = function (clusterGraphic) {
            clusterGraphic.visible = false;
            clusterGraphic.textGraphic.visible = false;
            //we're going to replicate a cluster graphic in the svg element. Just so it can be styled easily. Again native WebGL would probably be better, but at least this way css can still be used to style/animate things.
            var sp = this.layerView.view.toScreen(clusterGraphic.geometry);
            var clusterSymbol = clusterGraphic.symbol;
            if (!clusterSymbol) {
                var layer = this.layerView.layer;
                var info = layer.renderer.getClassBreakInfo(clusterGraphic);
                clusterSymbol = info.symbol;
            }
            var clusterGroup = this.surface.createGroup();
            clusterGroup.rawNode.setAttribute("class", "cluster-group created");
            clusterGraphic.clusterGroup = clusterGroup;
            //Fake out creation of a dojo shape from graphic object using the temp vectorGroup _drawPoint function
            var webGeo = clusterGraphic.geometry.spatialReference.isWebMercator ? clusterGraphic.geometry : webMercatorUtils.geographicToWebMercator(clusterGraphic.geometry);
            var tempVector = {
                extent: clusterGraphic.geometry,
                geometry: clusterGraphic.geometry,
                graphic: clusterGraphic,
                symbol: clusterSymbol,
                projectedGeometry: webGeo
            };
            var clusterShape = this.vectorGroup._drawPoint(this.surface, webGeo, clusterSymbol, tempVector, [0]);
            clusterShape.setFill(clusterSymbol.color);
            clusterGroup.add(clusterShape);
            this.addClassToNode(clusterShape.rawNode, "cluster", 5);
            if (clusterSymbol.outline) {
                clusterShape.setStroke(clusterSymbol.outline.color);
            }
            var textSymbol = clusterGraphic.textGraphic.symbol;
            var textSize = textSymbol.font.size * 1.5;
            var text = clusterGroup.createText({ x: 0, y: textSymbol.font.size / 2, text: textSymbol.text, align: "middle" })
                .setFill(textSymbol.color)
                .setFont({ size: textSize, family: textSymbol.font.family, weight: textSymbol.font.weight });
            text.rawNode.setAttribute("pointer-events", "none");
            this.addClassToNode(text.rawNode, "cluster-text", 5);
            this.addClassToNode(clusterGroup.rawNode, "activated", 10);
        };
        FlareClusterLayerExternalRenderer.prototype.createFlares = function (clusterGraphic) {
            var _this = this;
            //flares can only be circles in a scene view for now.
            var sp = this.layerView.view.toScreen(clusterGraphic.geometry);
            var clusterGroup = clusterGraphic.clusterGroup;
            if (!clusterGroup) {
                clusterGroup = this.surface.createGroup();
            }
            var radius = 8;
            var buffer = 5;
            var clusterSymbol = clusterGraphic.symbol;
            if (!clusterSymbol) {
                var layer = this.layerView.layer;
                var info = layer.renderer.getClassBreakInfo(clusterGraphic);
                clusterSymbol = info.symbol;
            }
            var bbox = clusterGroup.getBoundingBox();
            var conCircleRadius = bbox.width / 1.5 + buffer + (radius * 2); //get the radius of the circle to contain everything
            var containerCircle = clusterGroup.createCircle({ cx: 0, cy: 0, r: conCircleRadius })
                .setFill([0, 0, 0, 0]);
            var flareGraphics = [];
            for (var i = 0, len = clusterGraphic.flareGraphics.length; i < len; i++) {
                if (clusterGraphic.flareGraphics[i].attributes.isFlare) {
                    flareGraphics.push(clusterGraphic.flareGraphics[i]);
                }
            }
            var flareCount = flareGraphics.length;
            //if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
            //for an add amount position the first flare on top, -90 to do this. Looks more symmetrical this way.
            var degreeVariance = (flareCount % 2 === 0) ? -180 : -90;
            //array to hold the animations for displaying flares
            var stAnims = [];
            for (var i = 0; i < flareCount; i++) {
                var flareGraphic = flareGraphics[i];
                //get the position of the flare to be placed around the container circle.
                var degree = parseInt(((360 / flareCount) * i).toFixed());
                degree = degree + degreeVariance;
                var radian = degree * (Math.PI / 180);
                //calc the center point of the flare
                var screenPoint = {
                    x: (conCircleRadius - radius - 5) * Math.cos(radian),
                    y: (conCircleRadius - radius - 5) * Math.sin(radian)
                };
                var layer = this.layerView.layer;
                //create a group to hold the flare and the text for the flare
                var flareGroup = clusterGroup.createGroup();
                var flareCircle = flareGroup.createCircle({ r: radius + 2, cx: screenPoint.x, cy: screenPoint.y })
                    .setFill(layer.flareSymbol.color);
                if (layer.flareSymbol.outline) {
                    flareCircle.setStroke({ width: layer.flareSymbol.outline.width, color: layer.flareSymbol.outline.color });
                }
                flareGroup.rawNode.setAttribute("class", "flare-group cluster-object");
                if (flareGraphic.attributes.flareTextGraphic) {
                    var textSize = layer.flareTextSymbol.font.size * 1.5;
                    //add a flare text graphic
                    var text = flareGroup.createText({ x: screenPoint.x, y: screenPoint.y + (textSize / 2) - 1, text: flareGraphic.attributes.flareTextGraphic.symbol.text, align: "middle" })
                        .setFill(layer.flareTextSymbol.color)
                        .setFont({ size: textSize, family: layer.flareTextSymbol.font.family, weight: layer.flareTextSymbol.font.weight });
                    text.rawNode.setAttribute("pointer-events", "none");
                }
                flareGroup.rawNode.setAttribute("data-tooltip", flareGraphic.attributes.tooltipText);
                flareGroup.rawNode.setAttribute("data-center-x", screenPoint.x);
                flareGroup.rawNode.setAttribute("data-center-y", screenPoint.y);
                flareGroup.isSummaryFlare = flareGraphic.attributes.isSummaryFlare;
                this.addClassToNode(flareGroup.rawNode, "activated", 10);
                flareGroup.mouseEnter = on.pausable(flareGroup.rawNode, "mouseenter", function (e) { return _this.createTooltip(e); });
                flareGroup.mouseLeave = on.pausable(flareGroup.rawNode, "mouseleave", function (e) { return _this.destroyTooltip(e); });
            }
        };
        FlareClusterLayerExternalRenderer.prototype.createTooltip = function (e) {
            var flareGroupNode = e.gfxTarget ? e.gfxTarget.rawNode : e.target;
            var shape = flareGroupNode.__gfxObject__;
            this.destroyTooltip(e);
            var tooltipLength = query(".tooltip-text", shape.rawNode).length;
            if (tooltipLength > 0) {
                return;
            }
            //get the text from the data-tooltip attribute of the shape object
            var text = shape.rawNode.getAttribute("data-tooltip");
            if (!text) {
                console.log("no data-tooltip attribute on element");
                return;
            }
            //split on /n character that should be in tooltip to signify multiple lines
            var lines = text.split("\n");
            //read the center positions from the shape, attributes must be set on whatever node is being passed in. Calculating from getboundingBox wasn't working for some reason
            var xPos = parseInt(shape.rawNode.getAttribute("data-center-x"));
            //align on top for normal flare, align on bottom for summary flares.
            var centerY = parseInt(shape.rawNode.getAttribute("data-center-y"));
            var yPos = !shape.isSummaryFlare ? centerY - 12 : centerY + 17;
            //create a group to hold the tooltip elements
            var tooltipGroup = shape.createGroup({ x: xPos, y: yPos });
            tooltipGroup.rawNode.setAttribute("class", "tooltip-text");
            var textShapes = [];
            for (var i = 0, len = lines.length; i < len; i++) {
                var textShape = tooltipGroup.createText({ x: xPos, y: yPos + (i * 10), text: lines[i], align: 'middle' })
                    .setFill("#000")
                    .setFont({ size: 10, family: this.layerView.layer.textSymbol.font.family, weight: this.layerView.layer.textSymbol.font.weight });
                textShapes.push(textShape);
                textShape.rawNode.setAttribute("pointer-events", "none");
            }
            var rectPadding = 2;
            var textBox = tooltipGroup.getBoundingBox();
            var rectShape = tooltipGroup.createRect({ x: textBox.x - rectPadding, y: textBox.y - rectPadding, width: textBox.width + (rectPadding * 2), height: textBox.height + (rectPadding * 2), r: 0 })
                .setFill([255, 255, 255, 0.9])
                .setStroke({ color: "#000", width: 0.5 });
            rectShape.rawNode.setAttribute("pointer-events", "none");
            shape.moveToFront();
            for (var i = 0, len = textShapes.length; i < len; i++) {
                textShapes[i].moveToFront();
            }
        };
        FlareClusterLayerExternalRenderer.prototype.destroyTooltip = function (e) {
            query(".tooltip-text", this.surface.rawNode).forEach(domConstruct.destroy);
        };
        FlareClusterLayerExternalRenderer.prototype.deactivateCluster = function () {
            if (!this.activeCluster)
                return;
            this.activeCluster.visible = true;
            this.activeCluster.textGraphic.visible = true;
            if (this.activeCluster.attributes.areaGraphic) {
                this.activeCluster.attributes.areaGraphic.visible = false;
            }
            this.clearSurface();
            this.clusterDeactivatingId = this.activeCluster.id;
            this.activeCluster = null;
            externalRenderers.requestRender(this.layerView.view);
        };
        //svg hack to get flares and cluszter grpahic to show and be css animation friendly.
        FlareClusterLayerExternalRenderer.prototype.setupSurface = function (activeCluster) {
            var sp = this.layerView.view.toScreen(activeCluster.geometry);
            domStyle.set(this.surface.rawNode, { zIndex: 1, overflow: "visible", width: "1px", height: "1px", left: sp.x + "px", top: sp.y + "px" });
        };
        FlareClusterLayerExternalRenderer.prototype.clearSurface = function () {
            query(">", this.surface.rawNode).forEach(domConstruct.destroy);
            domStyle.set(this.surface.rawNode, { zIndex: -1 });
        };
        FlareClusterLayerExternalRenderer.prototype.mouseMove = function (e) {
            var _this = this;
            var mousePos = this.getMousePos(e);
            this.layerView.view.hitTest(mousePos).then(function (response) {
                var graphics = response.results;
                if (graphics.length == 0) {
                    _this.deactivateCluster();
                    return;
                }
                var graphicHit = false;
                graphics.forEach(function (r) {
                    if (r.graphic) {
                        if (r.graphic.attributes.isCluster || r.graphic.attributes.isClusterText) {
                            var cluster = r.graphic;
                            if (cluster.attributes.isClusterText) {
                                //get the cluster graphic from the text 
                                for (var i = 0, len = _this.loadedGraphics.length; i < len; i++) {
                                    if (!_this.loadedGraphics.items[i].attributes.isCluster)
                                        continue;
                                    if (_this.loadedGraphics.items[i].attributes.textGraphic === cluster) {
                                        cluster = _this.loadedGraphics[i];
                                        break;
                                    }
                                }
                            }
                            _this.activateCluster(cluster);
                        }
                        graphicHit = true;
                        return;
                    }
                });
                if (!graphicHit) {
                    _this.deactivateCluster();
                }
            });
        };
        FlareClusterLayerExternalRenderer.prototype.getMousePos = function (e) {
            var rect = this.layerView.view.canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };
        //IE / Edge don't have the classList property on svg elements, so we can'tuse that add / remove classes - probably why dojo domClass doesn't work either.
        //so do the following two functions are dodgy string hacks to add / remove classes. Uses a timeout for any css transitions to work correctly.
        FlareClusterLayerExternalRenderer.prototype.addClassToNode = function (node, className, timeoutMs) {
            setTimeout(function () {
                node.setAttribute("class", node.getAttribute("class") + " " + className);
            }, timeoutMs);
        };
        FlareClusterLayerExternalRenderer.prototype.removeClassFromNode = function (node, className, timeoutMs) {
            var currentClass = node.getAttribute("class");
            if (!currentClass)
                return;
            setTimeout(function () {
                node.setAttribute("class", currentClass.replace(" " + className, ""));
            }, timeoutMs);
        };
        return FlareClusterLayerExternalRenderer;
    }());
    exports.FlareClusterLayerExternalRenderer = FlareClusterLayerExternalRenderer;
});
