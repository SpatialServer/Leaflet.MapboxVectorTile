/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 7/11/14.
 */

function Feature(label, pbfFeature, options) {
  this.dynamicLabel = label;
  this.pbfFeature = pbfFeature;
  this.pbfLayer = pbfFeature.pbfLayer;
  this.pbfSource = pbfFeature.pbfLayer.pbfSource;
  this.map = label.map;
  this.activeTiles = label.activeTiles;
  this.marker = null;

  this.tilePoints = {};
  this.tileLines = {};
  this.tilePolys = {};

  // default options
  this.options = {};

  // apply options
  for (var key in options) {
    this.options[key] = options[key];
  }

  // override the style function if specified
  if (pbfFeature.style.dynamicLabel) {
    this._styleFn = pbfFeature.style.dynamicLabel;
  }

  this.style = this._styleFn();
  this.icon = L.divIcon({
    className: this.style.cssClass || 'dynamicLabel-icon-text',
    html: this.style.html || 'No Label',
    iconSize: this.style.iconSize || [50,50]
  });
}

Feature.prototype.addTilePolys = function(ctx, polys) {
  this.tilePolys[ctx.id] = polys;
  this.computeLabelPosition();
};

Feature.prototype.computeLabelPosition = function() {
  var activeTiles = this.activeTiles;
  var tilePolys = {};
  // only passing over tiles currently on the screen
  for (var id in activeTiles) {
    var t = this.tilePolys[id];
    if (t) tilePolys[id] = t;
  }
  var dynamicLabel = this.dynamicLabel;
  var job = {
    extent: this.pbfFeature.extent,
    tileSize: this.pbfFeature.tileSize,
    tilePolys: tilePolys
  };
  var feature = this;
  this.dynamicLabel.submitPositionJob(job, function(evt) {
    var data = evt.data;
    console.log([data.status, data]);
    if (data.status !== 'WARN') {
      // returns worker to the pool
      dynamicLabel.freePositionWorker(this);
    }

    if (data.status === 'OK' && map.getZoom() === data.z) {
      var pt = L.point(data.x, data.y);
      positionMarker(feature, pt);
    }

    if (data.status === 'WARN' && data.tile === '5:18:16') {
      var cEdgeGeoJson = unprojectGeoJson(feature.map, data.cEdgePolys);
      var nEdgeGeoJson = unprojectGeoJson(feature.map, data.nEdgePolys);

      L.geoJson(cEdgeGeoJson, {
        style: {
          color: "#ff7800",
          weight: 3,
          opacity: 0.4,
          fill: false
        }
      }).addTo(feature.map);

      L.geoJson(nEdgeGeoJson, {
        style: {
          color: "green",
          weight: 1,
          opacity: 0.7,
          fill: false
        }
      }).addTo(feature.map);
    }
  });
};

function positionMarker(feature, pt) {
  var map = feature.map;
  var latLng = map.unproject(pt);
  if (!feature.marker) {
    feature.marker = L.marker(latLng, {icon: feature.icon});
    feature.marker.addTo(map);
  } else {
    feature.marker.setLatLng(latLng);
  }
//  L.marker(latLng).addTo(map);
}

/**
 * This is the default style function. This is overridden
 * if there is a style.dynamicLabel function in PBFFeature.
 */
Feature.prototype._styleFn = function() {

};

/**
 * Converts projected GeoJSON back into WGS84 GeoJSON.
 * @param geojson
 * @returns {*}
 */
function unprojectGeoJson(map, geojson) {
  var wgs84Coordinates = [];
  var wgs84GeoJson = {
    type: 'MultiPolygon',
    coordinates: wgs84Coordinates
  };
  var coords = geojson.coordinates;
  for (var i = 0, len = coords.length; i < len; i++) {
    var innerCoords = coords[i];
    wgs84Coordinates[i] = [];
    for (var j = 0, len2 = innerCoords.length; j < len2; j++) {
      var innerCoords2 = innerCoords[j];
      wgs84Coordinates[i][j] = [];
      for (var k = 0, len3 = innerCoords2.length; k < len3; k++) {
        var coord = innerCoords2[k];
        var latlng = map.unproject(L.point(coord));
        wgs84Coordinates[i][j][k] = [latlng.lng, latlng.lat];
      }
    }
  }
  return wgs84GeoJson;
}


/**
 * Exports this as a module if using Browserify.
 */
if (typeof module !== 'undefined') {
  module.exports = Feature;
}
