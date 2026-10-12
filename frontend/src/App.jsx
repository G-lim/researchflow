// App.jsx 是应用的根组件
// 管理三个视图：搜索页、资料库页、论文详情页
// 用本地 state 做页面切换，不引入路由库

import { useState } from 'react'
import SearchPage from './pages/SearchPage'
import LibraryPage from './pages/LibraryPage'
import PaperDetailPage from './pages/PaperDetailPage'

function App() {
  // 当前视图：'search' / 'library' / 'detail'
  const [view, setView] = useState('search')
  // 详情页要展示的论文 id（只在 view === 'detail' 时有效）
  const [selectedPaperId, setSelectedPaperId] = useState(null)

  // 从资料库点击某篇论文时调用
  const openDetail = (paperId) => {
    setSelectedPaperId(paperId)
    setView('detail')
  }

  return (
    <div className="app">
      {/* 页面顶部标题区域 */}
      <header className="app-header">
        <h1>ResearchFlow</h1>
        <p>AI-Assisted Research Information Management System</p>
      </header>

      {/* Tab 滑块：用 id 选中，样式在 CSS 的 #app-tabs 里 */}
      {view !== 'detail' && (
        <nav id="app-tabs">
          <div className="track">
            {/* 滑块：根据当前 view 平移 */}
            <span
              className="indicator"
              style={{
                transform:
                  view === 'search' ? 'translateX(0)' : 'translateX(100%)',
              }}
            />
            <button
              type="button"
              className={view === 'search' ? 'active' : ''}
              onClick={() => setView('search')}
            >
              Search
            </button>
            <button
              type="button"
              className={view === 'library' ? 'active' : ''}
              onClick={() => setView('library')}
            >
              My Library
            </button>
          </div>
        </nav>
      )}

      {/* 主内容区：根据 view 渲染不同页面 */}
      <main className="app-main">
        {view === 'search' && <SearchPage />}
        {view === 'library' && <LibraryPage onSelectPaper={openDetail} />}
        {view === 'detail' && (
          <PaperDetailPage
            paperId={selectedPaperId}
            onBack={() => setView('library')}
          />
        )}
      </main>
    </div>
  )
}

export default App