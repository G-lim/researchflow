// settings.js 封装分析服务配置的接口
// 对应后端：GET / PUT /api/settings/analysis
//
// 后端只在本地（loopback）允许访问这些端点，部署到远程服务器时会返回 403

import client from './client'

/**
 * 读取当前分析服务配置
 * 对应后端接口：GET /api/settings/analysis
 *
 * @returns {Promise<{model: string, api_key_configured: boolean, restart_required: boolean}>}
 */
export async function getAnalysisSettings() {
  const response = await client.get('/settings/analysis')
  return response.data
}

/**
 * 更新分析服务配置
 * 对应后端接口：PUT /api/settings/analysis
 *
 * @param {string} model - 模型名称，例如 "dots-studio/dots-3-note-preview:free"
 * @param {string} apiKey - API key。传空字符串表示保留现有 key
 * @returns {Promise<{model: string, api_key_configured: boolean, restart_required: boolean}>}
 */
export async function updateAnalysisSettings(model, apiKey) {
  const response = await client.put('/settings/analysis', {
    model,
    api_key: apiKey,
  })
  return response.data
}