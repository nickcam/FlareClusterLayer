/* 
  Public toilets all over Australia.
  Data taken from this data set: https://data.gov.au/dataset/national-public-toilet-map
*/


var DataManager = function(){

    var rawData = [];

    //function to fake what should happen server side. When returning a large amount of data perform the clustering server
    //side to save sending large amounts of data to the client. As the data is just in a js file for this example faking the server side
    //clustering using this function. Implement own clustering logic as appropriate, this doesn't do it particularly well.
    function fakeServerSideClustering(xmin, xmax, ymin, ymax, clusterTolerance, maxSingleFlareCount) {
        //basic catering for longitude pole, no data in this set will go beyond -180, but the extent in wkid 4326 could.
        if (xmax < xmin) {
            xmax = 180;
        }

        var results = [];
        var clusters = [];
        var singles = [];
        for (var i = 0, len = rawData.length; i < len; i++) {
            var obj = rawData[i];
            
            //filter by visible extent first
            var include = obj.x >= xmin && obj.x < xmax && obj.y >= ymin && obj.y < ymax;
            if (!include) {
                continue;
            }

            var foundCluster = false;
            //loop existing existing cluters to see if it should be added to one
            for (var j = 0, jLen = clusters.length; j < jLen; j++) {
                var cl = clusters[j];

              
                //check if the point falls in the buffer of the current cluster - based on parameter clusterTolerance
                if ((obj.x <= cl.x + clusterTolerance && obj.x >= cl.x - clusterTolerance) &&
                    (obj.y <= cl.y + clusterTolerance && obj.y >= cl.y - clusterTolerance)) {

                    //recalc the x and y of the cluster by averaging the points again
                    cl.x = (obj.x + (cl.x * cl.clusterCount)) / (cl.clusterCount + 1);
                    cl.y = (obj.y + (cl.y * cl.clusterCount)) / (cl.clusterCount + 1);

                    //recalc the extent of the cluster
                    if (obj.x < cl.extent.xmin) {
                        cl.extent.xmin = obj.x;
                    }
                    if (obj.x > cl.extent.xmax) {
                        cl.extent.xmax = obj.x;
                    }

                    if (obj.y < cl.extent.ymin) {
                        cl.extent.ymin = obj.y;
                    }

                    if (obj.y > cl.extent.ymax) {
                        cl.extent.ymax = obj.y;
                    }


                    cl.clusterCount++;

                    //add sub type counts to an array in the cluster object - for this example using a property called facilityType
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
                    foundCluster = true;
                    break;
                }
                
            }

            //create a new cluster with one point that contains the object as a property
            if (!foundCluster) {
                //add a new cluster
                clusters.push({
                    clusterCount: 1,
                    x: obj.x,
                    y: obj.y,
                    extent: { xmin: obj.x, xmax: obj.x, ymin: obj.y, ymax: obj.y },
                    subTypeCounts: [{ name: obj.facilityType, count: 1 }],
                    singles: [obj]
                });
            }
        }

        //for every cluster that only has one point, just add the actual object to the result
        for (var i = 0, len = clusters.length; i < len; i++) {
            if (clusters[i].clusterCount === 1) {
                results.push(clusters[i].singles[0]);
            }
            else {

                if (clusters[i].singles.length > maxSingleFlareCount) {
                    clusters[i].singles = [];
                }
                results.push(clusters[i]);
            }
        }
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

