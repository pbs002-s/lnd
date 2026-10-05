/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // Every color is a token. No raw hex in components.
    extend: {
      colors: {
        // Base / Surface tokens
        ground: 'var(--ground)',
        'ground-sunk': 'var(--ground-sunk)',
        sheet: 'var(--sheet)',
        'sheet-raised': 'var(--sheet-raised)',
        paper: 'var(--paper)',
        surface: 'var(--surface)',

        // Rules
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        'line-hair': 'var(--line-hair)',

        // Inks
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        'ink-900': 'var(--ink-900)',
        'ink-600': 'var(--ink-600)',
        'ink-300': 'var(--ink-300)',

        // Semantic & Brand Colors
        indigo: 'var(--indigo)',
        'indigo-ink': 'var(--indigo-ink)',
        'indigo-soft': 'var(--indigo-soft)',
        seal: 'var(--seal)',
        'seal-soft': 'var(--seal-soft)',
        state: 'var(--state)',
        'state-soft': 'var(--state-soft)',
        amber: 'var(--amber)',
        'amber-soft': 'var(--amber-soft)',

        // design.md specific tokens
        'green-900': 'var(--green-900)',
        'green-700': 'var(--green-700)',
        'green-500': 'var(--green-500)',
        'green-100': 'var(--green-100)',
        'navy-800': 'var(--navy-800)',
        'gold-500': 'var(--gold-500)',
        'gold-100': 'var(--gold-100)',
        'red-600': 'var(--red-600)',
        'red-100': 'var(--red-100)',
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans Bengali"', '-apple-system', 'sans-serif'],
        bangla: ['"Noto Sans Bengali"', '"Inter"', 'sans-serif'],
        serif: ['"Tiro Bangla"', '"Noto Sans Bengali"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // design.md scale: 14 / 17 (base) / 20 / 24 / 32 / 44 / 60
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        xs: ['0.75rem', { lineHeight: '1.15rem' }],
        sm: ['0.875rem', { lineHeight: '1.35rem' }], // 14px
        base: ['1.0625rem', { lineHeight: '1.7' }], // 17px base per design.md
        lg: ['1.25rem', { lineHeight: '1.5' }], // 20px
        xl: ['1.5rem', { lineHeight: '1.35' }], // 24px
        '2xl': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }], // 32px
        '3xl': ['2.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }], // 44px
        '4xl': ['3.75rem', { lineHeight: '1.05', letterSpacing: '-0.025em' }], // 60px
        '5xl': ['4.5rem', { lineHeight: '1.0', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        // design.md: inputs 10px, cards 16px, buttons 12px, pills 999px
        none: '0',
        sm: '6px',
        DEFAULT: '8px',
        md: '10px', // inputs
        lg: '12px', // buttons
        xl: '16px', // cards
        '2xl': '20px',
        '3xl': '24px',
        full: '9999px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        none: 'none',
      },
      transitionTimingFunction: {
        sheet: 'cubic-bezier(0.22, 0.9, 0.3, 1)',
        'ease-out': 'cubic-bezier(0.22, 0.9, 0.3, 1)',
        'ease-soft': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '280ms',
        slow: '600ms',
        hero: '2400ms',
        1: '150ms',
        2: '280ms',
        3: '600ms',
      },
      maxWidth: {
        measure: '62ch',
        shell: '1200px', // design.md grid max width 1200px
      },
    },
  },
  plugins: [],
};
