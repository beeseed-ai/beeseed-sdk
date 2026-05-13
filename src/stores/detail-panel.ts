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

export function createDetailPanelStore() {
  return createStore<DetailPanelState>()((set, get) => ({
    panelVisible: false,
    sections: { ...DEFAULT_SECTIONS },
    activeFeature: (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('beeseed-feature') as FeatureView) || 'chat',
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

    reset: () => set({ panelVisible: false, sections: { ...DEFAULT_SECTIONS }, activeFeature: 'chat', composerInsertText: null }),
  }))
}

export type DetailPanelStore = ReturnType<typeof createDetailPanelStore>
