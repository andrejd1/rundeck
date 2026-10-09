// Unit tests for the platform-free logic. Built only with --unit-test:
//   monkeyc ... --unit-test -o bin/test.prg   then   monkeydo bin/test.prg fr965 -t
// (tools/build.sh test does both builds; the simulator runs them).

import Toybox.Lang;
import Toybox.Test;

(:test)
function testPaceParsing(logger as Logger) as Boolean {
    Test.assert(Text.parsePaceSec("4:30") == 270);
    Test.assert(Text.parsePaceSec(" 4'30 ") == 270);
    Test.assert(Text.parsePaceSec("4.05") == 245);
    Test.assert(Text.parsePaceSec("10:00") == 600);
    Test.assert(Text.parsePaceSec("4:60") == null);
    Test.assert(Text.parsePaceSec("430") == null);
    Test.assert(Text.parsePaceSec("4:3:0") == null);
    Test.assert(Text.parsePaceSec("") == null);
    Test.assert(Text.parsePaceSec(null) == null);
    return true;
}

(:test)
function testFormatting(logger as Logger) as Boolean {
    Test.assertEqual(Text.pace(1000.0 / 338, false), "5:38");
    Test.assertEqual(Text.pace(0, false), "--");
    Test.assertEqual(Text.pace(0.2, false), "--"); // slower than 59:59
    Test.assertEqual(Text.pace(1609.344 / 545, true), "9:05");
    Test.assertEqual(Text.duration(1543), "25:43");
    Test.assertEqual(Text.duration(3900), "1:05:00");
    Test.assertEqual(Text.duration(5), "0:05");
    // cut like the watch's own distance, not rounded
    Test.assertEqual(Text.distance(18349, false), "18.34");
    Test.assertEqual(Text.distance(9999, false), "9.99");
    Test.assertEqual(Text.distance(123456, false), "123.4");
    Test.assertEqual(Text.speed(10.0 / 3.6, false), "10.0");
    Test.assertEqual(Text.elevation(100, true), "328");
    Test.assertEqual(Text.clock(7, 5, true), "07:05");
    Test.assertEqual(Text.clock(19, 5, false), "7:05");
    Test.assertEqual(Text.clock(0, 30, false), "12:30");
    Test.assertEqual(Text.celsius(20, true), "68");
    return true;
}

(:test)
function testNumbers(logger as Logger) as Boolean {
    var n = Text.numbers("120, 140;155 168 180");
    Test.assert(n.size() == 5);
    Test.assert(n[0] == 120);
    Test.assert(n[4] == 180);
    Test.assert(Text.numbers("250.5")[0] == 250.5);
    Test.assert(Text.numbers("").size() == 0);
    return true;
}

// The watch's rule: zone n runs up to and including its max.
(:test)
function testZones(logger as Logger) as Boolean {
    var z = [97, 116, 135, 155, 174, 194] as Array<Numeric>;
    Test.assert(Zones.zoneOf(96, z) == 0);
    Test.assert(Zones.zoneOf(97, z) == 1);
    Test.assert(Zones.zoneOf(116, z) == 1);
    Test.assert(Zones.zoneOf(117, z) == 2);
    Test.assert(Zones.zoneOf(194, z) == 5);
    Test.assert(Zones.zoneOf(210, z) == 5);
    Test.assert(Zones.zoneOf(null, z) == -1);
    Test.assert(Zones.hrZone(90, z) == 0); // below zone 1: no zone named
    Test.assert(Zones.hrZone(150, z) == 3);
    Test.assert(Zones.position(97, z) == 0.0);
    Test.assert(Zones.position(250, z) == 1.0);
    var mid = Zones.position(125.5, z); // middle of zone 2
    Test.assert(mid > 0.29 && mid < 0.31);
    return true;
}

(:test)
function testCustomZones(logger as Logger) as Boolean {
    // lower bounds -> the watch's format; without a top Z5 gets Z4's width
    var z = Zones.parseCustom("120,140,155,168,180") as Array<Numeric>;
    Test.assert(z.size() == 6);
    Test.assert(z[0] == 120);
    Test.assert(z[1] == 139);
    Test.assert(z[4] == 179);
    Test.assert(z[5] == 192);
    Test.assert(Zones.parseCustom("120,110,155,168,180") == null);
    Test.assert(Zones.parseCustom("120,140") == null);
    var m = Zones.hrZones(1, 200, 0, "");
    Test.assert(m[0] == 100);
    Test.assert(m[5] == 200);
    var l = Zones.hrZones(2, 0, 170, "");
    Test.assert(l[4] == 170);
    return true;
}

(:test)
function testTargets(logger as Logger) as Boolean {
    var p = Target.parse(Target.PACE, "5:30", "5:50", false) as Array<Numeric>;
    Test.assert(p[0] == Target.PACE);
    Test.assert((p[1] - 1000.0 / 350).abs() < 0.001); // slower end is the lower speed
    Test.assert((p[2] - 1000.0 / 330).abs() < 0.001);
    var one = Target.parse(Target.PACE, "", "5:00", false) as Array<Numeric>;
    Test.assert((one[1] - 1000.0 / 305).abs() < 0.001); // ±5 s
    var w = Target.parse(Target.POWER, "270", "250", false) as Array<Numeric>;
    Test.assert(w[1] == 250);
    Test.assert(w[2] == 270);
    var w1 = Target.parse(Target.POWER, "300", "", false) as Array<Numeric>;
    Test.assert(w1[1] == 291); // ±3 %
    Test.assert(w1[2] == 309);
    var hr = Target.parse(Target.HR, "155", "", false) as Array<Numeric>;
    Test.assert(hr[1] == 150);
    Test.assert(hr[2] == 160);
    Test.assert(Target.parse(Target.PACE, "", "", false) == null);
    Test.assert(Target.parse(Target.PACE, "fast", "", false) == null);
    return true;
}

(:test)
function testTracker(logger as Logger) as Boolean {
    var t = new TargetTracker([Target.HR, 140, 150] as Array<Numeric>);
    Test.assert(t.update(130) == Target.BELOW);
    Test.assert(t.update(145) == Target.BELOW); // 3 s average: 137.5
    Test.assert(t.update(150) == Target.INSIDE); // 130, 145, 150: 141.7
    Test.assert(t.update(160) == Target.ABOVE); // 145, 150, 160: 151.7
    return true;
}
