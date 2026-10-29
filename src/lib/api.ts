import { getActiveApiProfile, getCustomProviderDefinition } from './apiProfiles'
import { callFalAiImageApi } from './falAiImageApi'
import { callGeminiImageApi } from './geminiImageApi'
import { isGeminiImageProfile } from './imageModels'
import { isSub2APIStudioProfile } from './sub2apiStudio'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import type { CallApiOptions, CallApiResult } from './imageApiShared'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  const profile = getActiveApiProfile(opts.settings)
  if (isSub2APIStudioProfile(profile) && !profile.model.trim()) throw new Error('请等待主站模型列表加载完成，并选择可用的生图模型')

  // fal.ai 专用处理
  if (profile.provider === 'fal') return callFalAiImageApi(opts, profile)

  if (isGeminiImageProfile(profile)) return callGeminiImageApi(opts, profile)

  // 默认使用 OpenAI 兼容接口
  return callOpenAICompatibleImageApi(opts, profile, getCustomProviderDefinition(opts.settings, profile.provider))
}
