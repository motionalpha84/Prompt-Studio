import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Modal} from './ui.jsx';

const keyNames = {
  ' ':'Space', ArrowUp:'Up', ArrowDown:'Down', ArrowLeft:'Left', ArrowRight:'Right',
  '+':'Plus', Escape:'Escape', Enter:'Enter', Tab:'Tab', Backspace:'Backspace',
  Delete:'Delete', Insert:'Insert', Home:'Home', End:'End', PageUp:'PageUp', PageDown:'PageDown',
  CapsLock:'Capslock', NumLock:'Numlock', ScrollLock:'Scrolllock', PrintScreen:'PrintScreen',
};
const numpadKeys = {NumpadAdd:'numadd',NumpadSubtract:'numsub',NumpadMultiply:'nummult',NumpadDivide:'numdiv',NumpadDecimal:'numdec'};
const labels = {commandorcontrol:'Ctrl',cmdorctrl:'Ctrl',control:'Ctrl',ctrl:'Ctrl',alt:'Alt',shift:'Shift',super:'Win',meta:'Win',space:'Space',plus:'+',up:'↑',down:'↓',left:'←',right:'→'};

function mainKey(event) {
  const {key,code} = event;
  if (/^Numpad\d$/.test(code) && /^\d$/.test(key)) return 'num' + key;
  if (numpadKeys[code]) return numpadKeys[code];
  if (keyNames[key]) return keyNames[key];
  if (/^F(?:[1-9]|1\d|2[0-4])$/.test(key)) return key;
  if (/^[a-z0-9]$/i.test(key)) return key.toUpperCase();
  // Shifted digits and punctuation use the unshifted Windows accelerator key.
  if (/^Digit\d$/.test(code)) return code.slice(-1);
  const punctuation = {Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Minus:'-',Equal:'=',Backquote:String.fromCharCode(96)};
  return punctuation[code];
}

function modifiers(e) {
  return [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
}

export function ShortcutKeys({value}) {
  return <span className="shortcut-keys">{value.split('+').map((key,i)=><React.Fragment key={i}>
    {i>0 && <span aria-hidden="true">+</span>}<kbd>{labels[key.toLowerCase()] || key}</kbd>
  </React.Fragment>)}</span>;
}

export function ShortcutRecorder({api, onSave, onClose}) {
  const [candidate,setCandidate]=useState(''), [held,setHeld]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const surface=useRef(null), captured=useRef(''), saving=useRef(false);
  useLayoutEffect(()=>{surface.current.focus();},[]);
  useEffect(()=>{
    function capture(value) {
      if (captured.current) return;
      captured.current=value;
      setCandidate(value);setHeld('');setError('');
    }
    const off=api.onRecordedShortcut(capture);
    api.call('shortcut.recording',{active:true}).catch(e=>setError(e.message));
    function down(e) {
      if (captured.current || saving.current) return;
      const mods=modifiers(e);
      if ((!mods.length && e.key==='Escape') || (e.key==='Tab' && !e.ctrlKey && !e.altKey && !e.metaKey)) return;
      if (document.activeElement?.closest('button') && !mods.length && (e.key==='Enter'||e.key===' ')) return;
      e.preventDefault();e.stopPropagation();
      if (e.repeat || e.isComposing || e.keyCode===229) return;
      if (['Control','Alt','Shift','Meta','AltGraph'].includes(e.key)) {setHeld(mods.join('+'));return;}
      const key=mainKey(e);
      if (key) capture([...mods,key].join('+'));
      else setError('无法识别这个按键，请试试其他按键。');
    }
    function up(e) {if (!captured.current) setHeld(modifiers(e).join('+'));}
    function blur() {setHeld('');}
    window.addEventListener('keydown',down,true);
    window.addEventListener('keyup',up,true);
    window.addEventListener('blur',blur);
    return ()=>{
      window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up,true);window.removeEventListener('blur',blur);
      off();api.call('shortcut.recording',{active:false}).catch(()=>{});
    };
  },[api]);
  function retry() {
    captured.current='';setCandidate('');setHeld('');setError('');surface.current.focus();
  }
  async function confirm() {
    if (!candidate || saving.current) return;
    saving.current=true;setBusy(true);
    try {await onSave(candidate);onClose();}
    catch(e) {setError(e.message);}
    finally {saving.current=false;setBusy(false);}
  }
  return <Modal title="设置唤起快捷键" subtitle="同时按下想用的组合键，松开后确认。" clear onClose={()=>{if(!saving.current)onClose();}}>
    <div className={'shortcut-capture'+(candidate?' ready':'')} tabIndex={-1} ref={surface} data-autofocus="" role="status" aria-live="polite">
      {candidate || held ? <ShortcutKeys value={candidate || held}/> : <span>等待按键…</span>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <footer><button type="button" className="btn ghost" disabled={busy} onClick={onClose}>取消</button>
      <button type="button" className="btn" disabled={busy || !(candidate || error)} onClick={retry}>重新录制</button>
      <button type="button" className="btn primary" disabled={busy || !candidate} onClick={confirm}>确认</button></footer>
  </Modal>;
}
