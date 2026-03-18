import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FiArrowRight, FiBookOpen, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { RiBookShelfLine } from 'react-icons/ri'
import { TiMicrophoneOutline } from 'react-icons/ti'
import { TbSettings } from 'react-icons/tb'
import { useLibrary } from '../../hooks/useLibrary'
import Tooltip from '../ui/Tooltip'

type SidebarProps = {
  collapsed: boolean
  onToggleCollapse: () => void
}

const navClass = (isActive: boolean, collapsed: boolean) =>
  `group relative w-full flex items-center gap-3 rounded-2xl border text-sm font-medium transition-all duration-300 ${
    collapsed ? 'justify-center px-2.5 py-3.5' : 'px-4 py-3.5'
  } ${
    isActive
      ? 'border-white/15 bg-white/10 text-white shadow-[0_14px_32px_rgba(0,0,0,0.22)]'
      : 'border-transparent bg-white/0 text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-zinc-100'
  }`

const navItems = [
  { path: '/', label: 'My Library', icon: <RiBookShelfLine className="text-lg" /> },
  { path: '/voice-market', label: 'Voice Studio', icon: <TiMicrophoneOutline className="text-lg" /> },
  { path: '/settings', label: 'Settings', icon: <TbSettings className="text-lg" /> }
]

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { library } = useLibrary()

  const isLibraryActive = location.pathname === '/' || location.pathname.startsWith('/read/')

  return (
    <aside
      className={`relative flex-shrink-0 overflow-hidden border-r border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] backdrop-blur-2xl flex flex-col p-5 gap-6 z-20 transition-[width] duration-300 ${
        collapsed ? 'w-20' : 'w-[19rem]'
      }`}
      aria-label="Sidebar"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_35%)]" />

      <div className={`relative z-10 flex items-center justify-between ${collapsed ? 'px-1' : 'px-1'}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-[11px] font-semibold tracking-[0.25em] text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            N
          </div>
          {!collapsed && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">Nur</div>
              <div className="mt-1 text-xs text-zinc-400">Reader</div>
            </div>
          )}
        </div>

        <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <button
            onClick={onToggleCollapse}
            className={`flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${
              collapsed ? 'h-8 w-8' : 'h-9 w-9'
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
          </button>
        </Tooltip>
      </div>

      <nav className="relative z-10 mt-1 flex flex-col gap-2 flex-none">
        {navItems.map((item) => {
          const isActive =
            item.path === '/' ? isLibraryActive : location.pathname.startsWith(item.path)
          const content = collapsed ? (
            <span aria-hidden="true" className="text-lg">
              {item.icon}
            </span>
          ) : (
            <>
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </>
          )

          if (item.path === '/') {
            return (
              <Tooltip key={item.path} label={item.label} className="w-full">
                <button
                  onClick={() => navigate('/')}
                  className={navClass(isActive, collapsed)}
                  aria-label={item.label}
                >
                  {content}
                  {!collapsed && (
                    <FiArrowRight className="ml-auto text-xs text-zinc-500 opacity-0 transition group-hover:opacity-100" />
                  )}
                  {collapsed && <span className="sr-only">{item.label}</span>}
                </button>
              </Tooltip>
            )
          }

          return (
            <Tooltip key={item.path} label={item.label} className="w-full">
              <NavLink to={item.path} className={() => navClass(isActive, collapsed)} aria-label={item.label}>
                {content}
                {!collapsed && (
                  <FiArrowRight className="ml-auto text-xs text-zinc-500 opacity-0 transition group-hover:opacity-100" />
                )}
                {collapsed && <span className="sr-only">{item.label}</span>}
              </NavLink>
            </Tooltip>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="relative z-10 mt-6 flex-1 min-h-0 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.24)] flex flex-col">
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                Recent Reads
              </div>
              <div className="mt-1 text-xs text-zinc-400">{library.length} in library</div>
            </div>
            <FiBookOpen className="text-zinc-500" />
          </div>

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {library.length > 0 ? (
              <div className="space-y-2.5">
                {library.slice(0, 6).map((book) => (
                  <button
                    key={book.id}
                    onClick={() => navigate(`/read/${book.id}`)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
                    aria-label={`Open ${book.title}`}
                  >
                    <div className="relative h-12 w-9 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70">
                      {book.cover ? (
                        <img src={book.cover} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                          Book
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-zinc-100">{book.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        <span>
                          {typeof book.lastPageIndex === 'number' && book.lastPageIndex > 0
                            ? `Page ${book.lastPageIndex + 1}`
                            : 'New'}
                        </span>
                        <FiArrowRight className="text-[9px] opacity-0 transition group-hover:opacity-100" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-32 items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-black/10 px-4 text-center text-sm text-zinc-500">
                Your recent reads will appear here once you add a book.
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
