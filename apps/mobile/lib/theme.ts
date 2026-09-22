/**
 * React Native theme — mirrors `@mch/ui-v2/tokens.css` (cream / taupe / gold).
 * CSS variables cannot ship in the native bundle; values stay in sync with
 * packages/ui-v2/src/tokens.css.
 */
export const tokens = {
  colorCharcoal: '#3a352d',
  colorOffWhite: '#f6f1e7',
  colorGold: '#8c7b5a',
  colorAction: '#0071c2',
  colorActionHover: '#005999',
  colorOnSurface: '#2b2722',
  colorOnSurfaceVariant: '#6f675b',
  colorSurfaceBright: '#fffefb',
  colorOutlineVariant: '#d8cfbc',
  colorDanger: '#b3261e',
  fontSans: 'System',
  fontSerif: 'Georgia',
  spaceGutter: 16,
  spaceStackSm: 8,
  spaceStackMd: 12,
  spaceStackLg: 16,
  spaceStackXl: 24,
  radiusSm: 4,
  radiusMd: 6,
  radiusLg: 8,
  touchTarget: 44,
  searchBarHeight: 52,
} as const;
