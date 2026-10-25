// CacheNotice.jsx 显示搜索结果的时间戳与缓存降级提示
//
// 两种状态：
//   1. 正常搜索（from_cache=false）→ 显示本次结果被缓存的时间
//   2. 降级命中（from_cache=true）→ 提示实时搜索失败，已载入上次缓存

function CacheNotice({ fromCache, cachedAt }) {
    if (!cachedAt) return null
  
    // 转成本地时区的可读时间，比如 "2026-10-12 14:32"
    const formatAbsolute = (isoString) => {
      const date = new Date(isoString)
      const pad = (n) => String(n).padStart(2, '0')
      return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`
      )
    }
  
    const stamp = formatAbsolute(cachedAt)
  
    if (fromCache) {
      return (
        <div className="cache-notice cache-notice-fallback">
          Live search is unavailable. Showing cached results from {stamp}.
        </div>
      )
    }
  
    return (
      <div className="cache-notice">
        Results cached at {stamp}.
      </div>
    )
  }
  
  export default CacheNotice