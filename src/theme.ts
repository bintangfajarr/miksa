export const theme = {
  color: {
    bg: '#0F1115',
    surface: '#181B22',
    surfaceAlt: '#1F232C',
    border: '#2A2F3A',
    text: '#ECEEF2',
    textMuted: '#9BA3B2',
    accent: '#5B8DEF',
    wrong: '#E5646E',
    right: '#4CC38A',
  },
  space: (n: number) => n * 4,
  radius: { sm: 8, md: 12, lg: 16 },
} as const;
