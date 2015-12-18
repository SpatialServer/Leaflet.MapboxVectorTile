Leaflet.MapboxVectorTile
========================

[![browser support](https://ci.testling.com/spatialserver/Leaflet.MapboxVectorTile.png)
](https://ci.testling.com/spatialserver/Leaflet.MapboxVectorTile)

A Leaflet Plugin that renders Mapbox Vector Tiles on HTML5 Canvas.

Though there is extensive use of MapboxVectorTiles in Mapnik PNG tile rendering as well as MapboxGL, there is a strange lacking of libraries that integrate these vector tiles directly into Leaflet. Search no more, the library you have been looking for is here!

Take a look at this [short presentation](https://speakerdeck.com/hallahan/leaflet-vector-tiles) outlining what MapboxVectorTiles are and how this is integrated in Leaflet.


##Changelog

### v 0.1.5 - May 21, 2015
*  Added point onClick events


### v 0.1.6 - May 26, 2015
*  Click function uses style.radius or radius function to do hittest.

### v 0.1.7 - December 17, 2015
*  Add XHR Headers to be configured for tile requests, update dependencies, correct package.json "main" property.

## Examples

[Basic Usage](http://spatialserver.github.io/Leaflet.MapboxVectorTile/examples/basic.html)

[Statically Placed Labels](http://spatialserver.github.io/Leaflet.MapboxVectorTile/examples/static-label.html)

[Confetti (700k Points)](http://spatialserver.github.io/Leaflet.MapboxVectorTile/examples/confetti.html)

[Fancy Labels Showing Point Aggregations](http://spatialserver.github.io/Leaflet.MapboxVectorTile/examples/india-aggregations.html)

## Demo Web Application

This library is currently being used in the [India Edition of Financial Services for the Poor](http://fspmaps.com/india). 

Tiles are being served by [SpatialServer (PGRestAPI)](https://github.com/spatialdev/PGRestAPI).

## Getting Started

Install the dependencies:

```sh
npm install
```

Dynamically compile and serve:

```sh
npm start
```

This puts a watcher on your source directory and recompiles with browserify automatically. It also serves the project directory on port 3000.

Open your browser to `http://localhost:3000/examples` and see the plugin in action!

## Usage

To put Leaflet.MapboxVectorTile on your map, you create an `L.TileLayer.MVTSource` object. This is a subclass of L.TileLayer, and it's usage and methods work the same as other Leaflet Tile Layers. 

The primary way that you setup your vector tiles is through a configuration object that you send as a parameter to the constructor.

```js
var config = {
  ...
};

var mvtSource = new L.TileLayer.MVTSource(config);
map.addLayer(mvtSource);
```

Of course if you would like to remove the vector tiles from the map, just call:

```js
map.removeLayer(mvtSource);
```

Take a look at the [Configuration Documentation](docs/configuration.md) to learn about all of the options you can use and what they mean.

## Testing

We are using [Tape](https://www.npmjs.org/package/tape), [Faucet](https://github.com/substack/faucet), and [Testling](https://ci.testling.com/) to do tests.

Upon push, tests are automatically run. You can see the [Testling CI Test Results](https://ci.testling.com/spatialserver/Leaflet.MapboxVectorTile) for the latest commit.

If you want to see if tests pass (on your local system's browser), run:

```js
npm test
```

Unit tests are in `test/js/`. All tests are written with Tape.
