import type { ApiProfile, AppSettings } from '../types'
import { DEFAULT_API_TIMEOUT, DEFAULT_IMAGES_MODEL, normalizeSettings } from './apiProfiles'
import { readRuntimeEnv } from './runtimeEnv'

const STUDIO_PROFILE_PREFIX = 'sub2api-studio-key-'
const STUDIO_EMPTY_PROFILE_ID = 'sub2api-studio-empty'
const API_KEY_PAGE_SIZE = 100

export const SUB2API_STUDIO_MODE = readRuntimeEnv(import.meta.env.VITE_SUB2API_STUDIO_MODE) === 'true'

export interface Sub2APIStudioGroup {
  id: number
  name: string
  platform: string
  status: string
  allow_image_generation: boolean
}

export interface Sub2APIStudioKey {
  id: number
  name: string
  key: string
  group_id: number | null
  status: string
  expires_at: string | null
}

export interface EligibleSub2APIStudioKey {
  id: number
  name: string
  key: string
  groupId: number
  groupName: string
}

export class Sub2APIStudioAuthError extends Error {}

interface Sub2APIApiEnvelope<T> {
  code: number
  message?: string
  data: T
}

export function unwrapSub2APIResponse<T>(payload: T | Sub2APIApiEnvelope<T>): T {
  if (payload && typeof payload === 'object' && 'code' in payload) {
    if (payload.code !== 0) throw new Error(payload.message || '主站接口请求失败')
    return payload.data
  }
  return payload
}

export function isSub2APIStudioProfile(profile: ApiProfile) {
  return profile.id.startsWith(STUDIO_PROFILE_PREFIX)
}

function studioProfileId(keyId: number) {
  return `${STUDIO_PROFILE_PREFIX}${keyId}`
}

function createStudioProfile(
  id: string,
  name: string,
  apiKey: string,
  origin: string,
): ApiProfile {
  const baseUrl = `${origin.replace(/\/+$/, '')}/v1`
  const providerDraft = {
    baseUrl,
    model: DEFAULT_IMAGES_MODEL,
    apiMode: 'images' as const,
    codexCli: false,
    apiProxy: false,
    streamImages: false,
    transparentBackgroundMethod: 'api' as const,
  }

  return {
    id,
    name,
    provider: 'sb2api-async',
    baseUrl,
    apiKey,
    model: DEFAULT_IMAGES_MODEL,
    timeout: DEFAULT_API_TIMEOUT,
    apiMode: 'images',
    codexCli: false,
    apiProxy: false,
    streamImages: false,
    transparentBackgroundMethod: 'api',
    providerDrafts: {
      openai: providerDraft,
      'sb2api-async': providerDraft,
    },
  }
}

export function filterEligibleSub2APIKeys(
  groups: Sub2APIStudioGroup[],
  keys: Sub2APIStudioKey[],
  now = new Date(),
): EligibleSub2APIStudioKey[] {
  const availableGroups = new Map(
    groups
      .filter((group) => (
        group.status === 'active' &&
        group.allow_image_generation &&
        (group.platform === 'openai' || group.platform === 'grok')
      ))
      .map((group) => [group.id, group]),
  )

  return keys.flatMap((key) => {
    if (key.status !== 'active' || !key.key.trim() || key.group_id == null) return []
    if (key.expires_at) {
      const expiresAt = Date.parse(key.expires_at)
      if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return []
    }
    const group = availableGroups.get(key.group_id)
    if (!group) return []
    return [{
      id: key.id,
      name: key.name,
      key: key.key,
      groupId: group.id,
      groupName: group.name,
    }]
  })
}

export function buildSub2APIStudioSettings(
  current: AppSettings,
  keys: EligibleSub2APIStudioKey[],
  origin: string,
): AppSettings {
  const profiles = keys.map((key) => createStudioProfile(
    studioProfileId(key.id),
    `${key.name} · ${key.groupName}`,
    key.key,
    origin,
  ))
  const studioProfiles = profiles.length
    ? profiles
    : [createStudioProfile(STUDIO_EMPTY_PROFILE_ID, '暂无可用 Key', '', origin)]
  const activeProfileId = studioProfiles.some((profile) => profile.id === current.activeProfileId)
    ? current.activeProfileId
    : studioProfiles[0].id

  return normalizeSettings({
    ...current,
    customProviders: [],
    providerOrder: ['openai', 'sb2api-async'],
    profiles: studioProfiles,
    activeProfileId,
    agentApiConfigMode: 'off',
    agentTextProfileId: null,
    agentImageProfileId: activeProfileId,
  })
}

export function stripSub2APIStudioProfileKeys(settings: AppSettings): AppSettings {
  return {
    ...settings,
    profiles: settings.profiles.map((profile) => (
      isSub2APIStudioProfile(profile) ? { ...profile, apiKey: '' } : profile
    )),
  }
}

async function fetchStudioJson<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal,
  })
  if (response.status === 401 || response.status === 403) {
    throw new Sub2APIStudioAuthError('主站登录状态已失效')
  }
  if (!response.ok) throw new Error(`主站接口请求失败：HTTP ${response.status}`)

  const payload = await response.json() as T | Sub2APIApiEnvelope<T>
  return unwrapSub2APIResponse(payload)
}

export async function loadEligibleSub2APIStudioKeys(signal?: AbortSignal) {
  const token = localStorage.getItem('auth_token')?.trim()
  if (!token) throw new Sub2APIStudioAuthError('请先登录主站')

  const groups = await fetchStudioJson<Sub2APIStudioGroup[]>('/api/v1/groups/available', token, signal)
  const keys: Sub2APIStudioKey[] = []
  let page = 1
  let total = Number.POSITIVE_INFINITY

  while (keys.length < total && page <= 100) {
    const result = await fetchStudioJson<{
      items: Sub2APIStudioKey[]
      total: number
    }>(`/api/v1/keys?page=${page}&page_size=${API_KEY_PAGE_SIZE}`, token, signal)
    const items = Array.isArray(result.items) ? result.items : []
    keys.push(...items)
    total = Number.isFinite(result.total) ? result.total : keys.length
    if (items.length < API_KEY_PAGE_SIZE) break
    page += 1
  }

  return filterEligibleSub2APIKeys(groups, keys)
}

export function getSub2APIStudioBackPath() {
  try {
    const user = JSON.parse(localStorage.getItem('auth_user') ?? 'null') as { role?: string } | null
    return user?.role === 'admin' ? '/admin/dashboard' : '/dashboard'
  } catch {
    return '/dashboard'
  }
}
