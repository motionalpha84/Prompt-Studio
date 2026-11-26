import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Layers, Wrench, X, Star, Minus, Plus, Copy, EyeOff, Eye, Trash2, BookmarkPlus, Parentheses, Brackets, Braces} from 'lucide-react';
import {normalize, outputSeparator, withTrailingTagComma, splitLine, tagInfo, editGroups, moveAcrossGroups} from '../core/prompt.mjs';
import {IconButton, catNo, pad2, meaningText, meaningTitle} from './ui.jsx';
import {Fireflies} from './Fireflies.jsx';

export function dictionaryKey(value){
  while(/^[([{]/.test(value) && {'(':')','[':']','{':'}'}[value[0]]===value.at(-1)){
    const inner=tagInfo(value).value;value=inner===value?value.slice(1,-1):inner;
  }
  return normalize(value);
}
function Weight({items,apply}){
  const common=items.every(t=>t.weight===items[0].weight)?String(items[0].weight):'';
  const [value,setValue]=useState(common);
  useEffect(()=>setValue(common),[common,items.map(t=>t.id).join(',')]);
  function commit(){const n=Number(value);if(value.trim() && Number.isFinite(n)&&n>=0.1&&n<=3){if(value!==common)apply('weight',n);}else setValue(common);}
  return <div className="weight"><IconButton icon={Minus} size={14} label="降低权重" onClick={()=>apply('step',-.1)}/><input aria-label="标签权重" title="权重 0.1 至 3，回车确认" type="number" min=".1" max="3" step=".01" placeholder="混合" value={value} onChange={e=>setValue(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><IconButton icon={Plus} size={14} label="提高权重" onClick={()=>apply('step',.1)}/></div>;
}
function InlineTag({tag,translation,onCommit,onClose}){
  const [raw,setRaw]=useState(tag.raw),[error,setError]=useState('');
  const input=useRef(null),finished=useRef(false);
  useLayoutEffect(()=>{input.current.focus();input.current.select();},[]);
  function finish(cancel=false,blur=false){
    if(finished.current)return;
    // Check the following delimiter as well. An unfinished quote or bracket
    // would otherwise absorb the next tag on this line.
    const value=raw.trim(),parsed=splitLine(value+', next');
    if(!cancel && (!value || /[\r\n]/.test(value) || parsed.length!==2 || parsed[0].raw!==value)){
      if(!blur){setError('请输入一个完整标签');return;}
      cancel=true;
    }
    finished.current=true;
    if(!cancel && value!==tag.raw)onCommit(value);
    onClose();
  }
  return <div className="chip-edit">
    <input ref={input} aria-label="当前标签" aria-invalid={!!error} value={raw} size={Math.max(10,Math.min(48,raw.length+1))}
      onChange={e=>{setRaw(e.target.value);setError('');}} onBlur={()=>finish(false,true)}
      onKeyDown={e=>{
        if(e.nativeEvent.isComposing || e.keyCode===229)return;
        if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(e.key==='Escape');}
      }}/>
    <span className={'chip-cn'+(error?' err':'')}>{error||translation||'—'}</span>
  </div>;
}
function TagToolbar({board,ids,groups,batch,onClose,children}){
  const popup=useRef(null);
  const position=useCallback(()=>{
    const el=popup.current;
    if(!board||!el)return;
    const chips=board.querySelectorAll('.chip.sel');
    if(!chips.length)return;
    const bounds=board.getBoundingClientRect();
    let left=Infinity,right=-Infinity,bottom=-Infinity;
    for(const chip of chips){
      const box=chip.getBoundingClientRect();
      left=Math.min(left,box.left);right=Math.max(right,box.right);bottom=Math.max(bottom,box.bottom);
    }
    const center=(left+right)/2-bounds.left;
    el.style.maxWidth=Math.max(0,board.clientWidth-8)+'px';
    const width=el.offsetWidth;
    const x=Math.max(4,Math.min(batch?center-width/2:left-bounds.left,board.clientWidth-width-4));
    el.style.left=(board.scrollLeft+x)+'px';
    el.style.top=(board.scrollTop+bottom-bounds.top+7)+'px';
    el.style.setProperty('--tip',Math.max(12,Math.min(width-12,center-x))+'px');
  },[board,batch]);
  // Text changes can move a chip without changing its own size.
  useLayoutEffect(position);
  useLayoutEffect(()=>{
    if(!board)return;
    const el=popup.current;
    const extra=el.getBoundingClientRect().bottom+5-board.getBoundingClientRect().bottom;
    if(extra>0)board.scrollTop+=extra;
    const observer=new ResizeObserver(position);
    for(const node of [el,board,...board.querySelectorAll('.bg,.chip.sel')])observer.observe(node);
    const outside=e=>{
      if(!el.contains(e.target)&&!board.contains(e.target.closest('.chip.sel')))onClose();
    };
    const escape=e=>{
      if(e.key!=='Escape'||e.isComposing)return;
      board.querySelector(batch?'.chip.sel .chip-main':'.chip.sel [data-adjust]')?.focus({preventScroll:true});
      onClose();
    };
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);
    return ()=>{observer.disconnect();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);};
  },[board,ids,groups,batch,onClose,position]);
  return <div ref={popup} className="tt-pop" role="toolbar" aria-label={batch?'批量标签操作':'调整当前标签'}>{children}</div>;
}

export function TagView({groups,dict,settings,onChange,onEditMeaning,onFavorite,onSnippet,onCopy}){
  const [ids,setIds]=useState([]),[mode,setMode]=useState(''),[rect,setRect]=useState(null),[marker,setMarker]=useState(null);
  const [dragIds,setDragIds]=useState(null);
  const closeTools=useCallback(()=>{setMode('');setIds([]);},[]);
  const board=useRef(null),start=useRef(null);
  const visible=groups.filter(g=>!g.hidden),lines=visible.flatMap(g=>g.field.lines);
  const tags=lines.flatMap(l=>l.items),selected=tags.filter(t=>ids.includes(t.id)),one=selected[0],info=one&&dict[dictionaryKey(one.value)];
  const apply=(action,value,targets=ids)=>onChange(editGroups(groups,targets,action,value,settings.autoTagSpace));
  function pick(tag,type){setIds([tag.id]);setMode(type);}
  function beginSelection(e){
    if(e.button!==0 || e.target.closest('button,input,.chip,[role="toolbar"]') || e.clientX>=board.current.getBoundingClientRect().left+board.current.clientWidth)return;
    // Marquee capture prevents the browser's normal focus change. Commit an open input first.
    if(document.activeElement?.closest('.chip-edit'))document.activeElement.blur();
    start.current={x:e.clientX,y:e.clientY};
    board.current.setPointerCapture(e.pointerId);setIds([]);setMode('');e.preventDefault();
  }
  function updateSelection(e){
    if(!start.current)return;
    const {x,y}=start.current,box={left:Math.min(x,e.clientX),top:Math.min(y,e.clientY),width:Math.abs(x-e.clientX),height:Math.abs(y-e.clientY)};
    if(box.width+box.height<5)return;
    setRect(box);const right=box.left+box.width,bottom=box.top+box.height;
    const hits=Array.from(board.current.querySelectorAll('[data-token]')).filter(el=>{const r=el.getBoundingClientRect();return r.right>=box.left&&r.left<=right&&r.bottom>=box.top&&r.top<=bottom;});
    setIds(hits.map(el=>el.dataset.token));setMode('batch');
  }
  function endSelection(){start.current=null;setRect(null);}
  function beginDrag(e,tag){
    const moving=mode==='batch'&&ids.includes(tag.id)?selected:[tag];
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',moving.filter(t=>!t.disabled).map(t=>t.raw).join(', '));
    setDragIds(moving.map(t=>t.id));
  }
  function endDrag(){setMarker(null);setDragIds(null);}
  function drop(e,line){
    if(!dragIds)return;
    e.preventDefault();
    const next=moveAcrossGroups(groups,dragIds,line.id,dest(e,line),settings.autoTagSpace);
    if(next!==groups)onChange(next);
    endDrag();
  }
  function dest(e,line){
    const chip=e.target.closest('[data-token]');
    if(chip){const i=line.items.findIndex(t=>t.id===chip.dataset.token),r=chip.getBoundingClientRect();
      return e.clientX<r.left+r.width/2?line.items[i].id:line.items[i+1]?.id||null;}
    // Empty space between wrapped chips uses the next chip on that visual row.
    const next=Array.from(e.currentTarget.querySelectorAll('[data-token]')).find(el=>{const r=el.getBoundingClientRect();return e.clientY<r.top || (e.clientY<=r.bottom && e.clientX<r.left+r.width/2);});
    return next?.dataset.token||null;
  }
  function selectedText(separator=', '){
    return lines.map(l=>l.items.filter(t=>!t.disabled&&ids.includes(t.id)).map(t=>settings.outputSpaces?t.raw.replaceAll('_',' '):t.raw).join(separator)).filter(Boolean).join(settings.singleLine?separator:'\n');
  }
  const live=selected.some(t=>!t.disabled);
  const showTools=one&&!rect&&!dragIds&&(mode==='tools'||mode==='batch');
  return <section className="pane tags-pane">
    <Fireflies on={settings.fireflies}/>
    <header className="pane-head"><div className="pane-title"><Layers size={15}/>标签视图</div><span className="count">{tags.filter(t=>!t.disabled).length}</span></header>
    <div className={'board '+(one&&(mode==='tools'||mode==='batch')?'tools-open':'')} ref={board} onPointerDown={beginSelection} onPointerMove={updateSelection} onPointerUp={endSelection} onLostPointerCapture={endSelection} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setMarker(null);}}>
      {groups.map((g,i)=>!g.hidden&&<section className="bg" key={g.id} aria-label={g.name}>
        <h3 className="bg-head"><span className="bg-idx">{pad2(i+1)}</span><span className="bg-name">{g.name||'未命名组'}</span><span className="bg-n">{g.field.lines.reduce((n,l)=>n+l.items.length,0)}</span></h3>
        {g.field.lines.map((line,lineIndex)=>{
          const hasBreak=lineIndex<g.field.lines.length-1;
          const atEnd=marker?.line===line.id&&!marker.before;
          const rowEnd=hasBreak&&<span className="line-break" role="img" aria-label="换行符" title="换行符">↵</span>;
          return <div className={'row'+(line.items.length?'':' empty-line')+(!line.items.length&&atEnd?' ins-empty':'')} key={line.id} data-line={line.id}
          onDragOver={e=>{if(!dragIds)return;e.preventDefault();e.dataTransfer.dropEffect='move';setMarker({line:line.id,before:dest(e,line)});}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setMarker(previous=>previous?.line===line.id?null:previous);}}
          onDrop={e=>drop(e,line)}>
          {line.items.map((tag,tagIndex)=>{
            const data=dict[dictionaryKey(tag.value)],name=tag.value.replaceAll('_',' ');
            const chip=<div data-testid="tag-chip" data-token={tag.id} key={tag.id} data-cat={data?catNo(data.category):0} draggable={!(mode==='edit'&&one?.id===tag.id)}
              onDragStart={e=>beginDrag(e,tag)} onDragEnd={endDrag}
              onContextMenu={e=>{if(e.target.tagName==='INPUT')return;e.preventDefault();pick(tag,'edit');}}
              className={'chip'+(tag.disabled?' off':'')+(ids.includes(tag.id)?' sel':'')+(marker?.line===line.id&&marker.before===tag.id?' ins':'')+(atEnd&&tagIndex===line.items.length-1?' ins-after':'')}>
              {mode==='edit'&&one?.id===tag.id?<InlineTag tag={tag} translation={data?.translation} onCommit={value=>apply('rename',value,[tag.id])} onClose={()=>setMode('')}/>
                :<button type="button" className="chip-main" title={tag.disabled?'已隐藏 · 双击恢复 · 右键编辑':'单击查看词义 · 双击隐藏 · 右键编辑'} onClick={()=>pick(tag,'meaning')} onDoubleClick={()=>{apply(tag.disabled?'enable':'hide',null,[tag.id]);pick(tag,'meaning');}}>
                  <span className="chip-en"><i className="dot"/>{name}{tag.weight!==1&&<b className="w">{tag.weight}</b>}</span>
                  <span className="chip-cn" title={meaningTitle(data)}>{meaningText(data)}</span>
                </button>}
              <div className="chip-tools"><IconButton icon={X} size={11} label={'移除 '+name} onClick={()=>apply('remove',null,[tag.id])}/><IconButton icon={Wrench} size={11} data-adjust aria-expanded={mode==='tools'&&one?.id===tag.id} label={'调整 '+name} onClick={()=>{if(mode==='tools'&&one?.id===tag.id){closeTools();return;}pick(tag,'tools');}}/></div>
            </div>;
            if(hasBreak&&tagIndex===line.items.length-1)return <div className="row-end" key={tag.id}>{chip}{rowEnd}</div>;
            return chip;
          })}
          {!line.items.length&&rowEnd}
        </div>;})}
      </section>)}
      {!tags.length&&<p className="board-empty">在提示词组里输入标签，这里会按原文分行显示。</p>}
      {showTools&&<TagToolbar board={board.current} ids={ids} groups={groups} batch={mode==='batch'} onClose={closeTools}>
        {mode==='tools'?<>
          <IconButton icon={Star} label={info?.favorite?'取消收藏':'收藏标签'} className={info?.favorite?'fav':''} aria-pressed={!!info?.favorite} onClick={()=>onFavorite(one,info)}/>
          <Weight items={[one]} apply={apply}/>
          {[[Parentheses,'添加小括号','()'],[Brackets,'添加中括号','[]'],[Braces,'添加大括号','{}']].map(([Icon,label,pair])=><IconButton key={pair} icon={Icon} label={label} onClick={()=>apply('wrap',pair)}/>)}
        </>:<>
        <span className="tt-count">已选 {selected.length} 项</span>
        <IconButton icon={BookmarkPlus} label="收藏为片段" disabled={!live} onClick={()=>onSnippet(selectedText())}/>
        <Weight items={selected} apply={apply}/>
        <IconButton icon={Copy} label="复制选中标签" disabled={!live} onClick={()=>onCopy(withTrailingTagComma(selectedText(outputSeparator(settings))))}/>
        <IconButton icon={EyeOff} label="隐藏选中标签" onClick={()=>apply('hide')}/>
        <IconButton icon={Eye} label="启用选中标签" onClick={()=>apply('enable')}/>
        <IconButton icon={Trash2} label="删除选中标签" onClick={()=>apply('remove')}/>
        <IconButton icon={X} size={14} label="关闭标签操作" onClick={closeTools}/>
        </>}
      </TagToolbar>}
    </div>
    {rect&&createPortal(<div className="marquee" style={rect}/>,document.body)}
    {one&&mode==='meaning'?<div className="shelf">
      <div className="shelf-title"><strong>{one.raw}</strong>{info?.category&&<span className="pill-cat" data-cat={catNo(info.category)}>{info.category}</span>}<IconButton icon={X} size={14} label="关闭标签操作" onClick={closeTools}/></div>
      <p>{info?.translation?(info.translation_kind==='zh'?'中文释义 · ':'')+meaningText(info):info?.translation_kind==='缺口'?'待考证 · 暂无可靠中文释义':'暂无中文释义'}{info?.translation_source&&<span className="source-note"> · 已核查来源/原因：{info.translation_source}</span>}{info?.note&&' · '+info.note}{one.disabled&&' · 已隐藏，双击恢复'}　<button type="button" className="text-btn" onClick={()=>onEditMeaning(one,info)}>编辑释义</button></p>
    </div>:<div className="hint">单击看释义 · 双击隐藏 · 右键改写 · 空白处拖动框选 · 拖动选中标签一起移动</div>}
  </section>;
}
