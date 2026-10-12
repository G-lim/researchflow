// PaperCollections.jsx 用于 PaperDetailPage
// 展示这篇论文属于哪些集合，并允许勾选/取消勾选

import { useState, useEffect } from 'react'
import {
  listCollections,
  listPaperCollections,
  addPaperToCollection,
  removePaperFromCollection,
} from '../api/collections'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'

function PaperCollections({ paperId }) {
  const [allCollections, setAllCollections] = useState([])
  const [memberIds, setMemberIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [all, mine] = await Promise.all([
          listCollections(),
          listPaperCollections(paperId),
        ])
        setAllCollections(all)
        setMemberIds(new Set(mine.map((c) => c.id)))
      } catch (err) {
        setError(
          err.response?.data?.error?.message ||
            'Failed to load collections. Please try again.'
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [paperId])

  const handleToggle = async (collectionId, currentlyMember) => {
    setBusyId(collectionId)
    setError(null)
    try {
      if (currentlyMember) {
        await removePaperFromCollection(collectionId, paperId)
        setMemberIds((prev) => {
          const next = new Set(prev)
          next.delete(collectionId)
          return next
        })
      } else {
        await addPaperToCollection(collectionId, paperId)
        setMemberIds((prev) => new Set(prev).add(collectionId))
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to update the collection. Please try again.'
      )
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <section>
        <h3>Collections</h3>
        <LoadingSpinner />
      </section>
    )
  }

  return (
    <section>
      <h3>Collections</h3>

      {error && <ErrorMessage message={error} />}

      {allCollections.length === 0 && (
        <p className="empty-hint">
          No collections yet. Create one from the Library page.
        </p>
      )}

      {allCollections.length > 0 && (
        <ul className="paper-collections-list">
          {allCollections.map((collection) => {
            const isMember = memberIds.has(collection.id)
            return (
              <li key={collection.id} className="paper-collection-item">
                <label>
                  <input
                    type="checkbox"
                    checked={isMember}
                    disabled={busyId === collection.id}
                    onChange={() => handleToggle(collection.id, isMember)}
                  />
                  <span>{collection.name}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default PaperCollections