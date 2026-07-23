/** @type {import('tailwindcss').Config} */

// ── 統一色票：平靜的大地色系 ──────────────────────────────
// 這裡刻意「覆寫」Tailwind 原本的 gray / blue / green / red / yellow / purple 等色階，
// 讓既有頁面上千個 utility class 不必逐一改寫，就能一致換成大地色。
// 語意對應：
//   gray   → 溫暖石色（頁面底、文字、邊框）
//   blue   → 陶土色（主要動作、連結、重點）
//   green  → 鼠尾草綠（成功、可用、匯出）
//   red    → 赤陶色（刪除、警示）
//   yellow → 赭黃色（提醒）
//   purple → 灰褐紫（次要標記）
const earth = {
  // 溫暖石色 / 紙感
  stone: {
    50: '#FAF8F4', 100: '#F3EFE8', 200: '#E7E0D5', 300: '#D6CCBD',
    400: '#B4A895', 500: '#8D8172', 600: '#6E6559', 700: '#554E45',
    800: '#3E3830', 900: '#2B2721',
  },
  // 陶土（主色）
  clay: {
    50: '#F8F3ED', 100: '#EFE4D7', 200: '#DFC9AF', 300: '#CBAA88',
    400: '#B58C65', 500: '#9C7049', 600: '#835A3B', 700: '#6A4830',
    800: '#513828', 900: '#3A2A21',
  },
  // 鼠尾草綠
  sage: {
    50: '#F3F5EF', 100: '#E5EADD', 200: '#CBD5BD', 300: '#ADBB99',
    400: '#8E9F76', 500: '#72845B', 600: '#5A6A49', 700: '#47543A',
    800: '#36402E', 900: '#272E22',
  },
  // 赤陶
  terracotta: {
    50: '#FBF2EE', 100: '#F6E2D9', 200: '#EAC3B2', 300: '#D99E86',
    400: '#C67C5F', 500: '#AE5E40', 600: '#914C33', 700: '#743D28',
    800: '#573020', 900: '#3E2318',
  },
  // 赭黃
  ochre: {
    50: '#FBF6EA', 100: '#F6EDD4', 200: '#ECD9AA', 300: '#DDC17D',
    400: '#CAA855', 500: '#B08C40', 600: '#8F7033', 700: '#705829',
    800: '#544321', 900: '#3B2F18',
  },
  // 灰褐紫
  mauve: {
    50: '#F8F4F3', 100: '#EFE7E5', 200: '#DBCFCA', 300: '#C2B0AA',
    400: '#A48E88', 500: '#87726C', 600: '#6E5C57', 700: '#574A46',
    800: '#413835', 900: '#2F2826',
  },
};

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 語意別名（新程式碼優先用這組）
        stone: earth.stone,
        clay: earth.clay,
        sage: earth.sage,
        terracotta: earth.terracotta,
        ochre: earth.ochre,
        mauve: earth.mauve,
        // 覆寫既有頁面在用的色名 → 一律導向大地色
        gray: earth.stone,
        slate: earth.stone,
        neutral: earth.stone,
        zinc: earth.stone,
        blue: earth.clay,
        sky: earth.clay,
        green: earth.sage,
        emerald: earth.sage,
        teal: earth.sage,
        red: earth.terracotta,
        rose: earth.terracotta,
        orange: earth.terracotta,
        yellow: earth.ochre,
        amber: earth.ochre,
        purple: earth.mauve,
        violet: earth.mauve,
        indigo: earth.mauve,
        pink: earth.mauve,
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', '-apple-system', '"Noto Sans TC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        // 大地色系的陰影：偏暖、低對比，避免藍黑硬邊
        sm: '0 1px 2px rgba(62,56,48,0.05)',
        DEFAULT: '0 1px 3px rgba(62,56,48,0.07)',
        md: '0 2px 8px rgba(62,56,48,0.06)',
        lg: '0 4px 16px rgba(62,56,48,0.07)',
        xl: '0 8px 32px rgba(62,56,48,0.10)',
      },
    },
  },
  plugins: [],
}
