// papers.js 封装所有与“论文”相关的后端接口
// 组件只调用这里的函数，不直接使用 axios
// 好处：接口路径或参数有变化时，只改这里

import client from './client'

/**
 * 搜索学术论文
 * 对应后端接口：GET /api/papers/search
 *
 * @param {string} query - 搜索关键词
 * @param {number} page - 页码，从 1 开始，默认 1
 * @returns {Promise<{papers: Array, page: number, has_more: boolean}>}
 */
export async function searchPapers(query, page = 1) {
  const response = await client.get('/papers/search', {
    params: {
      q: query,
      page: page,
    },
  })
  return response.data
}

/**
 * 保存论文到资料库
 * 对应后端接口：POST /api/papers
 *
 * @param {object} paper - 与搜索结果中的 paper 对象结构一致
 * @returns {Promise<object>} 保存后的论文记录（含 id、created_at 等）
 */
export async function savePaper(paper) {
  // 只挑后端需要的字段，避免把界面上临时字段发过去
  const payload = {
    openalex_id: paper.openalex_id,
    title: paper.title,
    authors: paper.authors ?? [],
    publication_year: paper.publication_year ?? null,
    abstract: paper.abstract ?? null,
    doi: paper.doi ?? null,
    venue: paper.venue ?? null,
    citation_count: paper.citation_count ?? 0,
    landing_page_url: paper.landing_page_url ?? null,
  }
  const response = await client.post('/papers', payload)
  return response.data
}

/**
 * 获取已保存论文列表
 * 对应后端接口：GET /api/papers
 *
 * 所有筛选参数都是可选的。不传任何参数时，返回最新的全部论文。
 *
 * @param {object} filters
 * @param {string} [filters.q]                 搜索标题 / 作者 / 摘要 / DOI
 * @param {number} [filters.year_from]         起始年份
 * @param {number} [filters.year_to]           结束年份
 * @param {number} [filters.collection_id]     按集合筛选
 * @param {string} [filters.document_status]   'pending' | 'processing' | 'completed' | 'failed' | 'not_started'
 * @param {string} [filters.analysis_status]   同上，针对最新分析状态
 * @param {string} [filters.sort_by]           'saved_at' | 'publication_year' | 'title' | 'citation_count'
 * @param {string} [filters.sort_order]        'asc' | 'desc'
 * @returns {Promise<{papers: Array}>}
 */
export async function listSavedPapers(filters = {}) {
  const params = {}

  // 只传非空字段，避免后端把空字符串当有效输入
  if (filters.q) params.q = filters.q
  if (filters.year_from != null) params.year_from = filters.year_from
  if (filters.year_to != null) params.year_to = filters.year_to
  if (filters.collection_id != null) params.collection_id = filters.collection_id
  if (filters.document_status) params.document_status = filters.document_status
  if (filters.analysis_status) params.analysis_status = filters.analysis_status
  if (filters.sort_by) params.sort_by = filters.sort_by
  if (filters.sort_order) params.sort_order = filters.sort_order

  const response = await client.get('/papers', { params })
  return response.data
}

/**
 * 获取单篇已保存论文的详情
 * 对应后端接口：GET /api/papers/{paper_id}
 *
 * @param {number} paperId - 资料库中的论文 ID
 * @returns {Promise<object>}
 */
export async function getSavedPaper(paperId) {
  const response = await client.get(`/papers/${paperId}`)
  return response.data
}

/**
 * 删除已保存的论文
 * 对应后端接口：DELETE /api/papers/{paper_id}
 *
 * @param {number} paperId - 资料库中的论文 ID
 * @returns {Promise<void>} 成功时后端返回 204，无 body
 */
export async function deletePaper(paperId) {
  await client.delete(`/papers/${paperId}`)
}