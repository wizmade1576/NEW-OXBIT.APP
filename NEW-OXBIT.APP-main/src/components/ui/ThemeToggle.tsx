import * as React from 'react'

function applyTheme(isDark: boolean) {
  const root = document.documentElement
  if (isDark) {
    root.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    root.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

function getInitial(): boolean {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'light') return false
    if (saved === 'dark') return true
  } catch {}
  return true // 기본값: 다크
}

export default function ThemeToggle() {
  const [isDark, setIsDark] = React.useState<boolean>(getInitial)

  React.useEffect(() => {
    applyTheme(isDark)
  }, [isDark])

  return (
    <button
      type="button"
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      onClick={() => setIsDark((v) => !v)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
      title={isDark ? '라이트 모드' : '다크 모드'}
    >
      <span className="text-base" role="img" aria-hidden>
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  )
}

