import type { ApiProfile, TaskParams } from '../types'
import {
  assertImageInputPayloadSize,
  type CallApiOptions,
  type CallApiResult,
  createRequestTimeoutError,
  getApiErrorMessage,
  normalizeBase64Image,
} from './imageApiShared'
import { apiFetch } from './platform'

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string
    content?: { parts?: Array<{
      text?: string
      thought?: boolean
      inlineData?: { mimeType?: string; data?: string }
    }> }
  }>
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

export async function callGeminiImageApi(opts: CallApiOptions, profile: ApiProfile): Promise<CallApiResult> {
  const model = profile.model.trim().replace(/^models\//, '')
  if (!model) throw new Error('请选择 Gemini 生图模型')
  if (opts.maskDataUrl) throw new Error('Gemini 原生接口不支持遮罩编辑，请移除遮罩并通过参考图和提示词描述修改区域')

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: opts.prompt }]
  for (const dataUrl of opts.inputImageDataUrls) {
    const match = dataUrl.match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/)
    if (!match) throw new Error('Gemini 参考图必须是有效的 Base64 图片')
    parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
  }

  const imageConfig: { aspectRatio?: string; imageSize?: string } = {}
  const size = opts.params.size.match(/^(\d+)x(\d+)$/)
  if (size && Number(size[1]) > 0 && Number(size[2]) > 0) {
    const ratio = Number(size[1]) / Number(size[2])
    const ratios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']
    imageConfig.aspectRatio = ratios.reduce((best, item) => {
      const [w, h] = item.split(':').map(Number)
      const [bw, bh] = best.split(':').map(Number)
      return Math.abs(Math.log(ratio / (w / h))) < Math.abs(Math.log(ratio / (bw / bh))) ? item : best
    })
  }
  // Flash 2.5 只支持固定分辨率；auto 交由模型选择默认输出尺寸。
  if (!model.toLowerCase().includes('gemini-2.5-flash-image') && opts.params.quality !== 'auto') {
    imageConfig.imageSize = opts.params.quality === 'low' ? '1K' : opts.params.quality === 'medium' ? '2K' : '4K'
  }
  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
    },
  })
  assertImageInputPayloadSize(new Blob([body]).size)
  const baseUrl = profile.baseUrl.trim().replace(/\/+$/, '').replace(/\/v1(?:beta)?$/, '')
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const n = Math.min(10, Math.max(1, Math.floor(opts.params.n) || 1))

  // Gemini 的多图数量通过独立请求实现，单张失败仍保留其他请求的结果。
  const results = await Promise.allSettled(Array.from({ length: n }, async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(createRequestTimeoutError(profile.timeout)), profile.timeout * 1000)
    try {
      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': profile.apiKey },
        body,
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(await getApiErrorMessage(response))
      const payload = await response.json() as GeminiResponse
      if (payload.error) throw new Error(payload.error.message || 'Gemini API 请求失败')
      const imageParts = (payload.candidates ?? []).flatMap((candidate) => candidate.content?.parts ?? [])
        .filter((part) => !part.thought && part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data)
      if (!imageParts.length) {
        const reason = payload.promptFeedback?.blockReason || (payload.candidates ?? [])
          .flatMap((candidate) => [candidate.finishReason, ...(candidate.content?.parts ?? []).map((part) => part.text)])
          .filter(Boolean).join('；')
        throw new Error(`Gemini 未返回图片${reason ? `：${reason}` : ''}`)
      }
      return imageParts.map((part) => {
        const format = part.inlineData!.mimeType!.split('/')[1]
        const params: Partial<TaskParams> = format === 'png' || format === 'jpeg' || format === 'webp'
          ? { output_format: format }
          : {}
        return { image: normalizeBase64Image(part.inlineData!.data!, part.inlineData!.mimeType!), params }
      })
    } catch (err) {
      if (controller.signal.aborted) throw controller.signal.reason
      throw err
    } finally {
      clearTimeout(timer)
    }
  }))
  const outputs = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  if (!outputs.length) throw (results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason
  const failedRequests = results.flatMap((result, requestIndex) => result.status === 'rejected'
    ? [{ requestIndex, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }]
    : [])
  return {
    images: outputs.map((item) => item.image),
    actualParams: { n: outputs.length, ...outputs[0].params },
    actualParamsList: outputs.map((item) => item.params),
    ...(failedRequests.length ? { failedRequests } : {}),
  }
}
