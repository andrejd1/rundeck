// Layout editor page, round 480x480 (px()-scaled from designWidth 480).

import { align } from "@zos/ui"
import { px } from "@zos/utils"

export const COLORS = {
  button: 0x222222,
  selected: 0x0e7a3e,
  pressed: 0x444444,
  muted: 0x111111,
  danger: 0x6b1d1d,
  row: 0x13324f, // row header (tap to change the column count)
}

export const TITLE = {
  x: px(60),
  y: px(40),
  w: px(360),
  h: px(50),
  color: 0xffffff,
  text_size: px(32),
  align_h: align.CENTER_H,
  align_v: align.CENTER_V,
}

export const BUTTON = {
  x: px(50),
  w: px(380),
  h: px(64),
  radius: px(32),
  text_size: px(26),
  color: 0xffffff,
}

export const ROW = { gap: px(10), bottomPad: px(160) }

export const ERROR_TEXT = {
  x: px(50),
  y: px(160),
  w: px(380),
  h: px(200),
  color: 0xff6b6b,
  text_size: px(24),
  align_h: align.CENTER_H,
  align_v: align.CENTER_V,
}
