var test = require('tape').test;
var MVTSource = require('../../src/MVTSource');

test('create a confetti map, loading a confetti tile', function(t) {
  console.log("About to load datasource");
  var confetti = require('../fixtures/confetti_datasource.js');
  document.body.innerHTML += '<div id="map"></div>';

  var map = L.map('map').setView([26.85305,80.93765], 14); // india
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
    t.ok(mvtSource.loadedTiles['14:11875:6922'], 'tile 14:11875:6922 loaded');
  }, 2000, mvtSource);
});


test('create a confetti map, filter confetti, test output - clearTile', function(t) {
  var confetti = require('../fixtures/confetti_datasource.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([25.53082458,78.816175], 13); // india
  var mvtSource = new MVTSource(confetti);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);

  //Make sure tile loads
  t.plan(2);
  setTimeout(function(mvtSource) {
    t.ok(mvtSource.loadedTiles['13:5889:3494'], 'tile 13:5889:3494 loaded');
  }, 2000, mvtSource);

  //Now filter the features
  var tileID = '13:5889:3494';
  setTimeout(function(mvtSource) {
    var lyr = mvtSource.layers[Object.keys(mvtSource.getLayers())[0]]; //Get the 1st Layer
    var features = lyr._canvasIDToFeatures[tileID].features;
    console.log("# Features: " + features.length);

    t.equal(features.length, 1);
  }, 2000, mvtSource);
});

test('Add confetti layer, remove layer, add it back.', function(t) {
  var confetti = require('../fixtures/confetti_datasource.js');
  document.body.innerHTML += '<div id="map"></div>';
  var map = L.map('map').setView([25.53082458,78.816175], 13); // india
  var mvtSource = new MVTSource(confetti);
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
  }).addTo(map);
  map.addLayer(mvtSource);
  console.log("added layer");

  //Set up remove event so we know when it is gone
  map.on("layerremove", function(removedObject){

    if(removedObject.layer.name && removedObject.layer.name == 'cicos_2014_geom') {

      //When layer is removed, this is fired.
      console.log("removed, about to add back.");

      //Add it back
      map.addLayer(mvtSource);

      console.log("added layer...again")
      setTimeout(function (addedLayer) {
        var tileID = '13:5889:3494';
        var lyr = addedLayer.layers[Object.keys(addedLayer.getLayers())[0]]; //Get the 1st Layer
        var features = lyr._canvasIDToFeatures[tileID].features;
        console.log("2nd Loading - # Features: " + features.length);
        t.equal(features.length, 1);
      }, 2000, mvtSource);
    }

  });


  //Make sure tile loads
  t.plan(2);

  setTimeout(function(mvtSource) {

    t.ok(mvtSource.loadedTiles['13:5889:3494'], 'tile 13:5889:3494 loaded');

    console.log("about to remove");
    //Remove it.
    map.removeLayer(mvtSource);

  }, 2000, mvtSource);


});