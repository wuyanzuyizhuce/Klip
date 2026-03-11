import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getHistory: () => Promise<any[]>
      getStats: () => Promise<any>
      getCollections: () => Promise<any[]>
      writeToClipboard: (item: { type: string, content: string }) => void
      togglePin: (id: string) => void
      clearHistory: () => void
      deleteItem: (id: string) => void
      deleteItems: (ids: string[]) => void
      showInFolder: (path: string) => void
      openExternal: (url: string) => void
      searchGoogle: (text: string) => void
      searchBaidu: (text: string) => void
      saveCollections: (collections: any[]) => void
      moveToCollection: (itemId: string, collectionId: string | null) => void
      onClipboardChanged: (callback: (history: any[]) => void) => () => void
    }
  }
}
