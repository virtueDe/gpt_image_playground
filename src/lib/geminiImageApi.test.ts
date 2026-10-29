import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import { prepareSettingsForCommit } from './settingsActions'
import { DEFAULT_SETTINGS, normalizeSettings } from './apiProfiles'
import { callImageApi } from './api'
import { buildSub2APIStudioSettings, stripSub2APIStudioProfileKeys } from './sub2apiStudio'
import { normalizeParamsForSettings } from './paramCompatibility'

function options(platform = 'gemini', model = 'banana-alias') {
  const settings = buildSub2APIStudioSettings(DEFAULT_SETTINGS, [
    { id: 1, name: 'Key', key: 'test-studio-secret', groupId: 1, groupName: '图片组', groupPlatform: platform },
  ], 'https://studio.example')
  return {
    settings: normalizeSettings({ ...settings, profiles: settings.profiles.map((profile) => ({ ...profile, model })) }),
    prompt: '画一只猫',
    params: { ...DEFAULT_PARAMS },
    inputImageDataUrls: [] as string[],
  }
}

const imageResponse = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [
  { thought: true, inlineData: { mimeType: 'image/png', data: 'dGhvdWdodA==' } },
  { text: '这是生成的图片' },
  { inlineData: { mimeType: 'audio/wav', data: 'YXVkaW8=' } },
  { inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } },
] } }] }))

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('Studio Gemini 原生生图', () => {
  it('平台信息经过 normalize 保留，模型别名走原生接口', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => imageResponse())
    const opts = options()
    const result = await callImageApi(opts)
    expect(opts.settings.profiles[0].studioGroupPlatform).toBe('gemini')
    expect(fetchMock.mock.calls[0][0]).toBe('https://studio.example/v1beta/models/banana-alias:generateContent')
    const init = fetchMock.mock.calls[0][1]!
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'test-studio-secret' })
    expect(JSON.parse(String(init.body))).toEqual({
      contents: [{ role: 'user', parts: [{ text: '画一只猫' }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    })
    expect(result.images).toEqual(['data:image/png;base64,aW1hZ2U='])
  })

  it.each(['openai', 'grok'])('%s 分组中 Gemini 名称仍走兼容接口', async (platform) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] })))
    const opts = options(platform, 'gemini-3-pro-image-preview')
    opts.settings = normalizeSettings({ ...opts.settings, profiles: opts.settings.profiles.map((profile) => ({ ...profile, provider: 'openai', streamImages: false })) })
    await callImageApi(opts)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/images/generations')
  })

  it.each(['/v1', '/v1beta/', ''])('规范化接口前缀 %s 并编码模型 ID', async (suffix) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => imageResponse())
    const opts = options('gemini', 'models/custom/model')
    opts.settings.profiles[0].baseUrl += suffix
    opts.settings = normalizeSettings(opts.settings)
    await callImageApi(opts)
    expect(fetchMock.mock.calls[0][0]).toBe('https://studio.example/v1beta/models/custom%2Fmodel:generateContent')
  })

  it('原生参考图、3:2 比例和 2K 分辨率', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => imageResponse())
    const opts = options()
    opts.inputImageDataUrls = ['data:image/jpeg;base64,cmVm']
    opts.params = { ...opts.params, size: '1536x1024', quality: 'medium' }
    await callImageApi(opts)
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]!.body))
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'cmVm' } })
    expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: '3:2', imageSize: '2K' })
    expect(body.generationConfig).not.toHaveProperty('responseMimeType')
    expect(body.generationConfig).not.toHaveProperty('candidateCount')
  })

  it('Flash 2.5 不发送不支持的分辨率', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => imageResponse())
    const opts = options('gemini', 'gemini-2.5-flash-image')
    opts.params.quality = 'high'
    await callImageApi(opts)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body)).generationConfig).not.toHaveProperty('imageConfig')
  })

  it('多图拆请求且保留部分成功与失败索引', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(imageResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'quota exhausted' } }), { status: 429 }))
      .mockResolvedValueOnce(imageResponse())
    const opts = options()
    opts.params.n = 3
    const result = await callImageApi(opts)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.images).toHaveLength(2)
    expect(result.failedRequests).toEqual([{ requestIndex: 1, error: expect.stringContaining('quota exhausted') }])
  })

  it.each([
    [{ error: { message: 'invalid model' } }, 'invalid model'],
    [{ promptFeedback: { blockReason: 'SAFETY' } }, 'SAFETY'],
    [{ candidates: [{ content: { parts: [{ text: '无法生成这张图片' }] } }] }, '无法生成这张图片'],
  ])('显示服务端错误或未出图原因', async (payload, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload)))
    await expect(callImageApi(options())).rejects.toThrow(String(message))
  })

  it('保存设置后仍保留 Studio 空模型状态', async () => {
    const opts = options('gemini', '')
    opts.settings = prepareSettingsForCommit(opts.settings)
    expect(opts.settings.model).toBe('')
    await expect(callImageApi(opts)).rejects.toThrow('模型列表')
  })

  it('模型未加载、非法参考图及遮罩明确报错且不发送请求', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(callImageApi(options('gemini', ''))).rejects.toThrow('模型列表')
    await expect(callImageApi({ ...options(), inputImageDataUrls: ['invalid'] })).rejects.toThrow('参考图')
    await expect(callImageApi({ ...options(), maskDataUrl: 'data:image/png;base64,bWFzaw==' })).rejects.toThrow('不支持遮罩')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('收到响应头之后仍约束响应体读取超时', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const response = new Response('{}')
      vi.spyOn(response, 'json').mockImplementation(() => new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))
      }))
      return response
    })
    const opts = options()
    opts.settings.profiles[0].timeout = 1
    opts.settings = normalizeSettings(opts.settings)
    const result = expect(callImageApi(opts)).rejects.toThrow('请求超时')
    await vi.advanceTimersByTimeAsync(1001)
    await result
    expect(vi.getTimerCount()).toBe(0)
  })

  it('切入 Gemini 清理不兼容参数，保存时不泄漏主站 Key', () => {
    const opts = options()
    expect(normalizeParamsForSettings({ ...opts.params, transparent_output: true, output_format: 'webp', output_compression: 80, moderation: 'low' }, opts.settings)).toMatchObject({
      transparent_output: false, output_format: 'png', output_compression: null, moderation: 'auto',
    })
    expect(JSON.stringify(stripSub2APIStudioProfileKeys(opts.settings))).not.toContain('test-studio-secret')
    expect(opts.settings.apiKey).toBe('test-studio-secret')
  })
})
