import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ascentStr,
  distanceStr,
  durationStr,
  gradeStr,
  lapTimeStr,
  paceStr,
} from "../shared/format.js"

test("pace", () => {
  assert.equal(paceStr(1000 / 338), "5'38")
  assert.equal(paceStr(1000 / 299.6), "5'00")
  assert.equal(paceStr(0), "-'--")
  assert.equal(paceStr(0.1), "-'--")
  assert.equal(paceStr(1609.344 / 480, "min_per_mile"), "8'00")
})

test("times", () => {
  assert.equal(durationStr(2014), "33:34")
  assert.equal(durationStr(3814), "1:03:34")
  assert.equal(lapTimeStr(43), "00:43")
  assert.equal(lapTimeStr(3700), "1:01:40")
  assert.equal(durationStr(null), "--:--")
})

test("distance, ascent, grade", () => {
  assert.equal(distanceStr(7140), "7.14")
  assert.equal(distanceStr(140), "0.14")
  assert.equal(distanceStr(123456), "123.5")
  assert.equal(distanceStr(1609.344, "min_per_mile"), "1.00")
  assert.equal(ascentStr(115), "115")
  assert.equal(ascentStr(100, "min_per_mile"), "328")
  assert.equal(gradeStr(-3.2), "-3%")
  assert.equal(gradeStr(-0.2), "0%")
  assert.equal(gradeStr(null), "--%")
})
