import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getHistory: () => ipcRenderer.invoke('get-history'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  getCollections: () => ipcRenderer.invoke('get-collections'),
  writeToClipboard: (item: { type: string, content: string }) => ipcRenderer.send('write-to-clipboard', item),
  togglePin: (id: string) => ipcRenderer.send('toggle-pin', id),
  clearHistory: () => ipcRenderer.send('clear-history'),
  deleteItem: (id: string) => ipcRenderer.send('delete-item', id),
  deleteItems: (ids: string[]) => ipcRenderer.send('delete-items', ids),
  showInFolder: (path: string) => ipcRenderer.send('show-in-folder', path),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  searchGoogle: (text: string) => ipcRenderer.send('search-google', text),
  searchBaidu: (text: string) => ipcRenderer.send('search-baidu', text),
  saveCollections: (collections: any[]) => ipcRenderer.send('save-collections', collections),
  moveToCollection: (itemId: string, collectionId: string | null) => ipcRenderer.send('move-to-collection', { itemId, collectionId }),
  onClipboardChanged: (callback: (history: any[]) => void) => {
    const listener = (_event: any, history: any[]) => callback(history)
    ipcRenderer.on('clipboard-changed', listener)
    return () => ipcRenderer.removeListener('clipboard-changed', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
