/**
 * Created by Ryan Whitley on 9/8/14.
 */
/** Forked from https://gist.github.com/DGuidi/1716010 **/
var Util = require('./MVTUtil');

module.exports = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    isHiddenLayer: false,
    getIDForLayerFeature: function() {},
    tileSize: 256
  },

  _featureIsClicked: {},

  _isPointInPoly: function(pt, poly) {
    if(poly && poly.length) {
      for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
        && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
        && (c = !c);
      return c;
    }
  },

  initialize: function(mvtSource, options) {
    var self = this;
    self.mvtSource = mvtSource;
    L.Util.setOptions(this, options);

    this.style = options.style;
    this.name = options.name;

    this.visible = true;
    this.features = {};
    this.featuresWithLabels = [];
    this.featuresToDraw = []; //A list of features to actually draw that pass filters.
    this.zIndexSortOrder = [];
  },

  drawTile: function(canvas, tilePoint, zoom) {

    var ctx = {
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    ctx.id = Util.getContextID(ctx);

//    if (!this.features) {
//      this.features = {};
//    }

  },

  _draw: function(ctx) {
    //Draw is handled by the parent MVTSource object
  },
  getCanvas: function(parentCtx, vtl){
    //Need a way to pluck a canvas element from this layer given the parent layer's id.
    //Wait for it to get loaded before proceeding.
    var tilePoint = parentCtx.tile;
    var ctx = this._tiles[tilePoint.x + ":" + tilePoint.y];

    if(ctx){
      parentCtx.canvas = ctx;
      this.parseVectorTileLayer(vtl, parentCtx);
      return;
    }

    var self = this;

    //This is a timer that will wait for a criterion to return true.
    //If not true within the timeout duration, it will move on.
    waitFor(function () {
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        if(ctx) {
          return true;
        }
      },
      function(){
        //When it finishes, do this.
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        parentCtx.canvas = ctx;
        self.parseVectorTileLayer(vtl, parentCtx);

      }, //when done, go to next flow
      2000); //The Timeout milliseconds.  After this, give up and move on

  },

  parseVectorTileLayer: function(vtl, ctx) {
    var self = this;
    var tilePoint = ctx.tile;

    //See if we can pluck the same tile from this local tile layer
    ctx.canvas = self._tiles[tilePoint.x + ":" + tilePoint.y];

    //Clear tile -- TODO: Add flag so this only happens when a layer is being turned back on after being hidden
    if(ctx.canvas) ctx.canvas.width = ctx.canvas.width;

    self.featuresToDraw = []; //clear features for this parsing.

    var features = vtl.parsedFeatures;
    for (var i = 0, len = features.length; i < len; i++) {
      var vtf = features[i] //vector tile feature

      var getIDForLayerFeature;
      if (typeof self.options.getIDForLayerFeature === 'function') {
        getIDForLayerFeature = self.options.getIDForLayerFeature;
      } else {
        getIDForLayerFeature = Util.getIDForLayerFeature;
      }
      var uniqueID = self.options.getIDForLayerFeature(vtf) || i;

      if(i === 0){
        // how much we divide the coordinate from the vector tile
        this.divisor = vtf.extent / ctx.tileSize;
        this.extent = vtf.extent;
        this.tileSize = ctx.tileSize;
      }

      /**
       * Apply filter on feature if there is one. Defined in the options object
       * of TileLayer.MVTSource.js
       */
      var filter = self.options.filter;
      if (typeof filter === 'function') {
        if ( filter(vtf, ctx) === true ){
          self.featuresToDraw.push(vtf); //add feature if filter returns true;
          self.features[uniqueID] = vtf; //TODO: Clear when a new z-index is in effect. Also, we probably don't want to do this.
        }
      }

      //if no filter, add the feature to the output list to draw.
      if(!filter) self.featuresToDraw.push(vtf);

      var layerOrdering = self.options.layerOrdering;
      if (typeof layerOrdering === 'function') {
        layerOrdering(vtf, ctx); //Applies a custom property to the feature, which is used after we're thru iterating to sort
      }
    }

    //If a z-order function is specified, wait unitl all features have been iterated over until drawing (here)
    /**
     * Apply sorting (zIndex) on feature if there is a function defined in the options object
     * of TileLayer.MVTSource.js
     */
    var layerOrdering = self.options.layerOrdering;
    if (layerOrdering) {
      //We've assigned the custom zIndex property when iterating above.  Now just sort.
      self.zIndexSortOrder = self.featuresToDraw.sort(function(a, b) {
        return -(b.properties.zIndex - a.properties.zIndex)
      });
    }else{
      //Just set the zIndexSortOrder property to the list of features.
      self.zIndexSortOrder = self.featuresToDraw;
    }

    self.redrawTile(ctx);

    for (var j = 0, len = self.featuresWithLabels.length; j < len; j++) {
      var feat = self.featuresWithLabels[j];
      debug.feat = feat;

    }
  },

  // NOTE: a placeholder for a function that, given a feature, returns a style object used to render the feature itself
  style: function(feature) {
    // override with your code
  },

  //This is the old way.  It works, but is slow for mouseover events.  Fine for click events.
  handleClickEvent: function(evt, cb) {
    //Click happened on the GroupLayer (Manager) and passed it here
    var tileID = evt.tileID.split(":").slice(1, 3).join(":");
    var canvas = this._tiles[tileID];
    if(!canvas) (cb(evt)); //break out
    var x = evt.layerPoint.x - canvas._leaflet_pos.x;
    var y = evt.layerPoint.y - canvas._leaflet_pos.y;

    var tilePoint = {x: x, y: y};
    var features = this._canvasIDToFeaturesForZoom[evt.tileID].features; //Switch this.  Not storing this for point.
    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      var paths = feature.getPathsForTile(evt.tileID, this._map.getZoom());
      for (var j = 0; j < paths.length; j++) {
        if (this._isPointInPoly(tilePoint, paths[j])) {
          if (feature.toggleEnabled) {
            feature.toggle();
          }
          evt.feature = feature;
          cb(evt);
          return;
        }
      }
    }
    //no match
    //return evt with empty feature
    evt.feature = null;
    cb(evt);
  },

  clearTile: function(ctx) {
    ctx.canvas.width = ctx.canvas.width;
  },

  clearLayerFeatureHash: function(){

  },

  redrawTile: function(ctx) {
    //Get the features for this tile, and redraw them.

    for (var i = 0; i < this.zIndexSortOrder.length; i++) {
      var feature = this.zIndexSortOrder[i];
      var style = this.style(feature);
      if (feature) {
        this.drawPoint(ctx, feature.coordinates, style);
        if (typeof style.staticLabel === 'function') {
          this._drawStaticLabel(ctx, feature.coordinates, style);
        }
      }
    }


    //Remove features
    //this.features = {};
    this.zIndexSortOrder = [];
    this.featureToDraw = [];
  },

  linkedLayer: function() {
    var linkName = this.mvtSource.layerLink(this.name);
    return this.mvtSource.layers[linkName];
  },

  drawPoint: function(ctx, coordsArray, style) {
    if (!style) return;

    var radius = 1;
    if (typeof style.radius === 'function') {
      radius = style.radius(ctx.zoom); //Allows for scale dependent rednering
    }
    else {
      radius = style.radius;
    }

    var p = this._tilePoint(coordsArray[0][0]);
    var c = ctx.canvas;
    var g = c.getContext('2d');
    g.beginPath();
    g.fillStyle = style.color;
    g.arc(p.x, p.y, radius, 0, Math.PI * 2);
    g.closePath();
    g.fill();
    g.restore();
  },
  /**
   * Takes a coordinate from a vector tile and turns it into a Leaflet Point.
   *
   * @param ctx
   * @param coords
   * @returns {eGeomType.Point}
   * @private
   */
  _tilePoint: function(coords) {
    return new L.Point(coords.x / this.divisor, coords.y / this.divisor);
  }

});

/**
 * See https://github.com/ariya/phantomjs/blob/master/examples/waitfor.js
 *
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */
function waitFor(testFx, onReady, timeOutMillis) {
  var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
    start = new Date().getTime(),
    condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()), //< defensive code
    interval = setInterval(function () {
      if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
        // If not time-out yet and condition not yet fulfilled
        condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
      } else {
        if (!condition) {
          // If condition still not fulfilled (timeout but condition is 'false')
          console.log("'waitFor()' timeout");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('timeout'); //< Do what it's supposed to do once the condition is fulfilled
        } else {
          // Condition fulfilled (timeout and/or condition is 'true')
          console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('success'); //< Do what it's supposed to do once the condition is fulfilled
        }
      }
    }, 50); //< repeat check every 50ms
};