export type ReaderAppearanceTheme = 'light' | 'sepia' | 'dark'

export interface ReaderPlayerTheme {
  shell: string
  button: string
  iconButton: string
  statusLabel: string
  statusValue: string
  separator: string
  wave: string
}

export interface ReaderSurfaceTheme {
  viewport: string
  ambient: string
  hud: string
  surface: string
  progressTrack: string
  progressFill: string
  eyebrow: string
  meta: string
  title: string
}

export const getPlayerTheme = (theme: ReaderAppearanceTheme): ReaderPlayerTheme => {
  if (theme === 'light') {
    return {
      shell: 'bg-white/95 text-zinc-900 border-black/10',
      button: 'bg-zinc-900 text-white hover:bg-zinc-800',
      iconButton: 'border-black/10 bg-black/5 text-zinc-700 hover:bg-black/10',
      statusLabel: 'text-zinc-500',
      statusValue: 'text-emerald-600',
      separator: 'border-black/10',
      wave: 'bg-zinc-700'
    }
  }

  if (theme === 'sepia') {
    return {
      shell: 'bg-[#f1e8d5]/95 text-[#3b2f1f] border-black/10',
      button: 'bg-[#3b2f1f] text-[#f4ecd8] hover:bg-[#2f2619]',
      iconButton: 'border-black/10 bg-black/5 text-[#3b2f1f] hover:bg-black/10',
      statusLabel: 'text-[#6a5a4a]',
      statusValue: 'text-emerald-700',
      separator: 'border-black/10',
      wave: 'bg-[#3b2f1f]'
    }
  }

  return {
    shell: 'bg-white/10 text-zinc-100 border-white/20',
    button: 'bg-white text-black hover:bg-zinc-200',
    iconButton: 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10',
    statusLabel: 'text-zinc-400',
    statusValue: 'text-emerald-400',
    separator: 'border-white/10',
    wave: 'bg-white'
  }
}

export const getReaderTheme = (theme: ReaderAppearanceTheme): ReaderSurfaceTheme => {
  if (theme === 'light') {
    return {
      viewport: 'bg-[#ece8e0]',
      ambient:
        'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(236,232,224,0.92)_45%,rgba(223,217,205,0.9)_100%)]',
      hud: 'bg-white/75 border-black/10 text-zinc-900',
      surface: 'bg-[#fcfbf7]/95 border-black/10 shadow-[0_32px_80px_rgba(60,48,29,0.14)]',
      progressTrack: 'bg-black/[0.08]',
      progressFill: 'bg-zinc-900',
      eyebrow: 'text-zinc-500',
      meta: 'text-zinc-600',
      title: 'text-zinc-900'
    }
  }

  if (theme === 'sepia') {
    return {
      viewport: 'bg-[#e6dcc7]',
      ambient:
        'bg-[radial-gradient(circle_at_top,rgba(255,245,220,0.62),rgba(230,220,199,0.92)_52%,rgba(214,201,174,0.9)_100%)]',
      hud: 'bg-[#f5ecda]/80 border-black/10 text-[#3b2f1f]',
      surface: 'bg-[#f4ecd8]/95 border-black/10 shadow-[0_32px_80px_rgba(66,43,12,0.16)]',
      progressTrack: 'bg-black/10',
      progressFill: 'bg-[#3b2f1f]',
      eyebrow: 'text-[#7a6652]',
      meta: 'text-[#6b5844]',
      title: 'text-[#2f2418]'
    }
  }

  return {
    viewport: 'bg-[#101113]',
    ambient:
      'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),rgba(16,17,19,0.72)_45%,rgba(10,11,13,0.95)_100%)]',
    hud: 'bg-black/35 border-white/10 text-zinc-100',
    surface: 'bg-[#15171b]/95 border-white/10 shadow-[0_32px_90px_rgba(0,0,0,0.42)]',
    progressTrack: 'bg-white/10',
    progressFill: 'bg-emerald-300',
    eyebrow: 'text-zinc-500',
    meta: 'text-zinc-400',
    title: 'text-zinc-100'
  }
}
