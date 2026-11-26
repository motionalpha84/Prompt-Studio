import React, {useEffect, useRef} from 'react';
import {X} from 'lucide-react';

export const LINE_HEIGHT = 1.85;
export const CATEGORIES = ['人物','头发','五官与表情','服装','动作与姿态','场景与光线','构图与风格','质量与排除'];
export const num = n => Number(n || 0).toLocaleString('zh-CN');
export const pad2 = n => String(n).padStart(2, '0');
export const date = s => new Date(s).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
export function meaningText(tag) {
  if (!tag?.translation) return '—';
  if (tag.translation_kind === '说明') return '说明 · ' + tag.translation;
  if (tag.translation_kind === '原名/身份标注') return '原名/身份 · ' + tag.translation;
  return tag.translation;
}
export function meaningTitle(tag) { return tag?.translation_source ? '来源：' + tag.translation_source : undefined; }

// The eight seed categories keep fixed colours; imported ones get a stable colour from their name.
export function catNo(category) {
  if (!category) return 0;
  const i = CATEGORIES.indexOf(category);
  if (i >= 0) return i + 1;
  let h = 0;
  for (const c of category) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return h % 8 + 1;
}

export function IconButton({icon:Icon, label, size=16, active=false, className='', ...props}) {
  return <button type="button" className={'ibtn' + (active ? ' on' : '') + (className ? ' ' + className : '')} title={label} aria-label={label} {...props}><Icon size={size}/></button>;
}

export function Empty({icon:Icon, title, children}) {
  return <div className="empty"><Icon size={26}/><strong>{title}</strong><p>{children}</p></div>;
}

export function Modal({title, subtitle, children, onClose, wide=false, clear=false, className=''}) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll('button:not(:disabled),input,textarea,select');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    const timer = setTimeout(() => ref.current?.querySelector('[data-autofocus],input,textarea,.btn.primary,.btn.danger')?.focus(), 30);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', key); previous?.focus?.(); };
  }, []);
  return <div className={'backdrop' + (clear ? ' clear' : '')} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={ref} className={'modal' + (wide ? ' wide' : '') + (className ? ' ' + className : '')} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><IconButton icon={X} label="关闭窗口" onClick={onClose}/></header>
      {children}
    </section>
  </div>;
}
