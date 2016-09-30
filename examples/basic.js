var debug = {};

var map = L.map('map').setView([-5, 27.4], 5); // africa

L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18,
  id: 'examples.map-i86knfo3'
}).addTo(map);

var layer = 'fenix:gaul0_faostat3_3857',
    url = 'http://fenix.fao.org:20900/geoserver/gwc/service/tms/1.0.0/'+layer+'/{z}/{x}/{y}.pbf';


var mvtSource = new L.TileLayer.MVTSource({
  //url: "http://spatialserver.spatialdev.com/services/vector-tiles/GAUL_FSP/{z}/{x}/{y}.pbf",
  url: url,
  debug: true,
  //clickableLayers: ["GAUL0"],
  /*getIDForLayerFeature: function(feature) {
    return feature.properties.id;
  },

  
  filter: function(feature, context) {
    if (feature.layer.name === 'GAUL0') {
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
        style.color = fillColor;
        style.outline = {
          color: strokeColor,
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
    return style;
  }
  //*/

});
debug.mvtSource = mvtSource;

//Globals that we can change later.
var fillColor = 'rgba(149,139,255,0.4)';
var strokeColor = 'rgb(20,20,20)';

//Add layer
map.addLayer(mvtSource);
