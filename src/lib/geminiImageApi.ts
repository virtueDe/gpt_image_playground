import type { ApiProfile, TaskParams } from '../types'
import {
  assertImageInputPayloadSize,
  type CallApiOptions,
  type CallApiResult,
  fetchImageUrlAsDataUrl,
  getApiErrorMessage,
  isDataUrl,
  isHttpUrl,
  MIME_MAP,
  normalizeBase64Image,
} from './imageApiShared'

/**
 * Gemini v1beta GenerateContent API 请求格式
 */
interface GeminiGenerateContentRequest {
  contents: Array<{
    role: 'user'
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
  }>
  generationConfig?: {
    candidateCount?: number
    responseMimeType?: string
  }
}

/**
 * Gemini v1beta GenerateContent API 响应格式
 */
interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        inlineData?: {
          mimeType: string
          data: string
        }
      }>
    }
  }>
  error?: {
    code: number
    message: string
    status?: string
  }
}

/**
 * 判断是否为 Gemini 图像生成模型
 */
export function isGeminiImageModel(model: string): boolean {
  const normalized = model.trim().toLowerCase()
  return normalized.includes('gemini') && normalized.includes('image')
}

/**
 * 构建 Gemini v1beta API 请求体
 */
function buildGeminiRequest(opts: CallApiOptions): GeminiGenerateContentRequest {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

  // 添加文本提示词
  parts.push({ text: opts.prompt })

  // 添加输入图片（如果有）
  for (const imageDataUrl of opts.inputImageDataUrls) {
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1] || 'image/png',
          data: match[2],
        },
      })
    }
  }

  // 添加遮罩图片（如果有）
  if (opts.maskDataUrl) {
    const match = opts.maskDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1] || 'image/png',
          data: match[2],
        },
      })
    }
  }

  const request: GeminiGenerateContentRequest = {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      candidateCount: Math.max(1, opts.params.n || 1),
      responseMimeType: MIME_MAP[opts.params.output_format] || 'image/png',
    },
  }

  return request
}

/**
 * 解析 Gemini v1beta API 响应
 */
async function parseGeminiResponse(
  response: GeminiGenerateContentResponse,
  params: TaskParams,
): Promise<CallApiResult> {
  // 检查错误
  if (response.error) {
    throw new Error(`Gemini API 错误：${response.error.message}`)
  }

  const mime = MIME_MAP[params.output_format] || 'image/png'
  const images: string[] = []
  const rawImageUrls: string[] = []

  // 提取图片数据
  if (response.candidates) {
    for (const candidate of response.candidates) {
      const parts = candidate.content?.parts || []
      for (const part of parts) {
        if (part.inlineData?.data) {
          // Base64 编码的图片数据
          const dataUrl = normalizeBase64Image(part.inlineData.data, part.inlineData.mimeType || mime)
          images.push(dataUrl)
        }
      }
    }
  }

  if (images.length === 0) {
    throw new Error('Gemini API 未返回图片数据')
  }

  return {
    images,
    actualParams: undefined,
    actualParamsList: images.map(() => undefined),
    revisedPrompts: images.map(() => undefined),
    ...(rawImageUrls.length ? { rawImageUrls } : {}),
  }
}

/**
 * 调用 Gemini v1beta GenerateContent API 生成图片
 */
export async function callGeminiImageApi(
  opts: CallApiOptions,
  profile: ApiProfile,
): Promise<CallApiResult> {
  const model = profile.model.trim() || 'gemini-3-pro-image-preview'

  // 构建完整的 API URL
  // sub2api 格式：POST /v1beta/models/{model}:generateContent
  // 注意：baseUrl 可能已经包含 /v1，需要移除避免重复
  const baseUrl = profile.baseUrl.trim().replace(/\/+$/, '').replace(/\/v1$/, '')
  const apiUrl = `${baseUrl}/v1beta/models/${model}:generateContent`

  // 构建请求体
  const requestBody = buildGeminiRequest(opts)

  // 验证输入大小
  const requestBodySize = new Blob([JSON.stringify(requestBody)]).size
  assertImageInputPayloadSize(requestBodySize)

  // 发送请求
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), profile.timeout * 1000)

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${profile.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      let errorMessage = `Gemini API 请求失败：HTTP ${response.status}`

      try {
        const errorJson = JSON.parse(errorText) as GeminiGenerateContentResponse
        if (errorJson.error?.message) {
          errorMessage = `Gemini API 错误：${errorJson.error.message}`
        }
      } catch {
        if (errorText) {
          errorMessage += `\n${errorText.slice(0, 200)}`
        }
      }

      throw new Error(errorMessage)
    }

    const responseData = await response.json() as GeminiGenerateContentResponse
    return await parseGeminiResponse(responseData, opts.params)
  } catch (err) {
    clearTimeout(timeoutId)

    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Gemini API 请求超时：超过 ${profile.timeout} 秒仍未完成`)
    }

    throw err
  }
}
