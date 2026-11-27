import type { ComponentType } from 'react'
import clsx from 'clsx'
import { useBoardStore } from '../store/useBoardStore'
import { MODULE_REGISTRY } from '../modules/moduleRegistry'
import type { ModuleId } from '../modules/moduleTypes'

const BRAND_ICON = `${import.meta.env.BASE_URL}brand/prisma-app-icon-512.jpg`

interface DockToolBase {
  id: string
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

interface DockModuleTool extends DockToolBase {
  kind: 'module'
  module: ModuleId
}

type DockTool = DockModuleTool

interface DockProps {
  isVisible: boolean
}

const TOOLS: DockTool[] = [
  ...MODULE_REGISTRY.filter((config) => config.id !== 'randomizer').map((config) => ({
    id: config.id,
    kind: 'module' as const,
    module: config.id,
    label: config.title,
    icon: config.icon,
  })),
]

export function Dock({ isVisible }: DockProps) {
  const moduleWindows = useBoardStore((state) => state.moduleWindows)
  const actions = useBoardStore((state) => state.actions)
  const openModuleIds = new Set(moduleWindows.openModuleIds)

  const handleModuleClick = (moduleId: ModuleId) => {
    actions.openModule(moduleId)
  }

  return (
    <nav
      className={clsx('dock')}
      data-visible={isVisible ? 'true' : 'false'}
      aria-hidden={!isVisible}
      aria-label="Verktygsfält"
    >
      <div className="dock-brand" aria-label="Prisma Tavla">
        <img src={BRAND_ICON} alt="" aria-hidden="true" />
      </div>
      {TOOLS.map((tool) => {
        const Icon = tool.icon
        const isActive = openModuleIds.has(tool.module)

        return (
          <button
            key={tool.id}
            type="button"
            className="dock-item"
            data-active={isActive ? 'true' : 'false'}
            onClick={() => handleModuleClick(tool.module)}
            aria-pressed={isActive}
            style={{ cursor: 'pointer' }}
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>{tool.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
