export const MOBILE_COMPOSER_BOTTOM_GAP_PX = 10;

export function getMobileComposerShift(
  composerBottom: number,
  visualViewportHeight: number,
  bottomGap = MOBILE_COMPOSER_BOTTOM_GAP_PX,
): number {
  if (
    !Number.isFinite(composerBottom) ||
    !Number.isFinite(visualViewportHeight) ||
    !Number.isFinite(bottomGap)
  ) {
    return 0;
  }

  return Math.min(
    0,
    Math.round(visualViewportHeight - bottomGap - composerBottom),
  );
}
