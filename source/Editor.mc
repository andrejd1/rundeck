// The on-watch layout editor: the data field's settings on the watch
// (activity settings, data screens, the RunDeck field, settings). Writes
// the same properties as the Garmin Connect settings page.
//
// One list: per row its column count and the field of every spot it shows,
// then field names, the zone bar and presets. A spot opens the field
// picker; a column count steps through its allowed values.

import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class EditorMenu extends WatchUi.Menu2 {
    function initialize() {
        Menu2.initialize({:title => "RunDeck"});
        build();
    }

    function build() as Void {
        var cfg = new Config();
        for (var r = 0; r < cfg.cols.size(); r++) {
            var cols = cfg.cols[r];
            addItem(new WatchUi.MenuItem(FieldTable.ROW_NAME[r],
                cols + (cols == 1 ? " column" : " columns"), "c" + r, {}));
            var ids = Layout.rowSlots(r, cols);
            for (var k = 0; k < ids.size(); k++) {
                var s = ids[k];
                addItem(new WatchUi.MenuItem("  " + FieldTable.SLOT_NAME[s],
                    FieldTable.name(cfg.slots[s]), "s" + s, {}));
            }
        }
        addItem(new WatchUi.MenuItem("Field names", EditorMenu.labelsName(cfg.labels), "labels", {}));
        addItem(new WatchUi.MenuItem("Zone bar", EditorMenu.barName(cfg.bar), "bar", {}));
        addItem(new WatchUi.MenuItem("Smaller spots", FieldTable.name(cfg.compact), "compact", {}));
        addItem(new WatchUi.MenuItem("Presets", null, "presets", {}));
    }

    static function labelsName(l as Number) as String {
        return l == 1 ? "Short text" : l == 2 ? "Icons" : "Text";
    }

    static function barName(b as Number) as String {
        var names = ["Auto", "Heart rate", "Pace", "Power", "Off"];
        return b >= 0 && b < names.size() ? names[b] : names[0];
    }
}

class EditorDelegate extends WatchUi.Menu2InputDelegate {
    var menu as EditorMenu;

    function initialize(m as EditorMenu) {
        Menu2InputDelegate.initialize();
        menu = m;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId() as String;
        var cfg = new Config();
        var head = id.substring(0, 1) as String;
        var rest = (id.substring(1, id.length()) as String).toNumber();
        if (head.equals("c") && rest != null) {
            var r = rest;
            var allowed = FieldTable.ROW_COLS[r];
            var i = allowed.indexOf(cfg.cols[r]);
            Config.set(FieldTable.ROW_KEY[r], allowed[(i + 1) % allowed.size()]);
            changed();
            // the spots shown changed: a fresh list, focus kept on this row
            var m = new EditorMenu();
            var idx = m.findItemById(id);
            if (idx >= 0) {
                m.setFocus(idx);
            }
            WatchUi.switchToView(m, new EditorDelegate(m), WatchUi.SLIDE_IMMEDIATE);
        } else if (head.equals("s") && rest != null) {
            var s = rest;
            pushPicker(FieldTable.SLOT_NAME[s], FieldTable.SLOT_KEY[s], cfg.slots[s], item);
        } else if (id.equals("compact")) {
            pushPicker("Smaller spots", "compact", cfg.compact, item);
        } else if (id.equals("labels")) {
            var v = (cfg.labels + 1) % 3;
            Config.set("labels", v);
            item.setSubLabel(EditorMenu.labelsName(v));
            changed();
        } else if (id.equals("bar")) {
            var b = (cfg.bar + 1) % 5;
            Config.set("bar", b);
            item.setSubLabel(EditorMenu.barName(b));
            changed();
        } else if (id.equals("presets")) {
            var pm = new PresetMenu();
            WatchUi.pushView(pm, new PresetDelegate(), WatchUi.SLIDE_LEFT);
        }
    }

    function pushPicker(title as String, key as String, current as Number, item as WatchUi.MenuItem) as Void {
        var picker = new WatchUi.Menu2({:title => title});
        var focus = 0;
        for (var i = 0; i < FieldTable.PICKER.size(); i++) {
            var f = FieldTable.PICKER[i];
            picker.addItem(new WatchUi.MenuItem(FieldTable.name(f), null, f, {}));
            if (f == current) {
                focus = i;
            }
        }
        picker.setFocus(focus);
        WatchUi.pushView(picker, new PickerDelegate(key, item), WatchUi.SLIDE_LEFT);
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}

function changed() as Void {
    getApp().reload();
}

class PickerDelegate extends WatchUi.Menu2InputDelegate {
    var key as String;
    var parent as WatchUi.MenuItem;

    function initialize(k as String, p as WatchUi.MenuItem) {
        Menu2InputDelegate.initialize();
        key = k;
        parent = p;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var f = item.getId() as Number;
        Config.set(key, f);
        parent.setSubLabel(FieldTable.name(f));
        changed();
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}

class PresetMenu extends WatchUi.Menu2 {
    function initialize() {
        Menu2.initialize({:title => "Presets"});
        for (var n = 1; n <= Presets.COUNT; n++) {
            if (Presets.exists(n)) {
                addItem(new WatchUi.MenuItem("Apply " + Presets.name(n), null, n, {}));
            }
        }
        for (var n = 1; n <= Presets.COUNT; n++) {
            addItem(new WatchUi.MenuItem("Save as " + Presets.name(n),
                Presets.exists(n) ? "replaces it" : "empty", 10 + n, {}));
        }
    }
}

class PresetDelegate extends WatchUi.Menu2InputDelegate {
    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var a = item.getId() as Number;
        if (a > 10) {
            Presets.save(a - 10);
            item.setSubLabel("saved");
            return;
        }
        if (Presets.apply(a)) {
            changed();
            // back to a fresh editor showing the preset's layout
            WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
            var m = new EditorMenu();
            WatchUi.switchToView(m, new EditorDelegate(m), WatchUi.SLIDE_IMMEDIATE);
        }
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}
