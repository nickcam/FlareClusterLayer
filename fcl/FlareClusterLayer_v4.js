var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
define(["require", "exports", "esri/Graphic", "esri/layers/GraphicsLayer", "esri/layers/GroupLayer", "esri/layers/FeatureLayer", "esri/geometry/SpatialReference", "esri/geometry/Point", "esri/core/accessorSupport/decorators"], function (require, exports, Graphic, GraphicsLayer, GroupLayer, FeatureLayer, SpatialReference, Point, asd) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * The cluster layer, which is an extended GroupLayer.
     * It contains a custom feature layer to perform clustering and flare display, and a graphics layer to display the area boundaries.
     * */
    var FlareClusterLayer = /** @class */ (function (_super) {
        __extends(FlareClusterLayer, _super);
        function FlareClusterLayer(properties) {
            var _this = _super.call(this, properties) || this;
            _this.clusters = [];
            _this.singleGraphics = [];
            // set up the properties and initialize the two child layers
            _this.areaDisplayMode = properties.areaDisplayMode || "activated";
            // data set property names
            _this.xPropertyName = properties.xPropertyName || "x";
            _this.yPropertyName = properties.yPropertyName || "y";
            _this.zPropertyName = properties.zPropertyName || "z";
            _this.spatialReference = properties.spatialReference || new SpatialReference({ wkid: 4326 }); // default to 4326
            _this.singlesObjectIdDataPropertyName = properties.singlesObjectIdDataPropertyName;
            _this.data = properties.data;
            _this.boundaryLayer = new GraphicsLayer();
            _this.clustersLayer = new FeatureLayer({
                fields: [
                    { name: "objectId", type: "oid", alias: "objectId" },
                    { name: "count", type: "integer", alias: "count" }
                ],
                objectIdField: "objectId",
                geometryType: "point",
                spatialReference: properties.spatialReference,
                renderer: properties.clusterRenderer,
                source: []
            });
            // set the object id field of the singles
            _this.singlesObjectIdField = properties.singlesFields.find(function (x) { return x.type === "oid"; });
            if (!_this.singlesObjectIdField) {
                console.error("An object id (oid type) must be set in singlesFields array");
                return _this;
            }
            _this.singlesLayer = new FeatureLayer({
                fields: properties.singlesFields,
                objectIdField: _this.singlesObjectIdField.name,
                geometryType: "point",
                renderer: properties.singleRenderer,
                spatialReference: properties.spatialReference,
                popupTemplate: properties.popupTemplate,
                source: []
            });
            _this.addMany([_this.boundaryLayer, _this.clustersLayer, _this.singlesLayer]);
            if (_this.data && _this.data.length > 0) {
                _this.runCluster();
            }
            return _this;
        }
        FlareClusterLayer.prototype.setData = function (data) {
            if (!data || data.length == 0)
                return;
            this.data = data;
        };
        FlareClusterLayer.prototype.runCluster = function () {
            return __awaiter(this, void 0, void 0, function () {
                var i, len, g;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.data)
                                return [2 /*return*/];
                            // clear the feature layers
                            return [4 /*yield*/, this.clustersLayer.applyEdits({
                                    deleteFeatures: this.clustersLayer.source.toArray()
                                })];
                        case 1:
                            // clear the feature layers
                            _a.sent();
                            return [4 /*yield*/, this.singlesLayer.applyEdits({
                                    deleteFeatures: this.singleGraphics
                                })];
                        case 2:
                            _a.sent();
                            // starter test, create them all as singles
                            this.singleGraphics = [];
                            for (i = 0, len = this.data.length; i < len; i++) {
                                g = this.createSingleGraphic(this.data[i], i);
                                this.singleGraphics.push(g);
                            }
                            return [4 /*yield*/, this.singlesLayer.applyEdits({
                                    addFeatures: this.singleGraphics
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        FlareClusterLayer.prototype.createSingleGraphic = function (obj, index) {
            var g = new Graphic({
                attributes: obj,
                geometry: new Point({
                    x: obj[this.xPropertyName],
                    y: obj[this.yPropertyName],
                    z: obj[this.zPropertyName] ? obj[this.zPropertyName] : 1,
                    spatialReference: this.spatialReference
                })
            });
            // set the object id data attribute on teh graphic if a property was set to get from the data set.
            if (this.singlesObjectIdDataPropertyName) {
                g.attributes[this.singlesObjectIdField.name] = obj[this.singlesObjectIdDataPropertyName];
            }
            return g;
        };
        FlareClusterLayer = __decorate([
            asd.subclass("FlareClusterLayer"),
            __metadata("design:paramtypes", [Object])
        ], FlareClusterLayer);
        return FlareClusterLayer;
    }(asd.declared(GroupLayer)));
    exports.FlareClusterLayer = FlareClusterLayer;
});
//# sourceMappingURL=FlareClusterLayer_v4.js.map