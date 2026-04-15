import { useBoardStore, type ModuleWindowLayout } from '../store/useBoardStore'
import { ModuleWindow } from './ModuleWindow'
import { MODULE_CONFIG_MAP } from '../modules/moduleRegistry'

export function ModuleLayer() {
  const moduleWindows = useBoardStore((state) => state.moduleWindows)
  const timer = useBoardStore((state) => state.timer)
  const sorted = moduleWindows.openModuleIds
    .map((moduleId) => moduleWindows.windowsById[moduleId])
    .filter((layout): layout is ModuleWindowLayout => Boolean(layout))
    .sort((a, b) => a.zIndex - b.zIndex)
  const fullscreenModule = sorted.find((module) => module.fullscreen)
  const timerChip = timer.durationMs ? `${Math.max(0, Math.ceil(timer.remainingMs / 60000))} min` : undefined

  return (
    <div className="module-layer">
      {sorted.map((module) => {
        if (fullscreenModule && module.moduleId !== fullscreenModule.moduleId) {
          return null
        }
        const config = MODULE_CONFIG_MAP[module.moduleId]
        if (!config) {
          return null
        }
        const Component = config.component
        return (
          <ModuleWindow
            key={module.moduleId}
            layout={module}
            config={config}
            chipLabel={module.moduleId === 'timer' ? timerChip : undefined}
          >
            <Component />
          </ModuleWindow>
        )
      })}
    </div>
  )
}
