/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 9/12/14.
 */

var test = require('tape').test;
var MVTSource = require('../../src/MVTSource');

test('creating MVTSource object', function(t) {
  t.plan(1);

  var mvtSource = new MVTSource({
    url: "http://spatialserver.spatialdev.com/services/vector-tiles/gadm2014kenya/{z}/{x}/{y}.pbf",
    debug: true,
    clickableLayers: ['gadm1'],

    getIDForLayerFeature: function(feature) {
      return feature.properties.id;
    },

    filter: function(feature, context) {
      if (feature.layer.name === 'gadm1_label' || feature.layer.name === 'gadm1') {
        return true;
      }

      return false;
    },

    layerLink: function(layerName) {
      if (layerName.indexOf('_label') > -1) {
        return layerName.replace('_label','');
      }
      return layerName + '_label';
    },

    styleFor: function(feature) {
      var style = {};
      var selected = style.selected = {};

      var type = feature.type;
      switch (type) {
        case 1: //'Point'
          // unselected
          style.color = '#ff0000';
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

      if (feature.layer.name === 'gadm1_label') {
        style.staticLabel = function() {
          var style = {
            html: feature.properties.name,
            iconSize: [125,30],
            cssClass: 'label-icon-text'
          };
          return style;
        };
      }

      return style;
    }
  });

  t.ok(mvtSource, 'gadm2014kenya with static labels source created');

});

