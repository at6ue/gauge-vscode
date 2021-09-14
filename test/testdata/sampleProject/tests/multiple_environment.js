/* globals gauge*/

"use strict";

var assert = require("assert");

step("<key> is loaded", (key) => {
  assert.ok(process.env[key]);
});

step("<key> is not loaded", (key) => {
  assert.ok(!process.env[key]);
});
