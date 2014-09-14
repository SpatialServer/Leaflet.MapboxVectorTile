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

