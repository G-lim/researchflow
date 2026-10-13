// PaperDetailPage.jsx 展示单篇已保存论文的完整信息，并管理 PDF 处理流程
//
// 完整流程：
//   1. 加载论文详情（含已有的 documents）
//   2. 如果没有 document，显示 "Find PDF Sources" 和 "Upload PDF"
//   3. 用户选择源 URL 或上传本地 PDF
//   4. 轮询 document 状态，直到 completed 或 failed
//   5. 解析完成后加载 sections，可展开查看 chunks
//   6. 解析完成后可以启动 AI 分析

import { useState, useEffect } from 'react'
import { getSavedPaper } from '../api/papers'
import {
  getFullTextSources,
  startDocumentProcessing,
  getDocumentStatus,
  retryDocument,
  getDocumentSections,
  getSectionChunks,
  uploadDocument,
} from '../api/documents'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import AnalysisPanel from '../components/AnalysisPanel'
import PaperCollections from '../components/PaperCollections'

// 轮询间隔：2 秒
const POLL_INTERVAL_MS = 2000

function PaperDetailPage({ paperId, onBack }) {
  // ---------- 论文基本信息 ----------
  const [paper, setPaper] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paperAttempt, setPaperAttempt] = useState(0)

  // ---------- PDF 源查找 ----------
  const [sources, setSources] = useState(null)
  const [loadingSources, setLoadingSources] = useState(false)
  const [sourceError, setSourceError] = useState(null)
  const [starting, setStarting] = useState(false)

  // ---------- 手动上传 ----------
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  // ---------- 当前活跃的 document ----------
  const [activeDocumentId, setActiveDocumentId] = useState(null)
  const [activeDocument, setActiveDocument] = useState(null)
  const [polling, setPolling] = useState(false)
  const [processingError, setProcessingError] = useState(null)
  const [statusError, setStatusError] = useState(null)

  // ---------- 解析结果：章节与 chunks ----------
  const [sections, setSections] = useState([])
  const [loadingSections, setLoadingSections] = useState(false)
  const [sectionsError, setSectionsError] = useState(null)
  const [chunkErrors, setChunkErrors] = useState({})
  const [chunksBySection, setChunksBySection] = useState({})
  const [expandedSectionId, setExpandedSectionId] = useState(null)
  const [loadingChunksFor, setLoadingChunksFor] = useState(null)

  // ---------- Effect 1：加载论文详情 ----------
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await getSavedPaper(paperId)
        setPaper(result)
      } catch (err) {
        setError(
          err.response?.data?.error?.message ||
            'Failed to load paper details. Please try again.'
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [paperId, paperAttempt])

  // ---------- Effect 2：检查是否已有 document ----------
  useEffect(() => {
    if (!paper || !paper.documents || paper.documents.length === 0) return
    const latest = paper.documents[0]
    setActiveDocumentId(latest.id)
    setStatusError(null)
    setPolling(true)
  }, [paper])

  // ---------- Effect 3：轮询 document 状态 ----------
  useEffect(() => {
    if (!activeDocumentId || !polling) return
    let cancelled = false
    let timer = null

    const poll = async () => {
      try {
        const updated = await getDocumentStatus(activeDocumentId)
        if (cancelled) return
        setActiveDocument(updated)

        if (updated.parsing_status === 'completed') {
          setPolling(false)
          loadParsedContent(activeDocumentId)
        } else if (
          updated.retrieval_status === 'failed' ||
          updated.parsing_status === 'failed'
        ) {
          setPolling(false)
        } else {
          timer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (!cancelled) {
          setPolling(false)
          setStatusError(
            err.response?.data?.error?.message || 'Unable to check document status. The task may still be running.'
          )
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [activeDocumentId, polling])

  async function loadParsedContent(documentId) {
    setLoadingSections(true)
    setSectionsError(null)
    try {
      const list = await getDocumentSections(documentId)
      setSections(list)
    } catch (err) {
      setSectionsError(
        err.response?.data?.error?.message || 'Failed to load sections. Please try again.'
      )
    } finally {
      setLoadingSections(false)
    }
  }

  // ---------- 事件处理 ----------
  const handleFindSources = async () => {
    setLoadingSources(true)
    setSourceError(null)
    try {
      const list = await getFullTextSources(paperId)
      setSources(list)
    } catch (err) {
      setSourceError(
        err.response?.data?.error?.message ||
          'Failed to find full-text sources. Please try again.'
      )
    } finally {
      setLoadingSources(false)
    }
  }

  const handleStartProcessing = async (sourceUrl) => {
    setStarting(true)
    setProcessingError(null)
    setStatusError(null)
    try {
      const doc = await startDocumentProcessing(paperId, sourceUrl)
      setActiveDocumentId(doc.id)
      setActiveDocument(doc)
      setPolling(true)
      setSources(null)
    } catch (err) {
      setProcessingError(
        err.response?.data?.error?.message ||
          'Failed to start document processing. Please try again.'
      )
    } finally {
      setStarting(false)
    }
  }

  const handleRetry = async () => {
    if (!activeDocumentId) return
    setProcessingError(null)
    setStatusError(null)
    try {
      const doc = await retryDocument(activeDocumentId)
      setActiveDocument(doc)
      setPolling(true)
    } catch (err) {
      setProcessingError(
        err.response?.data?.error?.message ||
          'Failed to retry processing. Please try again.'
      )
    }
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const confirmed = window.confirm(
      `Confirm that "${file.name}" belongs to "${paper.title}" and that you have permission to process it.`
    )
    if (!confirmed) {
      event.target.value = ''
      return
    }

    setUploading(true)
    setUploadError(null)
    setProcessingError(null)
    setStatusError(null)

    try {
      const doc = await uploadDocument(paperId, file, confirmed)
      setActiveDocumentId(doc.id)
      setActiveDocument(doc)
      setPolling(true)
      setSources(null)
      setSourceError(null)
    } catch (err) {
      setUploadError(
        err.response?.data?.error?.message ||
          'Failed to upload the PDF. Please try again.'
      )
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleToggleSection = async (sectionId) => {
    if (expandedSectionId === sectionId) {
      setExpandedSectionId(null)
      return
    }
    setExpandedSectionId(sectionId)

    if (chunksBySection[sectionId]) return

    await loadChunks(sectionId)
  }

  const loadChunks = async (sectionId) => {
    setChunkErrors((current) => ({ ...current, [sectionId]: null }))
    setLoadingChunksFor(sectionId)
    try {
      const list = await getSectionChunks(sectionId)
      setChunksBySection((prev) => ({ ...prev, [sectionId]: list }))
    } catch (err) {
      setChunkErrors((current) => ({
        ...current,
        [sectionId]: err.response?.data?.error?.message || 'Failed to load excerpts. Please try again.',
      }))
    } finally {
      setLoadingChunksFor(null)
    }
  }

  // ---------- 早期返回 ----------
  if (loading) {
    return (
      <div className="paper-detail-page">
        <button type="button" onClick={onBack}>
          ← Back to Library
        </button>
        <LoadingSpinner />
      </div>
    )
  }
  if (error) {
    return (
      <div className="paper-detail-page">
        <button type="button" onClick={onBack}>
          ← Back to Library
        </button>
        <ErrorMessage message={error} />
        <button type="button" onClick={() => setPaperAttempt((value) => value + 1)}>
          Retry loading paper
        </button>
      </div>
    )
  }
  if (!paper) return null

  // ---------- 派生状态 ----------
  const isProcessing =
    activeDocument &&
    (activeDocument.retrieval_status === 'pending' ||
      activeDocument.retrieval_status === 'processing' ||
      activeDocument.parsing_status === 'pending' ||
      activeDocument.parsing_status === 'processing')

  const isFailed =
    activeDocument &&
    (activeDocument.retrieval_status === 'failed' ||
      activeDocument.parsing_status === 'failed')

  const isCompleted = activeDocument?.parsing_status === 'completed'

  // 可复用的手动上传控件（出现在多个场景）
  const uploadControls = (
    <div className="upload-block">
      <p>Or upload a PDF you downloaded yourself:</p>
      <label className="upload-label">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading ? 'Uploading...' : 'Upload PDF'}
      </label>
      {uploadError && <ErrorMessage message={uploadError} />}
    </div>
  )

  return (
    <div className="paper-detail-page">
      {/* 返回按钮 */}
      <button type="button" onClick={onBack}>
        ← Back to Library
      </button>

      <article className="paper-detail card">
        {/* 标题 */}
        <h2>{paper.title}</h2>

        {/* 作者 */}
        <p className="authors">
          {paper.authors && paper.authors.length > 0
            ? paper.authors.join(', ')
            : 'Unknown authors'}
        </p>

        {/* 元信息 */}
        <div className="row">
          {paper.publication_year && (
            <span className="tag">Year: {paper.publication_year}</span>
          )}
          {paper.venue && <span className="tag">Venue: {paper.venue}</span>}
          {paper.citation_count !== undefined && (
            <span className="tag">Citations: {paper.citation_count}</span>
          )}
        </div>

        {/* 外部链接 */}
        <div className="row links">
          {paper.doi && (
            <a href={paper.doi} target="_blank" rel="noopener noreferrer">
              DOI
            </a>
          )}
          {paper.landing_page_url && (
            <a
              href={paper.landing_page_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Paper
            </a>
          )}
        </div>

        {/* 摘要 */}
        {paper.abstract && (
          <section>
            <h3>Abstract</h3>
            <p>{paper.abstract}</p>
          </section>
        )}

        {/* 集合归属 */}
        <PaperCollections paperId={paperId} />

        {/* Full-Text Documents 区块 */}
        <section>
          <h3>Full-Text Documents</h3>

          {processingError && <ErrorMessage message={processingError} />}
          {statusError && (
            <>
              <ErrorMessage message={statusError} />
              <button type="button" onClick={() => { setStatusError(null); setPolling(true) }}>
                Retry document status
              </button>
            </>
          )}
          {activeDocumentId && !activeDocument && polling && <LoadingSpinner />}

          {/* 情况 1：无 document，也没查过源 */}
          {!activeDocumentId && !sources && (
            <>
              <p className="empty-hint">
                No full-text document attached yet.
              </p>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  onClick={handleFindSources}
                  disabled={loadingSources || uploading}
                >
                  {loadingSources ? 'Searching...' : 'Find PDF Sources'}
                </button>
              </div>
              {uploadControls}
            </>
          )}

          {/* 情况 2：正在查源 */}
          {loadingSources && <LoadingSpinner />}

          {/* 情况 3：查源失败 */}
          {sourceError && <ErrorMessage message={sourceError} />}

          {/* 情况 4：源列表已返回 */}
          {!activeDocument && sources && (
            <div className="source-list">
              {sources.length === 0 && (
                <>
                  <p className="empty-hint">
                    No open-access PDF sources were found for this paper. You
                    can upload a PDF manually instead.
                  </p>
                  {uploadControls}
                </>
              )}
              {sources.length > 0 && (
                <>
                  <p>Choose a source to start PDF processing:</p>
                  <ul>
                    {sources.map((source) => (
                      <li key={source.source_url} className="source-item">
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source.source_url}
                        </a>
                        {source.licence && (
                          <span className="tag plain">
                            Licence: {source.licence}
                          </span>
                        )}
                        <button
                          type="button"
                          className="primary small"
                          onClick={() =>
                            handleStartProcessing(source.source_url)
                          }
                          disabled={starting}
                        >
                          {starting ? 'Starting...' : 'Start Processing'}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {uploadControls}
                </>
              )}
            </div>
          )}

          {/* 情况 5：有活跃 document */}
          {activeDocument && (
            <div className="document-status">
              <p>
                <strong>Document #{activeDocument.id}</strong>
              </p>
              <ul>
                <li>Retrieval: {activeDocument.retrieval_status}</li>
                <li>Parsing: {activeDocument.parsing_status}</li>
                {activeDocument.page_count != null && (
                  <li>Pages: {activeDocument.page_count}</li>
                )}
                {activeDocument.file_size_bytes != null && (
                  <li>
                    Size: {Math.round(activeDocument.file_size_bytes / 1024)} KB
                  </li>
                )}
                {activeDocument.error_message && (
                  <li className="error">
                    Error: {activeDocument.error_code} —{' '}
                    {activeDocument.error_message}
                  </li>
                )}
              </ul>

              {isProcessing && <p className="processing-hint">Processing…</p>}

              {isFailed && (
                <div className="row">
                  <button type="button" onClick={handleRetry}>
                    Retry Processing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDocument(null)
                      setActiveDocumentId(null)
                      setPolling(false)
                      setStatusError(null)
                      setSources(null)
                      setProcessingError(null)
                      setUploadError(null)
                    }}
                  >
                    Choose Another Source
                  </button>
                  {uploadControls}
                </div>
              )}
            </div>
          )}

          {/* 情况 6：解析完成，展示章节列表 */}
          {isCompleted && loadingSections && <LoadingSpinner />}
          {isCompleted && sectionsError && (
            <>
              <ErrorMessage message={sectionsError} />
              <button type="button" onClick={() => loadParsedContent(activeDocumentId)}>
                Retry loading sections
              </button>
            </>
          )}
          {isCompleted && !loadingSections && !sectionsError && sections.length === 0 && (
            <p className="empty-hint">No sections were extracted.</p>
          )}
          {isCompleted && !loadingSections && !sectionsError && sections.length > 0 && (
            <div className="sections-block">
              <h4>Extracted Sections ({sections.length})</h4>
              <ul className="section-list">
                {sections.map((section) => (
                  <li key={section.id} className="section-item">
                    <button
                      type="button"
                      className="section-toggle"
                      onClick={() => handleToggleSection(section.id)}
                    >
                      <span className="section-type">
                        {section.section_type}
                      </span>
                      {section.original_heading && (
                        <span className="section-heading">
                          {section.original_heading}
                        </span>
                      )}
                      <span className="section-pages">
                        p.{section.start_page}
                        {section.end_page !== section.start_page
                          ? `–${section.end_page}`
                          : ''}
                      </span>
                      <span className="section-expand">
                        {expandedSectionId === section.id ? '▼' : '▶'}
                      </span>
                    </button>

                    {expandedSectionId === section.id && (
                      <div className="section-chunks">
                        {loadingChunksFor === section.id && (
                          <p className="empty-hint">Loading excerpts…</p>
                        )}
                        {chunkErrors[section.id] && (
                          <>
                            <ErrorMessage message={chunkErrors[section.id]} />
                            <button type="button" onClick={() => loadChunks(section.id)}>
                              Retry loading excerpts
                            </button>
                          </>
                        )}
                        {chunksBySection[section.id]?.map((chunk) => (
                          <div key={chunk.id} className="chunk-item">
                            <div className="chunk-meta">
                              Chunk #{chunk.sequence_number} (p.
                              {chunk.start_page})
                            </div>
                            <p>{chunk.source_text}</p>
                          </div>
                        ))}
                        {chunksBySection[section.id]?.length === 0 && (
                          <p className="empty-hint">
                            No chunks in this section.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 情况 7：解析完成后启动全文分析 */}
        {isCompleted && <AnalysisPanel key={activeDocumentId} documentId={activeDocumentId} />}
      </article>
    </div>
  )
}

export default PaperDetailPage
