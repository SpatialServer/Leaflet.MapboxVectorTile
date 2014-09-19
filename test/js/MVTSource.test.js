/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 9/12/14.
 */

var test = require('tape').test;
var MVTSource = require('../../src/MVTSource');


test('creating MVTSource object', function(t) {
  var basicOpts = require('../fixtures/basicStaticLabel.js');
  t.plan(1);
  var mvtSource = new MVTSource(basicOpts);
  t.ok(mvtSource, 'gadm2014kenya with static labels source created');
});

test('create a map, loading a tile', function(t) {
  var basicOpts = require('../fixtures/basicStaticLabel.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([0,39], 6); // africa
  var mvtSource = new MVTSource(basicOpts);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);

  t.plan(1);
  setTimeout(function() {
    t.ok(mvtSource.loadedTiles['6:38:32'], 'tile 6:38:32 loaded');
  }, 1000);
});

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
  setTimeout(function() {
    console.log("# Tiles: " + Object.keys(mvtSource.loadedTiles).length);
    t.ok(mvtSource.loadedTiles['14:11875:6922'], 'tile 14:11875:6922 loaded');
  }, 1000);
});
