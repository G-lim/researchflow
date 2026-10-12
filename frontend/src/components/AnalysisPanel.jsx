// AnalysisPanel.jsx 管理单篇 document 的全文分析流程
//
// 用法：当 document.parsing_status === 'completed' 时渲染，传入 documentId
//
// 状态机：
//   无历史分析   → 显示 "Analyze Full Text" 按钮
//   pending / processing → 轮询中
//   completed    → 展示 4 类 findings
//   failed       → 显示错误 + Retry 按钮
//
// 折叠逻辑：
//   - 面板默认展开（方便首次使用）
//   - 加载完历史后，如果已经有分析记录，自动收起以节省空间
//   - 用户可随时手动切换

import { useState, useEffect } from 'react'
import {
  startAnalysis,
  getAnalysisStatus,
  listDocumentAnalyses,
  retryAnalysis,
  listFindings,
  getFinding,
} from '../api/analyses'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'

// 轮询间隔：3 秒（分析通常比 PDF 处理慢）
const POLL_INTERVAL_MS = 3000

// findings 的 4 个类型，按显示顺序排列
const FINDING_TYPES = [
  { key: 'research_problem', label: 'Research Problem' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'key_finding', label: 'Key Findings' },
  { key: 'limitation', label: 'Limitations' },
]

// 把秒数格式化为可读文本，例如 "2m 15s"
function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

// 根据已用时间给出阶段性的提示
function getTimingMessage(seconds) {
  if (seconds < 60) {
    return 'Usually 1-2 minutes for a short paper.'
  }
  if (seconds < 300) {
    return 'Longer papers can take 5-10 minutes.'
  }
  if (seconds < 900) {
    return 'This is taking longer than usual. Please keep waiting.'
  }
  return 'This is unusually long. Consider checking the backend log.'
}

function AnalysisPanel({ documentId }) {
  // 当前分析记录
  const [analysis, setAnalysis] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [starting, setStarting] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState(null)

  // 分析完成后的 findings
  const [findings, setFindings] = useState([])
  // 展开的 finding 详情缓存：{ [findingId]: FindingDetail }
  const [findingDetails, setFindingDetails] = useState({})
  const [expandedFindingId, setExpandedFindingId] = useState(null)
  const [loadingFindingFor, setLoadingFindingFor] = useState(null)

  // 面板是否展开：默认展开，加载完历史后如有记录则自动收起
  const [expanded, setExpanded] = useState(true)
  // 分析已用时间（秒），仅在运行中时计时
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // ---------- Effect 1：页面打开时加载该 document 的分析历史 ----------
  useEffect(() => {
    async function load() {
      setLoadingHistory(true)
      setError(null)
      try {
        const result = await listDocumentAnalyses(documentId, 1, 20)
        const latest = result.analyses[0] // 按 id 倒序，最新在前
        if (latest) {
          setAnalysis(latest)
          // 有分析记录时默认收起，避免占用过多空间
          setExpanded(false)
          if (latest.status === 'completed') {
            loadFindings(latest.id)
          } else if (
            latest.status === 'pending' ||
            latest.status === 'processing'
          ) {
            setPolling(true)
          }
        }
      } catch (err) {
        // 后端文档不存在时返回 404，正常场景不该发生；忽略即可
        console.warn('Failed to load analysis history:', err)
      } finally {
        setLoadingHistory(false)
      }
    }
    load()
  }, [documentId])

  // ---------- Effect 2：轮询分析状态 ----------
  useEffect(() => {
    if (!analysis || !polling) return
    let cancelled = false
    let timer = null

    const poll = async () => {
      try {
        const updated = await getAnalysisStatus(analysis.id)
        if (cancelled) return
        setAnalysis(updated)

        if (updated.status === 'completed') {
          setPolling(false)
          loadFindings(updated.id)
        } else if (updated.status === 'failed') {
          setPolling(false)
        } else {
          timer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch (err) {
        // 网络临时出错时延长间隔，不中断轮询
        if (!cancelled) {
          timer = setTimeout(poll, POLL_INTERVAL_MS * 2)
        }
      }
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.id, polling])

    // ---------- Effect 3：运行时每秒更新已用时间 ----------
  // 用 analysis.created_at 作为起点，而不是本地计时开始点
  // 这样即使用户刷新页面，计时器也能正确显示
  useEffect(() => {
    const isRunning =
      analysis &&
      (analysis.status === 'pending' || analysis.status === 'processing')

    if (!isRunning || !analysis.created_at) {
      setElapsedSeconds(0)
      return
    }

    const start = new Date(analysis.created_at).getTime()
    const update = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [analysis?.id, analysis?.status, analysis?.created_at])

  // ---------- 加载 findings ----------
  const loadFindings = async (analysisId) => {
    try {
      const list = await listFindings(analysisId)
      setFindings(list)
    } catch (err) {
      console.warn('Failed to load findings:', err)
    }
  }

  // ---------- 事件：启动分析 ----------
  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      const created = await startAnalysis(documentId)
      setAnalysis(created)
      setPolling(true)
      // 启动后自动展开，让用户看到进度
      setExpanded(true)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to start analysis. Please try again.'
      )
    } finally {
      setStarting(false)
    }
  }

  // ---------- 事件：重试失败的分析 ----------
  const handleRetry = async () => {
    if (!analysis) return
    setError(null)
    try {
      const updated = await retryAnalysis(analysis.id)
      setAnalysis(updated)
      setPolling(true)
      setExpanded(true)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to retry analysis. Please try again.'
      )
    }
  }

  // ---------- 事件：展开某条 finding，加载其 evidence ----------
  const handleToggleFinding = async (findingId) => {
    if (expandedFindingId === findingId) {
      setExpandedFindingId(null)
      return
    }
    setExpandedFindingId(findingId)

    // 已缓存就跳过
    if (findingDetails[findingId]) return

    setLoadingFindingFor(findingId)
    try {
      const detail = await getFinding(findingId)
      setFindingDetails((prev) => ({ ...prev, [findingId]: detail }))
    } catch (err) {
      console.warn('Failed to load finding detail:', err)
    } finally {
      setLoadingFindingFor(null)
    }
  }

  // ---------- 渲染：加载历史 ----------
  if (loadingHistory) {
    return (
      <section className="analysis-panel">
        <h3>Full-Text Analysis</h3>
        <LoadingSpinner />
      </section>
    )
  }

  const isRunning =
    analysis &&
    (analysis.status === 'pending' || analysis.status === 'processing')

  const isFailed = analysis?.status === 'failed'
  const isCompleted = analysis?.status === 'completed'

  // 折叠状态下显示的一行摘要，让用户知道点 Show 能看到什么
  const collapsedSummary = (() => {
    if (!analysis) return 'No analysis yet. Click Show to get started.'
    if (isRunning) return `Analysis #${analysis.id} — ${analysis.status}…`
    if (isFailed) return `Analysis #${analysis.id} — failed. Click Show for details.`
    if (isCompleted) {
      const count = findings.length
      return `Analysis #${analysis.id} — completed · ${count} finding${
        count !== 1 ? 's' : ''
      }`
    }
    return `Analysis #${analysis.id} — ${analysis.status}`
  })()

  return (
    <section className="analysis-panel">
      {/* 标题行：左标题，右折叠按钮 */}
      <div className="analysis-header">
        <h3>Full-Text Analysis</h3>
        <button
          type="button"
          className="toggle-button"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* 折叠状态：只显示一行摘要 */}
      {!expanded && <p className="analysis-hint">{collapsedSummary}</p>}

      {/* 展开状态：完整内容 */}
      {expanded && (
        <>
          {error && <ErrorMessage message={error} />}

          {/* 无分析记录：显示启动按钮 */}
          {!analysis && (
            <div className="analysis-actions">
              <p className="analysis-hint">
                Run an LLM analysis to extract structured findings from this
                paper.
              </p>
              <button
                type="button"
                className="analyze-button"
                onClick={handleStart}
                disabled={starting}
              >
                {starting ? 'Starting...' : 'Analyze Full Text'}
              </button>
            </div>
          )}

          {/* 分析进行中 */}
          {isRunning && (
            <div className="analysis-running">
              <p>
                <strong>Analysis #{analysis.id}</strong> — {analysis.status}
              </p>
              <p className="analysis-hint">Model: {analysis.service_model}</p>
              <p className="processing-hint">
                Analyzing<span className="loading-dots" /> · {formatElapsed(elapsedSeconds)} elapsed
              </p>
              <p className="analysis-hint">{getTimingMessage(elapsedSeconds)}</p>
            </div>
          )}

          {/* 分析失败 */}
          {isFailed && (
            <div className="analysis-failed">
              <p>
                <strong>Analysis #{analysis.id}</strong> — failed
              </p>
              {analysis.error_message && (
                <p className="error-line">
                  Error: {analysis.error_code} — {analysis.error_message}
                </p>
              )}
              <button
                type="button"
                className="retry-button"
                onClick={handleRetry}
              >
                Retry Analysis
              </button>
            </div>
          )}

          {/* 分析完成：展示 findings */}
          {isCompleted && (
            <div className="analysis-completed">
              <p className="analysis-meta">
                Analysis #{analysis.id} — completed using{' '}
                {analysis.service_model}
              </p>

              {findings.length === 0 && (
                <p className="empty-hint">No findings were extracted.</p>
              )}

              {FINDING_TYPES.map(({ key, label }) => {
                const group = findings.filter((f) => f.finding_type === key)
                // 若该类别只有一条 unavailable，则简化为 "Not available"
                const unavailable =
                  group.length === 1 &&
                  group[0].support_status === 'unavailable'

                return (
                  <div key={key} className="finding-group">
                    <h4 className="finding-group-title">{label}</h4>

                    {group.length === 0 && (
                      <p className="empty-hint">
                        Not available in this analysis.
                      </p>
                    )}

                    {unavailable && (
                      <p className="empty-hint">Not available in the paper.</p>
                    )}

                    {!unavailable &&
                      group.map((finding) => (
                        <div key={finding.id} className="finding-item">
                          <button
                            type="button"
                            className="finding-toggle"
                            onClick={() => handleToggleFinding(finding.id)}
                          >
                            <span className="finding-content">
                              {finding.content}
                            </span>
                            <span className="finding-evidence-count">
                              {finding.evidence_count} source
                              {finding.evidence_count !== 1 ? 's' : ''}
                            </span>
                            <span className="finding-expand">
                              {expandedFindingId === finding.id ? '▼' : '▶'}
                            </span>
                          </button>

                          {expandedFindingId === finding.id && (
                            <div className="finding-evidence">
                              {loadingFindingFor === finding.id && (
                                <p className="chunk-loading">
                                  Loading sources…
                                </p>
                              )}
                              {findingDetails[finding.id]?.evidence?.map(
                                (ev) => (
                                  <div key={ev.id} className="evidence-item">
                                    <div className="evidence-meta">
                                      {ev.section_type}
                                      {ev.original_heading
                                        ? ` — ${ev.original_heading}`
                                        : ''}
                                      {' · '}
                                      p.{ev.start_page}
                                      {ev.is_primary ? ' · primary' : ''}
                                    </div>
                                    <p className="evidence-excerpt">
                                      “{ev.source_excerpt}”
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default AnalysisPanel