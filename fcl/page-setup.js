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
define(["require", "exports", "esri/Map", "esri/views/MapView", "esri/renderers/SimpleRenderer", "esri/renderers/ClassBreaksRenderer", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/geometry/Point", "esri/geometry/SpatialReference", "esri/request", "./FlareClusterLayer_v4"], function (require, exports, Map, MapView, SimpleRenderer, ClassBreaksRenderer, SimpleMarkerSymbol, SimpleLineSymbol, Point, SpatialReference, esriRequest, FlareClusterLayer_v4_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var PageSetup = /** @class */ (function () {
        function PageSetup() {
        }
        PageSetup.prototype.init = function () {
            return __awaiter(this, void 0, void 0, function () {
                var resp, data, singlesRenderer, fcl;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, esriRequest("./data/data.json", {
                                responseType: "json"
                            })];
                        case 1:
                            resp = _a.sent();
                            data = resp.data;
                            this.map = new Map({
                                basemap: "gray"
                            });
                            this.mapView = new MapView({
                                container: "views",
                                center: new Point({ x: 134, y: -24, spatialReference: new SpatialReference({ wkid: 4326 }) }),
                                zoom: 4,
                                map: this.map,
                                ui: { components: ["compass", "zoom"] }
                            });
                            this.mapView.ui.move("zoom", "bottom-right");
                            this.mapView.ui.move("compass", "bottom-right");
                            singlesRenderer = new SimpleRenderer({
                                symbol: new SimpleMarkerSymbol({
                                    outline: new SimpleLineSymbol({
                                        color: [255, 255, 255],
                                        width: 1
                                    }),
                                    color: [255, 0, 0],
                                    size: 6
                                })
                            });
                            fcl = new FlareClusterLayer_v4_1.FlareClusterLayer({
                                singleRenderer: singlesRenderer,
                                clusterRenderer: new ClassBreaksRenderer(),
                                singlesFields: [
                                    { name: "objectId", type: "oid", alias: "objectId" },
                                    { name: "toiletId", type: "integer", alias: "toiletId" },
                                    { name: "name", type: "string", alias: "name" },
                                    { name: "postcode", type: "string", alias: "postcode" },
                                    { name: "facilityType", type: "string", alias: "facilityType" },
                                    { name: "isOpen", type: "string", alias: "isOpen" },
                                    { name: "x", type: "double", alias: "x" },
                                    { name: "y", type: "double", alias: "y" }
                                ],
                                singlesObjectIdDataPropertyName: "toiletId",
                                data: data
                            });
                            this.map.add(fcl);
                            return [2 /*return*/];
                    }
                });
            });
        };
        return PageSetup;
    }());
    exports.PageSetup = PageSetup;
});
//# sourceMappingURL=page-setup.js.map