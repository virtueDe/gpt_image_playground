import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './apiProfiles'
import {
  buildSub2APIStudioSettings,
  filterEligibleSub2APIKeys,
  stripSub2APIStudioProfileKeys,
  unwrapSub2APIResponse,
  type Sub2APIStudioGroup,
  type Sub2APIStudioKey,
} from './sub2apiStudio'

const groups: Sub2APIStudioGroup[] = [
  { id: 1, name: '图片组', platform: 'openai', status: 'active', allow_image_generation: true },
  { id: 2, name: '普通组', platform: 'openai', status: 'active', allow_image_generation: false },
  { id: 3, name: 'Gemini 图片组', platform: 'gemini', status: 'active', allow_image_generation: true },
]

const keys: Sub2APIStudioKey[] = [
  { id: 11, name: '可用 Key', key: 'sk-available', group_id: 1, status: 'active', expires_at: null },
  { id: 12, name: '错误分组', key: 'sk-wrong-group', group_id: 2, status: 'active', expires_at: null },
  { id: 13, name: '错误平台', key: 'sk-wrong-platform', group_id: 3, status: 'active', expires_at: null },
  { id: 14, name: '已停用', key: 'sk-inactive', group_id: 1, status: 'inactive', expires_at: null },
  { id: 15, name: '已过期', key: 'sk-expired', group_id: 1, status: 'active', expires_at: '2026-01-01T00:00:00Z' },
]

describe('sub2api studio', () => {
  it('只返回绑定了可用图片分组的有效 Key', () => {
    expect(filterEligibleSub2APIKeys(groups, keys, new Date('2026-09-02T00:00:00Z'))).toEqual([
      {
        id: 11,
        name: '可用 Key',
        key: 'sk-available',
        groupId: 1,
        groupName: '图片组',
      },
    ])
  })

  it('生成锁定的异步生图配置并保留上次选择', () => {
    const eligible = [
      { id: 11, name: '第一把', key: 'sk-one', groupId: 1, groupName: '图片组' },
      { id: 16, name: '第二把', key: 'sk-two', groupId: 1, groupName: '图片组' },
    ]
    const settings = buildSub2APIStudioSettings(
      { ...DEFAULT_SETTINGS, activeProfileId: 'sub2api-studio-key-16' },
      eligible,
      'https://subapi.example.com',
    )

    expect(settings.activeProfileId).toBe('sub2api-studio-key-16')
    expect(settings.customProviders).toEqual([])
    expect(settings.profiles).toHaveLength(2)
    expect(settings.profiles[0]).toMatchObject({
      id: 'sub2api-studio-key-11',
      name: '第一把 · 图片组',
      provider: 'sb2api-async',
      baseUrl: 'https://subapi.example.com/v1',
      apiKey: 'sk-one',
      model: 'gpt-image-2',
      apiMode: 'images',
    })
    expect(settings.profiles[0].providerDrafts?.openai).toMatchObject({
      baseUrl: 'https://subapi.example.com/v1',
      model: 'gpt-image-2',
      apiMode: 'images',
    })
    expect(settings.profiles[0].providerDrafts?.['sb2api-async']).toMatchObject({
      baseUrl: 'https://subapi.example.com/v1',
      model: 'gpt-image-2',
      apiMode: 'images',
    })
  })

  it('持久化前移除站内 profile 的原始 Key', () => {
    const settings = buildSub2APIStudioSettings(
      DEFAULT_SETTINGS,
      [{ id: 11, name: '可用 Key', key: 'sk-secret', groupId: 1, groupName: '图片组' }],
      'https://subapi.example.com',
    )

    const stripped = stripSub2APIStudioProfileKeys(settings)
    expect(stripped.profiles[0].apiKey).toBe('')
    expect(settings.profiles[0].apiKey).toBe('sk-secret')
  })

  it('解包 Sub2API 标准响应并保留兼容直返数据', () => {
    expect(unwrapSub2APIResponse({ code: 0, message: 'success', data: { total: 1 } })).toEqual({ total: 1 })
    expect(unwrapSub2APIResponse([{ id: 1 }])).toEqual([{ id: 1 }])
    expect(() => unwrapSub2APIResponse({ code: 1001, message: '读取失败', data: null })).toThrow('读取失败')
  })
})
