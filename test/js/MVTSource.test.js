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
  setTimeout(function(mvtSource) {
    t.ok(mvtSource.loadedTiles['6:38:32'], 'tile 6:38:32 loaded');
  }, 2000, mvtSource);
});

test('basic map, zoom in, zoom out, check for drawn tiles', function(t) {
  var basicOpts = require('../fixtures/basicStaticLabel.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([0,39], 6); // africa
  var mvtSource = new MVTSource(basicOpts);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);

  map.zoomIn();
  map.zoomOut();

  t.plan(2);
  setTimeout(function(mvtSource) {
    var numTiles = Object.keys(mvtSource.loadedTiles).length;
    t.equal(numTiles, 6, "# Tiles: " + numTiles);
    t.ok(mvtSource.loadedTiles['6:38:32'], 'tile 6:38:32 loaded');
  }, 2000, mvtSource);
});

test('ensure labels are removed when mvtSource is removed from map', function(t) {
  var opts = require('../fixtures/indiaStaticLabel.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([25.40,79.409], 6); // Northern India
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  var mvtSource = new L.TileLayer.MVTSource(opts);
  map.addLayer(mvtSource);

  t.plan(1);
  setTimeout(function(mvtSource) {
//    var layersWithLabels = Object.keys(map._layers).length;
//    t.equal(layersWithLabels, 41, 'should be 41 layers on map');
    setTimeout(function(mvtSource) {
      map.removeLayer(mvtSource);
      var layersWithLabels = Object.keys(map._layers).length;
      t.equal(layersWithLabels, 1, 'should be 1 base map layer with no mvt source and no labels');
    }, 500, mvtSource);
  }, 700, mvtSource);
});

test('ensure no repeats of features for featuresWithLabels array', function(t) {
  var opts = require('../fixtures/indiaStaticLabel.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([25.40,79.409], 4); // Northern India
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  var mvtSource = new L.TileLayer.MVTSource(opts);
  map.addLayer(mvtSource);

  t.plan(1);
  var hash = {};
  setTimeout(function(mvtSource) {
    var featuresWithLabels = mvtSource.layers.gaul_2014_adm1_label.featuresWithLabels;
    for (var idx = 0, len = featuresWithLabels.length; idx < len; idx++) {
      var feat = featuresWithLabels[idx];
      if (hash[feat.id]) {
        t.fail('there is more than 1 feature with id ' + feat.id + ' also known as ' + feat.staticLabel.icon.options.html);
      }
      hash[feat.id] = true;
//      console.log(feat.staticLabel.icon.options.html);
    }
    t.pass();
  }, 1500, mvtSource);
});
