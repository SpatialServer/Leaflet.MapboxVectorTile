module.exports = {
  url: "http://spatialserver.spatialdev.com/services/postgis/cicos_2014/geom/vector-tiles/{z}/{x}/{y}.pbf?fields=type,id", //Original Datasource - this is dynamic data, tho
  //url: "http://localhost/Leaflet.MapboxVectorTile/test/fixtures/pbfs/{z}.{x}.{y}.pbf",
  debug: true,
  clickableLayers: [''],

  getIDForLayerFeature: function (feature) {
    return feature.properties.id;
  },

  /**
   * The filter function gets called when iterating though each vector tile feature (vtf). You have access
   * to every property associated with a given feature (the feature, and the layer). You can also filter
   * based of the context (each tile that the feature is drawn onto).
   *
   * Returning false skips over the feature and it is not drawn.
   *
   * @param feature
   * @returns {boolean}
   */
  filter: function (feature, context) {
    //return feature.properties.type != 'Mobile Money Agent';
    return true;
  },

  /**
   * Specify which features should have a certain z index (integer).  Lower numbers will draw on 'the bottom'.
   *
   * @param feature - the PBFFeature that contains properties
   */
  layerOrdering: function (feature) {
    //This only needs to be done for each type, not necessarily for each feature. But we'll start here.
    if (feature && feature.properties) {
      feature.properties.zIndex =  5;
    }
  },

  style: function (feature) {
    var style = {};
    var selected = style.selected = {};

    var type = feature.type;
    switch (type) {
      case 1: //'Point'
        // unselected
        style.color = '#3086AB';
        style.radius = 3;
        // selected
        selected.color = 'rgba(255,255,0,0.5)';
        selected.radius = 5;
        break;
      case 2: //'LineString'
        // unselected
        style.color = 'rgba(161,217,155,0.8)';
        style.size = 3;
        // selected
        selected.color = 'rgba(255,25,0,0.5)';
        selected.size = 3;
        break;
      case 3: //'Polygon'
        // unselected
        style.color = 'rgba(149,139,255,0.4)';
        style.outline = {
          color: 'rgb(20,20,20)',
          size: 2
        };
        // selected
        selected.color = 'rgba(255,25,0,0.3)';
        selected.outline = {
          color: '#d9534f',
          size: 3
        };
    }

    return style;
  }
};
