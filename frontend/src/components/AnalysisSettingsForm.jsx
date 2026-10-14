// AnalysisSettingsForm.jsx 用于在 AnalysisPanel 中编辑分析服务配置
//
// 尽量复用现有 class：
//   - .filter-field 负责 label + input 的竖排
//   - .row 负责横向排列
//   - .tag 负责模型建议胶囊
//   - .empty-hint 负责灰字提示
//   - .error-line 负责红色错误文字（配内联字号）

import { useState } from 'react'
import { updateAnalysisSettings } from '../api/settings'
import ErrorMessage from './ErrorMessage'

// 建议模型清单：分免费与低价两组
const SUGGESTED_MODELS = [
  // 免费模型（演示主力）
  { value: 'dots-studio/dots-3-note-preview:free', label: 'Free', group: 'free' },
  { value: 'liquid/lfm-2.5-2.6b:free', label: 'Free', group: 'free' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Free', group: 'free' },

  // 低价收费模型（备选，仅展示）
  { value: 'anthropic/claude-haiku-5.5', label: '~$1/M', group: 'paid' },
  { value: 'openai/gpt-4o-mini', label: '~$0.15/M', group: 'paid' },
  { value: 'google/gemini-2.0-flash-001', label: '~$0.10/M', group: 'paid' },
]

// 与后端 Pydantic 校验一致的正则，避免提交被 422 拒绝
const MODEL_PATTERN = /^[A-Za-z0-9~][A-Za-z0-9._:/~-]*$/

function AnalysisSettingsForm({ initialModel, hasKey, onSaved, onCancel }) {
  const [model, setModel] = useState(initialModel || '')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const trimmedModel = model.trim()
  const modelValid = trimmedModel.length > 0 && MODEL_PATTERN.test(trimmedModel)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!modelValid) return

    setSaving(true)
    setError(null)
    try {
      const result = await updateAnalysisSettings(trimmedModel, apiKey)
      onSaved?.(result)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to save analysis settings. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  const freeModels = SUGGESTED_MODELS.filter((m) => m.group === 'free')
  const paidModels = SUGGESTED_MODELS.filter((m) => m.group === 'paid')

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <p className="empty-hint">
        Configure the OpenRouter model and API key. Settings take effect
        immediately and are stored locally in the backend.
      </p>

      {error && <ErrorMessage message={error} />}

      {/* 模型输入 */}
      <label className="filter-field">
        <span>Model</span>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="e.g. dots-studio/dots-3-note-preview:free"
          disabled={saving}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      {!modelValid && trimmedModel.length > 0 && (
        <p className="error-line" style={{ fontSize: '0.82rem', margin: 0 }}>
          Only letters, numbers, and . _ : / ~ - are allowed.
        </p>
      )}

      {/* 免费模型建议 */}
      <div>
        <p className="empty-hint" style={{ marginBottom: 4 }}>
          Recommended (free)
        </p>
        <div className="row">
          {freeModels.map((m) => (
            <button
              key={m.value}
              type="button"
              className="tag model-tag"
              onClick={() => setModel(m.value)}
              disabled={saving}
            >
              {m.value}
            </button>
          ))}
        </div>
      </div>

      {/* 低价模型建议 */}
      <div>
        <p className="empty-hint" style={{ marginBottom: 4 }}>
          Low cost
        </p>
        <div className="row">
          {paidModels.map((m) => (
            <button
              key={m.value}
              type="button"
              className="tag model-tag"
              onClick={() => setModel(m.value)}
              disabled={saving}
            >
              {m.value}
              <span style={{ marginLeft: 6, opacity: 0.7, fontSize: '0.72rem' }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* API key 输入 */}
      <label className="filter-field">
        <span>API Key</span>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              hasKey ? 'Leave blank to keep the current key' : 'sk-or-v1-...'
            }
            disabled={saving}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            className="small"
            onClick={() => setShowKey((v) => !v)}
            disabled={saving}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>
      {hasKey && (
        <p className="empty-hint">
          A key is already configured. Leave the field blank to keep it, or
          paste a new one to replace it.
        </p>
      )}

      {/* 操作按钮 */}
      <div className="row">
        <button
          type="submit"
          className="primary"
          disabled={saving || !modelValid}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default AnalysisSettingsForm