import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FiArrowRight, FiBookOpen, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { RiBookShelfLine } from 'react-icons/ri'
import { TiMicrophoneOutline } from 'react-icons/ti'
import { TbSettings } from 'react-icons/tb'
import { useLibrary } from '../../hooks/useLibrary'
import { useReaderSettings } from '../../hooks/useReaderSettings'
import { getAppTheme } from '../../theme/appTheme'
import Tooltip from '../ui/Tooltip'

type SidebarProps = {
  collapsed: boolean
  onToggleCollapse: () => void
}

const navClass = (isActive: boolean, collapsed: boolean, activeClass: string, idleClass: string) =>
  `group relative w-full flex items-center gap-3 rounded-2xl border text-sm font-medium transition-all duration-300 ${
    collapsed ? 'justify-center px-2.5 py-3.5' : 'px-4 py-3.5'
  } ${isActive ? activeClass : idleClass}`

const navItems = [
  { path: '/', label: 'My Library', icon: <RiBookShelfLine className="text-lg" /> },
  { path: '/voice-market', label: 'Voice Studio', icon: <TiMicrophoneOutline className="text-lg" /> },
  { path: '/settings', label: 'Settings', icon: <TbSettings className="text-lg" /> }
]

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { library } = useLibrary()
  const { settings } = useReaderSettings()
  const theme = getAppTheme(settings.theme)

  const isLibraryActive = location.pathname === '/' || location.pathname.startsWith('/read/')
  const railPadding = collapsed ? 'p-3' : 'p-5'

  return (
    <aside
      className={`relative flex-shrink-0 overflow-hidden border-r flex flex-col gap-6 z-20 transition-[width,padding] duration-300 ${
        collapsed ? 'w-24' : 'w-[19rem]'
      } ${railPadding} ${theme.sidebar}`}
      aria-label={collapsed ? 'Collapsed sidebar' : 'Sidebar'}
    >
      <div className={`pointer-events-none absolute inset-0 ${theme.sidebarGlow}`} />

      <div
        className={`relative z-10 ${collapsed ? 'flex flex-col items-center gap-3' : 'flex items-center justify-between px-1'}`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div
            className={`flex items-center justify-center rounded-2xl border font-semibold tracking-[0.25em] shadow-[0_12px_30px_rgba(0,0,0,0.18)] ${
              collapsed ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-[11px]'
            } ${theme.sidebarLogo}`}
          >
            N
          </div>
          {!collapsed && (
            <div>
              <div className={`text-[11px] uppercase tracking-[0.35em] ${theme.sidebarWordmark}`}>Nur</div>
              <div className={`mt-1 text-xs ${theme.sidebarSubcopy}`}>Reader</div>
            </div>
          )}
        </div>

        <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="bottom">
          <button
            onClick={onToggleCollapse}
            className={`flex items-center justify-center rounded-full border shadow-[0_12px_26px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              collapsed
                ? `h-10 w-10 ${theme.secondaryButton}`
                : `h-9 w-9 ${theme.secondaryButton}`
            } ${theme.body}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <FiChevronRight className="text-base" /> : <FiChevronLeft />}
          </button>
        </Tooltip>
      </div>

      <nav className={`relative z-10 mt-1 flex flex-col gap-2 flex-none ${collapsed ? 'items-center' : ''}`}>
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
              <Tooltip key={item.path} label={item.label} className={collapsed ? '' : 'w-full'}>
                <button
                  onClick={() => navigate('/')}
                  className={navClass(isActive, collapsed, theme.navActive, theme.navIdle)}
                  aria-label={item.label}
                >
                  {content}
                  {!collapsed && (
                    <FiArrowRight className={`ml-auto text-xs opacity-0 transition group-hover:opacity-100 ${theme.subtle}`} />
                  )}
                  {collapsed && <span className="sr-only">{item.label}</span>}
                </button>
              </Tooltip>
            )
          }

          return (
            <Tooltip key={item.path} label={item.label} className={collapsed ? '' : 'w-full'}>
              <NavLink
                to={item.path}
                className={() => navClass(isActive, collapsed, theme.navActive, theme.navIdle)}
                aria-label={item.label}
              >
                {content}
                {!collapsed && (
                  <FiArrowRight className={`ml-auto text-xs opacity-0 transition group-hover:opacity-100 ${theme.subtle}`} />
                )}
                {collapsed && <span className="sr-only">{item.label}</span>}
              </NavLink>
            </Tooltip>
          )
        })}
      </nav>

      {!collapsed && (
        <div className={`relative z-10 mt-6 flex-1 min-h-0 rounded-[1.75rem] border p-4 flex flex-col ${theme.recentPanel}`}>
          <div className="flex items-center justify-between px-1">
            <div>
              <div className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${theme.eyebrow}`}>
                Recent Reads
              </div>
              <div className={`mt-1 text-xs ${theme.muted}`}>{library.length} in library</div>
            </div>
            <FiBookOpen className={theme.subtle} />
          </div>

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {library.length > 0 ? (
              <div className="space-y-2.5">
                {library.slice(0, 6).map((book) => (
                  <button
                    key={book.id}
                    onClick={() => navigate(`/read/${book.id}`)}
                    className={`group flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition hover:-translate-y-0.5 ${theme.recentItem}`}
                    aria-label={`Open ${book.title}`}
                  >
                    <div className={`relative h-12 w-9 flex-shrink-0 overflow-hidden rounded-xl border ${theme.softCard}`}>
                      {book.cover ? (
                        <img src={book.cover} className="h-full w-full object-cover" />
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center text-[10px] ${theme.subtle}`}>
                          Book
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm ${theme.title}`}>{book.title}</div>
                      <div className={`mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] ${theme.recentMeta}`}>
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
              <div className={`flex h-full min-h-32 items-center justify-center rounded-[1.25rem] border border-dashed px-4 text-center text-sm ${theme.recentEmpty}`}>
                Your recent reads will appear here once you add a book.
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
