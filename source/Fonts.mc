// Fonts by pixel size. The Amazfit layout sizes text freely, so RunDeck
// does too: the watch's scalable Roboto Condensed Bold where the firmware
// has scalable fonts (API 4.2.1+, most watches from 2022 on), else the
// bitmap Roboto Condensed Bold shipped for each screen size
// (tools/gen-fonts.py), else the watch's fixed system fonts.

import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class FontCache {
    const FACES as Array<String> = ["RobotoCondensedBold", "RobotoCondensedRegular", "RobotoRegular"];
    const MAX_CACHED = 24;

    var vector as Boolean = false;
    var cache as Dictionary<Number, FontType> = {} as Dictionary<Number, FontType>;
    var bmSizes as Array<Number> = [];
    var bmFonts as Array<FontType?> = [];

    function initialize() {
        if (Graphics has :getVectorFont) {
            try {
                vector = Graphics.getVectorFont({:face => FACES, :size => 20}) != null;
            } catch (e) {
                vector = false;
            }
        }
        if (!vector) {
            try {
                var nums = Text.numbers(WatchUi.loadResource(Rez.Strings.BmSizes) as String);
                bmSizes = new Array<Number>[nums.size()];
                for (var i = 0; i < nums.size(); i++) {
                    bmSizes[i] = nums[i].toNumber();
                }
            } catch (e) {
                bmSizes = [];
            }
            bmFonts = new Array<FontType?>[bmSizes.size()];
        }
    }

    // Forget fonts no longer used (a layout change).
    function reset() as Void {
        cache = {} as Dictionary<Number, FontType>;
        bmFonts = new Array<FontType?>[bmSizes.size()];
    }

    // The largest font not above `size` px (the smallest there is when
    // nothing is that small).
    function get(size as Number) as FontType {
        return font(size, false);
    }

    // The same for text with letters: big bitmap fonts carry only digits.
    function text(size as Number) as FontType {
        return font(size, true);
    }

    function font(size as Number, letters as Boolean) as FontType {
        if (size < 6) {
            size = 6;
        }
        var key = letters ? -size : size;
        var f = cache[key];
        if (f != null) {
            return f;
        }
        if (vector) {
            f = Graphics.getVectorFont({:face => FACES, :size => size});
        }
        if (f == null && bmSizes.size() > 0) {
            var best = 0;
            var top = letters && BM_TEXT < bmSizes.size() ? BM_TEXT : bmSizes.size();
            for (var i = 0; i < top; i++) {
                if (bmSizes[i] <= size) {
                    best = i;
                }
            }
            f = bmFonts[best];
            if (f == null) {
                f = WatchUi.loadResource(BM_FONTS[best]) as FontResource;
                bmFonts[best] = f;
            }
        }
        if (f == null) {
            f = systemFont(size);
        }
        if (cache.size() >= MAX_CACHED) {
            cache = {} as Dictionary<Number, FontType>;
        }
        cache[key] = f;
        return f;
    }

    // The next smaller font size there is below `size` (for fitting text).
    function smaller(size as Number) as Number {
        if (vector) {
            return size - (size > 30 ? 2 : 1);
        }
        if (bmSizes.size() > 0) {
            var next = 0;
            for (var i = 0; i < bmSizes.size(); i++) {
                if (bmSizes[i] < size) {
                    next = bmSizes[i];
                }
            }
            return next;
        }
        for (var i = SYSTEM.size() - 1; i >= 0; i--) {
            var h = Graphics.getFontHeight(SYSTEM[i]) * 3 / 4;
            if (h < size) {
                return h;
            }
        }
        return 0;
    }

    const SYSTEM as Array<FontDefinition> = [
        Graphics.FONT_XTINY, Graphics.FONT_TINY, Graphics.FONT_SMALL,
        Graphics.FONT_MEDIUM, Graphics.FONT_LARGE,
    ];

    // System fonts are named by size class, not pixels: the largest whose
    // cap height (about 3/4 of the line height) is not above `size`.
    function systemFont(size as Number) as FontType {
        var best = SYSTEM[0];
        for (var i = 0; i < SYSTEM.size(); i++) {
            if (Graphics.getFontHeight(SYSTEM[i]) * 3 / 4 <= size) {
                best = SYSTEM[i];
            }
        }
        return best;
    }
}
