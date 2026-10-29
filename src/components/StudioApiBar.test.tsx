// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store'
import { DEFAULT_SETTINGS, getActiveApiProfile } from '../lib/apiProfiles'
import { buildSub2APIStudioSettings } from '../lib/sub2apiStudio'
import StudioApiBar from './StudioApiBar'

vi.mock('./Select', () => ({ default: (props: { value: string; options: Array<{ label: string; value: string }>; disabled?: boolean; onChange: (value: string) => void }) => (
  <select value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)}>
    {props.options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
  </select>
) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => { vi.restoreAllMocks() })

describe('Studio 分组模型选择', () => {
  it('旧分组请求晚到不会覆盖新分组，加载期间不使用默认模型', async () => {
    const pending: Array<(response: Response) => void> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => pending.push(resolve)))
    useStore.getState().setSettings(buildSub2APIStudioSettings(DEFAULT_SETTINGS, [
      { id: 1, name: 'A', key: 'key-a', groupId: 1, groupName: 'OpenAI', groupPlatform: 'openai' },
      { id: 2, name: 'B', key: 'key-b', groupId: 2, groupName: 'Gemini', groupPlatform: 'gemini' },
    ], 'https://studio.example'))
    const el = document.createElement('div')
    const root = createRoot(el)
    try {
      await act(async () => root.render(<StudioApiBar />))
      expect(getActiveApiProfile(useStore.getState().settings).model).toBe('')
      await act(async () => useStore.getState().setSettings({ activeProfileId: 'sub2api-studio-key-2' }))
      expect(pending).toHaveLength(2)
      await act(async () => {
        pending[0](new Response(JSON.stringify({ data: [{ id: 'old-model' }] })))
      })
      expect(el.textContent).toContain('正在获取模型')
      await act(async () => {
        const state = useStore.getState()
        state.setSettings({ profiles: state.settings.profiles.map((profile) => ({ ...profile, timeout: 321 })) })
        pending[1](new Response(JSON.stringify({ data: [{ id: 'banana-alias' }, { id: 'second-model' }] })))
      })
      expect(getActiveApiProfile(useStore.getState().settings)).toMatchObject({
        model: 'banana-alias', studioGroupPlatform: 'gemini', timeout: 321,
      })
      expect(el.textContent).not.toContain('old-model')
      await act(async () => {
        const select = el.querySelectorAll('select')[1]
        select.value = 'second-model'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })
      expect(getActiveApiProfile(useStore.getState().settings).model).toBe('second-model')
    } finally {
      act(() => root.unmount())
    }
  })

  it.each([true, false])('空列表或请求失败时禁止回退到默认生图模型：%s', async (empty) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(empty
      ? new Response(JSON.stringify({ data: [] }))
      : new Response('failure', { status: 503 }))
    useStore.getState().setSettings(buildSub2APIStudioSettings(DEFAULT_SETTINGS, [
      { id: 1, name: 'A', key: 'key-a', groupId: 1, groupName: 'Gemini', groupPlatform: 'gemini' },
    ], 'https://studio.example'))
    const el = document.createElement('div')
    const root = createRoot(el)
    try {
      await act(async () => root.render(<StudioApiBar />))
      expect(getActiveApiProfile(useStore.getState().settings).model).toBe('')
      expect(el.querySelectorAll('select')[1].disabled).toBe(true)
      expect(el.textContent).toContain(empty ? '暂无可用模型' : 'HTTP 503')
    } finally {
      act(() => root.unmount())
    }
  })
})
