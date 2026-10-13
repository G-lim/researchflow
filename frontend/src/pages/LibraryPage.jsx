// LibraryPage.jsx 资料库页面
// 功能：
//   - 顶部集合管理（CollectionsPanel）
//   - 筛选栏（LibraryFilters）
//   - 已保存论文列表，支持删除
//   - 点击标题进入详情页

import { useState, useEffect, useCallback } from 'react'
import { listSavedPapers, deletePaper } from '../api/papers'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import CollectionsPanel from '../components/CollectionsPanel'
import LibraryFilters, { DEFAULT_FILTERS } from '../components/LibraryFilters'

function LibraryPage({ onSelectPaper }) {
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [collections, setCollections] = useState([])

  const handleCollectionsLoaded = useCallback((list) => {
    setCollections(list)
    setFilters((current) =>
      current.collection_id != null &&
      !list.some((collection) => collection.id === current.collection_id)
        ? { ...current, collection_id: null }
        : current
    )
  }, [])

  // ---------- 加载论文列表 ----------
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await listSavedPapers(filters)
        if (cancelled) return
        setPapers(result.papers)
      } catch (err) {
        if (cancelled) return
        setError(
          err.response?.data?.error?.message ||
            'Failed to load your library. Please try again.'
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timer = setTimeout(load, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [filters])

  // ---------- 删除论文 ----------
  const handleDelete = async (paperId) => {
    const confirmed = window.confirm(
      'Are you sure you want to remove this paper from your library?'
    )
    if (!confirmed) return

    setDeletingId(paperId)
    setError(null)

    try {
      await deletePaper(paperId)
      setPapers((prev) => prev.filter((p) => p.id !== paperId))
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to delete this paper. Please try again.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="library-page">
      <h2>My Research Library</h2>

      <CollectionsPanel onLoaded={handleCollectionsLoaded} />

      <LibraryFilters
        filters={filters}
        onChange={setFilters}
        collections={collections}
      />

      {error && <ErrorMessage message={error} />}

      {loading && <LoadingSpinner />}

      {!loading && !error && papers.length === 0 && (
        <div className="empty-state">
          <p>No saved papers match your filters.</p>
        </div>
      )}

      {!loading && !error && papers.length > 0 && (
        <div className="library-list">
          <p className="library-count">
            {papers.length} paper{papers.length !== 1 ? 's' : ''}
          </p>

          {papers.map((paper) => (
            <div key={paper.id} className="library-item card">
              <div className="info">
                <h3 onClick={() => onSelectPaper(paper.id)}>{paper.title}</h3>
                <div className="row">
                  {paper.publication_year && (
                    <span className="tag plain">
                      Year: {paper.publication_year}
                    </span>
                  )}
                  {paper.venue && (
                    <span className="tag plain">Venue: {paper.venue}</span>
                  )}
                  {paper.document_status && (
                    <span className="tag plain">
                      Document: {paper.document_status}
                    </span>
                  )}
                  {paper.latest_analysis_status && (
                    <span className="tag plain">
                      Analysis: {paper.latest_analysis_status}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="danger"
                onClick={() => handleDelete(paper.id)}
                disabled={deletingId === paper.id}
              >
                {deletingId === paper.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LibraryPage
