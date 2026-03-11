import { create } from 'zustand'

export interface HistoryItem {
  id: string
  content: string
  type: string
  timestamp: number
  isPinned?: boolean
  sourceApp?: string
  copyCount?: number
  collectionId?: string
  iconData?: string // 存储文件的图标数据
  fileName?: string // 存储文件名
}

export interface Collection {
  id: string
  name: string
  icon?: string
}

interface Stats {
  totalCopies: number
  textCopies: number
  imageCopies: number
  appStats: Record<string, number>
  dailyStats: Record<string, number>
}

export type CategoryTab = 'all' | 'top' | 'text' | 'link' | 'image' | 'code'

interface ClipboardState {
  history: HistoryItem[]
  stats: Stats
  collections: Collection[]
  searchQuery: string
  selectedIndex: number
  activeTab: CategoryTab
  activeCollectionId: string | null // 当前选中的收藏夹 ID
  
  isActionMenuOpen: boolean
  selectedIds: string[]
  
  setHistory: (history: HistoryItem[]) => void
  setStats: (stats: Stats) => void
  setCollections: (collections: Collection[]) => void
  setSearchQuery: (query: string) => void
  setSelectedIndex: (index: number) => void
  setActiveTab: (tab: CategoryTab) => void
  setActiveCollectionId: (id: string | null) => void
  setIsActionMenuOpen: (isOpen: boolean) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  nextItem: (totalCount: number) => void
  prevItem: () => void
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  history: [],
  stats: { totalCopies: 0, textCopies: 0, imageCopies: 0, appStats: {}, dailyStats: {} },
  collections: [],
  searchQuery: '',
  selectedIndex: 0,
  activeTab: 'all',
  activeCollectionId: null,
  
  isActionMenuOpen: false,
  selectedIds: [],

  setHistory: (history) => set({ history }),
  setStats: (stats) => set({ stats }),
  setCollections: (collections) => set({ collections }),
  setSearchQuery: (searchQuery) => set({ searchQuery, selectedIndex: 0, selectedIds: [], isActionMenuOpen: false }),
  setSelectedIndex: (selectedIndex) => set({ selectedIndex, isActionMenuOpen: false }),
  
  setActiveTab: (activeTab) => set({ activeTab, activeCollectionId: null, selectedIndex: 0, isActionMenuOpen: false }),
  setActiveCollectionId: (id) => set({ activeCollectionId: id, activeTab: 'all', selectedIndex: 0, isActionMenuOpen: false }),
  
  setIsActionMenuOpen: (isActionMenuOpen) => set({ isActionMenuOpen }),
  
  toggleSelection: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id) 
      ? state.selectedIds.filter(selectedId => selectedId !== id)
      : [...state.selectedIds, id]
  })),
  clearSelection: () => set({ selectedIds: [] }),

  nextItem: (totalCount) => set((state) => {
    if (state.isActionMenuOpen) return state
    return { selectedIndex: Math.min(state.selectedIndex + 1, totalCount - 1) }
  }),
  
  prevItem: () => set((state) => {
    if (state.isActionMenuOpen) return state
    return { selectedIndex: Math.max(state.selectedIndex - 1, 0) }
  }),
}))
