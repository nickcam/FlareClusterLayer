# FlareClusterLayer
A custom graphics layer that inherits from ArcGIS js graphics layer. Clustering is nothing special but I couldn't find an arcgis js api layer that clustered with flares...like the Silverlight Flare Clusters, which is why I created this.

The clustering is performed using a grid system based on the current extent, the pixel dimensions of the map and a configurable cluster ratio that can be set to suit a data set.

Support for both for 3.x and 4.1 arcgis js apis.

Note: The latest version won't work with arcgis v4.0, only v4.1. There's a 4.0 branch in this repo where you can get to the code that works for v4.0. There is only an example page that uses v4.1 as well.

## Features

- Flares will be created for individual points when the cluster contains <= a configured amount of points. Selecting these clusters will open an info window for the object.

- Flares can also be created for counts of sub types. For example, if all of your data objects contain a property called 'Type', you can create flares for large clusters that contain the count of each unique value of the property 'Type'.

- The boundary of the points in a cluster can also be displayed as a polygon behind the flare with a separate renderer to style however you like. They can be displayed on hover, tap, all the time or not at all.

- Summary flares with the text '...' and a tooltip containing all data will be created if there's too many to fit in the configured total amount of flares to display.

- Configure the symbology to be whatever you want by using a renderer for the clusters and single symbols and an optional second renderer for the cluster boundaries.

- Supports MapView (2d) and SceneView (3d) for api v4.1.

All of the options are explained in the constructor of the layer/s so just check out the code for a full explanation. 
Demos are here:

v3.x - http://flareclusterlayer.azurewebsites.net/index_v3.html

v4.1 - http://flareclusterlayer.azurewebsites.net/index_v4.html 

## api v4.1 notes

I used typescript to build the v4 version (because typescript rocks), so you could either use the typecsript version and compile it to js in your own project or just use the compiled version in the fcl folder, same way the demo does.

Moved all of the animations out of the code and added css classes to elements instead. Animations can be performed using css instead of in code. This allows for much more flexibility. Example css that replicates/extends the v3.x animations are in the index_v4.html example.

If you want to run the repo locally, do an 
npm install

Also run the default gulp task (or at least the copy-dojo-typings task) to make sure the dojo typings get copied into the typings folder; dojo typings have an npm package of their own but can't be included using typings tool.

If you plan to include the .ts file in your project you may need to change the import statements at the top of the file depending on the module loader and typescript compilation options you're using.
For example, to use it in an angular 2 project you would change the imports to be -
```
import GraphicsLayer from "esri/layers/GraphicsLayer";
```  
That is assuming you're using [esri-system-js](https://github.com/Esri/esri-system-js) to load the arcgis api using systemjs.

You would probably also need to remove the reference to the index.d.ts from typings at the top of the file, and just include the required typings file however your project already manages this.

In the SceneView I used an external renderer to do the custom drawing...I think this is the way to go - but my webgl knowledge is non existent so to draw the flares and the activated cluster I used an svg element that moves around depending on the cluster selected and just add svg nodes to it. It works fine, but anyone with some webgl skills is welcome to fix that up so it's all in the webgl render pipeline using webgl objects. The benefit of using svg nodes is that any css defined for the classes will apply to the scene view as well.

 Cross browser notes on the example CSS animations:
  - IE/Edge: These POS's don't support transforms on svg elements using css, so the css transform animations won't work.
  - Firefox: Firefox's transform-origin behaves differently to Chrome...as in "keywords and percentages refer to the canvas instead of the object itself" - https://developer.mozilla.org/en/docs/Web/CSS/transform-origin
  This means scaling won't work out of the box in firefox, the svg element will move around, so is disabled using -moz- tags in the default styles.
  To get it to work you have to set the firefox preference svg.transform-box.enabled to true.
  Not ideal as each user will have to set this preference in their installation, but could work as an enterprise wide setting I guess.
  See this bug - https://bugzilla.mozilla.org/show_bug.cgi?id=1209061 - apparentely firefox is on spec, for the moment, the spec will change to match Chrome's default in time. 
  
  Have added these notes to the index_v4.html file as well as well example styles to get firefox working with the example page.
  Of course you could just not use scaling as an animation and/or use some other type of css animation.

