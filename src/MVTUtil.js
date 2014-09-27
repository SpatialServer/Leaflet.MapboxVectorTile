/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 8/15/14.
 */
var Util = module.exports = {};

var request = require('request');

Util.getContextID = function(ctx) {
  return [ctx.zoom, ctx.tile.x, ctx.tile.y].join(":");
};

/**
 * Default function that gets the id for a layer feature.
 * Sometimes this needs to be done in a different way and
 * can be specified by the user in the options for L.TileLayer.MVTSource.
 *
 * @param feature
 * @returns {ctx.id|*|id|string|jsts.index.chain.MonotoneChain.id|number}
 */
Util.getIDForLayerFeature = function(feature) {
  return feature.properties.id;
};

Util.getJSON = function(url, callback) {
  request(url, function(error, response, body) {
    if (!error && response.statusCode >= 200 && response.statusCode < 300) {
      var data;
      try { data = JSON.parse(body); }
      catch (err) { return callback(err); }
      callback(null, data);
    } else {
      callback(error || new Error(response.statusCode));
    }
  });
};
