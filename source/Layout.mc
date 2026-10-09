// Screen geometry: the slot grid. The numbers live in tools/catalog.py
// (generated into LayoutTable.mc) so the preview renderer draws exactly
// what the watch draws. Designed at 480 px, scaled per screen by the field.

import Toybox.Lang;

module Layout {

    const SLOT_HEADER = 0;

    // slot indices a row shows for a column count (left to right)
    function rowSlots(row as Number, cols as Number) as Array<Number> {
        if (row == 0) {
            return cols == 2 ? [1, 2] : [0];
        }
        var base = row * 3;
        if (cols == 1) {
            return [base + 1];
        }
        if (cols == 2) {
            return [base, base + 2];
        }
        return [base, base + 1, base + 2];
    }
}
