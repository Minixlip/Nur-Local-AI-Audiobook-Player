import { useState, useEffect } from 'react'

// Define the shape of a book (optional but good for TS)
export interface SavedBook {
  id: string
  title: string
  path: string
  cover?: string | null
  dateAdded: string
  lastPageIndex?: number
  totalPages?: number
  lastAnchorSentenceIndex?: number
  summary?: string | null
  summaryUpdatedAt?: string | null
  summaryModel?: string | null
}

export function useLibrary() {
  const [library, setLibrary] = useState<SavedBook[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(true)

  const refreshLibrary = async () => {
    try {
      setLoadingLibrary(true)
      const books = await window.api.getLibrary()
      // Sort by newest first
      setLibrary(
        books.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
      )
    } catch (e) {
      console.error('Failed to load library', e)
    } finally {
      setLoadingLibrary(false)
    }
  }

  // UPDATE: Accept cover argument
  const addToLibrary = async (filePath: string, title: string, cover: string | null) => {
    const result = await window.api.saveBook(filePath, title, cover)
    await refreshLibrary()
    window.dispatchEvent(new Event('library:updated'))
    return result?.book ?? null
  }

  const removeBook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent clicking the book card while deleting
    if (confirm('Are you sure you want to delete this book?')) {
      await window.api.deleteBook(id)
      await refreshLibrary()
      window.dispatchEvent(new Event('library:updated'))
    }
  }

  const updateProgress = async (
    bookId: string,
    pageIndex: number,
    totalPages?: number,
    anchorSentenceIndex?: number
  ) => {
    setLibrary((prev) =>
      prev.map((b) =>
        b.id === bookId
          ? {
              ...b,
              lastPageIndex: pageIndex,
              totalPages,
              lastAnchorSentenceIndex: anchorSentenceIndex
            }
          : b
      )
    )
    await window.api.updateBookProgress(bookId, {
      lastPageIndex: pageIndex,
      totalPages,
      lastAnchorSentenceIndex: anchorSentenceIndex
    })
  }

  const updateSummary = async (
    bookId: string,
    summary: string | null,
    summaryUpdatedAt?: string | null,
    summaryModel?: string | null
  ) => {
    setLibrary((prev) =>
      prev.map((book) =>
        book.id === bookId
          ? {
              ...book,
              summary,
              summaryUpdatedAt: summaryUpdatedAt ?? null,
              summaryModel: summaryModel ?? null
            }
          : book
      )
    )

    await window.api.updateBookSummary(
      bookId,
      summary,
      summaryUpdatedAt ?? null,
      summaryModel ?? null
    )
  }

  // Load on startup
  useEffect(() => {
    refreshLibrary()
  }, [])

  useEffect(() => {
    const handleUpdate = () => {
      refreshLibrary()
    }
    window.addEventListener('library:updated', handleUpdate)
    return () => window.removeEventListener('library:updated', handleUpdate)
  }, [])

  return {
    library,
    loadingLibrary,
    refreshLibrary,
    addToLibrary,
    removeBook,
    updateProgress,
    updateSummary
  }
}
