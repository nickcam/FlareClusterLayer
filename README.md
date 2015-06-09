# FlareClusterLayer
This is a custom graphics layer that inherits from ArcGIS js graphics layer. Clustering is nothing special but I couldn't find an arcgis js api layer that clustered with flares...like the Silverlight Flare Clusters, which is why I created this.

Clustering can be performed by the layer by passing it a dataset, or it can display pre-clustered data if your data is already grouped into clusters (server side clustering).

Flares (really just circles positioned around the cluster graphic) will be created for individual points when the cluster contains <= a configured amount of points. Selecting these clusters will open an info window for the object.

Flares can also be created for counts of sub types. For example, if all of your data objects contain a property called 'Type', you can create flares for large clusters that contain the count of each unique value of the property 'Type'.

Summary flares with the text '...' and a tooltip containing all data will be created if there's too many to fit in the configured total amount of flares to display.

All of the options are explained in the constructor of the layer so just check out the code for a full explanation. A demo is here: http://flareclusterlayer.azurewebsites.net/

Just configure the symbology to be whatever you want by using a class breaks renderer as well.

Enjoy!
