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
    setModelsLoading(true)
    setModelsError('')
    const modelsUrl = `${activeProfile.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1/models`
    fetch(modelsUrl, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${activeProfile.apiKey}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json() as { data?: Array<{ id?: string }> }
        const nextModels = Array.isArray(payload.data)
          ? payload.data.map((item) => item.id?.trim()).filter((id): id is string => !!id)
          : []
        setModels(nextModels)
        if (nextModels.length && !nextModels.includes(activeProfile.model)) {
          setSettings({
            profiles: settings.profiles.map((profile) => profile.id === activeProfile.id
              ? { ...profile, model: nextModels[0], providerDrafts: {
                ...profile.providerDrafts,
                'sb2api-async': { ...profile.providerDrafts?.['sb2api-async'], model: nextModels[0] },
              } }
              : profile),
          })
        }
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setModels([])
          setModelsError('模型列表获取失败')
        }
      })
      .finally(() => setModelsLoading(false))
    return () => controller.abort()
  }, [activeProfile?.id, activeProfile?.apiKey, activeProfile?.baseUrl])

  const updateModel = (model: string | number) => {
    const nextModel = String(model)
    setSettings({
      profiles: settings.profiles.map((profile) => profile.id === activeProfile?.id
        ? { ...profile, model: nextModel, providerDrafts: {
          ...profile.providerDrafts,
          'sb2api-async': { ...profile.providerDrafts?.['sb2api-async'], model: nextModel },
        } }
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
            value={activeProfile?.model ?? ''}
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
