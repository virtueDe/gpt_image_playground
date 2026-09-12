import { getActiveApiProfile, getCustomProviderDefinition } from './apiProfiles'
import { callFalAiImageApi } from './falAiImageApi'
import { callGeminiImageApi, isGeminiImageModel } from './geminiImageApi'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import type { CallApiOptions, CallApiResult } from './imageApiShared'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  const profile = getActiveApiProfile(opts.settings)

  // fal.ai 专用处理
  if (profile.provider === 'fal') return callFalAiImageApi(opts, profile)

  // Gemini 图像模型专用处理
  if (isGeminiImageModel(profile.model)) return callGeminiImageApi(opts, profile)

  // 默认使用 OpenAI 兼容接口
  return callOpenAICompatibleImageApi(opts, profile, getCustomProviderDefinition(opts.settings, profile.provider))
}
