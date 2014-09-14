/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 9/12/14.
 */

var test = require('tape').test;
var MVTSource = require('../../src/MVTSource');
var basicOpts = require('../fixtures/basicStaticLabel.js');

test('creating MVTSource object', function(t) {
  t.plan(1);
  var mvtSource = new MVTSource(basicOpts);
  t.ok(mvtSource, 'gadm2014kenya with static labels source created');
});

test('create a map, loading a tile', function(t) {
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


