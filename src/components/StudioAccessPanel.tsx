import { RefreshIcon } from './icons'

export type StudioAccessStatus = 'loading' | 'ready' | 'empty' | 'auth' | 'error'

interface StudioAccessPanelProps {
  status: StudioAccessStatus
  error: string
  onRetry: () => void
}

export default function StudioAccessPanel({ status, error, onRetry }: StudioAccessPanelProps) {
  const isLoading = status === 'loading'
  const title = isLoading
    ? '正在同步主站配置'
    : status === 'empty'
      ? '暂无可用于图片生成的 Key'
      : status === 'auth'
        ? '请先登录主站'
        : '主站配置加载失败'
  const description = isLoading
    ? '正在读取你已创建的 API Key 和图片生成分组。'
    : status === 'empty'
      ? '请先在主站创建 API Key，并将它绑定到已开启图片生成的分组。'
      : status === 'auth'
        ? '登录后会自动同步你的可用 Key，无需在这里重复填写。'
        : error || '暂时无法读取主站配置，请稍后重试。'

  return (
    <main className="safe-area-x mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl items-center justify-center px-4 pb-20 pt-28">
      <section className="w-full max-w-lg text-center" aria-live="polite">
        {isLoading ? (
          <div className="mx-auto mb-5 h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500 dark:border-white/[0.1] dark:border-t-blue-400" />
        ) : (
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-300">
            <RefreshIcon className="h-5 w-5" />
          </div>
        )}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
        {!isLoading && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {status === 'empty' && (
              <a href="/keys" className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600">
                去创建密钥
              </a>
            )}
            {status === 'auth' && (
              <a href="/login?redirect=%2Fstudio%2F" className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600">
                登录主站
              </a>
            )}
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]"
            >
              重新同步
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
