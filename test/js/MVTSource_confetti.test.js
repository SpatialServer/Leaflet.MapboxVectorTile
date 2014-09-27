var test = require('tape').test;
var MVTSource = require('../../src/MVTSource');

test('create a confetti map, loading a confetti tile', function(t) {
  var confetti = require('../fixtures/confetti_datasource.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([26.85305,80.93765], 14); // india
  var mvtSource = new MVTSource(confetti);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);

  console.log("Center: " + map.getCenter());

  t.plan(1);
  setTimeout(function(mvtSource) {
//    console.log("# Tiles: " + Object.keys(mvtSource.loadedTiles).length);
    t.ok(mvtSource.loadedTiles['14:11875:6922'], 'tile 14:11875:6922 loaded');
  }, 2000, mvtSource);
});
