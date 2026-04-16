import type { ComponentType } from 'react'
import clsx from 'clsx'
import { Monitor } from 'lucide-react'
import { useBoardStore } from '../store/useBoardStore'
import { MODULE_REGISTRY } from '../modules/moduleRegistry'
import type { ModuleId } from '../modules/moduleTypes'

interface DockToolBase {
  id: string
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

interface DockModuleTool extends DockToolBase {
  kind: 'module'
  module: ModuleId
}

interface DockToggleTool extends DockToolBase {
  kind: 'toggle'
}

type DockTool = DockModuleTool | DockToggleTool

interface DockProps {
  isVisible: boolean
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}

const TOOLS: DockTool[] = [
  ...MODULE_REGISTRY.map((config) => ({
    id: config.id,
    kind: 'module' as const,
    module: config.id,
    label: config.title,
    icon: config.icon,
  })),
  { id: 'projector', kind: 'toggle', label: 'Projektor', icon: Monitor },
]

export function Dock({ isVisible, onPointerEnter, onPointerLeave }: DockProps) {
  const projectorMode = useBoardStore((state) => state.projectorMode)
  const moduleWindows = useBoardStore((state) => state.moduleWindows)
  const actions = useBoardStore((state) => state.actions)
  const openModuleIds = new Set(moduleWindows.openModuleIds)

  const handleModuleClick = (moduleId: ModuleId) => {
    if (openModuleIds.has(moduleId)) {
      actions.closeModule(moduleId)
    } else {
      actions.openModule(moduleId)
    }
  }

  return (
    <nav
      className={clsx('dock', { 'dock-projector': projectorMode })}
      data-visible={isVisible ? 'true' : 'false'}
      aria-hidden={!isVisible}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      aria-label="Verktygsfält"
    >
      {TOOLS.map((tool) => {
        if (tool.kind === 'toggle') {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              type="button"
              className="dock-item"
              data-active={projectorMode ? 'true' : 'false'}
              onClick={() => actions.toggleProjector()}
              aria-pressed={projectorMode}
              style={{ cursor: 'pointer' }}
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              <span>{tool.label}</span>
            </button>
          )
        }

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
