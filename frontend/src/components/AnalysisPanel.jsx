// AnalysisPanel.jsx 管理单篇 document 的全文分析流程
// 状态机：
//   无历史分析         → 显示 "Analyze Full Text" 或 "Configure Analysis"
//   pending / processing → 轮询中
//   completed          → 展示 4 类 findings
//   failed             → 显示错误 + Retry
//
// 折叠：有历史记录时默认收起，点击 Show 展开

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  startAnalysis,
  getAnalysisStatus,
  listDocumentAnalyses,
  listFindings,
  getFinding,
} from '../api/analyses'
import { getAnalysisSettings } from '../api/settings'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'
import AnalysisSettingsForm from './AnalysisSettingsForm'

// 轮询间隔：3 秒
const POLL_INTERVAL_MS = 3000

// findings 的 4 个类型，按显示顺序排列
const FINDING_TYPES = [
  { key: 'research_problem', label: 'Research Problem' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'key_finding', label: 'Key Findings' },
  { key: 'limitation', label: 'Limitations' },
]

// 把秒数格式化为可读文本
function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

// 根据已用时间给出阶段性的提示
function getTimingMessage(seconds) {
  if (seconds < 60) return 'Usually 1-2 minutes for a short paper.'
  if (seconds < 300) return 'Longer papers can take 5-10 minutes.'
  if (seconds < 900)
    return 'This is taking longer than usual. Please keep waiting.'
  return 'This is unusually long. Consider checking the backend log.'
}

function AnalysisPanel({ documentId }) {
  const [analysis, setAnalysis] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [starting, setStarting] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState(null)
  const [historyError, setHistoryError] = useState(null)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [statusError, setStatusError] = useState(null)

  const [findings, setFindings] = useState([])
  const [loadingFindings, setLoadingFindings] = useState(false)
  const [findingsError, setFindingsError] = useState(null)
  const [evidenceErrors, setEvidenceErrors] = useState({})
  const [findingDetails, setFindingDetails] = useState({})
  const [expandedFindingId, setExpandedFindingId] = useState(null)
  const [loadingFindingFor, setLoadingFindingFor] = useState(null)

  const [expanded, setExpanded] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  // 本地计时起点（毫秒时间戳）。用于覆盖后端复用的 created_at
  const startedAtRef = useRef(null)

  // ---------- 分析服务配置 ----------
  const [settings, setSettings] = useState(null)
  const [settingsError, setSettingsError] = useState(null)
  const [editing, setEditing] = useState(false)

  const loadFindings = useCallback(async (analysisId) => {
    setLoadingFindings(true)
    setFindingsError(null)
    try {
      setFindings(await listFindings(analysisId))
    } catch (err) {
      setFindingsError(
        err.response?.data?.error?.message ||
          'Failed to load findings. Please try again.'
      )
    } finally {
      setLoadingFindings(false)
    }
  }, [])

  // ---------- Effect 0：加载分析服务配置 ----------
  useEffect(() => {
    let cancelled = false
    async function loadSettings() {
      setSettingsError(null)
      try {
        const result = await getAnalysisSettings()
        if (!cancelled) setSettings(result)
      } catch (err) {
        if (!cancelled) {
          // 403 / 网络异常：视为未配置，但记录错误让用户可见
          setSettings({
            model: '',
            api_key_configured: false,
            restart_required: false,
          })
          setSettingsError(
            err.response?.data?.error?.message ||
              'Analysis settings could not be loaded.'
          )
        }
      }
    }
    loadSettings()
    return () => {
      cancelled = true
    }
  }, [])

  // ---------- Effect 1：加载分析历史 ----------
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingHistory(true)
      setHistoryError(null)
      try {
        const result = await listDocumentAnalyses(documentId, 1, 20)
        if (cancelled) return
        const latest = result.analyses[0]
        if (latest) {
          setAnalysis(latest)
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
        if (!cancelled)
          setHistoryError(
            err.response?.data?.error?.message ||
              'Failed to load analysis history. Please try again.'
          )
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [documentId, historyAttempt, loadFindings])

  // ---------- Effect 2：轮询分析状态 ----------
  useEffect(() => {
    if (!analysis || !polling) return
    const analysisId = analysis.id
    let cancelled = false
    let timer = null

    const poll = async () => {
      try {
        const updated = await getAnalysisStatus(analysisId)
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
        if (!cancelled) {
          setPolling(false)
          setStatusError(
            err.response?.data?.error?.message ||
              'Unable to check analysis status. The task may still be running.'
          )
        }
      }
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [analysis?.id, polling, loadFindings])

  // ---------- Effect 3：运行时每秒更新已用时间 ----------
  useEffect(() => {
    const isRunning =
      analysis &&
      (analysis.status === 'pending' || analysis.status === 'processing')

    if (!isRunning) {
      setElapsedSeconds(0)
      startedAtRef.current = null
      return
    }

    if (startedAtRef.current == null) {
      const backendStart = analysis.started_at || analysis.created_at
      startedAtRef.current = backendStart
        ? new Date(backendStart).getTime()
        : Date.now()
    }

    const start = startedAtRef.current
    const update = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [
    analysis?.id,
    analysis?.status,
    analysis?.started_at,
    analysis?.created_at,
  ])

  // ---------- 事件 ----------
  const handleStart = async () => {
    setStarting(true)
    setError(null)
    setStatusError(null)
    try {
      const created = await startAnalysis(documentId)
      startedAtRef.current = Date.now()
      setAnalysis(created)
      setPolling(true)
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

  const handleToggleFinding = async (findingId) => {
    if (expandedFindingId === findingId) {
      setExpandedFindingId(null)
      return
    }
    setExpandedFindingId(findingId)
    if (findingDetails[findingId]) return

    await loadEvidence(findingId)
  }

  const loadEvidence = async (findingId) => {
    setEvidenceErrors((current) => ({ ...current, [findingId]: null }))
    setLoadingFindingFor(findingId)
    try {
      const detail = await getFinding(findingId)
      setFindingDetails((prev) => ({ ...prev, [findingId]: detail }))
    } catch (err) {
      setEvidenceErrors((current) => ({
        ...current,
        [findingId]:
          err.response?.data?.error?.message ||
          'Failed to load evidence. Please try again.',
      }))
    } finally {
      setLoadingFindingFor(null)
    }
  }

  // 保存配置成功后刷新 settings
  const handleSettingsSaved = (result) => {
    setSettings(result)
    setSettingsError(null)
    setEditing(false)
  }

  // ---------- 早期返回 ----------
  if (loadingHistory) {
    return (
      <div className="analysis-panel">
        <h3>Full-Text Analysis</h3>
        <LoadingSpinner />
      </div>
    )
  }

  if (historyError) {
    return (
      <div className="analysis-panel">
        <h3>Full-Text Analysis</h3>
        <ErrorMessage message={historyError} />
        <button
          type="button"
          onClick={() => setHistoryAttempt((value) => value + 1)}
        >
          Retry loading history
        </button>
      </div>
    )
  }

  const isRunning =
    analysis &&
    (analysis.status === 'pending' || analysis.status === 'processing')

  const isFailed = analysis?.status === 'failed'
  const isCompleted = analysis?.status === 'completed'

  // 折叠状态时显示的一行摘要
  const collapsedSummary = (() => {
    if (!analysis) return 'No analysis yet. Click Show to get started.'
    if (isRunning) return `Analysis #${analysis.id} — ${analysis.status}…`
    if (isFailed)
      return `Analysis #${analysis.id} — failed. Click Show for details.`
    if (isCompleted) {
      if (loadingFindings)
        return `Analysis #${analysis.id} — loading findings…`
      if (findingsError)
        return `Analysis #${analysis.id} — findings could not be loaded.`
      const count = findings.length
      return `Analysis #${analysis.id} — completed · ${count} finding${
        count !== 1 ? 's' : ''
      }`
    }
    return `Analysis #${analysis.id} — ${analysis.status}`
  })()

  return (
    <div className="analysis-panel">
      <div className="header">
        <h3>Full-Text Analysis</h3>
        <button type="button" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {statusError && (
        <>
          <ErrorMessage message={statusError} />
          <button
            type="button"
            onClick={() => {
              setStatusError(null)
              setPolling(true)
            }}
          >
            Retry status check
          </button>
        </>
      )}

      {!expanded && <p className="empty-hint">{collapsedSummary}</p>}

      {expanded && (
        <>
          {/* 编辑模式：优先显示，独立于 analysis 状态 */}
          {editing && (
            <AnalysisSettingsForm
              initialModel={settings?.model}
              hasKey={settings?.api_key_configured}
              onSaved={handleSettingsSaved}
              onCancel={() => setEditing(false)}
            />
          )}

          {/* 非编辑模式：正常展示 */}
          {!editing && (
            <>
              {error && <ErrorMessage message={error} />}

              {/* 无分析记录 */}
              {!analysis && (
                <>
                  {/* 未配置 */}
                  {!settings?.api_key_configured && (
                    <>
                      {settingsError && (
                        <ErrorMessage message={settingsError} />
                      )}
                      <p className="empty-hint">
                        Analysis service is not configured. Get and copy an API key from{' '}
                        <a
                          href="https://openrouter.ai/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          openrouter.ai/keys
                        </a>
                        {' '}and select a model to enable full-text analysis.
                      </p>
                      <div className="row">
                        <button
                          type="button"
                          className="primary"
                          onClick={() => setEditing(true)}
                        >
                          Configure Analysis
                        </button>
                      </div>
                    </>
                  )}

                  {/* 已配置 */}
                  {settings?.api_key_configured && (
                    <>
                      <p className="empty-hint">
                        Run an LLM analysis to extract structured findings
                        from this paper.
                      </p>
                      <p className="empty-hint">Model: {settings.model}</p>
                      <div className="row">
                        <button
                          type="button"
                          className="primary"
                          onClick={handleStart}
                          disabled={starting}
                        >
                          {starting ? 'Starting...' : 'Analyze Full Text'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                        >
                          Edit settings
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* 运行中 */}
              {isRunning && (
                <div className="analysis-running">
                  <p>
                    <strong>Analysis #{analysis.id}</strong> —{' '}
                    {analysis.status}
                  </p>
                  <p className="empty-hint">
                    Model: {analysis.service_model}
                  </p>
                  <p className="processing-hint">
                    Analyzing<span className="loading-dots" /> ·{' '}
                    {formatElapsed(elapsedSeconds)} elapsed
                  </p>
                  <p className="empty-hint">
                    {getTimingMessage(elapsedSeconds)}
                  </p>
                </div>
              )}

              {/* 失败 */}
              {isFailed && (
                <div className="analysis-failed">
                  <p>
                    <strong>Analysis #{analysis.id}</strong> — failed
                  </p>
                  <p className="empty-hint">
                    Model used: {analysis.service_model}
                  </p>
                  {analysis.error_message && (
                    <p className="error-message">
                      Error: {analysis.error_code} — {analysis.error_message}
                    </p>
                  )}
                  <div className="row">
                    <button
                      type="button"
                      className="primary"
                      onClick={handleStart}
                      disabled={starting}
                    >
                      {starting ? 'Starting...' : 'Run with current settings'}
                    </button>
                    <button type="button" onClick={() => setEditing(true)}>
                      Edit settings
                    </button>
                  </div>
                </div>
              )}

              {/* 完成 */}
              {isCompleted && (
                <div className="analysis-completed">
                  <p className="empty-hint">
                    Analysis #{analysis.id} — completed using{' '}
                    {analysis.service_model}
                  </p>

                  {loadingFindings && <LoadingSpinner />}
                  {findingsError && (
                    <>
                      <ErrorMessage message={findingsError} />
                      <button
                        type="button"
                        onClick={() => loadFindings(analysis.id)}
                      >
                        Retry loading findings
                      </button>
                    </>
                  )}
                  {!loadingFindings &&
                    !findingsError &&
                    findings.length === 0 && (
                      <p className="empty-hint">
                        No findings were extracted.
                      </p>
                    )}

                  {!loadingFindings &&
                    !findingsError &&
                    FINDING_TYPES.map(({ key, label }) => {
                      const group = findings.filter(
                        (f) => f.finding_type === key
                      )
                      const unavailable =
                        group.length === 1 &&
                        group[0].support_status === 'unavailable'

                      return (
                        <div key={key} className="finding-group">
                          <h4>{label}</h4>

                          {group.length === 0 && (
                            <p className="empty-hint">
                              Not available in this analysis.
                            </p>
                          )}

                          {unavailable && (
                            <p className="empty-hint">
                              Not available in the paper.
                            </p>
                          )}

                          {!unavailable &&
                            group.map((finding) => (
                              <div
                                key={finding.id}
                                className="finding-item"
                              >
                                <button
                                  type="button"
                                  className="finding-toggle"
                                  onClick={() =>
                                    handleToggleFinding(finding.id)
                                  }
                                >
                                  <span className="finding-content">
                                    {finding.content}
                                  </span>
                                  <span className="tag plain">
                                    {finding.evidence_count} source
                                    {finding.evidence_count !== 1
                                      ? 's'
                                      : ''}
                                  </span>
                                  <span className="finding-expand">
                                    {expandedFindingId === finding.id
                                      ? '▼'
                                      : '▶'}
                                  </span>
                                </button>

                                {expandedFindingId === finding.id && (
                                  <div className="finding-evidence">
                                    {loadingFindingFor === finding.id && (
                                      <p className="empty-hint">
                                        Loading sources…
                                      </p>
                                    )}
                                    {evidenceErrors[finding.id] && (
                                      <>
                                        <ErrorMessage
                                          message={
                                            evidenceErrors[finding.id]
                                          }
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            loadEvidence(finding.id)
                                          }
                                        >
                                          Retry loading evidence
                                        </button>
                                      </>
                                    )}
                                    {findingDetails[
                                      finding.id
                                    ]?.evidence?.map((ev) => (
                                      <div
                                        key={ev.id}
                                        className="evidence-item"
                                      >
                                        <div className="chunk-meta">
                                          {ev.section_type}
                                          {ev.original_heading
                                            ? ` — ${ev.original_heading}`
                                            : ''}
                                          {' · '}
                                          p.{ev.start_page}
                                          {ev.is_primary
                                            ? ' · primary'
                                            : ''}
                                        </div>
                                        <p>“{ev.source_excerpt}”</p>
                                      </div>
                                    ))}
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
        </>
      )}
    </div>
  )
}

export default AnalysisPanel