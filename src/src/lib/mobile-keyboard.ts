export const MOBILE_KEYBOARD_MIN_INSET_PX = 80;
export const MOBILE_KEYBOARD_FALLBACK_MIN_PX = 260;
export const MOBILE_KEYBOARD_FALLBACK_MAX_PX = 380;
export const MOBILE_KEYBOARD_FALLBACK_RATIO = 0.42;
export const MOBILE_KEYBOARD_MIN_VISIBLE_VIEWPORT_PX = 160;

export function getMobileKeyboardInset(
  stableViewportHeight: number,
  visualViewportHeight: number,
  visualViewportOffsetTop = 0,
): number {
  if (
    !Number.isFinite(stableViewportHeight) ||
    !Number.isFinite(visualViewportHeight) ||
    !Number.isFinite(visualViewportOffsetTop)
  ) {
    return 0;
  }

  const visibleViewportBottom =
    Math.max(0, visualViewportOffsetTop) + visualViewportHeight;
  const inset = Math.max(
    0,
    Math.round(stableViewportHeight - visibleViewportBottom),
  );

  return inset >= MOBILE_KEYBOARD_MIN_INSET_PX ? inset : 0;
}

export function getMobileKeyboardFallbackInset(
  stableViewportHeight: number,
): number {
  if (!Number.isFinite(stableViewportHeight) || stableViewportHeight <= 0) {
    return 0;
  }

  return Math.min(
    MOBILE_KEYBOARD_FALLBACK_MAX_PX,
    Math.max(
      MOBILE_KEYBOARD_FALLBACK_MIN_PX,
      Math.round(stableViewportHeight * MOBILE_KEYBOARD_FALLBACK_RATIO),
    ),
    Math.max(0, stableViewportHeight - MOBILE_KEYBOARD_MIN_VISIBLE_VIEWPORT_PX),
  );
}

export function getMobileComposerInset(
  layoutViewportHeight: number,
  visibleViewportBottom: number,
): number {
  if (
    !Number.isFinite(layoutViewportHeight) ||
    !Number.isFinite(visibleViewportBottom)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(layoutViewportHeight - visibleViewportBottom),
  );
}
