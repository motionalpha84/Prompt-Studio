import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Copy, Eye, EyeOff, Trash2, Eraser, BookmarkPlus, GripHorizontal, Star} from 'lucide-react';
import {parseField, completionAt, acceptCompletion, formatTagInput, outputField, withTrailingTagComma} from '../core/prompt.mjs';
import {IconButton, pad2, LINE_HEIGHT, meaningText, meaningTitle} from './ui.jsx';

export function GroupEditor({group, index, active, single, api, settings, source, sourceLabel, onActivate, onChange, onCommand, register, onError}){
  const editor=useRef(null),body=useRef(null),compositionBefore=useRef(null),list=useRef(null);
  const pendingCaret=useRef(null), autoSpaceAt=useRef(null);
  const [scroll,setScroll]=useState(0),[context,setContext]=useState(null),[choices,setChoices]=useState([]),[pick,setPick]=useState(0);
  const field=group.field;
  useEffect(()=>{
    register(group.id,editor.current);
    return ()=>register(group.id,null);
  },[group.id,group.hidden,register]);
  useEffect(()=>{setContext(null);},[source,active,group.hidden]);
  useEffect(()=>{
    setChoices([]);setPick(0);
    if (!context) return;
    let live=true;
    const timer=setTimeout(()=>api.call('tags.search',{query:context.query,completion:true,limit:settings.completionLimit}).then(r=>{
      if(live)setChoices(r.items);
    }).catch(onError),65);
    return ()=>{live=false;clearTimeout(timer);};
  },[context,source,settings.completionLimit]);
  useEffect(()=>{
    list.current?.children[pick]?.scrollIntoView({block:'nearest',container:'nearest'});
  },[choices,pick]);
  useLayoutEffect(()=>{
    const caret=pendingCaret.current;
    if(caret!==null && editor.current===document.activeElement)editor.current.setSelectionRange(caret,caret);
    pendingCaret.current=null;
  });
  function updateInput(input,before=field.text,inserted=null){
    const raw=input.value,end=input.selectionStart;
    if(compositionBefore.current!==null){
      onChange({field:parseField(raw,field)},'typing');setContext(null);return;
    }
    // Anchor the changed range to the caret, including when adjacent characters match.
    let start=0;
    if(inserted && raw.slice(0,end).endsWith(inserted))start=end-inserted.length;
    else{
      const limit=Math.min(end,before.length-(raw.length-end));
      while(start<limit && before[start]===raw[start])start++;
    }
    const extraSpace=settings.autoTagSpace && autoSpaceAt.current===start && raw.slice(start,end)===' ' && before===raw.slice(0,start)+raw.slice(end);
    const {text,caret}=extraSpace ? {text:before,caret:start} : formatTagInput(raw,start,end,settings);
    autoSpaceAt.current=text!==raw && !extraSpace && text.slice(caret-2,caret)===', ' ? caret : null;
    if(text!==raw)pendingCaret.current=caret;
    const next=parseField(text,field);
    onChange({field:next},'typing');
    const afterComma=text[caret-1]===',' || text.slice(caret-2,caret)===', ';
    setContext(afterComma ? (settings.commaCloses ? null : {query:'',start:caret,end:caret}) : completionAt(next,caret));
  }
  function accept(tag){
    const next=acceptCompletion(field,context,tag.name,settings.insertSpaces,settings.escapeBrackets,settings.autoTagSpace);
    pendingCaret.current=next.caret;
    autoSpaceAt.current=settings.autoTagSpace && next.field.text.slice(next.caret-2,next.caret)===', ' ? next.caret : null;
    onChange({field:next.field});setContext(null);
    api.call('tags.use',{name:tag.name}).catch(onError);
  }
  function key(e){
    if(e.nativeEvent.isComposing||compositionBefore.current!==null||e.keyCode===229)return;
    if(e.key==='Escape'){setContext(null);return;}
    if((e.ctrlKey||e.metaKey)&&e.code==='Space'){e.preventDefault();setContext(completionAt(field,e.target.selectionStart));return;}
    if(e.ctrlKey||e.metaKey||!context||!choices.length)return;
    if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setPick((pick+choices.length+(e.key==='ArrowDown'?1:-1))%choices.length);}
    else if(e.key==='Tab'||(e.key==='Enter'&&settings.enterCompletes)){e.preventDefault();accept(choices[pick]);}
  }
  function compositionEnd(e){
    const before=compositionBefore.current??field.text;
    compositionBefore.current=null;
    updateInput(e.currentTarget,before,e.data);
  }
  function copySelection(e){
    const {selectionStart,selectionEnd,value}=e.currentTarget;
    const text=value.slice(selectionStart,selectionEnd);
    if(!text.trim())return;
    // Leave ordinary text-fragment copies to the editor.
    const insideTag=position=>{
      const line=field.lines.find(l=>position>=l.offset && position<=l.offset+l.raw.length);
      const offset=position-(line?.offset??0);
      return line?.items.some(tag=>!tag.disabled && tag.start<offset && offset<tag.end);
    };
    if(insideTag(selectionStart)||insideTag(selectionEnd))return;
    const formatted=withTrailingTagComma(outputField({text},settings));
    e.clipboardData.setData('text/plain',formatted);
    e.preventDefault();
  }
  function resize(e){
    if(e.button!==0)return;
    const handle=e.currentTarget,initial=body.current.offsetHeight,origin=e.clientY;
    handle.setPointerCapture(e.pointerId);
    handle.onpointermove=ev=>onChange({height:Math.max(72,Math.min(2000,initial+ev.clientY-origin))},'resize');
    handle.onlostpointercapture=()=>{handle.onpointermove=null;};
  }
  // Groups size to their line count until the user drags a height; a lone group fills the pane.
  const lineHeight=settings.fontSize*LINE_HEIGHT;
  const fill=single&&group.height==null;
  const style=group.height!=null?{height:group.height+'px'}:fill?null:{height:Math.round(Math.min(320,Math.max(84,field.lines.length*lineHeight+20)))+'px'};
  const count=field.lines.reduce((n,l)=>n+l.items.filter(t=>!t.disabled).length,0);
  const popTop=context?Math.max(4,Math.min(field.text.slice(0,context.end).split('\n').length*lineHeight+12-scroll,(body.current?.clientHeight||200)-120)):0;
  return <section className={'pg'+(active?' active':'')+(group.hidden?' collapsed':'')+(!group.hidden&&fill?' fill':'')} onFocusCapture={onActivate} onPointerDown={onActivate}>
    <header className="pg-head">
      <span className="pg-index">{pad2(index+1)}</span>
      <input className="pg-name" aria-label="提示词组名称" value={group.name} maxLength={200} placeholder="组名" onChange={e=>onChange({name:e.target.value},'typing')}/>
      <span className="pg-count">{group.hidden?'已隐藏':count+' 个标签'}</span>
      <div className="pg-tools">
        <IconButton icon={BookmarkPlus} size={15} label="把组内提示词收藏为片段" onClick={()=>onCommand('snippet')}/>
        <IconButton icon={Eraser} size={15} label="清空组内提示词" onClick={()=>onCommand('clear')}/>
        <IconButton icon={group.hidden?EyeOff:Eye} size={15} label={group.hidden?'启用提示词组':'隐藏提示词组'} onClick={()=>onChange({hidden:!group.hidden})}/>
        <IconButton icon={Trash2} size={15} label="删除提示词组" onClick={()=>onCommand('delete')}/>
      </div>
      <button type="button" className="btn sm soft pg-copy" title="复制本组提示词 · Ctrl+Enter" onClick={()=>onCommand('copy')}><Copy size={13}/><span className="lbl">复制</span></button>
    </header>
    {!group.hidden&&<>
      <div className="pg-body" ref={body} style={style}>
        <div className="pg-stage">
          <div className="gutter" aria-hidden="true"><div style={{transform:'translateY(-'+scroll+'px)'}}>{field.lines.map(l=><button key={l.id} type="button" tabIndex={-1} onClick={()=>{editor.current.focus();editor.current.setSelectionRange(l.offset,l.offset);}}>{pad2(l.index+1)}</button>)}</div></div>
          <textarea ref={editor} data-testid="prompt-editor" aria-label={group.name+' 编辑器'} className="editor" value={field.text} maxLength={200000} spellCheck={false} wrap="off" placeholder="在同一行写同类标签，用逗号分隔"
            onCopy={copySelection}
            onChange={e=>updateInput(e.target,field.text,e.nativeEvent.data)} onKeyDown={key} onScroll={e=>setScroll(e.currentTarget.scrollTop)} onClick={()=>{autoSpaceAt.current=null;setContext(null);}} onBlur={()=>{autoSpaceAt.current=null;setContext(null);}}
            onCompositionStart={e=>{compositionBefore.current=e.currentTarget.value;setContext(null);}} onCompositionEnd={compositionEnd}/>
          {context&&choices.length>0&&<div className="complete" style={{top:popTop+'px'}}>
            <div className="complete-head"><span>标签补全 · {sourceLabel}</span><span>{choices.length} 项 · Tab 插入</span></div>
            <div className="complete-list" role="listbox" aria-label="补全候选" ref={list}>{choices.map((t,i)=><button key={t.name} type="button" role="option" title={t.name} aria-selected={pick===i} className={pick===i?'on':''} onMouseDown={e=>{e.preventDefault();accept(t);}}>
              <span className="en">{settings.insertSpaces?t.name.replaceAll('_',' '):t.name}</span><small title={meaningTitle(t)}>{t.translation?meaningText(t):t.category}</small>{t.favorite&&<Star size={11}/>}
            </button>)}</div>
          </div>}
        </div>
      </div>
      <div role="separator" aria-label="调整提示词组高度" title="拖动调整高度" className="pg-resize" onPointerDown={resize}><GripHorizontal size={14}/></div>
    </>}
  </section>;
}
