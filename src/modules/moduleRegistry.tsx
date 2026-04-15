import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Palette,
  TimerReset,
  Shuffle,
  Users,
  NotebookPen,
  TrafficCone,
  Sparkles,
  Clock4,
  LayoutGrid,
  ListChecks,
  Ticket,
  Activity,
} from 'lucide-react'
import { BackgroundWindow } from './windows/BackgroundWindow'
import { TimerWindow } from './windows/TimerWindow'
import { TurnWindow } from './windows/TurnWindow'
import { GroupsWindow } from './windows/GroupsWindow'
import { InstructionWindow } from './windows/InstructionWindow'
import { TrafficWindow } from './windows/TrafficWindow'
import { RandomizerWindow } from './windows/RandomizerWindow'
import { ClockWindow } from './windows/ClockWindow'
import { SeatingWindow } from './windows/SeatingWindow'
import { LessonPlanWindow } from './windows/LessonPlanWindow'
import { ExitTicketWindow } from './windows/ExitTicketWindow'
import { SoundMeterWindow } from './windows/SoundMeterWindow'
import type { ModuleId } from './moduleTypes'

export interface ModuleConfig {
  id: ModuleId
  title: string
  icon: LucideIcon
  component: ComponentType
  defaultSize: { width: number; height: number }
  supportsFullscreen: boolean
}

export const MODULE_REGISTRY: ModuleConfig[] = [
  {
    id: 'background',
    title: 'Bakgrund',
    icon: Palette,
    component: BackgroundWindow,
    defaultSize: { width: 480, height: 380 },
    supportsFullscreen: false,
  },
  {
    id: 'timer',
    title: 'Timer',
    icon: TimerReset,
    component: TimerWindow,
    defaultSize: { width: 400, height: 420 },
    supportsFullscreen: true,
  },
  {
    id: 'turntaking',
    title: 'Tur i tur',
    icon: Shuffle,
    component: TurnWindow,
    defaultSize: { width: 760, height: 580 },
    supportsFullscreen: true,
  },
  {
    id: 'groups',
    title: 'Arbetsgrupper',
    icon: Users,
    component: GroupsWindow,
    defaultSize: { width: 680, height: 740 },
    supportsFullscreen: true,
  },
  {
    id: 'instructioncards',
    title: 'Instruktion',
    icon: NotebookPen,
    component: InstructionWindow,
    defaultSize: { width: 480, height: 520 },
    supportsFullscreen: true,
  },
  {
    id: 'trafficlight',
    title: 'Trafikljus',
    icon: TrafficCone,
    component: TrafficWindow,
    defaultSize: { width: 380, height: 340 },
    supportsFullscreen: false,
  },
  {
    id: 'randomizer',
    title: 'Slump',
    icon: Sparkles,
    component: RandomizerWindow,
    defaultSize: { width: 380, height: 360 },
    supportsFullscreen: false,
  },
  {
    id: 'clock',
    title: 'Klocka',
    icon: Clock4,
    component: ClockWindow,
    defaultSize: { width: 360, height: 320 },
    supportsFullscreen: false,
  },
  {
    id: 'seating',
    title: 'Sittplats',
    icon: LayoutGrid,
    component: SeatingWindow,
    defaultSize: { width: 600, height: 560 },
    supportsFullscreen: true,
  },
  {
    id: 'lessonplan',
    title: 'Lektionsplan',
    icon: ListChecks,
    component: LessonPlanWindow,
    defaultSize: { width: 540, height: 520 },
    supportsFullscreen: true,
  },
  {
    id: 'exitticket',
    title: 'Exit ticket',
    icon: Ticket,
    component: ExitTicketWindow,
    defaultSize: { width: 420, height: 420 },
    supportsFullscreen: true,
  },
  {
    id: 'soundmeter',
    title: 'Ljudnivå',
    icon: Activity,
    component: SoundMeterWindow,
    defaultSize: { width: 420, height: 360 },
    supportsFullscreen: false,
  },
]

export const MODULE_CONFIG_MAP: Record<ModuleId, ModuleConfig> = MODULE_REGISTRY.reduce(
  (acc, config) => {
    acc[config.id] = config
    return acc
  },
  {} as Record<ModuleId, ModuleConfig>,
)
