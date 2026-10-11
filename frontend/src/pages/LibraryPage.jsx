// LibraryPage.jsx 资料库页面
// 功能：
//   - 顶部展示集合管理（CollectionsPanel）
//   - 筛选栏（LibraryFilters）
//   - 已保存论文列表，支持删除
//   - 点击标题进入详情页

import { useState, useEffect } from 'react'
import { listSavedPapers, deletePaper } from '../api/papers'
import { listCollections } from '../api/collections'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import CollectionsPanel from '../components/CollectionsPanel'
import LibraryFilters, { DEFAULT_FILTERS } from '../components/LibraryFilters'

function LibraryPage({ onSelectPaper }) {
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // 筛选条件（由 LibraryFilters 控制）
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  // 所有集合（供筛选栏的下拉使用）
  // 独立加载，与 CollectionsPanel 内部状态不共享，简单起见
  const [collections, setCollections] = useState([])

  // ---------- 加载集合（用于下拉选项） ----------
  useEffect(() => {
    listCollections()
      .then(setCollections)
      .catch(() => {
        // 静默失败：下拉列表为空也不影响论文列表
      })
  }, [])

  // ---------- 加载论文列表 ----------
  // 依赖 filters，且带 300ms 防抖，避免输入时频繁请求
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

      {/* 集合管理 */}
      <CollectionsPanel />

      {/* 筛选栏 */}
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
            <div key={paper.id} className="library-item">
              <div className="library-item-info">
                <h3
                  className="library-item-title"
                  onClick={() => onSelectPaper(paper.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {paper.title}
                </h3>
                <div className="library-item-meta">
                  {paper.publication_year && (
                    <span>Year: {paper.publication_year}</span>
                  )}
                  {paper.venue && <span>Venue: {paper.venue}</span>}
                  {paper.document_status && (
                    <span>Document: {paper.document_status}</span>
                  )}
                  {paper.latest_analysis_status && (
                    <span>Analysis: {paper.latest_analysis_status}</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="library-item-delete"
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