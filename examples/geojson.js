var debug = {};

var map = L.map('map').setView([-5, 27.4], 5); // africa

L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18,
  id: 'examples.map-i86knfo3'
}).addTo(map);

var geojsonUrl = "https://cdn.rawgit.com/johan/world.geo.json/master/countries.geo.json"

var xmlhttp = new XMLHttpRequest();
xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        var json = JSON.parse(xmlhttp.responseText);
        geoJsonLoaded(json);
    }
};
xmlhttp.open("GET", geojsonUrl, true);
xmlhttp.send();

function geoJsonLoaded(geojson) {

  var mvtSource = new L.TileLayer.MVTSource({
    // url: "http://spatialserver.spatialdev.com/services/vector-tiles/GAUL_FSP/{z}/{x}/{y}.pbf",
    geoJson: geojson,
    debug: true,
    getIDForLayerFeature: function(feature) {
      return feature.properties.name;
    },
  });

  debug.mvtSource = mvtSource;

  //Globals that we can change later.
  var fillColor = 'rgba(149,139,255,0.4)';
  var strokeColor = 'rgb(20,20,20)';

  //Add layer
  map.addLayer(mvtSource);
}
