export const MOBILE_KEYBOARD_MIN_INSET_PX = 80;

export function getMobileKeyboardInset(
  layoutViewportHeight: number,
  visualViewportHeight: number,
  visualViewportOffsetTop: number,
): number {
  return Math.max(
    0,
    Math.round(
      layoutViewportHeight - visualViewportHeight - visualViewportOffsetTop,
    ),
  );
}
