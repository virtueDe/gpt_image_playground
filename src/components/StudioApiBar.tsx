import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { isSub2APIStudioProfile } from '../lib/sub2apiStudio'
import Select from './Select'

export default function StudioApiBar() {
  const settings = useStore((state) => state.settings)
  const setSettings = useStore((state) => state.setSettings)
  const profiles = settings.profiles.filter(isSub2APIStudioProfile)
  const activeProfile = profiles.find((profile) => profile.id === settings.activeProfileId) ?? profiles[0]
  const [models, setModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')

  useEffect(() => {
    if (!activeProfile?.apiKey || !activeProfile.baseUrl) {
      setModels([])
      setModelsError('')
      return
    }
    const controller = new AbortController()
    const previousModel = activeProfile.selectedModel || activeProfile.model
    setModels([])
    setModelsLoading(true)
    setModelsError('')
    setSettings({ profiles: useStore.getState().settings.profiles.map((profile) => profile.id === activeProfile.id
      ? { ...profile, model: '', selectedModel: previousModel }
      : profile) })
    const modelsUrl = `${activeProfile.baseUrl.replace(/\/+$/, '').replace(/\/v1(?:beta)?$/, '')}/v1/models`
    fetch(modelsUrl, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${activeProfile.apiKey}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json() as { data?: Array<{ id?: string }> }
        if (controller.signal.aborted) return
        const nextModels = Array.isArray(payload.data)
          ? [...new Set(payload.data.flatMap((item) => typeof item.id === 'string' && item.id.trim() ? [item.id.trim()] : []))]
          : []
        setModels(nextModels)
        setSettings({
          profiles: useStore.getState().settings.profiles.map((profile) => {
            if (profile.id !== activeProfile.id) return profile
            const selected = profile.selectedModel || previousModel
            const model = nextModels.includes(selected) ? selected : nextModels[0] ?? ''
            return { ...profile, model: nextModels.join(', '), selectedModel: model }
          }),
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.warn('主站模型列表获取失败：', error)
        setModels([])
        setModelsError(`模型列表获取失败：${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false)
      })
    return () => controller.abort()
  }, [activeProfile?.id, activeProfile?.apiKey, activeProfile?.baseUrl, activeProfile?.studioGroupPlatform, activeProfile?.provider, setSettings])

  const updateModel = (model: string | number) => {
    setSettings({
      profiles: useStore.getState().settings.profiles.map((profile) => profile.id === activeProfile?.id
        ? { ...profile, selectedModel: String(model) }
        : profile),
    })
  }

  return (
    <div className="mt-3 border-b border-gray-200/70 pb-3 dark:border-white/[0.08]">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="min-w-0">
          <span className="mb-1 block text-xs text-gray-400 dark:text-gray-500">主站 API Key</span>
          <Select
            value={settings.activeProfileId}
            onChange={(activeProfileId) => setSettings({ activeProfileId: String(activeProfileId) })}
            options={profiles.map((profile) => ({ label: profile.name, value: profile.id }))}
            className="h-10 rounded-xl border border-gray-200/70 bg-white/70 px-3 text-sm text-gray-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
            showValueTooltips
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-xs text-gray-400 dark:text-gray-500">主站图片模型</span>
          <Select
            value={activeProfile?.selectedModel ?? ''}
            onChange={updateModel}
            options={models.map((model) => ({ label: model, value: model }))}
            disabled={!activeProfile || modelsLoading || !models.length}
            className="h-10 rounded-xl border border-gray-200/70 bg-white/70 px-3 text-sm text-gray-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
            showValueTooltips
          />
          {modelsLoading && <span className="mt-1 block text-[11px] text-gray-400">正在获取模型…</span>}
          {modelsError && <span className="mt-1 block text-[11px] text-red-400">{modelsError}</span>}
          {!modelsLoading && !modelsError && activeProfile?.apiKey && !models.length && <span className="mt-1 block text-[11px] text-gray-400">暂无可用模型</span>}
        </label>
        <p className="pb-2 text-xs text-gray-400 dark:text-gray-500 sm:whitespace-nowrap">
          配置与主站同步，无需单独填写 API
        </p>
      </div>
    </div>
  )
}
