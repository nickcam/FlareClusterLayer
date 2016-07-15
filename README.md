# FlareClusterLayer
This is a custom graphics layer that inherits from ArcGIS js graphics layer. Clustering is nothing special but I couldn't find an arcgis js api layer that clustered with flares...like the Silverlight Flare Clusters, which is why I created this.

The clustering is performed using a grid system based on the current extent, the pixel dimensions of the map and a configurable cluster ratio that can be set to suit a data set.

## Features

- Clustering can be performed by the layer by passing it a dataset, or it can display pre-clustered data if your data is already grouped into clusters (server side clustering). 

- Flares (really just circles positioned around the cluster graphic) will be created for individual points when the cluster contains <= a configured amount of points. Selecting these clusters will open an info window for the object.

- Flares can also be created for counts of sub types. For example, if all of your data objects contain a property called 'Type', you can create flares for large clusters that contain the count of each unique value of the property 'Type'.

- The boundary of the points in a cluster can also be displayed as a polygon behind the flare with a separate renderer to style however you like. They can be displayed on hover, tap, all the time or not at all.

- Summary flares with the text '...' and a tooltip containing all data will be created if there's too many to fit in the configured total amount of flares to display.

- Configure the symbology to be whatever you want by using a renderer for the clusters and single symbols and an optional second renderer for the cluster boundaries.

All of the options are explained in the constructor of the layer so just check out the code for a full explanation. 
A demo is here: http://flareclusterlayer.azurewebsites.net/index.html

Have a look at index.html for an example of how to use. It's the same as the demo link. 

Enjoy!
