/* 
  Public toilets all over Australia.
  Data taken from this data set: https://data.gov.au/dataset/national-public-toilet-map
*/


var DataManager = function () {

    var rawData = [];

    //function to fake what should happen server side. When returning a large amount of data perform the clustering server
    //side to save sending large amounts of data to the client. As the data is just in a js file for this example faking the server side
    //clustering using this function. Implement own clustering logic as appropriate, this doesn't do it particularly well.
    function fakeServerSideClustering(clusterRatio, maxSingleFlareCount, areaDisplayMode, map) {

        var itcount = 0;
        console.time("fake-server-side-cluster");

        var webExtent = map.extent;

        //set up a grid system to do the clustering

        //get the total amount of grid spaces based on the height and width of the map (divide it by clusterRatio) - then get the degrees for x and y 
        var xCount = Math.round(map.width / clusterRatio);
        var yCount = Math.round(map.height / clusterRatio);

        var xw = (webExtent.xmax - webExtent.xmin) / xCount;
        var yh = (webExtent.ymax - webExtent.ymin) / yCount;

        var gsxmin, gsxmax, gsymin, gsymax;
        var dataLength = rawData.length;

        //create an array of clusters that is a grid over the visible extent. Each cluster contains the extent (in web merc) that bounds the grid space for it.
        var clusters = [];
        for (var i = 0; i < xCount; i++) {
            gsxmin = webExtent.xmin + (xw * i);
            gsxmax = gsxmin + xw;
            for (var j = 0; j < yCount; j++) {
                gsymin = webExtent.ymin + (yh * j);
                gsymax = gsymin + yh;
                var ext = new esri.geometry.Extent({ xmin: gsxmin, xmax: gsxmax, ymin: gsymin, ymax: gsymax });
                ext.setSpatialReference(new esri.SpatialReference({ "wkid": 102100 }));
                clusters.push({
                    extent: ext,
                    clusterCount: 0,
                    subTypeCounts: [],
                    singles: [],
                    points: []
                });
            }
        }


        var web, obj;
        for (var i = 0; i < dataLength; i++) {
            obj = rawData[i];
            //get a web merc lng/lat for extent checking. Use web merc as it's flat to cater for longitude pole
            web = esri.geometry.lngLatToXY(obj.x, obj.y);

            //filter by visible extent first
            if (web[0] < webExtent.xmin || web[0] > webExtent.xmax || web[1] < webExtent.ymin || web[1] > webExtent.ymax) {
                continue;
            }

            var foundCluster = false;
            //loop cluster grid to see if it should be added to one
            for (var j = 0, jLen = clusters.length; j < jLen; j++) {
                var cl = clusters[j];

                if (web[0] < cl.extent.xmin || web[0] > cl.extent.xmax || web[1] < cl.extent.ymin || web[1] > cl.extent.ymax) {
                    continue; //not here so carry on
                }

                //recalc the x and y of the cluster by averaging the points again
                cl.x = cl.clusterCount > 0 ? (obj.x + (cl.x * cl.clusterCount)) / (cl.clusterCount + 1) : obj.x;
                cl.y = cl.clusterCount > 0 ? (obj.y + (cl.y * cl.clusterCount)) / (cl.clusterCount + 1) : obj.y;

                //push every point into the cluster so we have it for area checking if required. This could be omitted if never checking areas, or on demand at least
                if (areaDisplayMode) {
                    cl.points.push([obj.x, obj.y]);
                }

                cl.clusterCount++;

                var subTypeExists = false;
                for (var s = 0, sLen = cl.subTypeCounts.length; s < sLen; s++) {
                    if (cl.subTypeCounts[s].name === obj.facilityType) {
                        cl.subTypeCounts[s].count++;
                        subTypeExists = true;
                        break;
                    }
                }
                if (!subTypeExists) {
                    cl.subTypeCounts.push({ name: obj.facilityType, count: 1 });
                }

                cl.singles.push(obj);
            }
        }

        var results = [];
        //for every cluster that only has one point, just add the actual object to the result
        for (var i = 0, len = clusters.length; i < len; i++) {
            if (clusters[i].clusterCount === 1) {
                results.push(clusters[i].singles[0]);
            }
            else if (clusters[i].clusterCount > 0) {
                if (clusters[i].singles.length > maxSingleFlareCount) {
                    clusters[i].singles = [];
                }
                results.push(clusters[i]);
            }
        }

        console.timeEnd("fake-server-side-cluster");
        return results;
    }

    function getData() {
        return rawData;
    }

    function setData(data) {
        rawData = data;
    }

    return {
        getData: getData,
        setData: setData,
        fakeServerSideClustering: fakeServerSideClustering

    }

}();

