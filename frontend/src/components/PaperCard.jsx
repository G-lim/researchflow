// PaperCard.jsx 展示单篇论文信息，右下角有保存按钮
// 保存相关属性：
//   - isSaved：是否已保存（true 时按钮禁用并显示 Saved）
//   - isSaving：是否正在保存中（true 时显示 Saving...）
//   - onSave：点击保存按钮时的回调，会把 paper 对象传出去

function PaperCard({ paper, isSaved, isSaving, onSave }) {
  // 根据状态决定按钮文案
  const buttonText = isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save'

  // 论文外部链接：优先用 landing_page_url，其次 doi
  const paperLink = paper.landing_page_url || paper.doi

  return (
    <div className="paper-card card">
      {/* 标题：有链接就包 a，没有就纯文本 */}
      <h3>
        {paperLink ? (
          <a href={paperLink} target="_blank" rel="noopener noreferrer">
            {paper.title}
          </a>
        ) : (
          paper.title
        )}
      </h3>

      {/* 作者列表 */}
      <p className="authors">
        {paper.authors && paper.authors.length > 0
          ? paper.authors.join(', ')
          : 'Unknown authors'}
      </p>

      {/* 元信息：年份、期刊、引用次数 */}
      <div className="row">
        {paper.publication_year && (
          <span className="tag">Year: {paper.publication_year}</span>
        )}
        {paper.venue && <span className="tag">Venue: {paper.venue}</span>}
        {paper.citation_count !== undefined && (
          <span className="tag">Citations: {paper.citation_count}</span>
        )}
      </div>

      {/* 摘要 */}
      {paper.abstract && <p className="abstract">{paper.abstract}</p>}

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

      {/* 保存按钮 */}
      <footer>
        <button
          type="button"
          onClick={() => onSave(paper)}
          disabled={isSaved || isSaving}
        >
          {buttonText}
        </button>
      </footer>
    </div>
  )
}

export default PaperCard