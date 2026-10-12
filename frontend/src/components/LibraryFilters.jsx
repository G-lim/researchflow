// LibraryFilters.jsx 资料库的筛选栏
// 包含：关键词搜索、排序、年份范围、集合、文档状态、分析状态
//
// 交互设计：
//   - 关键词输入有 300ms 防抖，避免每敲一个字都发请求
//   - 其他下拉/输入立即触发 onChange
//   - "Clear" 按钮恢复默认筛选

import { useState, useEffect } from 'react'

// 默认筛选：不设任何条件，按保存时间倒序
export const DEFAULT_FILTERS = {
  q: '',
  year_from: null,
  year_to: null,
  collection_id: null,
  document_status: null,
  analysis_status: null,
  sort_by: 'saved_at',
  sort_order: 'desc',
}

// 供下拉选择的状态选项（后端约定的值）
const STATUS_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'not_started', label: 'Not started' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

function LibraryFilters({ filters, onChange, collections }) {
  const [localQ, setLocalQ] = useState(filters.q || '')
  const [expanded, setExpanded] = useState(false)

  // q 输入的防抖：300ms 后同步到父组件的 filters
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQ !== filters.q) {
        onChange({ ...filters, q: localQ })
      }
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ])

  const update = (patch) => {
    onChange({ ...filters, ...patch })
  }

  const clearAll = () => {
    setLocalQ('')
    onChange({ ...DEFAULT_FILTERS })
  }

  // 判断是否有激活的筛选条件（用于显示 Clear 按钮和计数）
  const activeCount = [
    filters.q ? 1 : 0,
    filters.year_from != null || filters.year_to != null ? 1 : 0,
    filters.collection_id != null ? 1 : 0,
    filters.document_status ? 1 : 0,
    filters.analysis_status ? 1 : 0,
  ].reduce((sum, n) => sum + n, 0)

  return (
    <div className="library-filters card">
      {/* 主筛选行 */}
      <div className="filter-row-main">
        <input
          type="search"
          placeholder="Search title, author, abstract, or DOI..."
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
        />

        <select
          value={filters.sort_by}
          onChange={(e) => update({ sort_by: e.target.value })}
        >
          <option value="saved_at">Sort by: Saved at</option>
          <option value="publication_year">Sort by: Publication year</option>
          <option value="title">Sort by: Title</option>
          <option value="citation_count">Sort by: Citation count</option>
        </select>

        <select
          value={filters.sort_order}
          onChange={(e) => update({ sort_order: e.target.value })}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>

        <button type="button" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Hide filters' : 'More filters'}
          {activeCount > 0 ? ` (${activeCount})` : ''}
        </button>

        {activeCount > 0 && (
          <button type="button" className="danger" onClick={clearAll}>
            Clear
          </button>
        )}
      </div>

      {/* 高级筛选行 */}
      {expanded && (
        <div className="filter-row-extra">
          <label className="filter-field">
            <span>Year from</span>
            <input
              type="number"
              placeholder="e.g. 2015"
              min="1"
              max="9999"
              value={filters.year_from ?? ''}
              onChange={(e) =>
                update({
                  year_from: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>

          <label className="filter-field">
            <span>Year to</span>
            <input
              type="number"
              placeholder="e.g. 2026"
              min="1"
              max="9999"
              value={filters.year_to ?? ''}
              onChange={(e) =>
                update({
                  year_to: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>

          <label className="filter-field">
            <span>Collection</span>
            <select
              value={filters.collection_id ?? ''}
              onChange={(e) =>
                update({
                  collection_id: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            >
              <option value="">Any collection</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.paper_count})
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Document</span>
            <select
              value={filters.document_status ?? ''}
              onChange={(e) =>
                update({ document_status: e.target.value || null })
              }
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Analysis</span>
            <select
              value={filters.analysis_status ?? ''}
              onChange={(e) =>
                update({ analysis_status: e.target.value || null })
              }
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

export default LibraryFilters