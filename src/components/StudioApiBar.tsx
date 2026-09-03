import { useStore } from '../store'
import { isSub2APIStudioProfile } from '../lib/sub2apiStudio'
import Select from './Select'

export default function StudioApiBar() {
  const settings = useStore((state) => state.settings)
  const setSettings = useStore((state) => state.setSettings)
  const profiles = settings.profiles.filter(isSub2APIStudioProfile)

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
          <div className="flex h-10 items-center rounded-xl border border-gray-200/70 bg-gray-50/80 px-3 text-sm text-gray-600 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300">
            gpt-image-2
          </div>
        </label>
        <p className="pb-2 text-xs text-gray-400 dark:text-gray-500 sm:whitespace-nowrap">
          配置与主站同步，无需单独填写 API
        </p>
      </div>
    </div>
  )
}
