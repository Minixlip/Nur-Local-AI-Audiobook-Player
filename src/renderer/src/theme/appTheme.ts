export type AppThemeMode = 'light' | 'sepia' | 'dark'

export interface AppTheme {
  shell: string
  shellBackdrop: string
  shellGlowPrimary: string
  shellGlowSecondary: string
  mainPanel: string
  headerBorder: string
  sidebar: string
  sidebarGlow: string
  sidebarLogo: string
  sidebarWordmark: string
  sidebarSubcopy: string
  navActive: string
  navIdle: string
  recentPanel: string
  recentItem: string
  recentMeta: string
  recentEmpty: string
  eyebrow: string
  title: string
  body: string
  muted: string
  subtle: string
  pill: string
  readyBadge: string
  pendingBadge: string
  accentPill: string
  accentText: string
  accentDot: string
  accentOutline: string
  warningCallout: string
  dangerText: string
  selectionRing: string
  controlActive: string
  controlIdle: string
  spinner: string
  toggleTrackOn: string
  toggleThumb: string
  buttonChip: string
  overlayBackdrop: string
  overlayCard: string
  overlaySpinnerIdle: string
  overlaySpinnerError: string
  overlayMessage: string
  overlayProgressTrack: string
  overlayProgressFill: string
  primaryButton: string
  secondaryButton: string
  card: string
  heroCard: string
  softCard: string
  insetCard: string
  input: string
  inputIcon: string
  progressTrack: string
  progressFill: string
  coverFallback: string
  dialogBackdrop: string
  dialogCard: string
  link: string
}

export const getAppTheme = (theme: AppThemeMode): AppTheme => {
  if (theme === 'light') {
    return {
      shell: 'bg-[#ece8e0] text-zinc-800',
      shellBackdrop:
        'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_34%),radial-gradient(circle_at_82%_0%,rgba(120,113,108,0.08),transparent_30%),linear-gradient(180deg,rgba(244,241,234,0.98),rgba(233,228,218,1))]',
      shellGlowPrimary: 'bg-black/[0.04]',
      shellGlowSecondary: 'bg-amber-700/10',
      mainPanel: 'border-black/10 bg-white/45 backdrop-blur-2xl',
      headerBorder: 'border-black/10',
      sidebar:
        'border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.38))] backdrop-blur-2xl',
      sidebarGlow: 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),transparent_36%)]',
      sidebarLogo: 'border-black/10 bg-white/80 text-zinc-800',
      sidebarWordmark: 'text-zinc-500',
      sidebarSubcopy: 'text-zinc-600',
      navActive:
        'border-black/10 bg-black/[0.06] text-zinc-900 shadow-[0_14px_32px_rgba(0,0,0,0.08)]',
      navIdle:
        'border-transparent bg-transparent text-zinc-600 hover:border-black/10 hover:bg-black/[0.04] hover:text-zinc-900',
      recentPanel: 'border-black/10 bg-white/55 shadow-[0_20px_50px_rgba(0,0,0,0.08)]',
      recentItem: 'border-black/10 bg-black/[0.03] hover:border-black/15 hover:bg-black/[0.05]',
      recentMeta: 'text-zinc-500',
      recentEmpty: 'border-black/10 bg-black/[0.03] text-zinc-500',
      eyebrow: 'text-zinc-500',
      title: 'text-zinc-900',
      body: 'text-zinc-800',
      muted: 'text-zinc-600',
      subtle: 'text-zinc-500',
      pill: 'border-black/10 bg-black/[0.04] text-zinc-700',
      readyBadge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
      pendingBadge: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
      accentPill: 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800',
      accentText: 'text-emerald-800',
      accentDot: 'bg-emerald-700',
      accentOutline: 'border-emerald-600/20 shadow-[0_16px_30px_rgba(0,0,0,0.08)]',
      warningCallout: 'border-amber-600/20 bg-amber-600/10 text-amber-800',
      dangerText: 'text-red-700 hover:text-red-600',
      selectionRing: 'border-black/15',
      controlActive: 'bg-zinc-900 shadow-inner shadow-black/10',
      controlIdle: 'border-black/20',
      spinner: 'border-zinc-700/70 border-t-transparent',
      toggleTrackOn: 'bg-zinc-900 border-zinc-900',
      toggleThumb: 'bg-white',
      buttonChip: 'bg-black/10 text-current',
      overlayBackdrop: 'bg-[#e9e4da]/82',
      overlayCard: 'border-black/10 bg-[#fcfbf7]/95',
      overlaySpinnerIdle: 'border-black/10 border-t-emerald-500',
      overlaySpinnerError: 'border-red-500/20 border-t-red-500',
      overlayMessage: 'border-black/10 bg-black/[0.03] text-zinc-700',
      overlayProgressTrack: 'bg-black/10',
      overlayProgressFill: 'bg-emerald-500',
      primaryButton: 'border-black/10 bg-zinc-900 text-white hover:bg-zinc-800',
      secondaryButton: 'border-black/10 bg-black/[0.05] text-zinc-800 hover:bg-black/[0.08]',
      card: 'border-black/10 bg-white/70 shadow-[0_18px_45px_rgba(0,0,0,0.08)]',
      heroCard:
        'border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,245,238,0.84))] shadow-[0_22px_70px_rgba(0,0,0,0.10)]',
      softCard: 'border-black/10 bg-black/[0.04]',
      insetCard: 'border-black/10 bg-black/[0.035]',
      input:
        'border-black/10 bg-white/80 text-zinc-900 placeholder:text-zinc-500 focus:border-black/20 focus:bg-white',
      inputIcon: 'text-zinc-500',
      progressTrack: 'bg-black/10',
      progressFill: 'bg-zinc-900',
      coverFallback:
        'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_40%),linear-gradient(180deg,rgba(243,239,230,1),rgba(229,223,211,1))]',
      dialogBackdrop: 'bg-[#d8d0c4]/62',
      dialogCard: 'border-black/10 bg-[#fbfaf6]/96',
      link: 'text-emerald-700 hover:text-emerald-600'
    }
  }

  if (theme === 'sepia') {
    return {
      shell: 'bg-[#e6dcc7] text-[#3f3324]',
      shellBackdrop:
        'bg-[radial-gradient(circle_at_top_left,rgba(255,245,220,0.72),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(120,87,39,0.12),transparent_28%),linear-gradient(180deg,rgba(241,233,214,0.98),rgba(228,220,199,1))]',
      shellGlowPrimary: 'bg-white/20',
      shellGlowSecondary: 'bg-amber-700/12',
      mainPanel: 'border-black/10 bg-[#f4ecd9]/50 backdrop-blur-2xl',
      headerBorder: 'border-black/10',
      sidebar:
        'border-black/10 bg-[linear-gradient(180deg,rgba(247,239,224,0.86),rgba(238,229,210,0.48))] backdrop-blur-2xl',
      sidebarGlow: 'bg-[radial-gradient(circle_at_top,rgba(255,247,229,0.7),transparent_36%)]',
      sidebarLogo: 'border-black/10 bg-[#f8f1df] text-[#3b2f1f]',
      sidebarWordmark: 'text-[#7a6652]',
      sidebarSubcopy: 'text-[#6c5946]',
      navActive:
        'border-black/10 bg-black/[0.06] text-[#2f2418] shadow-[0_14px_32px_rgba(66,43,12,0.10)]',
      navIdle:
        'border-transparent bg-transparent text-[#6b5844] hover:border-black/10 hover:bg-black/[0.04] hover:text-[#2f2418]',
      recentPanel: 'border-black/10 bg-[#f5ecda]/66 shadow-[0_20px_50px_rgba(66,43,12,0.12)]',
      recentItem: 'border-black/10 bg-black/[0.03] hover:border-black/15 hover:bg-black/[0.05]',
      recentMeta: 'text-[#7a6652]',
      recentEmpty: 'border-black/10 bg-black/[0.03] text-[#7a6652]',
      eyebrow: 'text-[#7a6652]',
      title: 'text-[#2f2418]',
      body: 'text-[#3f3324]',
      muted: 'text-[#6b5844]',
      subtle: 'text-[#7a6652]',
      pill: 'border-black/10 bg-black/[0.04] text-[#5c4835]',
      readyBadge: 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800',
      pendingBadge: 'border-amber-600/20 bg-amber-600/10 text-amber-800',
      accentPill: 'border-emerald-700/20 bg-emerald-700/10 text-emerald-900',
      accentText: 'text-emerald-800',
      accentDot: 'bg-emerald-800',
      accentOutline: 'border-emerald-700/20 shadow-[0_16px_30px_rgba(66,43,12,0.10)]',
      warningCallout: 'border-amber-700/20 bg-amber-700/10 text-amber-900',
      dangerText: 'text-red-700 hover:text-red-600',
      selectionRing: 'border-black/15',
      controlActive: 'bg-[#3b2f1f] shadow-inner shadow-black/10',
      controlIdle: 'border-black/20',
      spinner: 'border-[#3b2f1f]/65 border-t-transparent',
      toggleTrackOn: 'bg-[#3b2f1f] border-[#3b2f1f]',
      toggleThumb: 'bg-[#f5ecda]',
      buttonChip: 'bg-black/10 text-current',
      overlayBackdrop: 'bg-[#d9ceb6]/78',
      overlayCard: 'border-black/10 bg-[#f6efde]/95',
      overlaySpinnerIdle: 'border-black/10 border-t-emerald-700',
      overlaySpinnerError: 'border-red-600/20 border-t-red-600',
      overlayMessage: 'border-black/10 bg-black/[0.03] text-[#5c4835]',
      overlayProgressTrack: 'bg-black/10',
      overlayProgressFill: 'bg-emerald-700',
      primaryButton: 'border-black/10 bg-[#3b2f1f] text-[#f4ecd8] hover:bg-[#2f2619]',
      secondaryButton:
        'border-black/10 bg-black/[0.05] text-[#3f3324] hover:bg-black/[0.08]',
      card: 'border-black/10 bg-[#f4ecd8]/82 shadow-[0_18px_45px_rgba(66,43,12,0.12)]',
      heroCard:
        'border-black/10 bg-[linear-gradient(180deg,rgba(249,242,228,0.96),rgba(241,233,214,0.9))] shadow-[0_22px_70px_rgba(66,43,12,0.14)]',
      softCard: 'border-black/10 bg-black/[0.04]',
      insetCard: 'border-black/10 bg-black/[0.035]',
      input:
        'border-black/10 bg-[#fbf4e4] text-[#2f2418] placeholder:text-[#7a6652] focus:border-black/20 focus:bg-[#fff8eb]',
      inputIcon: 'text-[#7a6652]',
      progressTrack: 'bg-black/10',
      progressFill: 'bg-[#3b2f1f]',
      coverFallback:
        'bg-[radial-gradient(circle_at_top,rgba(255,248,228,0.82),transparent_42%),linear-gradient(180deg,rgba(240,230,208,1),rgba(219,205,174,1))]',
      dialogBackdrop: 'bg-[#cdbf9f]/58',
      dialogCard: 'border-black/10 bg-[#f5ecda]/96',
      link: 'text-emerald-800 hover:text-emerald-700'
    }
  }

  return {
    shell: 'bg-[#08090c] text-zinc-100',
    shellBackdrop:
      'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(148,163,184,0.08),transparent_30%),linear-gradient(180deg,rgba(10,10,12,0.92),rgba(6,7,10,1))]',
    shellGlowPrimary: 'bg-white/[0.08]',
    shellGlowSecondary: 'bg-slate-500/10',
    mainPanel: 'border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl',
    headerBorder: 'border-white/[0.08]',
    sidebar:
      'border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] backdrop-blur-2xl',
    sidebarGlow: 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_35%)]',
    sidebarLogo: 'border-white/10 bg-white/[0.08] text-white',
    sidebarWordmark: 'text-zinc-500',
    sidebarSubcopy: 'text-zinc-400',
    navActive:
      'border-white/15 bg-white/10 text-white shadow-[0_14px_32px_rgba(0,0,0,0.22)]',
    navIdle:
      'border-transparent bg-white/0 text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-zinc-100',
    recentPanel: 'border-white/10 bg-white/[0.04] shadow-[0_20px_50px_rgba(0,0,0,0.24)]',
    recentItem: 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
    recentMeta: 'text-zinc-500',
    recentEmpty: 'border-white/10 bg-black/10 text-zinc-500',
    eyebrow: 'text-zinc-500',
    title: 'text-zinc-50',
    body: 'text-zinc-200',
    muted: 'text-zinc-400',
    subtle: 'text-zinc-500',
    pill: 'border-white/10 bg-white/5 text-zinc-300',
    readyBadge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    pendingBadge: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    accentPill: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
    accentText: 'text-emerald-300/80',
    accentDot: 'bg-emerald-300',
    accentOutline: 'border-emerald-300/30 shadow-lg',
    warningCallout: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    dangerText: 'text-red-400 hover:text-red-300',
    selectionRing: 'border-white/20',
    controlActive: 'bg-white shadow-inner shadow-black/20',
    controlIdle: 'border-white/20 hover:border-white/50',
    spinner: 'border-white/70 border-t-transparent',
    toggleTrackOn: 'bg-white/90 border-white/80',
    toggleThumb: 'bg-black',
    buttonChip: 'bg-black/10 text-black/70',
    overlayBackdrop: 'bg-zinc-950/82',
    overlayCard: 'border-white/10 bg-[#17181d]/92',
    overlaySpinnerIdle: 'border-white/15 border-t-emerald-300',
    overlaySpinnerError: 'border-red-400/25 border-t-red-400',
    overlayMessage: 'border-white/10 bg-white/[0.04] text-zinc-300',
    overlayProgressTrack: 'bg-white/10',
    overlayProgressFill: 'bg-emerald-300',
    primaryButton: 'border-white/10 bg-white text-black hover:bg-zinc-200',
    secondaryButton: 'border-white/10 bg-white/10 text-zinc-100 hover:bg-white/15',
    card: 'border-white/10 bg-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.35)]',
    heroCard:
      'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.03))] shadow-[0_22px_70px_rgba(0,0,0,0.24)]',
    softCard: 'border-white/10 bg-black/15',
    insetCard: 'border-white/10 bg-black/20',
    input:
      'border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:bg-black/30',
    inputIcon: 'text-zinc-500',
    progressTrack: 'bg-white/10',
    progressFill: 'bg-white/75',
    coverFallback:
      'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,rgba(24,24,27,0.9),rgba(15,15,18,1))]',
    dialogBackdrop: 'bg-black/60',
    dialogCard: 'border-white/10 bg-zinc-900/80',
    link: 'text-emerald-300 hover:text-emerald-200'
  }
}
