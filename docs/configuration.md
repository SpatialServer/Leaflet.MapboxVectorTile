# Configuration Documentation

Take a look at the javascript files in the [examples](../examples). You can see a number of working configurations there.

The following are properties that define a config object for the `MVTSource` object used as follows:

```js
var config = {
  ...
};

var mvtSource = new L.TileLayer.MVTSource(config);
map.addLayer(mvtSource);
```

## Config

* `url` - **{string}** The URL Endpoint that we fetch MVT Protocal Buffer tiles from. **Required**.

```js
url: "http://spatialserver.spatialdev.com/services/vector-tiles/gaul_fsp_india/{z}/{x}/{y}.pbf",
```

* `debug` - **{boolean}** Flagging debug as true provides a grid that shows the edge of the tiles and the z,x,y coordinate address of the tiles. **Default: `false`***.

```js
debug: true,
```

* `clickableLayers` - **[{string}, ...]** A list of vector tile layers that will capture mouse click events and be selectable on the map. **Default: `null`**.

```js
clickableLayers: ['gaul_2014_adm1'],
```

* `mutexToggle` - **{boolean}** If this is set to `true`, only one feature can be selected at a time. If it is `false`, multiple features can be selected simultaneously. Clicking again on a selected feature deselects it. **Default: `false`***.

```js
mutexToggle: true,
```

* `getIDForLayerFeature` - **{function}** Each MVT Feature needs a unique ID. You can specify a specific function to create a unique ID that will be associated with a given feature. *TODO: We need a default function that properly fetches the _id property by deafult.* **Required**.

```js
getIDForLayerFeature: function(feature) {
return feature._id;
},
```

* `filter` - **{function}** The filter function gets called when iterating though each vector tile feature (vtf). You have access to every property associated with a given feature (the feature, and the layer). You can also filter based of the context (each tile that the feature is drawn onto). Returning false skips over the feature and it is not drawn. **Required**.   
  * *@param feature* *@returns {boolean}*

```js
filter: function(feature, context) {
  if (feature.layer.name === 'gaul_2014_adm1' || feature.layer.name === 'gaul_2014_adm1_label') {
    return true;
  }
  return false;
},
```

* `style` - **{function}** This function sets properties that the HTML5 Canvas' context uses to draw on the map. If you do not specify this, default styling will be applied to your features. `style.selected` parameters specify how a feature looks when it is selected. **Optional**.
  * *@returns {object}* 

```js
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
      style.color = 'rgba(149,139,255,0.4)';
      style.outline = {
        color: 'rgb(20,20,20)',
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

  if (feature.layer.name === 'gaul_2014_adm1_label') {
    style.ajaxSource = function(mvtFeature) {
      var id = mvtFeature.id;
      return 'http://localhost:8888/fsp/2014/fsp/aggregations-no-name/' + id + '.json';
    };

    style.staticLabel = function(mvtFeature, ajaxData) {
      var style = {
        html: ajaxData.total_count,
        iconSize: [33,33],
        cssClass: 'label-icon-number',
        cssSelectedClass: 'label-icon-number-selected'
      };
      return style;
    };
  }

  return style;
},
```

* `layerLink` - **{function}**  When we want to link events between layers, like clicking on a label and a
                                corresponding polygon feature, this will return the corresponding mapping
                                between layers. This provides knowledge of which other feature a given feature
                                is linked to. **Optional**.
  * *@param layerName* - the layer we want to know the linked layer from
  * *@returns {string}* - returns corresponding linked layer.

```js
layerLink: function(layerName) {
  if (layerName.indexOf('_label') > -1) {
    return layerName.replace('_label','');
  }
  return layerName + '_label';
}
```

* 'onClick' - **{function}** This callback is fired every time a layer in clickableLayers is clicked on.
  * *@param event* - the event that initiated the click. This event object is the Leaflet event along with the feature object.

```js
onClick: function(evt) {
  console.log('click');
}
```

* 'scope' - **{object}** The execution context for the onClick callback
