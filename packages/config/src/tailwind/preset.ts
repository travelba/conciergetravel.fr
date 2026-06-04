import type { Config } from 'tailwindcss';

/**
 * Tailwind preset shared between apps/web, apps/admin and packages/ui.
 *
 * Aligned with CDC §10 (visual identity).
 *
 * Tokens come from CSS custom properties (see packages/ui/src/tokens.css)
 * so the design can be re-styled by overriding a single tokens file.
 *
 * Naming convention:
 *   - **Brand tokens** (charcoal, off-white, gold, sage) — semantic, prefer these
 *   - **Material 3 named tokens** (surface, on-surface, outline, etc.) — for
 *     advanced surface/interaction work
 *   - **Legacy aliases** (bg, fg, muted, border, accent) — kept for
 *     backward-compat with existing components
 */
const preset = {
  darkMode: 'class',
  content: [],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        /* ---------------------------------------------------------------- */
        /* Brand tokens (preferred — semantic)                              */
        /* ---------------------------------------------------------------- */
        charcoal: 'var(--color-charcoal)',
        'off-white': 'var(--color-off-white)',
        gold: {
          DEFAULT: 'var(--color-gold)',
          50: 'var(--color-gold-50)',
          100: 'var(--color-gold-100)',
          200: 'var(--color-gold-200)',
          300: 'var(--color-gold-300)',
          400: 'var(--color-gold-400)',
          500: 'var(--color-gold-500)',
          600: 'var(--color-gold-600)',
          700: 'var(--color-gold-700)',
          800: 'var(--color-gold-800)',
          900: 'var(--color-gold-900)',
        },
        sage: 'var(--color-sage)',
        'primary-heritage': 'var(--color-primary-heritage)',
        ring: 'var(--color-ring)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',

        /* ---------------------------------------------------------------- */
        /* Material Design 3 named tokens                                   */
        /* (only the most-used; full set available as CSS vars in tokens.css) */
        /* ---------------------------------------------------------------- */
        surface: {
          DEFAULT: 'var(--color-surface)',
          bright: 'var(--color-surface-bright)',
          dim: 'var(--color-surface-dim)',
          variant: 'var(--color-surface-variant)',
          container: {
            DEFAULT: 'var(--color-surface-container)',
            lowest: 'var(--color-surface-container-lowest)',
            low: 'var(--color-surface-container-low)',
            high: 'var(--color-surface-container-high)',
            highest: 'var(--color-surface-container-highest)',
          },
        },
        'on-surface': {
          DEFAULT: 'var(--color-on-surface)',
          variant: 'var(--color-on-surface-variant)',
        },
        'inverse-surface': 'var(--color-inverse-surface)',
        'inverse-on-surface': 'var(--color-inverse-on-surface)',
        outline: {
          DEFAULT: 'var(--color-outline)',
          variant: 'var(--color-outline-variant)',
        },

        /* ---------------------------------------------------------------- */
        /* Legacy aliases — kept for backward-compat                        */
        /* ---------------------------------------------------------------- */
        bg: 'var(--color-bg)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        accent: {
          DEFAULT: 'var(--color-accent-gold)',
          fg: 'var(--color-accent-fg)',
        },
      },

      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },

      /* ----------------------------------------------------------------- */
      /* Type scale                                                        */
      /* (the default Tailwind sizes remain available; these are extras)   */
      /* ----------------------------------------------------------------- */
      fontSize: {
        'display-xl': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '400' }],
        'display-lg': ['64px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '500' }],
        'headline-lg': ['32px', { lineHeight: '1.2', fontWeight: '400' }],
        'headline-md': ['24px', { lineHeight: '1.3', fontWeight: '400' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        'label-caps': ['12px', { lineHeight: '1.0', letterSpacing: '0.1em', fontWeight: '600' }],
        interactive: ['14px', { lineHeight: '1.0', fontWeight: '500' }],
      },

      /* ----------------------------------------------------------------- */
      /* Radius — soft 4px DEFAULT                                          */
      /* ----------------------------------------------------------------- */
      borderRadius: {
        none: '0',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },

      /* ----------------------------------------------------------------- */
      /* Elevation — token-driven soft shadows                             */
      /* ----------------------------------------------------------------- */
      boxShadow: {
        xs: 'var(--shadow-xs)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        overlay: 'var(--shadow-overlay)',
      },

      ringColor: {
        DEFAULT: 'var(--color-ring)',
      },

      /* ----------------------------------------------------------------- */
      /* Spacing — named tokens for editorial layout                       */
      /* ----------------------------------------------------------------- */
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        gutter: 'var(--space-gutter)' /* 24px */,
        'margin-mobile': 'var(--space-margin-mobile)' /* 20px */,
        'margin-desktop': 'var(--space-margin-desktop)' /* 80px */,
        'section-gap': 'var(--space-section-gap)' /* 120px */,
        'touch-target': 'var(--space-touch-target)' /* 44px */,
      },

      /* ----------------------------------------------------------------- */
      /* Min height — touch target enforcement (a11y skill, WCAG 2.2 AA)   */
      /* ----------------------------------------------------------------- */
      minHeight: {
        'touch-target': 'var(--space-touch-target)',
      },
      minWidth: {
        'touch-target': 'var(--space-touch-target)',
      },

      maxWidth: {
        prose: 'var(--max-prose)',
        editorial: 'var(--max-editorial)',
      },

      transitionTimingFunction: {
        'editorial-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
        editorial: 'var(--ease-editorial)',
        standard: 'var(--ease-standard)',
      },

      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        slow: 'var(--motion-slow)',
      },

      /* ----------------------------------------------------------------- */
      /* Letter-spacing for label-caps                                      */
      /* ----------------------------------------------------------------- */
      letterSpacing: {
        caps: '0.1em',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default preset;
