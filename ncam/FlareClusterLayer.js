define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "esri/Color",
  "dojo/on",
  "dojo/fx",
  "dojox/gfx",
  "dojox/gfx/fx",
  "dojox/gesture/tap",
 
  "esri/SpatialReference",
  "esri/geometry/Point",
  "esri/graphic",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleFillSymbol",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/TextSymbol",
  "esri/renderers/ClassBreaksRenderer",

  "esri/dijit/PopupTemplate",
  "esri/layers/GraphicsLayer"
], function (
  declare, lang, arrayUtils, Color, on, coreFx, gfx, fx, tap,
  SpatialReference, Point, Graphic, SimpleMarkerSymbol, SimpleFillSymbol, SimpleLineSymbol, TextSymbol,
  ClassBreaksRenderer, PopupTemplate, GraphicsLayer
) {
    return declare([GraphicsLayer], {
        constructor: function (options) {
            /* options description:
              spatialReference: default 102100. A SpatialReference object using the wkid of that data.
              preClustered (boolean) : default false. Whether the data is pre-clustered or not. If true the addPreClusteredData method should be used to add data. 
                                        If false use addData method and clusters will be calculated within the layer.
              clusterTolerance (boolean): default 80. When not pre clustered this is the pixel tolerance to apply when checking if a point should be added to a cluster.
              reclusterOnPan (boolean): default false. When true will force a recluster to happen on every pan as well as zoom. When drilling down if there's a large amount of data and this is false 
                                         performance suffers as the amount of graphics not in the viewport becomes large. This enforces current extent checking when doing the clustering.
              displaySubTypeFlares (boolean): default false. Whether to dipslay flares for sub types (ie the count of a property). If this is true, then subTypeFlareProperty must also be set
              subTypeFlareProperty (string): default null. If specified and displaySubTypeFlares is true, layer will display flares that contain a count of the objects that have the same value for the configured property.
              flareColor (dojo.Color) : default new Color([0, 0, 0, 0.5]). The color for flares.
              maxFlareCount (number): default 8. The max number of flares to display. If this is too high they may overlap, depends on the size of the cluster symbols.
              displaySingleFlaresAtCount (number): default 8. If a cluster contains this count or less it will display flare that represent single objects. If it contains greater than this count it will display sub type flares if they have been configured to be displayed.
              singleFlareTooltipProperty (string): default null. Property name to get the values for display in a single point flares tooltips.
              textSymbol (esri.symbol.TextSymbol): default set below. The text symbol to use in clusters
              flareShowMode (string): default 'mouse'. Must be 'mouse' or 'tap'. On a mouse enabled device whether to show the flares on mouse enter and hide on mouse leave, or on tap / click. Devices with no mouse will behave like 'tap' anyway.
              clusteringBegin (function): default null. A basic callback function that get's fired when clustering is beginning. 
              clusteringComplete (function): default null. A basic callback function that get's fired when clustering is complete.  
            */

            //set options from constructor parameter or set defaults
            options = options || {};
            this.spatialRef = options.spatialReference || new SpatialReference({ "wkid": 102100 });
            this.preClustered = options.preClustered === true; //whether the data has already been clustered (ie: server side), defaults false
            this.clusterTolerance = options.clusterTolerance || 80; //when client side clustering this is the tolerance to apply to pixels to see if a point should be clustered.
            this.reclusterOnPan = options.reclusterOnPan === true; //Default false. When client side clustering this will force a recluster to happen on every pan as well as zoom. Wehn drilling down if there's a large amount of data performance suffers as the amount of graphics not in the viewport becomes large.

            this.displaySubTypeFlares = options.displaySubTypeFlares === true; //whether to dipslay flares for sub types. If this is true, then subTypeFlareProperty must also be set
            this.subTypeFlareProperty = options.subTypeFlareProperty || null; //if specified will display flares for a count of sub types property

            this.flareColor = options.flareColor || new Color([0, 0, 0, 0.5]); //default flare color.
            this.maxFlareCount = options.maxFlareCount || 8; //the max number of flares to display. If this it too high they may overlap, depends on the size of the cluster symbols.
            this.displaySingleFlaresAtCount = options.displaySingleFlaresAtCount || 8; //if a cluster contains this count or less it will display flare that represent single objects. If it contians greater than this count it will display sub type flares if they have been configured to be displayed.
            this.singleFlareTooltipProperty = options.singleFlareTooltipProperty || null; //property name to get the values for displaying in single point flares tooltips.
            var defaultTextSymbol = new TextSymbol()
                           .setColor(new dojo.Color([255, 255, 255]))
                           .setAlign(esri.symbol.Font.ALIGN_START)
                           .setFont(new esri.symbol.Font("10pt").setWeight(esri.symbol.Font.WEIGHT_BOLD).setFamily("calibri"))
                           .setVerticalAlignment("middle");
            this.textSymbol = options.textSymbol || defaultTextSymbol;
            this.flareShowMode = options.flareShowMode || "mouse"; //on a mouse enabled device whether to show the flares on mouse enter and hide on mouse leave, or on tap / click. Can either be "mouse", or "tap". Devices with no mouse will always use tap.

            //a couple of callbacks - could make them into events on the layer, and/or have the clustering return deferreds. 
            this.clusteringBegin = options.clusteringBegin; //a basic callback function that get's fired when clustering is beginning.
            this.clusteringComplete = options.clusteringComplete; //a basic callback function that get's fired when clustering is complete.

            if (this.flareShowMode !== "mouse" && this.flareShowMode !== "tap") {
                console.error("flareShowMode option can only be 'mouse' or 'tap'");
                return;
            }

            //init some stuff
            this.animationMultipleType = {
                combine: "combine",
                chain: "chain"
            }

            this.events = [];
            this.graphicEvents = [];
            this.animationsRunning = [];
            this.clusters = [];
            this.singles = [];

        },


        //#region override some GraphicsLayer methods 
        _setMap: function (map, surface) {

            this.map = map;
            this.surface = surface;
            
            this.events.push(on(this.map, "resize", lang.hitch(this, this._mapResize)));
    
            if (this.reclusterOnPan) {
                //add pan events to limit to recluster on each pan aif configured.
                this.events.push(on(this.map, "pan-start", lang.hitch(this, this.clear)));
                this.events.push(on(this.map, "pan-end", lang.hitch(this, this._clusterData)));
            }

            this.events.push(on(this.map, "zoom-start", lang.hitch(this, this.clear)));
            this.events.push(on(this.map, "zoom-end", lang.hitch(this, this._clusterData)));
              
            //Handle click event at the map level
            this.events.push(on(this.map, "click", lang.hitch(this, this._mapClick)));
            
            this.events.push(on(this.map.infoWindow, "show", lang.hitch(this, this._infoWindowShow)));
            this.events.push(on(this.map.infoWindow, "hide", lang.hitch(this, this._infoWindowHide)));
  
            this.events.push(on(this, "graphic-draw", this._graphicDraw));
            this.events.push(on(this, "graphic-node-remove", this._graphicNodeRemove));

            this.events.push(on(this, "mouse-over", this._graphicMouseOver));
            this.events.push(on(this, "mouse-out", this._graphicMouseOut));
           
            return this.inherited(arguments);
        },


        _unsetMap: function () {
            this.inherited(arguments);
            //remove events
            for (var i = 0, len = this.events.length; i < len; i++) {
                if (this.events[i]) {
                    this.events[i].remove();
                }
            }

            for (var i = 0, len = this.graphicEvents.length; i < len; i++) {
                if (this.graphicEvents[i]) {
                    this.graphicEvents[i].remove();
                }
            }
        },

        onClick: function (evt) {
            
            this._restoreInfoWindowSettings();

            if (evt.graphic.attributes.isCluster) {
                evt.stopPropagation();
                this._activateCluster(evt.graphic);
                this.map.infoWindow.hide();
            }
            else if (evt.graphic.attributes.isFlare) {
                evt.stopPropagation();

                var flareObject = this._getFlareFromGraphic(evt.graphic);
                if (!flareObject) {
                    this._hideFlareDetail();
                    this.map.infoWindow.hide();
                    return;
                }

                if (flareObject.isSummaryFlare || !flareObject.singleData) {
                    this._showFlareDetail(evt.graphic);
                    this.map.infoWindow.hide();
                    return;
                }

                //if we're clicking on a single data flare then show an info window
                var graphic = evt.graphic;
                
                this.originalInfoWindow = {
                    highlight: lang.clone(this.map.infoWindow.get("highlight")),
                    anchor: lang.clone(this.map.infoWindow.anchor)
                };

                this.map.infoWindow.hide();
                this.map.infoWindow.clearFeatures();
                this.map.infoWindow.set("highlight", false);
                this.map.infoWindow.setFeatures([graphic]);

                //when getting screen point make sure we use the location of the flare on screen, by converting the map point on the object.
                var sp = this.map.toScreen({x: flareObject.mapPoint.x, y: flareObject.mapPoint.y });
                
                //Could do something with the anchor of the info window here if wanted. The offsets can be a bit wacky as well.
                //var anchor = this._getInfoWindowAnchor(flareObject.degree);
                //this.map.infoWindow.anchor = anchor;

                this.map.infoWindow.cluster = this.activeCluster;

                //reset the geometry of the flare feature in the info window to be the actual location of the flared object, not the location of the flare graphic.
                var p = esri.geometry.geographicToWebMercator(new Point(flareObject.singleData.x, flareObject.singleData.y, this.spatialRef));
                this.map.infoWindow.features[0].geometry = p;
                this.map.infoWindow.show(sp);
                
            }

        },

        //Add a data point to be clustered.
        //Each object passed in must contain an x and y property. 
        //Data should also contain whatever property is set in singleFlareTooltipProperty, so the flare tooltip has something to display for summary flares if needed
        add: function (p) {

            // if passed a graphic, just use the base GraphicsLayer's add method
            if (p.declaredClass) {
                this.inherited(arguments);
                return;
            }

            //if we got here, then we're adding a single object
            //NOTE: Use this sparingly - better to use addData (or even better addPreClusteredData). 
            //If using add() to add a large amount of objects (eg: in a long loop), clusters and their elements will be removed and recreated when changes are applied to them,this can be expensive
            //If you use addData and pass in an array clusters will only be created in the DOM once they have been fully calculated

            //get an extent that is in web mercator to make sure it's flat for extent checking
            var projExtent = esri.geometry.project(map.extent, new SpatialReference({ "wkid": 102100 }));
            var resolution = projExtent.getWidth() / map.width;


            var obj = p;
            this.allData.push(obj);
            var addedToResult = this._addPointToCluster(obj, this.clusters, projExtent, resolution, this.clusterTolerance);
            if (!addedToResult) {
                return; //result was null so point wasn't checked, just return
            }

            var cl = addedToResult.addedTo;
            if (cl) {
                //obj was added to this cluster, recreate the cluster
                this._removeCluster(cl);
                this._createCluster(cl);
            }
            else {
                var addedToCluster = false;
                //didn't find a cluster to add to so check against singles that may exist
                var webPoint = esri.geometry.geographicToWebMercator(new Point(obj.x, obj.y, this.spatialRef));
                for (var i = 0, len = this.singles.length; i < len; i++) {
                    var sin = this.singles[i];
                    var sinWebPoint = esri.geometry.geographicToWebMercator(new Point(sin.x, sin.y, this.spatialRef));

                    if (this._isInClusterRange(webPoint, sinWebPoint, resolution, this.clusterTolerance)) {

                        //create a new cluster with these two points
                        var subTypeCounts;
                        if (this.displaySubTypeFlares && this.subTypeFlareProperty && obj.hasOwnProperty(this.subTypeFlareProperty)) {
                            if (sin[this.subTypeFlareProperty] === obj[this.subTypeFlareProperty]) {
                                subTypeCounts = [{ name: obj[this.subTypeFlareProperty], count: 2 }];
                            }
                            else {
                                subTypeCounts = [{ name: obj[this.subTypeFlareProperty], count: 1 }, { name: sin[this.subTypeFlareProperty], count: 1 }];
                            }
                        }

                        var cl = {
                            clusterCount: 2,
                            x: (obj.x + sin.x) / 2,
                            y: (obj.y + sin.y) / 2,
                            subTypeCounts: subTypeCounts
                        };

                        //remove from singles list and singles from graphics list
                        this.remove(sin.graphic);
                        this.singles.splice(i, 1);
                        delete sin.graphic;

                        cl.singles = [lang.clone(sin), lang.clone(obj)];

                        //create the new cluster
                        this._createCluster(cl);
                        addedToCluster = true;
                        break;
                    }
                }

                if (!addedToCluster) {
                    //didn't find a cluster to add to at all so add a single
                    this._createSingle(obj);
                }
            }
        },


        clear: function () {
            // Summary:  Remove all clusters and data points.

            this.inherited(arguments);

            this.activeCluster = null;
            this.activeFlareObject = null;

            //stop any animations that may still be running while clearing graphics
            this._stopAnimations();

            //remove all created cluster group elements
            var node = this.getNode();
            dojo.query("g.cluster-group", node).forEach(dojo.destroy);

            //clear any graphic events
            for (var i = 0, len = this.graphicEvents.length; i < len; i++) {
                if (this.graphicEvents[i]) {
                    this.graphicEvents[i].remove();
                }
            }

            this.map.infoWindow.hide();
            this.map.infoWindow.clearFeatures();

            this.clusters = [];
            this.singles = [];
        },

       

        //#endregion

        //#region other event handlers

        _mapResize: function() {
            //destroy any orphaned cluster group nodes
            dojo.query("g.cluster-group:empty", this.getNode()).forEach(dojo.destroy);
        },

        _mapClick: function(e) {
            if (!e.target) {
                return;
            }

            var targetClass = e.target.getAttribute("class");
            if (!targetClass || targetClass.indexOf("cluster-object") === -1) {
                //if this was not a cluster object at all then clear any active one and return
                this._clearActiveCluster();
            }
            else if (targetClass.indexOf("cluster-object") !== -1) {
                //if click reached map click event and it is a cluster object, make sure an info window doesn't display for the cluster graphic
                if (this.map.infoWindow.cluster) {
                    this._restoreInfoWindowSettings();
                }
                this.map.infoWindow.hide();
            }
        },

        _graphicDraw: function(e){
            var g = e.graphic;
            if (g.attributes.isCluster) {
                //create the cluster graphics if this is a cluster being drawn
                var cl = this._getClusterFromGraphic(g);
                this._createClusterGraphic(cl);
                if (this.activeCluster === cl) {
                    this._clearActiveCluster();
                }
            }

        },

        _graphicNodeRemove: function (e) {
            var g = e.graphic;
            if (g.attributes.isCluster) {
                //remove any group graphics related to this cluster as they'll be recreated when the node is redrawn.
                var cl = this._getClusterFromGraphic(g);
                if (cl) {
                    dojo.destroy(cl.groupShape.rawNode);
                }
            }
        },

        _graphicMouseOver: function(e) {
            if (e.graphic.attributes.isCluster) {
                this._activateCluster(e.graphic);
            }
            else if (e.graphic.attributes.isFlare) {
                this._showFlareDetail(e.graphic);
            }
        },

        _graphicMouseOut: function (e) {
            if (e.graphic.attributes.isFlare) {
                this._hideFlareDetail();
            }
        },


        _infoWindowShow: function(e) {
            for (var i = 0; i < this.map.infoWindow.features.length; i++) {
                if (this.map.infoWindow.features[i].attributes.isCluster) {
                    this.map.infoWindow.hide(); //if a cluster never show an info window
                    return;
                }
            }
        },

        _infoWindowHide: function(e) {
            this.map.infoWindow.cluster = null;
        },

        
        //#endregion



        //#region extra public methods

        addPreClusteredData: function (data) {
            /*
                Add data that is preclustered - (ie clustered server side).
                Data is an array, clusters must contain an x and y property as well as a clusterCount property. subTypeCounts is optional. 
                Clusters that have a count less than the this.displaySingleFlaresAtCount option must all contain the data for the single points in an array called singles
               Singles should also be in the array, they only need to contain an x and y property. Singles should also contain whatever property is set in singleFlareTooltipProperty, so the flare tooltip has something to display for summary flares if needed
            */

            if (this.clusteringBegin) {
                this.clusteringBegin();
            }

            this.allData = [];
            this.preClustered = true; //if we're adding preclustered data, force this flag to true
            for (var i = 0, len = data.length; i < len; i++) {
                if (data[i].clusterCount) {
                    //this is a cluster as it contains clusterCount
                    var cl = data[i];
                    this._createCluster(cl);
                }
                else {
                    this._createSingle(data[i]);
                }
            }

            if (this.clusteringComplete) {
                this.clusteringComplete();
            }
        },


        addData: function (data) {
            /*
                Add data to be clustered.
                Data is an array of objects. Each object passed in must contain an x and y property. 
                Data should also contain whatever property is set in singleFlareTooltipProperty if one is set, so the flare tooltip has something to display for summary flares if needed
                This will also clear all data first. add() can be used to add single objects at any time.
            */
            this.allData = data;
            this._clusterData();
        },


        //#endregion


        //#region internal stuff

        _restoreInfoWindowSettings: function(){
            if (this.originalInfoWindow) {
                this.map.infoWindow.set("highlight", this.originalInfoWindow.highlight);
                this.map.infoWindow.anchor = this.originalInfoWindow.anchor;
            }
        },

       
        _clusterData: function () {

            //this function currently only applies if not using preclustered data
            if (this.preClustered) {
                return;
            }

            if (this.clusteringBegin) {
                this.clusteringBegin();
            }

            //get an extent that is in web mercator to make sure it's flat for extent checking
            var projExtent = esri.geometry.project(map.extent, new SpatialReference({ "wkid": 102100 }));
            var resolution = projExtent.getWidth() / map.width;

            var tempClusters = [];
            for (var i = 0, len = this.allData.length; i < len; i++) {

                var obj = this.allData[i];
               
                var addedToResult = this._addPointToCluster(obj, tempClusters, projExtent, resolution, this.clusterTolerance);
                if (!addedToResult) {
                    continue; //result was null so point wasn't checked, just continue
                }


                //didn't find a cluster to add to, create a cluster with a single point
                if (!addedToResult.addedTo) {
                 
                    var subTypeCounts;
                    if (this.displaySubTypeFlares && this.subTypeFlareProperty && obj.hasOwnProperty(this.subTypeFlareProperty)) {
                        subTypeCounts = [{ name: obj[this.subTypeFlareProperty], count: 1 }];
                    }

                    var clWebPoint = esri.geometry.geographicToWebMercator(new Point(obj.x, obj.y, this.spatialRef));
                    var cl = {
                        clusterCount: 1,
                        singles: [lang.clone(obj)],
                        x: obj.x,
                        y: obj.y,
                        subTypeCounts: subTypeCounts,
                        webPoint: clWebPoint
                    };
                    tempClusters.push(cl);
                }
            }

            //now loop the temp clusters and work out singles from actual clusters and create the graphics
            for (var i = 0, len = tempClusters.length; i < len; i++) {
                if (tempClusters[i].clusterCount === 1) {
                    this._createSingle(tempClusters[i].singles[0]);
                }
                else {
                    this._createCluster(tempClusters[i]);
                }
            }

            if (this.clusteringComplete) {
                this.clusteringComplete();
            }

        },


        _isInClusterRange: function (point, cluster, resolution, tolerance) {
            //check if the point is in range of the cluster. Formula taken from esri cluster layer: https://developers.arcgis.com/javascript/jssamples/layers_point_clustering.html
            var distance = (
              Math.sqrt(Math.pow((cluster.x - point.x), 2) + Math.pow((cluster.y - point.y), 2)) / resolution
            );
            return (distance <= tolerance);
        },


        _addPointToCluster: function (obj, clusters, projExtent, resolution, tolerance) {

            if (!obj.x || !obj.y) {
                return null; //no x and y so can't add this object
            }

            //only check if in the current extent - this is for performance reasons for large data set, may not be needed
            var webPoint = esri.geometry.geographicToWebMercator(new Point(obj.x, obj.y, this.spatialRef));
            if (this.reclusterOnPan) {
                if (webPoint.x < projExtent.xmin || webPoint.x > projExtent.xmax || webPoint.y < projExtent.ymin || webPoint.y > projExtent.ymax) {
                    return null; //not in the current extent so continue
                }
            }

            //check this point against the existing clusters to see if it should be added to one
            for (var j = 0, jLen = clusters.length; j < jLen; j++) {
                var cl = clusters[j];
                if (this._isInClusterRange(webPoint, cl.webPoint, resolution, tolerance)) {
                    //recalc the x and y of the cluster by averaging the points
                    cl.x = (obj.x + (cl.x * cl.clusterCount)) / (cl.clusterCount + 1);
                    cl.y = (obj.y + (cl.y * cl.clusterCount)) / (cl.clusterCount + 1);

                    cl.webPoint = esri.geometry.geographicToWebMercator(new Point(cl.x, cl.y, this.spatialRef));
                    cl.clusterCount++;

                    //add sub type count to the array in the cluster object if they have been configured
                    if (this.displaySubTypeFlares && this.subTypeFlareProperty && obj.hasOwnProperty(this.subTypeFlareProperty)) {
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
                    }

                    //add the singles data to the cluster if there's less than the configured amount to keep track of
                    if (cl.singles.length + 1 <= this.displaySingleFlaresAtCount) {
                        cl.singles.push(lang.clone(obj));
                    }
                    else {
                        cl.singles = [];
                    }

                    return { addedTo: cl };
                }
            }

            return { addedTo: null };
        },

        _createSingle: function (single) {
            this.singles.push(single);
            delete single.graphic;
            var point = new Point(single.x, single.y, this.spatialRef);
            var attributes = lang.clone(single);
            var graphic = new Graphic(point, null, attributes, null);
            single.graphic = graphic;
            this.add(graphic);
        },

        _createCluster: function (cluster) {

            this.clusters.push(cluster);

            //add the graphic using the Graphics Layer add
            var point = new Point(cluster.x, cluster.y, this.spatialRef);

            //clear some props as we may be recreating the cluster
            delete cluster.graphic;
            delete cluster.graphicShape;
            delete cluster.groupShape;

            var attributes = {
                isCluster: true,
                x: cluster.x,
                y: cluster.y,
                clusterCount: cluster.clusterCount
            }

            var graphic = new Graphic(point, null, attributes, null);
            cluster.graphic = graphic;
            this.add(graphic);

        },

        _createClusterGraphic: function (cluster) {

            if (cluster.groupShape) {
                dojo.destroy(cluster.groupShape.rawNode);
            }

            //create a group element to hold the cluster and text and other things
            var groupShape = this.surface.createGroup();

            //Note: dojo.addClass() doesn't seem to work on svg elements, that's why all the setAttributes for each shape.
            groupShape.rawNode.setAttribute("class", "cluster-group cluster-object"); 
            cluster.groupShape = groupShape;

            //append the group to this layer's node
            var layerNode = this.getNode();
            layerNode.appendChild(groupShape.rawNode);
            
            var gShape = cluster.graphic.getShape();
            if (!gShape) {
                return; //couldn't get the graphic shape that was just added, it's probably not visible on the map
            }

            cluster.graphicShape = gShape;
            cluster.graphicShape.rawNode.setAttribute("class", "cluster-object");
            groupShape.add(cluster.graphicShape);

            //add a text element for the label to display the count and add to the group
            var shapeCenter = this._getShapeCenter(cluster.graphicShape);
            var textShape = groupShape.createText({ x: shapeCenter.x, y: shapeCenter.y + (this.textSymbol.font.size / 2 - 2), text: cluster.clusterCount, align: 'middle' })
                            .setFont({ size: this.textSymbol.font.size, family: this.textSymbol.font.family, weight: this.textSymbol.font.weight })
                            .setFill(this.textSymbol.color);
            textShape.rawNode.setAttribute("pointer-events", "none"); //remove pointer events from text
            groupShape.add(textShape);
            
            var self = this;
            //animate drawing of the cluster. 
            var create = fx.animateTransform({
                duration: 200,
                shape: groupShape,
                transform: [
                    { name: "scaleAt", start: [0, 0, shapeCenter.x, shapeCenter.y], end: [1, 1, shapeCenter.x, shapeCenter.y] }
                ],
                onEnd: dojo.partial(this._animationEnd, this)
            });

            this._playAnimations([create], this.animationMultipleType.combine);
            
            //add events
            if (this.flareShowMode === "mouse") {
                this.graphicEvents.push(on(groupShape, "mouseleave", lang.hitch(this, this._clearActiveCluster)));
            }

        },
           
        
        _activateCluster: function (graphic) {
            
            var cluster = this._getClusterFromGraphic(graphic);
            if (!cluster) {  
                return;
            }

            if (this.activeCluster) {
                this._clearActiveCluster();
            }

            this.activeCluster = cluster;

            var groupShape = cluster.groupShape;
            var graphicShape = cluster.graphicShape;
            groupShape.moveToFront();

            var center = this._getShapeCenter(graphicShape);
            var scaleUp = fx.animateTransform({
                duration: 400,
                shape: groupShape,
                transform: [
                    { name: "scaleAt", start: [1, 1, center.x, center.y], end: [1.3, 1.3, center.x, center.y] }
                ],
                onEnd: dojo.partial(this._animationEnd, this)
            });

            this._playAnimations([scaleUp], this.animationMultipleType.combine);
            
            //Add applicable flare graphics

            //array to hold the flare object data
            this.flareObjects = [];

            //check if we need to create flares for the cluster
            var singleFlares = (cluster.singles && cluster.singles.length > 0) && (cluster.clusterCount <= this.displaySingleFlaresAtCount);
            var subTypeFlares = !singleFlares && (this.displaySubTypeFlares && this.subTypeFlareProperty && (cluster.subTypeCounts && cluster.subTypeCounts.length > 0));
            
            if (!singleFlares && !subTypeFlares) {
                return;
            }

            //create and add a graphic to represent the flare circle
            var bbox = graphicShape.getBoundingBox();
            var radius = 8;
            var buffer = 4;

            var flareSymbol = new SimpleMarkerSymbol()
                                .setStyle(SimpleMarkerSymbol.STYLE_CIRCLE)
                                .setSize(radius * 2);

            //create a transparent circle that contains the boundary of the flares, this is to make sure the mouse events don't fire moving in between flares
            var conCircleRadius = (center.x - (bbox.x - radius - buffer)) + radius; //get the radius of the circle to contain everything
            var containerCircle = groupShape.createCircle({ cx: center.x, cy: center.y, r: conCircleRadius })
                                                //.setStroke({ width: 1, color: "000" })
                                                .setFill(new Color([0, 0, 0, 0]));
            containerCircle.rawNode.setAttribute("class", "flare-object cluster-object");

            //array to hold the animations for displaying flares
            var stAnims = [];

            if (singleFlares) {
                for (var i = 0, len = cluster.singles.length; i < len; i++) {
                    delete cluster.singles[i].graphic;
                    this.flareObjects.push({
                        tooltipText: cluster.singles[i][this.singleFlareTooltipProperty],
                        flareText: "",
                        color: this.flareColor,
                        singleData: cluster.singles[i],
                        strokeWidth: 2
                    });
                }
            }
            else if (subTypeFlares) {

                //sort sub types by highest count first
                var subTypes = cluster.subTypeCounts.sort(function (a, b) {
                    return b.count - a.count;
                });

                for (var i = 0, len = subTypes.length; i < len; i++) {
                    this.flareObjects.push({
                        tooltipText: subTypes[i].count + " - " + subTypes[i].name,
                        flareText: subTypes[i].count,
                        color: this.flareColor,
                        strokeWidth: 1
                    });
                }
            }

            //if there are more flare objects to create that the maxFlareCount and this is a one of those - create a summary flare that contains '...' as the text and make this one part of it 
            var willContainSummaryFlare = this.flareObjects.length > this.maxFlareCount;
            var flareCount = willContainSummaryFlare ? this.maxFlareCount : this.flareObjects.length;

            //if there's an even amount of flares, position the first flare to the left, minus 180 from degree to do this.
            //for an add amount position the first flare on top, -90 to do this. Looks more symmetrical this way.
            var degreeVariance = (flareCount % 2 === 0) ? -180 : -90;
            for (var i = 0, len = flareCount; i < len; i++) {

                //exit if we've hit the maxFlareCount - a summary would have been created on the last one
                if (i >= this.maxFlareCount) {
                    break;
                }

                var fo = this.flareObjects[i];

                //Do a couple of things differently if this is a summary flare or not
                var tooltipText = "";                
                var isSummaryFlare = willContainSummaryFlare && i >= this.maxFlareCount - 1;
                if (isSummaryFlare) {
                    fo.color = this.flareColor;
                    fo.isSummaryFlare = true;

                    //multiline tooltip for summary flares, ie: greater than this.maxFlareCount flares per cluster
                    for (var j = this.maxFlareCount - 1, jlen = this.flareObjects.length; j < jlen; j++) {
                        tooltipText += j > (this.maxFlareCount - 1) ? "\n" : "";
                        tooltipText += this.flareObjects[j].tooltipText;
                    }
                }
                else {
                    tooltipText = fo.tooltipText;
                }

                //get the position of the flare to be placed around the container circle.
                var degree = parseInt(((360 / len) * i).toFixed());
                degree = degree + degreeVariance;
             
                var radian = degree * (Math.PI / 180);
                fo.degree = degree;
                fo.radius = radius;
                fo.center = {
                    x: center.x + (conCircleRadius - radius) * Math.cos(radian),
                    y: center.y + (conCircleRadius - radius) * Math.sin(radian)
                };
              
                //create a group to hold the flare objects
                var flareGroup = groupShape.createGroup();

                //add a graphic for the flare
                var sym = lang.clone(flareSymbol);
                sym.setColor(fo.color).setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, this.textSymbol.color, fo.strokeWidth));
            
                //get the map point from the flare group center
                var matrix = flareGroup.rawNode.getScreenCTM();
                var pt = this.surface.rawNode.createSVGPoint();
                pt.x = fo.center.x;
                pt.y = fo.center.y;
                var screenPoint = pt.matrixTransform(matrix);
                var sp = new esri.geometry.ScreenPoint(screenPoint.x, screenPoint.y);
                fo.mapPoint = this.map.toMap(sp);

                var attributes = fo.singleData ? lang.clone(fo.singleData) : {};
                attributes.isFlare = true;
                var flareGraphic = new Graphic(fo.mapPoint, sym, attributes, null);
                this.add(flareGraphic);
                var flareCircle = flareGraphic.getShape();
                flareGroup.rawNode.appendChild(flareCircle.rawNode);

                var flareText = flareGroup.createText({ x: fo.center.x, y: fo.center.y + (radius / 2 - 1), text: !isSummaryFlare ? fo.flareText : "...", align: 'middle' })
                        .setFill(this.textSymbol.color)
                        .setFont({ size: !isSummaryFlare ? 7 : 10, family: this.textSymbol.font.family, weight: this.textSymbol.font.weight });
                flareText.rawNode.setAttribute("pointer-events", "none"); //remove pointer events from text
                flareGroup.setTransform({ xx: 0, yy: 0 });//scale to 0 to start with
                flareGroup.rawNode.setAttribute("class", "flare-object cluster-object");
                flareCircle.rawNode.setAttribute("class", "flare-graphic cluster-object");
                flareGroup.rawNode.setAttribute("data-tooltip", tooltipText);

                //add an animation to display the flare
                var anim = fx.animateTransform({
                    duration: 50,
                    shape: flareGroup,
                    transform: [
                        { name: "scaleAt", start: [0, 0, fo.center.x, fo.center.y], end: [1, 1, fo.center.x, fo.center.y] }
                    ],
                    onEnd: dojo.partial(this._animationEnd, this)
                });

                stAnims.push(anim);

                flareGroup.rawNode.setAttribute("data-center-x", fo.center.x);
                flareGroup.rawNode.setAttribute("data-center-y", fo.center.y);
                fo.flareGroupShape = flareGroup;
            }

            this._playAnimations(stAnims, this.animationMultipleType.chain);
        },


        _showFlareDetail: function(graphic) {
            var flareObject = this._getFlareFromGraphic(graphic);
            
            if (this.activeFlareObject && flareObject !== this.activeFlareObject) {
                this._hideFlareDetail();
            }

            this.activeFlareObject = flareObject;
            this._createTooltip(flareObject.flareGroupShape);
          
        },

        _getInfoWindowAnchor: function(degree) {
            //set the anchor based on the degree, so the cluster is not covered by the info window
            if (degree === -180) {
                return "left";
            }
            else if (degree > -10 && degree < 10) {
                return "right";
            }
            else if (degree > -260 && degree < -170) {
                return "left";
            }
            else if (degree <= -90) {
                return "top-left";
            }
            else if (degree > -90 && degree <= 0) {
                return "top-right";
            }
            else if (degree > 0 && degree <= 90) {
                return "bottom-right";
            }
            else {
                return "bottom-left";
            }
        },

        _hideFlareDetail: function () {

            if (!this.activeFlareObject) {
                return;
            }

            var flareObject = this.activeFlareObject;
            this._destroyTooltip(flareObject.flareGroupShape);
            this.activeFlareObject = null;

        },

        _clearActiveCluster: function (e) {
          
            if (!this.activeCluster) {
                return;
            }

            if (e) {
                var currentElement = e.toElement || e.relatedTarget;
                if (currentElement && (currentElement.parentElement === this.map.infoWindow.domNode || (currentElement.parentElement && currentElement.parentElement.parentElement === this.map.infoWindow.domNode))) {
                    return;
                }
            }

            if (this.map.infoWindow.cluster) {
                this.map.infoWindow.hide();
            }

            var cluster = this.activeCluster;
            this._hideFlareDetail();

            var groupShape = cluster.groupShape;
            var graphicShape = cluster.graphicShape;

            var center = this._getShapeCenter(graphicShape);
            
            var scaleDown = fx.animateTransform({
                duration: 400,
                shape: groupShape,
                transform: [
                    { name: "scaleAt", start: [1.3, 1.3, center.x, center.y], end: [1, 1, center.x, center.y] }
                ],
                onEnd: dojo.partial(this._animationEnd, this)
            });
            
            this._playAnimations([scaleDown], this.animationMultipleType.combine);
            
            //destroy any flares
            for (var i = 0, len = this.graphics.length; i < len; i++) {
                if (this.graphics[i].attributes.isFlare) {
                    this.remove(this.graphics[i]);
                    len--;
                    i--;
                }
            }
            dojo.query(".flare-object", groupShape.rawNode).forEach(dojo.destroy);
            this.activeCluster = null;
        },

      
        _createTooltip: function (shape) {

            var tooltipLength = dojo.query(".tooltip-text", shape.rawNode).length;
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
            var yPos = parseInt(shape.rawNode.getAttribute("data-center-y")) + 18; //align underneath, could be changed to be wherever

            //create a group to hold the tooltip elements
            var tooltipGroup = shape.createGroup({ x: xPos, y: yPos });
            tooltipGroup.rawNode.setAttribute("class", "tooltip-text");

            var textShapes = [];
            for (var i = 0, len = lines.length; i < len; i++) {
                var textShape = tooltipGroup.createText({ x: xPos, y: yPos + (i * 10), text: lines[i], align: 'middle' })
                    .setFill("#000")
                    .setFont({ size: 8, family: this.textSymbol.font.family, weight: this.textSymbol.font.weight });
                textShapes.push(textShape);
                textShape.rawNode.setAttribute("pointer-events", "none");
            }

            var rectPadding = 2;
            var textBox = tooltipGroup.getBoundingBox();
            var rectShape = tooltipGroup.createRect({ x: textBox.x - rectPadding, y: textBox.y - rectPadding, width: textBox.width + (rectPadding * 2), height: textBox.height + (rectPadding * 2), r: 0 })
                            .setFill(new dojo.Color([255,255,255,0.9]))
                            .setStroke({ color: "#000", width: 0.5 });
            rectShape.rawNode.setAttribute("pointer-events", "none");

            shape.moveToFront();
            for (var i = 0, len = textShapes.length; i < len; i++) {
                textShapes[i].moveToFront();
            }

        },

        _destroyTooltip: function (shape) {
            dojo.query(".tooltip-text", shape.rawNode).forEach(dojo.destroy);
        },

        _removeCluster: function (cluster) {
            //remove the cluster completely
            for (var i = 0, len = this.clusters.length; i < len; i++) {
                if (this.clusters[i] === cluster) {
                    this.clusters.splice(i, 1);
                    i--;
                    len--;
                }
            }
            this.remove(cluster.graphic);
            dojo.destroy(cluster.groupShape.rawNode);
        },

        //#endregion

        //#region helper methods 

        _getGraphicFromObject: function(obj) {
            //return the graphic from the obj which could be a single or cluster object
            for (var i = 0, len = this.graphics.length; i < len; i++) {
                var g = this.graphics[i];
                if (g.attributes.x === obj.x && g.attributes.y === obj.y) {
                    return g;
                }
            }
            return null;
        },

        _getClusterFromGraphic: function (graphic) {
            //return the obj which could be a single or cluster object, based on the graphic
            for (var i = 0, len = this.clusters.length; i < len; i++) {
                var cl = this.clusters[i];
                if (cl.graphic === graphic || (graphic.attributes.x === cl.x && graphic.attributes.y === cl.y)) {
                    cl.graphic = graphic;
                    return cl;
                }
            }

            return null;
        },

        _getClusterFromGroupNode: function (groupNode) {
            for (var i = 0, len = this.clusters.length; i < len; i++) {
                if (this.clusters[i].groupShape.rawNode === groupNode) {
                    return this.clusters[i];
                }
            }
        },

        _getFlareFromGraphic: function (graphic) {
            //return the obj which could be a single or cluster object, based on the graphic
            for (var i = 0, len = this.flareObjects.length; i < len; i++) {
                var fl = this.flareObjects[i];
                if (fl.singleData && (fl.singleData.x === graphic.attributes.x && fl.singleData.y === graphic.attributes.y)) {
                    return fl;
                }

                if (graphic.geometry.x === fl.mapPoint.x && graphic.geometry.y === fl.mapPoint.y) {
                    return fl;
                }
            }
            return null;
        },

        _getShapeCenter: function (shape) {
            var bbox = shape.getBoundingBox();
            x = bbox.x + bbox.width / 2;
            y = bbox.y + bbox.height / 2
            return { x: x, y: y };
        },


        _animationEnd: function (layer) {

            //IE fix, if the animation shape contains a text element underneath it set the transform of the the text to 1. 
            //IE wasn't displaying most text elements after animations for some reason, there's probably a better fix for this though.
            var textElement = dojo.query("> text", this.shape.rawNode).forEach(function(elem){
                var txt = new gfx.Text(elem);
                txt.setTransform({ xx: 1, yy: 1 });
            });
           
            //scope: 'this' is the animation that triggered the event, 'layer' is the flare cluster layer object instance
            for (var i = 0, len = layer.animationsRunning.length; i < len; i++) {
                if (layer.animationsRunning[i] === this) {
                    layer.animationsRunning.splice(i, 1);
                    return;
                }
            }

        },

        _playAnimations: function (animations, type) {
            if (type === this.animationMultipleType.combine) {
                coreFx.combine(animations).play();
            }
            else if (type === this.animationMultipleType.chain) {
                coreFx.chain(animations).play();
            }
            else {
                for (var i = 0, len = animations.length; i < len; i++) {
                    animations[i].play();
                }
            }

            this.animationsRunning = this.animationsRunning.concat(animations);
        },

        _stopAnimations: function () {
            for (var i = 0, len = this.animationsRunning.length; i < len; i++) {
                this.animationsRunning[i].stop();
            }
            this.animationsRunning = [];
        },

        //#endregion
    });
});

