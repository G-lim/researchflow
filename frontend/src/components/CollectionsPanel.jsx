// CollectionsPanel.jsx 管理所有集合（分组）
// 用于 LibraryPage 顶部，提供：
//   - 展示所有集合及论文数
//   - 创建新集合
//   - 重命名 / 删除集合

import { useState, useEffect, useCallback } from 'react'
import {
  listCollections,
  createCollection,
  renameCollection,
  deleteCollection,
} from '../api/collections'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'

function CollectionsPanel({ onLoaded }) {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [expanded, setExpanded] = useState(true)

  // ---------- 加载集合列表 ----------
  const loadCollections = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listCollections()
      setCollections(list)
      onLoaded?.(list)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to load collections. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [onLoaded])

  useEffect(() => {
    loadCollections()
  }, [loadCollections])

  // ---------- 创建集合 ----------
  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return

    setCreating(true)
    setError(null)
    try {
      await createCollection(name)
      setNewName('')
      await loadCollections()
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to create the collection. Please try again.'
      )
    } finally {
      setCreating(false)
    }
  }

  // ---------- 重命名 ----------
  const handleRename = async (collection) => {
    const newValue = window.prompt('Rename collection:', collection.name)
    if (newValue === null) return
    const trimmed = newValue.trim()
    if (!trimmed || trimmed === collection.name) return

    setBusyId(collection.id)
    setError(null)
    try {
      await renameCollection(collection.id, trimmed)
      await loadCollections()
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to rename the collection. Please try again.'
      )
    } finally {
      setBusyId(null)
    }
  }

  // ---------- 删除 ----------
  const handleDelete = async (collection) => {
    const confirmed = window.confirm(
      `Delete collection "${collection.name}"? Papers inside will not be deleted.`
    )
    if (!confirmed) return

    setBusyId(collection.id)
    setError(null)
    try {
      await deleteCollection(collection.id)
      await loadCollections()
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to delete the collection. Please try again.'
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="collections-panel card">
      <div className="header">
        <h3>Collections</h3>
        <button type="button" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {!expanded && collections.length > 0 && (
        <p className="empty-hint">
          {collections.length} collection
          {collections.length !== 1 ? 's' : ''}
        </p>
      )}

      {expanded && (
        <>
          {/* 创建新集合 */}
          <form className="collection-create-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="New collection name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
              maxLength={100}
            />
            <button
              type="submit"
              className="primary"
              disabled={creating || !newName.trim()}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </form>

          {error && (
            <>
              <ErrorMessage message={error} />
              <button type="button" onClick={loadCollections} disabled={loading}>
                Retry loading collections
              </button>
            </>
          )}

          {loading && <LoadingSpinner />}

          {!loading && !error && collections.length === 0 && (
            <p className="empty-hint">
              No collections yet. Create one to organise your papers.
            </p>
          )}

          {!loading && collections.length > 0 && (
            <ul className="collection-list">
              {collections.map((collection) => (
                <li key={collection.id} className="collection-item">
                  <span className="name">{collection.name}</span>
                  <span className="tag plain">
                    {collection.paper_count} paper
                    {collection.paper_count !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    className="small"
                    onClick={() => handleRename(collection)}
                    disabled={busyId === collection.id}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="small danger"
                    onClick={() => handleDelete(collection)}
                    disabled={busyId === collection.id}
                  >
                    {busyId === collection.id ? 'Working...' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export default CollectionsPanel
