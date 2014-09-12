/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 8/15/14.
 */

var debug = {};

// panel
var open = 0;
$(".trigger").click(function() {
  if (open == 0) {
    //$('#start-input').focus();
    $(".trigger").animate({ "right": "+=300px" }, "fast");
    $(".block").animate({ "right": "+=300px" }, "fast", function() {
      $('#start-input').focus();
    });

    open = 1;
  }
  else if (open == 1) {
    $(".block").animate({ "right": "-=300px" }, "fast");
    $(".trigger").animate({ "right": "-=300px" }, "fast");
    open = 0;
  }
});

var map = L.map('map').setView([0,39], 6); // africa
//    var map = L.map('map').setView([19.6,-155.4], 8); // hawaii

L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18
}).addTo(map);


var pbfSource = new L.TileLayer.PBFSource({
  url: "http://spatialserver.spatialdev.com/services/vector-tiles/gadm2014kenya/{z}/{x}/{y}.pbf",
//        url: "https://a.tiles.mapbox.com/v3/mapbox.mapbox-terrain-v1,mapbox.mapbox-streets-v5/{z}/{x}/{y}.vector.pbf",
  debug: true,
  clickableLayers: ['gadm0', 'gadm1', 'gadm2', 'gadm3', 'gadm4', 'gadm5'],

  getIDForLayerFeature: function(feature) {
    return feature.properties.id;
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
    if (feature.layer.name === 'gadm1_label' || feature.layer.name === 'gadm1') {
      return true;
    }

    return false;
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
  },

  /**
   * Specify which features should have a certain z index (integer).  Lower numbers will draw on 'the bottom'.
   *
   * @param feature - the PBFFeature that contains properties
   */
  layerOrdering: function(feature){
    //This only needs to be done for each type, not necessarily for each feature. But we'll start here.
    if(feature && feature.properties){
      feature.properties.zIndex = cicoConfig[feature.properties.type].zIndex || 5;
    }
  },

  styleFor: pbfStyle
});
debug.pbfSource = pbfSource;

//Globals that we can change later.
var fillColor = 'rgba(149,139,255,0.4)';
var strokeColor = 'rgb(20,20,20)';


function pbfStyle(feature) {
  var style = {};
  var selected = style.selected = {};
  var pointRadius = 1;

  function ScaleDependentPointRadius(zoom){
    //Set point radius based on zoom
    var pointRadius = 1;
    if(zoom >= 0 && zoom <= 7){
      pointRadius = 1;
    }
    else if(zoom > 7 && zoom <= 10){
      pointRadius = 3;
    }
    else if(zoom > 10){
      pointRadius = 4;
    }

    return pointRadius;
  }

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


// All possible CICO layer (combined from all countries)
var cicoConfig =  {
  'Offsite ATMs': {
    color: '#3086AB',
    infoLabel: 'Offsite ATM',
    providers: null,
    zIndex: 3
  },
  'Bank Branches': {
    color: '#977C00',
    infoLabel: 'Bank Branch',
    providers: null,
    zIndex: 2
  },
  'MFIs': {
    color: '#9B242D',
    infoLabel: 'MFI',
    providers: null,
    zIndex: 1
  },
  'SACCOs': {
    color: '#cf8a57',
    infoLabel: 'SACCO',
    providers: null,
    zIndex: 10
  },
  'Mobile Money Agent': {
    color: '#8CB7C7',
    infoLabel: 'Mobile Money Agent',
    providers: null,
    zIndex: -1
  },
  'MDIs': {
    color: '#825D99',
    infoLabel: 'MDI',
    providers: null,
    zIndex: 6
  },
  'Credit Institution': {
    color: '#6CA76B',
    infoLabel: 'Credit Institution',
    providers: null,
    zIndex: 5
  },
  'MFBs': {
    color: '#825D99',
    infoLabel: 'MFB',
    providers: null,
    zIndex: 7
  },
  'Motor Parks': {
    color: '#bd85b3',
    infoLabel: 'Motor Parks',
    providers: null,
    zIndex: 7
  },
  'Mobile Network Operator Outlets': {
    color: '#a2a2a2',
    infoLabel: 'Mobile Network Operator Outlets',
    providers: null,
    zIndex: 0
  },
  'Post Offices': {
    color: '#80ad7b',
    infoLabel: 'Post Offices',
    providers: null,
    zIndex: 5
  },
  'Post Office': {
    color: '#80ad7b',
    infoLabel: 'Post Offices',
    providers: null,
    zIndex: 6
  },
  'Bus Stand': {
    color: '#80ad7b',
    infoLabel: 'Bus Stands',
    providers: null,
    zIndex: 6
  },
  'Bus Stands': {
    color: '#80ad7b',
    infoLabel: 'Bus Stands',
    providers: null,
    zIndex: 6
  },

  //Kenya
  'Insurance Providers': {
    color: '#3086AB',
    infoLabel: 'Insurance providers',
    providers: null,
    zIndex: 6
  },
  'Money Transfer Service': {
    color: '#977C00',
    infoLabel: 'Money Transfer Service',
    providers: null,
    zIndex: 6
  },
  'Dev Finance': {
    color: '#9B242D',
    infoLabel: 'Dev Finance',
    providers: null,
    zIndex: 6
  },
  'Forex Bureaus': {
    color: '#cf8a57',
    infoLabel: 'Forex Bureaus',
    providers: null,
    zIndex: 6
  },
  'Cap Markets': {
    color: '#825D99',
    infoLabel: 'Cap Markets',
    providers: null,
    zIndex: 6
  },
  'Pension Providers': {
    color: '#a2a2a2',
    infoLabel: 'Pension providers',
    providers: null,
    zIndex: 6
  },
  'Purchase Lease Factoring': {
    color: '#80ad7b',
    infoLabel: 'Purchase Lease Factoring',
    providers: null,
    zIndex: 6
  },
  'Bank Agent': {
    color: '#80ad7b',
    infoLabel: 'Bank Agent',
    providers: null,
    zIndex: 6
  },
  'Bank and Mortgage': {
    color: '#80ad7b',
    infoLabel: 'Banks and Mortgage',
    providers: null,
    zIndex: 6
  },
  'Commercial Bank': {
    color: '#80ad7b',
    infoLabel: 'Commercial Bank',
    providers: null,
    zIndex: 6
  },
  'PostBank': {
    color: '#bd85b3',
    infoLabel: 'Post Bank',
    providers: null,
    zIndex: 6
  },

  //Nigeria New Post Offices
  'NIPOST Post Office': {
    color: '#80ad7b',
    infoLabel: 'NIPOST Post Offices',
    providers: null,
    zIndex: 6
  },
  'NIPOST Post Shop': {
    color: '#80ad7b',
    infoLabel: 'NIPOST Post Shops',
    providers: null,
    zIndex: 6
  },
  'NIPOST Postal Agency': {
    color: '#80ad7b',
    infoLabel: 'NIPOST Postal Agencies',
    providers: null,
    zIndex: 6
  }
}

map.on("click", function(e) {
  //Take the click event and pass it to the group layers.


  //Pass to mouseover for now.
  pbfSource.onMouseOver(e, function(evt){
    alert("got it.");
  });

//  pbfSource.onClick(e, function (evt) {
//    if (evt && evt.feature) {
//      //alert("Clicked Country: " + evt.feature.name_0);
//      $("#idResults").html("Clicked Country: " + evt.feature.properties.name_0);
//    }
//  });

});

map.on("layerremove", function(removed){
  //This is the layer that was removed.
  //If it is a TileLayer.PBFSource, then call a method to actually remove the children, too.
  if(removed.layer.removeChildLayers){
    removed.layer.removeChildLayers(map);
  }
});

pbfSource.bind("PBFLoad", function(){
  //Fired when all PBFs have been processed and map has finished rendering.
  console.log("done rendering.");
});

//Add layer
map.addLayer(pbfSource);


function loadLayers() {
  //Load layer list
  var layers = pbfSource.getLayers();
  var layerIds = Object.keys(layers);

  layerIds.forEach(function(key, idx){
    //var key = layerIds[idx];
    //loop thru layers and list them in the panel
    var layer = layers[key];
    var row = $('<div class="VTSubLayer"><label class="checkbox">' + key + '</label></div>').appendTo($("#layerList"));
    var cBox = $('<input type="checkbox" checked="checked" value="all">').appendTo(row);

    cBox.on("click", function(evt) {
      //Toggle layer visiblity
      if (layer.visible == true) {
        pbfSource.hideLayer(key);
      }
      else {
        pbfSource.showLayer(key);
        pbfSource.redraw();
      }
    });
  })
}

function removePBFLayer(){
  map.removeLayer(pbfSource);
}

function updateStyle() {
  var cssFill = $("#cssFill").val();
  var cssStroke = $("#cssStroke").val();

  if (cssFill) fillColor = cssFill;
  if (cssStroke) strokeColor = cssStroke;
  pbfLayerGroup.redraw();
}
