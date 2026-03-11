import { useEffect, useRef, useState, useMemo } from 'react'
import { Search, Clipboard, BarChart3, Trash2, Command, Pin, Image as ImageIcon, Link2, Globe, Code2, ExternalLink, Search as SearchIcon, Copy, Trash, CheckSquare, Layers, Maximize2, X, Zap, Plus, FolderHeart, Folder, ChevronRight } from 'lucide-react'
import { useClipboardStore, CategoryTab } from './store/useClipboardStore'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import Fuse from 'fuse.js'
import { motion, AnimatePresence } from 'framer-motion'

const detectCategory = (text: string) => {
  const t = text.trim()
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  const rgbRegex = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i
  if (hexRegex.test(t) || rgbRegex.test(t)) return 'color'
  const urlRegex = /^(https?:\/\/[^\s]+)/g
  const codeRegex = /(const|let|var|function|class|import|export|=>|{|}|<[a-z]+>|\[.*\]|console\.log|println!|public static|def\s|fn\s)/i
  if (urlRegex.test(t)) return 'link'
  if (codeRegex.test(t) || (t.includes('{') && t.includes('}')) || (t.length > 10 && t.includes(';'))) return 'code'
  return 'text'
}

function App() {
  const {
    history, stats, collections, searchQuery, selectedIndex, activeTab, activeCollectionId, isActionMenuOpen, selectedIds,
    setHistory, setStats, setCollections, setSearchQuery, setSelectedIndex, setActiveTab, setActiveCollectionId, setIsActionMenuOpen, toggleSelection, clearSelection, nextItem, prevItem
  } = useClipboardStore()

  const inputRef = useRef<HTMLInputElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const [actionIndex, setActionIndex] = useState(0)
  const [showFullImage, setShowFullImage] = useState<string | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)
  const [isAddingCollection, setIsAddingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [movingToCollection, setMovingToCollection] = useState(false)

  const filteredHistory = useMemo(() => {
    let filtered = history.filter(item => {
      if (activeCollectionId) return item.collectionId === activeCollectionId
      if (activeTab === 'all') return true
      if (item.type === 'image') return activeTab === 'image'
      const category = detectCategory(item.content)
      if (activeTab === 'text') return category === 'text'
      return category === activeTab
    })
    if (debouncedQuery.trim() !== '') {
      const fuse = new Fuse(filtered, { keys: ['content', 'fileName'], threshold: 0.4 })
      filtered = fuse.search(debouncedQuery).map(r => r.item)
    }
    return filtered.sort((a: any, b: any) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1))
  }, [history, debouncedQuery, activeTab, activeCollectionId])

  useEffect(() => { inputRef.current?.focus() }, [activeTab, activeCollectionId])

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQuery(searchQuery) }, 100)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    window.api.getHistory().then(setHistory)
    window.api.getStats().then(setStats)
    window.api.getCollections().then(setCollections)
    const removeListener = window.api.onClipboardChanged((newHistory) => {
      setHistory(newHistory); window.api.getStats().then(setStats)
    })
    return () => removeListener()
  }, [])

  useEffect(() => {
    if (previewScrollRef.current) previewScrollRef.current.scrollTop = 0
    const selectedItem = filteredHistory[selectedIndex]
    if (selectedItem) {
      const element = itemRefs.current.get(selectedItem.id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [selectedIndex, filteredHistory])

  const currentItem = filteredHistory[selectedIndex]
  const currentCategory = currentItem ? (currentItem.type === 'text' ? detectCategory(currentItem.content) : 'image') : 'text'

  const actions = useMemo(() => {
    if (movingToCollection) {
      return [
        { id: 'back', label: '返回主菜单', icon: ChevronRight, show: true, danger: false },
        { id: 'move-none', label: '移出收藏夹', icon: X, show: !!currentItem?.collectionId, danger: false },
        ...collections.map(c => ({ id: `move-${c.id}`, label: `移动到: ${c.name}`, icon: Folder, show: true, danger: false }))
      ].filter(a => a.show)
    }
    return [
      { id: 'paste', label: selectedIds.length > 1 ? `合并粘贴 (${selectedIds.length}项)` : '粘贴', icon: Copy, show: true, danger: false },
      { id: 'bulk-delete', label: `批量删除 (${selectedIds.length}项)`, icon: Trash2, show: selectedIds.length > 1, danger: true },
      { id: 'show-folder', label: '在访达中显示', icon: Folder, show: currentItem?.type === 'file', danger: false },
      { id: 'move', label: '移动到收藏夹...', icon: FolderHeart, show: true, danger: false },
      { id: 'search-baidu', label: '百度搜索', icon: SearchIcon, show: currentItem?.type === 'text' && currentCategory !== 'link', danger: false },
      { id: 'search-google', label: 'Google 搜索', icon: Globe, show: currentItem?.type === 'text' && currentCategory !== 'link', danger: false },
      { id: 'open', label: '浏览器打开', icon: ExternalLink, show: currentCategory === 'link', danger: false },
      { id: 'pin', label: currentItem?.isPinned ? '取消置顶' : '置顶', icon: Pin, show: true, danger: false },
      { id: 'delete', label: '删除记录', icon: Trash, show: true, danger: true }
    ].filter(a => a.show)
  }, [currentItem, currentCategory, selectedIds, collections, movingToCollection])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showFullImage) { if (e.key === 'Escape') setShowFullImage(null); return }
      if (isActionMenuOpen) {
        if (e.key === 'Escape') { e.preventDefault(); setIsActionMenuOpen(false); setMovingToCollection(false) }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActionIndex(prev => Math.min(prev + 1, actions.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActionIndex(prev => Math.max(prev - 1, 0)) }
        else if (e.key === 'Enter') { e.preventDefault(); handleAction(actions[actionIndex].id) }
        return
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); if (currentItem) { setActionIndex(0); setMovingToCollection(false); setIsActionMenuOpen(true) }
      } else if (e.key === 'ArrowDown') { e.preventDefault(); nextItem(filteredHistory.length) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); prevItem() }
      else if (e.key === ' ') {
        if (document.activeElement === inputRef.current && searchQuery !== '') return
        e.preventDefault(); if (currentItem) toggleSelection(currentItem.id)
      }
      else if (e.key === 'Enter') { e.preventDefault(); handleAction('paste') }
      else if (e.key === 'p' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (currentItem) window.api.togglePin(currentItem.id) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredHistory, selectedIndex, isActionMenuOpen, actionIndex, selectedIds, currentItem, showFullImage, actions, movingToCollection, searchQuery])

  const handleAction = (actionId: string) => {
    if (actionId === 'move') { setMovingToCollection(true); setActionIndex(0); return }
    if (actionId === 'back') { setMovingToCollection(false); setActionIndex(0); return }
    setIsActionMenuOpen(false); setMovingToCollection(false)
    if (!currentItem) return
    if (actionId.startsWith('move-')) {
      const colId = actionId === 'move-none' ? null : actionId.replace('move-', '')
      window.api.moveToCollection(currentItem.id, colId); return
    }
    switch (actionId) {
      case 'paste':
        if (selectedIds.length > 1) {
          const itemsToMerge = history.filter(h => selectedIds.includes(h.id))
          const mergedText = itemsToMerge.map(i => i.content).join('\n\n')
          window.api.writeToClipboard({ type: 'text', content: mergedText }); clearSelection()
        } else {
          window.api.writeToClipboard({ type: currentItem.type, content: currentItem.content })
        }
        break
      case 'bulk-delete': window.api.deleteItems(selectedIds); clearSelection(); break
      case 'show-folder': window.api.showInFolder(currentItem.content); break
      case 'open': window.api.openExternal(currentItem.content.trim()); break
      case 'search-google': window.api.searchGoogle(currentItem.content.trim()); break
      case 'search-baidu': window.api.searchBaidu(currentItem.content.trim()); break
      case 'pin': window.api.togglePin(currentItem.id); break
      case 'delete': window.api.deleteItem(currentItem.id); if (selectedIndex >= filteredHistory.length - 1) prevItem(); break
    }
  }

  const addCollection = () => {
    if (!newCollectionName.trim()) return
    const newCols = [...collections, { id: Date.now().toString(), name: newCollectionName.trim() }]
    setCollections(newCols); window.api.saveCollections(newCols); setNewCollectionName(''); setIsAddingCollection(false)
  }

  const deleteCollection = (id: string) => {
    const newCols = collections.filter(c => c.id !== id)
    setCollections(newCols); window.api.saveCollections(newCols)
    if (activeCollectionId === id) setActiveCollectionId(null)
  }

  const counts = useMemo(() => {
    return {
      all: history.length,
      text: history.filter(h => h.type === 'text' && detectCategory(h.content) === 'text').length,
      link: history.filter(h => h.type === 'text' && detectCategory(h.content) === 'link').length,
      image: history.filter(h => h.type === 'image').length,
      code: history.filter(h => h.type === 'text' && detectCategory(h.content) === 'code').length,
    }
  }, [history])

  const tabs: { id: CategoryTab, label: string, icon: any }[] = [
    { id: 'all', label: '全部', icon: Layers },
    { id: 'text', label: '文本', icon: Clipboard },
    { id: 'link', label: '链接', icon: Link2 },
    { id: 'image', label: '图片', icon: ImageIcon },
    { id: 'code', label: '代码', icon: Code2 }
  ]

  return (
    <div className="h-screen w-screen flex flex-col rounded-2xl overflow-hidden font-sans bg-stone-900/95 relative text-stone-50 border border-white/5 shadow-2xl">
      <div className="bg-stone-900/40 border-b border-white/5 no-drag flex-shrink-0 pt-4 px-4 pb-0">
        <div className="flex items-center bg-stone-800/50 rounded-xl px-4 py-3 shadow-inner border border-white/[0.03] focus-within:border-blue-500/50 transition-all duration-200">
          <Search className="w-5 h-5 text-stone-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="搜索剪贴板历史..."
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-lg text-stone-100 placeholder-stone-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedIds.length > 0 && (
              <div className="px-2 py-1 rounded-md bg-blue-500/20 text-blue-400 text-xs flex items-center gap-1 border border-blue-500/20 font-medium shadow-sm">
                <CheckSquare className="w-3.5 h-3.5" /> {selectedIds.length}
              </div>
            )}
            <kbd className="flex items-center gap-1 px-2 py-1 rounded bg-stone-700/50 border border-stone-600 text-[10px] text-stone-300 font-sans tracking-wide">
              <Command className="w-3 h-3" /> K
            </kbd>
          </div>
        </div>
        <div className="flex px-2 pt-4 gap-6 relative no-drag hide-scrollbar overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs pb-3 transition-colors relative z-10 flex-shrink-0 flex items-center gap-2 outline-none ${activeTab === tab.id && !activeCollectionId ? 'text-blue-400 font-medium' : 'text-stone-400 hover:text-stone-200'}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${(counts as any)[tab.id] > 0 ? 'opacity-100' : 'opacity-0'} ${activeTab === tab.id && !activeCollectionId ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-stone-500'}`}
              >
                {(counts as any)[tab.id]}
              </span>
              {activeTab === tab.id && !activeCollectionId && (
                <motion.div
                  layoutId="main-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-500 rounded-t-full shadow-[0_-2px_10px_rgba(59,130,246,0.6)]"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0 relative bg-stone-900/60">
        <div className="w-48 border-r border-white/5 bg-stone-900/40 p-4 flex flex-col gap-6 no-drag flex-shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            <div className="flex items-center justify-between text-stone-500 mb-4 px-1 font-bold uppercase tracking-widest text-[10px]">
              收藏夹{' '}
              <button
                onClick={() => setIsAddingCollection(true)}
                className="p-1 hover:bg-stone-800 rounded-md transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1">
              {isAddingCollection && (
                <div className="px-1 mb-2">
                  <input
                    autoFocus
                    onBlur={() => setIsAddingCollection(false)}
                    onKeyDown={(e) => e.key === 'Enter' && addCollection()}
                    className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg px-2.5 py-1.5 text-xs outline-none text-blue-100"
                    placeholder="名称..."
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                  />
                </div>
              )}
              {collections.map((col) => (
                <div key={col.id} className="group relative">
                  <button
                    onClick={() => setActiveCollectionId(col.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeCollectionId === col.id ? 'bg-blue-600 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
                  >
                    <FolderHeart
                      className={`w-4 h-4 flex-shrink-0 ${activeCollectionId === col.id ? 'text-blue-200' : 'text-stone-500'}`}
                    />
                    <span className="truncate">{col.name}</span>
                  </button>
                  <button
                    onClick={() => deleteCollection(col.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all rounded-md"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-white/5 flex-shrink-0">
            <div className="bg-stone-800/50 rounded-xl p-4 border border-white/[0.02] shadow-sm">
              <div className="flex items-center gap-2 text-stone-400 mb-1">
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">今日活跃</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-stone-100 tracking-tighter">
                  {stats.dailyStats?.[new Date().toISOString().split('T')[0]] || 0}
                </span>
                <span className="text-[10px] text-stone-500 uppercase font-medium">次</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-drag p-3 space-y-2 scroll-smooth custom-scrollbar bg-black/10">
          <motion.div
            key={activeTab + activeCollectionId + debouncedQuery}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="space-y-2 pb-4"
          >
            {filteredHistory.length === 0 ? (
              <div className="h-full py-32 flex flex-col items-center justify-center text-stone-500">
                <Layers className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm font-medium tracking-wide text-center">暂无匹配记录</p>
              </div>
            ) : (
              filteredHistory.map((item: any, index) => {
                const category =
                  item.type === 'text'
                    ? detectCategory(item.content)
                    : item.type === 'file'
                      ? 'file'
                      : 'image'
                const isSelected = index === selectedIndex
                const isChecked = selectedIds.includes(item.id)
                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.id, el)
                      else itemRefs.current.delete(item.id)
                    }}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => handleAction('paste')}
                    className={`group flex items-start gap-4 p-3.5 rounded-2xl cursor-pointer transition-all duration-150 relative overflow-hidden outline-none ${isSelected ? 'bg-blue-600/15 ring-1 ring-blue-500/30 shadow-lg' : 'hover:bg-stone-800/60 border border-transparent hover:border-white/5'} ${isChecked ? 'bg-blue-900/20' : ''}`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="list-selection"
                        className="absolute inset-0 bg-blue-500/5 z-0 pointer-events-none"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                    <div
                      className={`mt-0.5 p-2.5 rounded-xl flex-shrink-0 flex items-center justify-center transition-colors z-10 shadow-sm ${isSelected || isChecked ? 'bg-blue-500 text-white' : 'bg-stone-800 border border-white/5 text-stone-400'}`}
                    >
                      {category === 'color' ? (
                        <div
                          className="w-4 h-4 rounded-[4px] border border-white/20 shadow-inner"
                          style={{ backgroundColor: item.content.trim() }}
                        />
                      ) : category === 'file' && item.iconData ? (
                        <img src={item.iconData} className="w-4 h-4" />
                      ) : category === 'image' ? (
                        <ImageIcon className="w-4 h-4" />
                      ) : category === 'link' ? (
                        <Link2 className="w-4 h-4" />
                      ) : category === 'code' ? (
                        <Code2 className="w-4 h-4" />
                      ) : (
                        <Clipboard className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-10 z-10 flex flex-col justify-center min-h-[36px]">
                      {item.type === 'image' ? (
                        <div className="h-20 w-36 rounded-lg bg-stone-900 border border-white/10 overflow-hidden">
                          <img
                            src={item.content}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : item.type === 'file' ? (
                        <div className="flex flex-col">
                          <p
                            className={`text-sm font-bold truncate ${isSelected ? 'text-blue-400' : 'text-stone-200'}`}
                          >
                            {item.fileName || '未知文件'}
                          </p>
                          <p className="text-[10px] text-stone-500 truncate opacity-60 font-mono tracking-tighter">
                            {item.content}
                          </p>
                        </div>
                      ) : (
                        <p
                          className={`text-sm font-medium leading-relaxed line-clamp-2 ${isSelected ? 'text-stone-50' : 'text-stone-300'}`}
                        >
                          {item.content}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 opacity-70">
                        <p className="text-[10px] font-mono text-stone-400">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {item.sourceApp && (
                          <div className="flex items-center gap-1.5 text-stone-500">
                            <Globe className="w-3 h-3" />
                            <span className="text-[10px]">{item.sourceApp}</span>
                          </div>
                        )}
                        {item.copyCount > 1 && (
                          <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20 font-bold text-[9px] shadow-sm tracking-tighter">
                            <Zap className="w-2.5 h-2.5 fill-current" /> {item.copyCount} 次
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.api.togglePin(item.id)
                        }}
                        className={`p-2 rounded-lg transition-all outline-none ${item.isPinned ? 'text-yellow-500 bg-yellow-500/10' : 'text-stone-500 opacity-0 group-hover:opacity-100 hover:bg-stone-700'}`}
                      >
                        <Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-current' : ''}`} />
                      </button>
                      {isChecked && (
                        <div className="bg-blue-500 text-white p-0.5 rounded shadow-lg animate-in zoom-in-50">
                          <CheckSquare className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </motion.div>
        </div>

        <div className="w-80 border-l border-white/5 bg-stone-900/80 flex-shrink-0 relative h-full no-drag">
          {currentItem ? (
            <div className="grid grid-rows-[1fr_auto] h-full p-3 gap-3 overflow-hidden">

              {/* 核心滚动区域 */}
              <div
                ref={previewScrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-stone-950/50 rounded-2xl border border-white/[0.03] p-4 text-xs select-text custom-scrollbar shadow-inner relative"
              >
                {currentCategory === 'color' ? (
                  <div className="space-y-6">
                    <div
                      className="w-full h-36 rounded-2xl shadow-xl border border-white/10 relative overflow-hidden flex items-center justify-center transition-colors"
                      style={{ backgroundColor: currentItem.content.trim() }}
                    >
                      <span className="text-white text-2xl font-black font-mono tracking-tighter uppercase drop-shadow-md mix-blend-difference">
                        {currentItem.content.trim()}
                      </span>
                    </div>
                    <div className="bg-stone-800/80 rounded-xl p-3.5 border border-white/5 space-y-3 shadow-sm font-medium">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 uppercase text-[10px] tracking-wider font-bold">
                          格式
                        </span>
                        <span className="text-stone-300 font-mono bg-stone-900 px-2 py-0.5 rounded shadow-inner">
                          HEX
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 uppercase text-[10px] tracking-wider font-bold">
                          数值
                        </span>
                        <span className="text-blue-400 font-mono font-bold bg-blue-500/10 px-2 py-0.5 rounded uppercase">
                          {currentItem.content.trim()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : currentCategory === 'link' ? (
                  <div className="space-y-6 h-full flex flex-col justify-center">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-8 flex flex-col items-center gap-5 shadow-inner">
                      <div className="p-4 rounded-2xl bg-blue-500 shadow-[0_8px_30px_rgba(59,130,246,0.4)]">
                        <Globe className="w-10 h-10 text-white" />
                      </div>
                      <div className="text-center space-y-2 w-full">
                        <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest tracking-widest">
                          检测到网址
                        </p>
                        <p className="text-stone-100 text-sm font-medium break-all line-clamp-4 px-2 leading-relaxed">
                          {currentItem.content.trim()}
                        </p>
                      </div>
                      <button
                        onClick={() => window.api.openExternal(currentItem.content.trim())}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-[0.98]"
                      >
                        立即访问
                      </button>
                    </div>
                  </div>
                ) : currentItem.type === 'file' ? (
                  <div className="space-y-6 h-full flex flex-col justify-center">
                    <div className="bg-stone-800/50 border border-white/5 rounded-3xl p-8 flex flex-col items-center gap-5 shadow-inner">
                      <div className="p-4 rounded-2xl bg-stone-700 shadow-xl border border-white/10">
                        {currentItem.iconData ? (
                          <img src={currentItem.iconData} className="w-12 h-12" />
                        ) : (
                          <Folder className="w-12 h-12 text-stone-400" />
                        )}
                      </div>
                      <div className="text-center space-y-2 w-full">
                        <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">
                          文件记录
                        </p>
                        <p className="text-stone-100 text-sm font-bold truncate px-2">
                          {currentItem.fileName}
                        </p>
                        <p className="text-stone-500 text-[10px] break-all px-4 leading-tight opacity-60 font-mono">
                          {currentItem.content}
                        </p>
                      </div>
                      <button
                        onClick={() => window.api.showInFolder(currentItem.content)}
                        className="w-full bg-stone-700 hover:bg-stone-600 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 border border-white/5 tracking-wider active:scale-[0.98]"
                      >
                        <Folder className="w-4 h-4 text-blue-400" /> 在访达中显示
                      </button>
                    </div>
                  </div>
                ) : currentItem.type === 'image' ? (
                  <div className="space-y-4 flex flex-col items-center">
                    <img
                      src={currentItem.content}
                      alt="preview"
                      className="w-full rounded-xl cursor-zoom-in border border-white/5 transition-transform hover:scale-[1.01] shadow-2xl"
                      onClick={() => setShowFullImage(currentItem.content)}
                    />
                    <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">
                      点击全屏查看
                    </p>
                  </div>
                ) : currentCategory === 'code' ? (
                  <div className="-m-4 overflow-x-auto custom-scrollbar">
                    <SyntaxHighlighter
                      language="javascript"
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: '1.25rem',
                        background: 'transparent',
                        fontSize: '12px',
                        lineHeight: '1.6',
                        minWidth: 'fit-content'
                      }}
                      wrapLines={false}
                    >
                      {currentItem.content}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="whitespace-pre-wrap break-words text-stone-300 text-[13.5px] leading-relaxed select-text font-medium">
                      {currentItem.content}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        onClick={() => window.api.searchBaidu(currentItem.content.trim())}
                        className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold text-stone-300 transition-all shadow-sm active:scale-[0.98]"
                      >
                        <SearchIcon className="w-3.5 h-3.5" /> 百度搜索
                      </button>
                      <button
                        onClick={() => window.api.searchGoogle(currentItem.content.trim())}
                        className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold text-stone-300 transition-all shadow-sm active:scale-[0.98]"
                      >
                        <Globe className="w-3.5 h-3.5" /> Google 搜索
                      </button>
                    </div>
                  </div>
                )}
                {currentCategory !== 'color' &&
                  currentCategory !== 'link' &&
                  currentItem.type !== 'file' && (
                    <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-stone-500 font-medium tracking-tight">来源应用</span>
                        <span className="text-stone-300 font-semibold bg-stone-800 px-2 py-0.5 rounded-md text-[10px] shadow-sm">
                          {currentItem.sourceApp || '未知'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-stone-500 font-medium tracking-tight">累计频次</span>
                        <span className="text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px]">
                          <Zap className="w-2.5 h-2.5" /> {currentItem.copyCount || 1} 次
                        </span>
                      </div>
                    </div>
                  )}
              </div>
              <div className="bg-stone-800/60 rounded-xl border border-white/5 px-4 py-3 flex items-center justify-between text-[10px] text-stone-400 font-medium shadow-md">
                <span className="flex items-center gap-1.5">
                  <Command className="w-3.5 h-3.5 opacity-50" /> K 动作
                </span>
                <span className="flex items-center gap-1.5 opacity-80">
                  回车粘贴 <span className="text-lg leading-none opacity-40 font-light">↵</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center h-full text-stone-600 opacity-50">
              <Maximize2 className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-[11px] font-bold tracking-widest uppercase text-center">
                选中记录查看预览
              </p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isActionMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-80 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 bg-stone-800/30 flex items-center justify-between">
                <span className="text-xs text-stone-400 font-bold uppercase tracking-widest tracking-widest">
                  {movingToCollection ? '移动到' : '快捷动作'}
                </span>
                <kbd className="px-2 py-0.5 rounded border border-stone-700 bg-stone-800 text-[10px] text-stone-400">
                  ESC
                </kbd>
              </div>
              <div className="p-1.5 space-y-0.5">
                {actions.map((action, index) => (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action.id)}
                    onMouseEnter={() => setActionIndex(index)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-100 text-sm font-medium outline-none ${index === actionIndex ? (action.danger ? 'bg-red-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg') : action.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-stone-300 hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-3">
                      <action.icon
                        className={`w-4 h-4 ${index === actionIndex ? 'text-white' : 'text-stone-500'}`}
                      />
                      <span>{action.label}</span>
                    </div>
                    {index === actionIndex && (
                      <span className="text-[12px] opacity-80 font-bold">↵</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFullImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-xl"
            onClick={() => setShowFullImage(null)}
          >
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              src={showFullImage}
              className="max-w-full max-h-full rounded-xl object-contain shadow-2xl ring-1 ring-white/10"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
