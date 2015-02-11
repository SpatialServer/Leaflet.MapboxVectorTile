module.exports = {
  url: "http://spatialserver.spatialdev.com/services/vector-tiles/gaul_fsp_india/{z}/{x}/{y}.pbf",
  debug: true,
  clickableLayers: ['gaul_2014_adm1'],

  /**
   * If you click on a feature, if there is a different
   * currently selected feature, that gets toggled off.
   */
  mutexToggle: true,

  getIDForLayerFeature: function(feature) {
    return feature._id;
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
    if (feature.layer.name === 'gaul_2014_adm1' || feature.layer.name === 'gaul_2014_adm1_label') {
      return true;
    }
    return false;
  },

  style: function (feature) {
    var style = {};

    var type = feature.type;
    switch (type) {
      case 1: //'Point'
        style.color = 'rgba(49,79,79,1)';
        style.radius = 5;
        style.selected = {
          color: 'rgba(255,255,0,0.5)',
          radius: 6
        };
        break;
      case 2: //'LineString'
        style.color = 'rgba(161,217,155,0.8)';
        style.size = 3;
        style.selected = {
          color: 'rgba(255,25,0,0.5)',
          size: 4
        };
        break;
      case 3: //'Polygon'
        style.color = 'rgba(149,139,255,0.4)';
        style.outline = {
          color: 'rgb(20,20,20)',
          size: 1
        };
        style.selected = {
          color: 'rgba(255,140,0,0.3)',
          outline: {
            color: 'rgba(255,140,0,1)',
            size: 2
          }
        };
        break;
    }

    if (feature.layer.name === 'gaul_2014_adm1_label') {
      style.ajaxSource = function(mvtFeature) {
        var id = mvtFeature.id;
        return 'http://localhost:8888/fsp/2014/fsp/aggregations-no-name/' + id + '.json';
      };

      style.staticLabel = function(mvtFeature, ajaxData) {
        var style = {
          html: ajaxData.total_count,
          iconSize: [33,33],
          cssClass: 'label-icon-number',
          cssSelectedClass: 'label-icon-number-selected'
        };
        return style;
      };
    }

    return style;
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
      return layerName.replace('_label','');
    }
    return layerName + '_label';
  }

};