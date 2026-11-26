import React, {useEffect, useRef, useState} from 'react';
import {Search, X, Tag, Star, Clock, Plus, Layers, Ellipsis, ChevronRight, ChevronLeft, Check, Trash2, Camera, ArrowUpRight, FileText, RotateCcw, Download, FolderOpen, BookOpen} from 'lucide-react';
import {normalize} from '../core/prompt.mjs';
import {IconButton, Empty, catNo, num, date, meaningText, meaningTitle} from './ui.jsx';

export const SOURCES = {danbooru:{label:'Danbooru', date:'2026-10-01'}, gelbooru:{label:'Gelbooru', date:'2026-06-11'}};
export const PAGE = 65;
const FILTERS = [['','全部',Tag],['favorites','收藏',Star],['recent','最近',Clock],['custom','自定义',Plus]];

function CategoryFlyout({categories, counts, current, onPick, onClose, toggle}) {
  const ref = useRef(null);
  useEffect(() => {
    const outside = e => { if (!ref.current?.contains(e.target) && !toggle.current?.contains(e.target)) onClose(); };
    const escape = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); toggle.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape, true);
    ref.current?.querySelector('.cat-item.on')?.focus();
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true); };
  }, []);
  const item = (c, label) => {
    const n = counts?.get(c);
    return <button key={c || 'all'} type="button" data-cat={catNo(c)} className={'cat-item' + (current === c ? ' on' : '') + (n === 0 ? ' zero' : '')} aria-pressed={current === c} onClick={() => onPick(c)}>
      <i className="dot"/><span>{label}</span><span className="n">{n == null ? '…' : num(n)}</span>{current === c && <Check size={14}/>}
    </button>;
  };
  return <div className="cat-fly" ref={ref} role="dialog" aria-label="选择分类">
    <header><div><span className="eyebrow">Categories</span><h3>选择分类</h3></div><div className="spacer"/><IconButton icon={ChevronLeft} label="收起分类" onClick={onClose}/></header>
    <div className="cat-list">{item('', '全部分类')}<div className="cat-sep"/>{categories.map(c => item(c, c))}</div>
    <p className="cat-note">数量已按当前的搜索和筛选计算</p>
  </div>;
}

function SnippetCards({snippets, onInsert, onEdit}) {
  return <div className="cards">
    {snippets.map(s => <article className="card" key={s.id}>
      <div className="card-top"><strong>{s.name}</strong><span className="pill-cat">{s.category}</span><div className="spacer"/><IconButton icon={Ellipsis} size={14} label={'编辑片段 ' + s.name} onClick={() => onEdit(s)}/></div>
      <pre>{s.text}</pre>
      <div className="card-acts"><button type="button" className="btn sm soft" onClick={() => onInsert(s.text)}><Plus size={13}/>插入到光标处</button></div>
    </article>)}
    {!snippets.length && <Empty icon={Layers} title="还没有片段">在组标题栏点书签按钮，或框选几个标签后选「收藏为片段」。</Empty>}
  </div>;
}

// Tag library. Favourites hold single tags and multi-tag snippets; categories open in a flyout to the right.
export function LibraryPanel({api, lib, setLib, list, loading, stats, source, snippets, onSwitchSource, onInsertTag, onInsertText, onFavorite, onEditTag, onEditSnippet, onError}) {
  const [catOpen, setCatOpen] = useState(false), [counts, setCounts] = useState(null);
  const toggle = useRef(null);
  const favSnippets = lib.filter === 'favorites' && lib.favKind === 'snippets';
  const set = patch => setLib(l => ({...l, offset:0, ...patch}));
  useEffect(() => {
    if (!catOpen) return;
    let live = true; setCounts(null);
    Promise.all(['', ...stats.categories].map(category => api.call('tags.search', {query:lib.query, filter:lib.filter, category, offset:0, limit:1}).then(r => [category, r.total])))
      .then(rows => { if (live) setCounts(new Map(rows)); }).catch(onError);
    return () => { live = false; };
  }, [catOpen, lib.query, lib.filter, stats, source]);
  const q = normalize(lib.query);
  const shownSnippets = snippets.filter(s => !q || normalize(s.name + ' ' + s.category + ' ' + s.text).includes(q));
  const page = Math.floor(lib.offset / PAGE) + 1, pages = Math.ceil(list.total / PAGE);
  return <div className="lib">
    <div className="lib-top">
      <div className="seg" role="radiogroup" aria-label="当前词库">{Object.entries(SOURCES).map(([k, v]) => <button key={k} type="button" role="radio" aria-checked={source === k} className={source === k ? 'on' : ''} title={v.label + ' 词库 · 更新于 ' + v.date} onClick={() => onSwitchSource(k)}>{v.label}</button>)}</div>
      <div className="spacer"/>
      {favSnippets ? <button type="button" className="text-btn" onClick={() => onEditSnippet(null)}><Plus size={13}/>新建片段</button>
        : <button type="button" className="text-btn" onClick={() => onEditTag(null)}><Plus size={13}/>新建词条</button>}
    </div>
    <label className="search"><Search size={14}/><input aria-label="搜索词库" placeholder={favSnippets ? '搜索片段名称或内容…' : '搜索中文、英文、别名…'} value={lib.query} onChange={e => set({query:e.target.value})}/>{lib.query && <IconButton icon={X} size={12} label="清空搜索" onClick={() => set({query:''})}/>}</label>
    <div className="filters">{FILTERS.map(([v, label, Icon]) => <button key={v || 'all'} type="button" aria-pressed={lib.filter === v} className={lib.filter === v ? 'on' : ''} onClick={() => set({filter:v})}><Icon size={12}/>{label}</button>)}</div>
    {lib.filter === 'favorites' && <div className="seg fav-seg" role="tablist" aria-label="收藏类型">
      <button type="button" role="tab" aria-selected={!favSnippets} className={favSnippets ? '' : 'on'} onClick={() => set({favKind:'tags'})}><Tag size={12}/>单个标签<span className="count">{num(stats.favorites)}</span></button>
      <button type="button" role="tab" aria-selected={favSnippets} className={favSnippets ? 'on' : ''} onClick={() => set({favKind:'snippets'})}><Layers size={12}/>片段<span className="count">{snippets.length}</span></button>
    </div>}
    {favSnippets ? <>
      <div className="lib-head"><span>{shownSnippets.length} 个片段 · 插入时保留换行</span></div>
      <SnippetCards snippets={shownSnippets} onInsert={onInsertText} onEdit={onEditSnippet}/>
    </> : <>
      <div className="cat-bar" ref={toggle} data-cat={catNo(lib.category)}>
        <button type="button" className="cat-current" aria-expanded={catOpen} aria-haspopup="dialog" title="展开全部分类" onClick={() => setCatOpen(!catOpen)}>
          <span className="eyebrow">分类</span>{lib.category && <i className="dot"/>}<span className="cat-name">{lib.category || '全部分类'}</span><span className="count">{loading ? '…' : num(list.total)}</span>
        </button>
        {lib.category && <IconButton icon={X} size={13} label="清除分类" onClick={() => set({category:''})}/>}
        <IconButton icon={ChevronRight} className="cat-expand" label="展开全部分类" aria-expanded={catOpen} onClick={() => setCatOpen(!catOpen)}/>
      </div>
      <div className="lib-head"><span>{loading ? '检索中…' : num(list.total) + ' 个标签 · 点击插入'}</span><span className="src-date" title="词库更新日期">{SOURCES[source]?.date}</span></div>
      <div className="lib-list">{list.items.map(tag => <div className="li" data-cat={catNo(tag.category)} key={tag.name}>
        <button type="button" className="li-add" title={[`插入 ${tag.name}`,meaningTitle(tag)].filter(Boolean).join(' · ')} onClick={() => onInsertTag(tag)}><span className="en"><i className="dot"/>{tag.name.replaceAll('_', ' ')}</span><span className="cn">{tag.translation?meaningText(tag):tag.category}</span></button>
        <div className="li-acts">
          <IconButton icon={Star} size={14} className={tag.favorite ? 'fav' : ''} label={(tag.favorite ? '取消收藏 ' : '收藏 ') + tag.name} onClick={() => onFavorite(tag.name)}/>
          <IconButton icon={Ellipsis} size={14} label={'编辑 ' + tag.name} onClick={() => onEditTag(tag)}/>
        </div>
      </div>)}</div>
      {!list.items.length && !loading && (lib.filter === 'favorites'
        ? <Empty icon={Star} title="还没有收藏的标签">点词条右侧的星标，或在标签视图里用扳手收藏。</Empty>
        : <Empty icon={Search} title="没有匹配的词">换个关键词，或者新建一个词条。</Empty>)}
      {pages > 1 && <div className="pager"><button type="button" className="btn sm ghost" disabled={page === 1} onClick={() => setLib(l => ({...l, offset:Math.max(0, l.offset - PAGE)}))}>上一页</button><span>{page} / {pages}</span><button type="button" className="btn sm ghost" disabled={page >= pages} onClick={() => setLib(l => ({...l, offset:l.offset + PAGE}))}>下一页</button></div>}
      {catOpen && <CategoryFlyout categories={stats.categories} counts={counts} current={lib.category} toggle={toggle} onClose={() => setCatOpen(false)} onPick={c => { set({category:c}); setCatOpen(false); }}/>}
    </>}
  </div>;
}

export function PresetsPanel({presets, onLoad, onEdit, onDelete, onSaveCurrent}) {
  return <div className="cards-wrap">
    <div className="list-head"><span>{presets.length} 套方案</span><button type="button" className="text-btn" onClick={onSaveCurrent}><Plus size={13}/>保存当前</button></div>
    <div className="cards">
      {presets.map((p, i) => <article className="card" key={p.id}>
        <div className="cover" data-v={i % 3}>{p.cover && <img src={p.cover} alt={p.name}/>}<span>{p.draft?.groups ? p.draft.groups.length + ' 组' : '旧版方案'}</span></div>
        <div className="card-top"><span className="pill-cat">{p.category}</span><strong>{p.name}</strong><div className="spacer"/><IconButton icon={Ellipsis} size={14} label={'编辑方案 ' + p.name} onClick={() => onEdit(p)}/><IconButton icon={Trash2} size={14} label={'删除方案 ' + p.name} onClick={() => onDelete(p)}/></div>
        {p.note && <p>{p.note}</p>}
        <div className="card-acts"><button type="button" className="btn sm soft" onClick={() => onLoad(p)}>新草稿打开</button><button type="button" className="btn sm ghost" onClick={() => onLoad(p, true)}>替换当前</button>{p.updatedAt && <span className="card-date">{date(p.updatedAt)}</span>}</div>
      </article>)}
      {!presets.length && <Empty icon={BookOpen} title="还没有方案">点顶部的「保存方案」，收藏当前这套提示词。</Empty>}
    </div>
  </div>;
}

export function HistoryPanel({history, onRestore, onSnapshot}) {
  return <div className="cards-wrap">
    <div className="list-head"><span>保留最近 150 个快照</span><button type="button" className="text-btn" onClick={onSnapshot}><Camera size={13}/>立即快照</button></div>
    <div className="cards hist-list">
      {history.map(h => <div className="hist" key={h.id}><time>{date(h.created_at)}</time><div className="hist-main"><strong>{h.title}</strong><small>恢复时创建新草稿</small></div><IconButton icon={ArrowUpRight} size={15} label={'把「' + h.title + '」恢复为新草稿'} onClick={() => onRestore(h)}/></div>)}
      {!history.length && <Empty icon={Clock} title="还没有历史快照">编辑时会自动创建，也可以在编辑器工具栏手动保存。</Empty>}
    </div>
  </div>;
}

export function DataPanel({source, demo, onImport, onExport, onOpenData}) {
  const imports = [['tags', Tag, '标签词库 CSV', 'Tag Autocomplete 格式：标签、类别、次数、别名；可选第 5 列中文'], ['translations', FileText, '中文翻译 CSV', '两列「英文、中文」，或旧版三列「英文、忽略列、中文」'], ['backup', RotateCcw, '恢复词序 JSON 备份', '预览后替换当前数据，恢复前会自动备份']];
  return <div className="data">
    <h4>导入</h4>
    {imports.map(([kind, Icon, title, hint]) => <button key={kind} type="button" className="data-opt" onClick={() => onImport(kind)}><Icon size={18}/><span><strong>{title}</strong><small>{hint}</small></span><ChevronRight size={15}/></button>)}
    <h4>导出</h4>
    <div className="data-exp">
      {[['backup', '完整 JSON 备份'], ['tags', '标签词库 CSV'], ['translations', '中文翻译 CSV']].map(([kind, label]) => <button key={kind} type="button" className="btn sm" onClick={() => onExport(kind)}><Download size={13}/>{label}</button>)}
      {!demo && <button type="button" className="btn sm ghost" onClick={onOpenData}><FolderOpen size={13}/>打开数据目录</button>}
    </div>
    <p className="muted-note">CSV 作用于当前词库（{SOURCES[source]?.label || source}），完整 JSON 备份包含两个词库。WeiLin 专用格式尚未适配，可先整理为 CSV。</p>
  </div>;
}
