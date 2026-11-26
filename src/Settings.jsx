import React, {useState} from 'react';
import {Type, Keyboard, Copy, Monitor, Database, Moon, Sun, Minus, Plus} from 'lucide-react';
import {outputField, withTrailingTagComma, parseField} from '../core/prompt.mjs';
import {maxCompletionLimit} from '../core/seed.mjs';
import {IconButton, Modal, num, LINE_HEIGHT} from './ui.jsx';
import {DataPanel} from './Library.jsx';
import {ShortcutKeys, ShortcutRecorder} from './ShortcutRecorder.jsx';

const INPUT = [['convertComma','全角逗号转半角'],['convertPeriod','全角句号转半角'],['convertBrackets','全角括号转半角'],['convertAngles','全角尖括号转半角'],['insertSpaces','输入与插入时下划线转空格'],['commaCloses','输入逗号后关闭补全列表'],['escapeBrackets','插入词库标签时自动转义括号'],['enterCompletes','回车接受补全']];

// Settings live in a centred dialog with categories on the left. The backdrop stays
// unblurred so font-size changes can be judged against the real workbench.
export function SettingsDialog({api, settings:s, onChange, stats, dataDir, version, demo, sample, source, onImport, onExport, onOpenData, onClose}) {
  const tabs = [['look',Type,'外观与字号'],['input',Keyboard,'输入与补全'],['copy',Copy,'复制格式'],...(demo ? [] : [['desktop',Monitor,'桌面行为']]),['data',Database,'本地数据']];
  const [tab, setTab] = useState('look'), [recording, setRecording] = useState(false);
  if (recording) return <ShortcutRecorder api={api} onClose={()=>setRecording(false)} onSave={async shortcut=>{
    const saved=await api.call('shortcut.set',{shortcut});
    onChange('shortcut',saved);
  }}/>;
  const tagFont = s.tagFontSize;
  const toggle = (key, label, hint, invert=false) => <label className="set-row" key={key}><span>{label}{hint && <small>{hint}</small>}</span><input type="checkbox" className="switch" checked={invert ? !s[key] : !!s[key]} onChange={e => onChange(key, invert ? !e.target.checked : e.target.checked)}/></label>;
  const size = (key, value, label, hint, min, max) => <div className="set-row"><span>{label}<small>{hint}</small></span><div className="range">
    <IconButton icon={Minus} size={14} label={label + '减小'} disabled={value <= min} onClick={() => onChange(key, Math.max(min, value - 1))}/>
    <input type="range" aria-label={label} min={min} max={max} value={value} onChange={e => onChange(key, Number(e.target.value))}/>
    <IconButton icon={Plus} size={14} label={label + '增大'} disabled={value >= max} onClick={() => onChange(key, Math.min(max, value + 1))}/>
    <output>{value} px</output>
  </div></div>;
  const pages = {
    look: <>
      <h3>外观与字号</h3><p>提示词编辑器和标签视图的字号分开调整，改动立即生效。</p>
      <div className="set-row"><span>界面主题<small>跟随系统时随 Windows 的深浅色切换</small></span><div className="seg">{[['system',Monitor,'跟随'],['dark',Moon,'深色'],['light',Sun,'浅色']].map(([v, Icon, label]) => <button key={v} type="button" className={s.theme === v ? 'on' : ''} aria-pressed={s.theme === v} onClick={() => onChange('theme', v)}><Icon size={13}/>{label}</button>)}</div></div>
      {size('fontSize', s.fontSize, '提示词字号', '左侧编辑器，行距随字号缩放', 11, 22)}
      {size('tagFontSize', tagFont, '标签视图字号', '右侧标签卡片，中文释义和权重随之缩放', 10, 20)}
      <div className="font-preview">
        <div><span className="eyebrow">提示词</span><div className="fp-editor" style={{fontSize:s.fontSize + 'px', lineHeight:(s.fontSize * LINE_HEIGHT).toFixed(1) + 'px'}}><i>01</i>long hair, blue eyes,<br/><i>02</i>(depth of field:1.2),</div></div>
        <div style={{'--tag-font':tagFont + 'px'}}><span className="eyebrow">标签视图</span><div className="fp-tags">
          <div className="chip" data-cat="2"><span className="chip-main"><span className="chip-en"><i className="dot"/>long hair</span><span className="chip-cn">长发</span></span></div>
          <div className="chip" data-cat="6"><span className="chip-main"><span className="chip-en"><i className="dot"/>depth of field<b className="w">1.2</b></span><span className="chip-cn">景深</span></span></div>
          <div className="chip off" data-cat="6"><span className="chip-main"><span className="chip-en"><i className="dot"/>sunset</span><span className="chip-cn">日落</span></span></div>
        </div></div>
      </div>
      {toggle('fireflies', '萤火微光', '标签视图背后缓慢明灭的光点')}
    </>,
    input: <><h3>输入与补全</h3><p>只转换新输入或粘贴的内容，已有文本保持原样。</p>
      <label className="set-row"><span>补全候选数量<small>每次最多显示的条数，可填 1–{maxCompletionLimit}。</small></span>
        <input type="number" className="completion-limit" aria-label="补全候选数量" min={1} max={maxCompletionLimit} step={1} required
          defaultValue={s.completionLimit} onChange={e=>{
            if(e.target.validity.valid)onChange('completionLimit',e.target.valueAsNumber);
          }} onBlur={e=>{e.target.value=String(s.completionLimit);}}/>
      </label>
      {toggle('autoTagSpace', '标签逗号后自动加空格', '开启时输入为 long hair, blue eyes，关闭时补全只加逗号')}
      {INPUT.map(([k, l]) => toggle(k, l))}</>,
    copy: <>
      <h3>复制格式</h3><p>用于复制当前组、全部提示词和选中的标签。</p>
      {toggle('singleLine', '保留换行', '关闭后每组合并成一行，用逗号连接', true)}{toggle('outputSpaces', '复制时下划线转空格')}
      {toggle('keepTagSpaces', '保留标签之间的空格', '关闭后将 long hair, blue eyes 复制为 long hair,blue eyes,')}
      <div className="set-row col"><span>按当前设置复制的效果<small>取自当前草稿的第一个可见组</small></span><pre className="preview">{withTrailingTagComma(outputField(sample || parseField('long_hair, blue eyes,'), s)) || '（空）'}</pre></div>
    </>,
    desktop: <>
      <h3>桌面行为</h3><p>窗口和快捷键设置。</p>
      {toggle('closeToTray', '关闭窗口时留在托盘', '从托盘菜单选择「退出」可完全关闭')}{toggle('alwaysOnTop', '窗口置顶', '左侧栏的图钉按钮也能切换')}
      <div className="set-row"><span>全局唤起快捷键<small>显示或隐藏工作台</small></span><div className="shortcut"><ShortcutKeys value={s.shortcut}/><button type="button" data-autofocus="" className="btn sm" onClick={()=>setRecording(true)}>设置快捷键</button></div></div>
    </>,
    data: <>
      <h3>本地数据</h3><p>{dataDir}{!demo && ' · 正常启动时自动备份，保留最近 10 份'}</p>
      <div className="stat-grid"><div><b>{num(stats.total)}</b><span>标签</span></div><div><b>{num(stats.translated)}</b><span>中文释义</span></div><div><b>{num(stats.notes||0)}</b><span>中文说明</span></div><div><b>{num(stats.identity||0)}</b><span>原名/身份</span></div><div><b>{num(stats.pending||0)}</b><span>待考证</span></div><div><b>{num(stats.untranslated||0)}</b><span>无译文（含待考证）</span></div><div><b>{num(stats.favorites)}</b><span>收藏</span></div></div>
      <DataPanel source={source} demo={demo} onImport={onImport} onExport={onExport} onOpenData={onOpenData}/>
    </>,
  };
  return <Modal title="设置" subtitle="所有设置自动保存在本机。" clear className="settings" onClose={onClose}>
    <div className="set-layout">
      <nav className="set-nav" role="tablist" aria-orientation="vertical" aria-label="设置分类">
        {tabs.map(([k, Icon, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} data-autofocus={tab === k && k !== 'desktop' ? '' : undefined} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon size={15}/>{label}</button>)}
        <p className="about">词序 · Prompt Studio v{version}</p>
      </nav>
      <div className="set-pane" role="tabpanel">{pages[tab]}</div>
    </div>
  </Modal>;
}
