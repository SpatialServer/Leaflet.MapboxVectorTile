var test = require('tape').test;
var MVTSource = require('../../src/MVTSource');

test('create a confetti map, loading a confetti tile', function(t) {
  console.log("About to load datasource");
  var confetti = require('../fixtures/confetti_datasource.js');
  document.body.innerHTML += '<div id="map"></div>';

  var map = L.map('map').setView([21, 80], 5); // india
  console.log("Created Map");

  var mvtSource = new MVTSource(confetti);
  console.log("Created new source.");

  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);

  console.log("Added source to map.");
  console.log("Center: " + map.getCenter());

  t.plan(1);

  setTimeout(function(mvtSource) {
    t.ok(mvtSource.loadedTiles['5:22:13'], 'tile 5:22:13 loaded');
  }, 2000, mvtSource);
});


test('create a confetti map, count features in a tile', function(t) {
  var confetti = require('../fixtures/confetti_datasource.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([21, 80], 5); // india
  var mvtSource = new MVTSource(confetti);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);

  //Make sure tile loads
  t.plan(2);
  setTimeout(function(mvtSource) {
    t.ok(mvtSource.loadedTiles['5:22:13'], 'tile 5:22:13 loaded');
  }, 2000, mvtSource);

  //Now filter the features
  var tileID = '5:22:13';
  setTimeout(function(mvtSource) {
    var lyr = mvtSource.layers[Object.keys(mvtSource.getLayers())[0]]; //Get the 1st Layer
    var features = lyr._canvasIDToFeatures[tileID].features;
    console.log("# Features: " + features.length);

    t.equal(features.length, 3);
  }, 2000, mvtSource);
});

test('Add confetti layer, remove layer, add it back.', function(t) {
  var confetti = require('../fixtures/confetti_datasource.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([21, 80], 5); // india
  var mvtSource = new MVTSource(confetti);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);
  console.log("added layer");

  //Set up remove event so we know when it is gone
  map.on("layerremove", function(removedObject){

    console.log("Layer removed fired.");

    console.log("removedObject.layer.name: " + removedObject.layer.name)

    if(removedObject.layer.name && removedObject.layer.name == 'cicos_2014geojson') {

      //When layer is removed, this is fired.
      console.log("removed, about to add back.");

      //Add it back
      map.addLayer(mvtSource);

      console.log("added layer...again")
      setTimeout(function (addedLayer) {
        var tileID = '5:22:13';
        var lyr = addedLayer.layers[Object.keys(addedLayer.getLayers())[0]]; //Get the 1st Layer
        var features = lyr._canvasIDToFeatures[tileID].features;
        console.log("2nd Loading - # Features: " + features.length);
        t.equal(features.length, 3);
      }, 2000, mvtSource);
    }

  });


  //Make sure tile loads
  t.plan(2);

  setTimeout(function(mvtSource) {

    t.ok(mvtSource.loadedTiles['5:22:13'], 'tile 5:22:13 loaded');

    console.log("about to remove");
    //Remove it.
    map.removeLayer(mvtSource);

  }, 2000, mvtSource);

});


test('point layer - rapid refresh', function(t) {
  var confetti = require('../fixtures/confetti_datasource.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([21, 80], 5); // india
  var mvtSource = new MVTSource(confetti);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);

  //Make sure tile loads
  t.plan(1);
  setTimeout(function(mvtSource) {
    t.ok(mvtSource.loadedTiles['5:22:13'], 'tile 5:22:13 loaded');
  }, 2000, mvtSource);

  var i = 5; //redraw 5 times

  (function callRedraw (i) {
    setTimeout(function () {

      //redraw layer
      mvtSource.redraw();

      if (--i) {                  // If i > 0, keep going
        callRedraw(i);  // Call the loop again
      }
    }, 200);
  })(i);
});

test('point layer - bust that cache', function(t) {
  var confetti = require('../fixtures/confetti_datasource.js');

  //Add bustCache option to confetti object
  confetti.bustCache = true;

  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([21, 80], 5); // india
  var mvtSource = new MVTSource(confetti);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);

  //Make sure tile loads
  t.plan(1);
  setTimeout(function(mvtSource) {
    t.ok(mvtSource.loadedTiles['5:22:13'], 'tile 5:22:13 loaded');
  }, 2000, mvtSource);

  var i = 2; //redraw 5 times

  (function callRedraw (i) {
    setTimeout(function () {

      //redraw layer
      mvtSource.redraw();

      if (--i) {                  // If i > 0, keep going
        callRedraw(i);  // Call the loop again
      }
    }, 200);


  })(i);

});