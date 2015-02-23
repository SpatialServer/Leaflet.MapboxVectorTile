var debug = {};

var map = L.map('map').setView([47.6, -122.3], 9); // Seattle

L.tileLayer('http://{s}.tiles.mapbox.com/v3/spatialdev.map-c9z2cyef/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
  id: 'examples.map-i86knfo3'
}).addTo(map);


var pbfSource = new L.TileLayer.MVTSource({
  url: "http://localhost:3000/services/vector-tiles/gadm/{z}/{x}/{y}.pbf",
  debug: false,
  clickableLayers: null,

  getIDForLayerFeature: function(feature) {
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
  filter: function(feature, context) {
    if (feature.layer.name === 'gadm2') {
      return true;
    }
    return false;
  },

  /**
   * When we want to link events between layers, like clicking on a label and a
   * corresponding polygon freature, this will return the corresponding mapping
   * between layers. This provides knowledge of which other feature a given feature
   * is linked to.
   *
   * @param layerName  the layer we want to know the linked layer from
   * @returns {string} returns corresponding linked layer
   */
  layerLink: function(layerName) {
    if (layerName.indexOf('_label') > -1) {
      return layerName.replace('_label', '');
    }
    return layerName + '_label';
  },

  /**
   * Specify which features should have a certain z index (integer).  Lower numbers will draw on 'the bottom'.
   *
   * @param feature - the PBFFeature that contains properties
   */
  layerOrdering: function(feature) {
    //This only needs to be done for each type, not necessarily for each feature. But we'll start here.
  },

  style: function(feature) {
    var style = {};
    var selected = style.selected = {};
    var pointRadius = 1;

    function ScaleDependentPointRadius(zoom) {
      //Set point radius based on zoom
      var pointRadius = 1;
      if (zoom >= 0 && zoom <= 7) {
        pointRadius = 1;
      }
      else if (zoom > 7 && zoom <= 10) {
        pointRadius = 2;
      }
      else if (zoom > 10) {
        pointRadius = 3;
      }

      return pointRadius;
    }

    var type = feature.type;
    switch (type) {
      case 1: //'Point'
        // unselected
        style.color = CICO_LAYERS[feature.properties.type].color || '#3086AB';
        style.radius = ScaleDependentPointRadius;
        // selected
        style.selected = {
          color: 'rgba(255,255,0,0.5)',
          radius: 6
        };
        break;
      case 2: //'LineString'
        // unselected
        style.color = 'rgba(161,217,155,0.8)';
        style.size = 3;
        // selected
        style.selected = {
          color: 'rgba(255,255,0,0.5)',
          size: 6
        };
        break;
      case 3: //'Polygon'
        // unselected
        style.color = 'rgba(149,139,255,0.4)';
        style.outline = {
          color: 'rgb(20,20,20)',
          size: 2
        };
        // selected
        style.selected = {
          color: 'rgba(255,255,0,0.5)',
          outline: {
            color: '#d9534f',
            size: 3
          }
        };

    }

    return style;
  },

  onClick: function(evt) {
    console.log('clickkkk');
  }

});

debug.mvtSource = pbfSource;


//Add layer
map.addLayer(pbfSource);
