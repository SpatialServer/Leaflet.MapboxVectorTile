    var debug = {};

    var map = L.map('map').setView([-5,27.4], 5); // africa

    L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                'Imagery © <a href="http://mapbox.com">Mapbox</a>',
        id: 'examples.map-i86knfo3'
    }).addTo(map);


    var pbfSource = new L.TileLayer.MVTSource({
        url: "http://spatialserver.spatialdev.com/services/vector-tiles/GAUL_FSP/{z}/{x}/{y}.pbf",
        debug: true,
        clickableLayers: ["gadm2"],
        getIDForLayerFeature: function(feature) {
            switch (feature.layer.name) {
                case "gadm0":
                    return feature.properties.id_0;

                case "gadm1":
                    return feature.properties.id_0 + "-" + feature.properties.id_1;

                case "gadm2":
                    return feature.properties.id_0 + "-" + feature.properties.id_1 + "-" + feature.properties.id_2;
            }
            return "";
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
            return true;
        }
    });
    debug.mvtSource = pbfSource;

    //Globals that we can change later.
    var fillColor = 'rgba(149,139,255,0.4)';
    var strokeColor = 'rgb(20,20,20)';

    pbfSource.style = pbfStyle;

    function pbfStyle(feature) {
        var style = {};

        var type = feature.type;
        switch (type) {
            case 1: //'Point'
                style.color = 'rgba(49,79,79,1)';
                style.radius = 5;
                break;
            case 2: //'LineString'
                style.color = 'rgba(161,217,155,0.8)';
                style.size = 3;
                break;
            case 3: //'Polygon'
                style.color = fillColor;
                style.outline = {
                    color: strokeColor,
                    size: 2
                };
                break;
        }
        return style;
    }

    function pbfSelectedStyle(vectorTileFeature) {
        var type = vectorTileFeature.type;
        switch (type) {
            case 1: //'Point'
                return {
                    color: 'rgba(255,255,0,0.5)',
                    radius: 5
                };

            case 2: //'LineString'
                return {
                    color: 'rgba(255,25,0,0.5)',
                    size: 3
                };

            case 3: //'Polygon'
                return {
                    color: 'rgba(255,140,0,0.3)',
                    outline: {
                        color: 'rgba(255,140,0,1)',
                        size: 1
                    }
                };

            default:
                return null;
        }
    }

    map.on("click", function(e) {
        //Take the click event and pass it to the group layers.

        pbfSource.onClick(e, function (evt) {
            if (evt && evt.feature) {
                //alert("Clicked Country: " + evt.feature.name_0);
                $("#idResults").html("Clicked Country: " + evt.feature.properties.name_0);

                evt.feature.isSelected = !evt.feature.isSelected;

                var style;
                if (evt.feature.isSelected === true) {
                    //Set selected style
                    style = pbfSelectedStyle(evt.feature);
                }
                else {
                    //return to normal color
                    style = pbfStyle(evt.feature);
                }

                //set it - this triggers an auto tile redraw
                evt.feature.setStyle(style);
            }


//            L.popup().setLatLng([evt.latlng.lat, evt.latlng.lng]).setContent("HELLO!!!!").openOn(map);
        });
    });

    map.on("layerremove", function(removed){
        //This is the layer that was removed.
        //If it is a TileLayer.MVTSource, then call a method to actually remove the children, too.
        if(removed.layer.removeChildLayers){
            removed.layer.removeChildLayers(map);
        }
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