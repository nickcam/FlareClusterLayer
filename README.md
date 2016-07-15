# FlareClusterLayer
A custom graphics layer that inherits from ArcGIS js graphics layer. Clustering is nothing special but I couldn't find an arcgis js api layer that clustered with flares...like the Silverlight Flare Clusters, which is why I created this.

The clustering is performed using a grid system based on the current extent, the pixel dimensions of the map and a configurable cluster ratio that can be set to suit a data set.

Different versions for 3.x and 4.0.

## Features

- Flares will be created for individual points when the cluster contains <= a configured amount of points. Selecting these clusters will open an info window for the object.

- Flares can also be created for counts of sub types. For example, if all of your data objects contain a property called 'Type', you can create flares for large clusters that contain the count of each unique value of the property 'Type'.

- The boundary of the points in a cluster can also be displayed as a polygon behind the flare with a separate renderer to style however you like. They can be displayed on hover, tap, all the time or not at all.

- Summary flares with the text '...' and a tooltip containing all data will be created if there's too many to fit in the configured total amount of flares to display.

- Configure the symbology to be whatever you want by using a renderer for the clusters and single symbols and an optional second renderer for the cluster boundaries.

- Supports MapView (2d) and SceneView (3d) for api v4.0.

All of the options are explained in the constructor of the layer/s so just check out the code for a full explanation. 
A demo is here: http://flareclusterlayer.azurewebsites.net/index_v3.html and here http://flareclusterlayer.azurewebsites.net/index_v4.html 

## api v4.0 notes

I used typescript to build the v4 version (because typescript rocks), so you could either use the typecsript version and compile it to js in your own project or just use the compiled version in the ncam folder, same way the demo does.

If you want to run the repo locally, do an 
npm install

Also run the default gulp task (or at least the copy-dojo-typings task) to make sure the dojo typings get copied into the typings folder, dojo typings have an npm package but aren't compatible with the typings package.

If you plan to include the .ts file in your project you may need to change the import statements at the top of the file depending on the module loader and typescript compilation options you're using.
For example, to use it in an angular 2 project you would change the imports to be -
'''
import GraphicsLayer from "esri/layers/GraphicsLayer";
'''  
That is assuming you're using esri-system-js to load arcgis api using systemjs.

You would probably also need to remove the reference to the index.d.ts from typings at the top of the file, and just include the required typings file however your project does.

In the SceneView I used an external renderer to do the custom drawing...I think this is the way to go - but my webgl knowledge is non existent so to draw the flares I used an svg element 
that moves around depending on the cluster selected and just add svg nodes to that. It seems to work fine, but anyone with some webgl skills is welcome to fix that up so it's all in the webgl render pipeline.