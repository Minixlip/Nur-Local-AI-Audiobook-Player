import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlus, FiSearch } from 'react-icons/fi'
import { useBookImporter } from '../../../hooks/useBookImporter'
import { useLibrary, SavedBook } from '../../../hooks/useLibrary'
import Tooltip from '../../ui/Tooltip'

export default function Library(): React.JSX.Element {
  const navigate = useNavigate()
  const { library, addToLibrary, removeBook } = useLibrary()
  const { importBook } = useBookImporter()
  const [search, setSearch] = useState('')

  const handleImportNew = async () => {
    const bookData = await importBook(true)
    if (!bookData) return

    const savedBook = await addToLibrary(bookData.filePath, bookData.title, bookData.cover || null)
    if (savedBook?.id) {
      navigate(`/read/${savedBook.id}`)
    }
  }

  const openBook = (book: SavedBook) => {
    navigate(`/read/${book.id}`)
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredLibrary = normalizedSearch
    ? library.filter((book) => book.title.toLowerCase().includes(normalizedSearch))
    : library

  const totalBooks = library.length
  const resumedBooks = library.filter((book) => typeof book.lastPageIndex === 'number' && book.lastPageIndex > 0).length
  const finishedBooks = library.filter(
    (book) =>
      typeof book.lastPageIndex === 'number' &&
      typeof book.totalPages === 'number' &&
      book.totalPages > 0 &&
      book.lastPageIndex + 1 >= book.totalPages
  ).length

  return (
    <div className="h-full overflow-y-auto px-5 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.03))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">Library</div>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50 md:text-5xl">
                Your shelf, ready to read.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                Import EPUBs, resume a chapter in one click, and keep progress synced with voice
                playback.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Tooltip label="Import a new book">
                <button
                  onClick={handleImportNew}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-[0_14px_30px_rgba(0,0,0,0.25)] transition hover:bg-zinc-200 active:scale-95"
                >
                  <FiPlus className="text-base" />
                  Add Book
                </button>
              </Tooltip>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-300">
                {totalBooks} total
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Books</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-50">{totalBooks}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">In progress</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-50">{resumedBooks}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Finished</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-50">{finishedBooks}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="relative flex-1">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your library"
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-white/20 focus:bg-black/30"
              />
            </label>

            <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
              {filteredLibrary.length} visible of {totalBooks}
            </div>
          </div>
        </section>

        {filteredLibrary.length > 0 ? (
          <section className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredLibrary.map((book) => (
              <article
                key={book.id}
                className="group relative cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openBook(book)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openBook(book)
                  }
                }}
                aria-label={`Open ${book.title}`}
              >
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-[0_18px_45px_rgba(0,0,0,0.24)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:bg-white/[0.06]">
                  <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900/70">
                    {book.cover ? (
                      <img
                        src={book.cover}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        alt={book.title}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,rgba(24,24,27,0.9),rgba(15,15,18,1))] p-4 text-center">
                        <div className="text-3xl font-semibold tracking-[0.2em] text-zinc-100">Nur</div>
                        <div className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                          No cover
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.48))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {typeof book.lastPageIndex === 'number' && book.lastPageIndex > 0 && (
                      <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-md">
                        Continue
                      </div>
                    )}

                    <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 opacity-0 transition duration-300 group-hover:opacity-100">
                      <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black">
                        Open
                      </span>
                      <button
                        onClick={(event) => removeBook(book.id, event)}
                        className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md transition hover:bg-red-500/80"
                        aria-label={`Remove ${book.title}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 px-4 pb-4 pt-4">
                    <div className="min-h-12">
                      <h3 className="text-sm font-semibold leading-snug text-zinc-100">
                        {book.title}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                      <span>Added {new Date(book.dateAdded).toLocaleDateString()}</span>
                      {typeof book.lastPageIndex === 'number' && book.lastPageIndex > 0 ? (
                        <span className="text-emerald-300/80">Resume</span>
                      ) : (
                        <span>New</span>
                      )}
                    </div>

                    {typeof book.lastPageIndex === 'number' &&
                      typeof book.totalPages === 'number' &&
                      book.totalPages > 0 && (
                        <div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-white/75"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(2, ((book.lastPageIndex + 1) / book.totalPages) * 100)
                                )}%`
                              }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500">
                            Page {book.lastPageIndex + 1} of {book.totalPages}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
            <div className="mx-auto max-w-xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">
                Empty shelf
              </div>
              <h3 className="mt-3 text-2xl font-semibold text-zinc-50">
                Import your first book to get started.
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Nur keeps reading state local, so your library stays fast and private.
              </p>
              <div className="mt-6 flex justify-center">
                <Tooltip label="Import a new book">
                  <button
                    onClick={handleImportNew}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 active:scale-95"
                  >
                    <FiPlus className="text-base" />
                    Import EPUB
                  </button>
                </Tooltip>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
