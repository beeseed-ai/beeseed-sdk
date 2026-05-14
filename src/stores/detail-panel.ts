import { createStore } from 'zustand/vanilla'
import type { FeatureView } from '../core/types.js'

export interface AccordionSections {
  members: boolean
  tasks: boolean
  storage: boolean
}

export interface DetailPanelState {
  panelVisible: boolean
  sections: AccordionSections
  activeFeature: FeatureView
  composerInsertText: string | null

  togglePanel: () => void
  setPanel: (visible: boolean) => void
  toggleSection: (key: keyof AccordionSections) => void
  setActiveFeature: (feature: FeatureView) => void
  insertIntoComposer: (text: string) => void
  consumeComposerInsert: () => void
  reset: () => void
}

const DEFAULT_SECTIONS: AccordionSections = { members: true, tasks: false, storage: false }
const DEFAULT_PANEL_VISIBLE = true

function initialFeature(): FeatureView {
  if (typeof sessionStorage === 'undefined') return 'chat'
  const saved = sessionStorage.getItem('beeseed-feature')
  if (saved === 'agents') {
    sessionStorage.setItem('beeseed-feature', 'admin')
    return 'admin'
  }
  if (saved === 'tasks' || saved === 'knowledge' || saved === 'cron' || saved === 'settings' || saved === 'admin') {
    return saved
  }
  return 'chat'
}

export function createDetailPanelStore() {
  return createStore<DetailPanelState>()((set, get) => ({
    panelVisible: DEFAULT_PANEL_VISIBLE,
    sections: { ...DEFAULT_SECTIONS },
    activeFeature: initialFeature(),
    composerInsertText: null,

    togglePanel: () => set({ panelVisible: !get().panelVisible }),
    setPanel: (visible) => set({ panelVisible: visible }),

    toggleSection: (key) => {
      const sections = { ...get().sections }
      sections[key] = !sections[key]
      set({ sections })
    },

    setActiveFeature: (feature) => {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('beeseed-feature', feature)
      set({
        activeFeature: feature,
        panelVisible: feature === 'chat' ? get().panelVisible : false,
      })
    },

    insertIntoComposer: (text) => set({ composerInsertText: text }),
    consumeComposerInsert: () => set({ composerInsertText: null }),

    reset: () => set({ panelVisible: DEFAULT_PANEL_VISIBLE, sections: { ...DEFAULT_SECTIONS }, activeFeature: 'chat', composerInsertText: null }),
  }))
}

export type DetailPanelStore = ReturnType<typeof createDetailPanelStore>
