export const uid = () => globalThis.crypto.randomUUID();
export const normalize = value => String(value).toLowerCase().replaceAll('_', ' ').replace(/\\([()])/g, '$1').replace(/\s+/g, ' ').trim();

// Split only at top-level commas. Escaped parentheses, quoted text, and weighted
// groups stay intact; unknown model-specific syntax is never discarded.
function tagSpans(raw) {
  const spans = []; let from = 0, escaped = false, quote = '', stack = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"') { quote = c; continue; }
    if ('([{<'.includes(c)) stack.push(c);
    else if (')]}>' .includes(c)) { const open = {')':'(',']':'[','}':'{','>':'<'}[c]; if (stack.at(-1) === open) stack.pop(); }
    else if (c === ',' && stack.length === 0) { spans.push([from, i]); from = i + 1; }
  }
  spans.push([from, raw.length]);
  return spans;
}

export function splitLine(raw) {
  return tagSpans(raw).filter(([a,b]) => raw.slice(a,b).trim()).map(([a,b]) => {
    const content = raw.slice(a,b), leading = content.length - content.trimStart().length;
    const text = content.trim();
    return { raw: text, start: a + leading, end: a + leading + text.length, ...tagInfo(text) };
  });
}

export function tagInfo(raw) {
  const weighted = raw.match(/^\(([^\n]*):([0-9]+(?:\.[0-9]+)?)\)$/);
  return { value: weighted ? weighted[1] : raw, weight: weighted ? Number(weighted[2]) : 1 };
}

export function parseField(text, previous = { lines: [] }) {
  text = String(text ?? '').replace(/\r\n?/g, '\n');
  const raws = text.split('\n'), old = previous.lines || [], used = new Set(), matches = new Map();
  // Exact line matches first, so inserting blank lines preserves group names.
  raws.forEach((raw, i) => { const n = old.findIndex((line, j) => !used.has(j) && line.raw === raw); if (n >= 0) { used.add(n); matches.set(i, old[n]); } });
  raws.forEach((_raw, i) => { if (!matches.has(i) && old[i] && !used.has(i)) { used.add(i); matches.set(i, old[i]); } });
  let offset = 0;
  const lines = raws.map((raw, index) => {
    const prior = matches.get(index), tokenUsed = new Set();
    const items = splitLine(raw).map(item => {
      const n = prior?.items?.findIndex((p,j) => !p.disabled && !tokenUsed.has(j) && normalize(p.value ?? tagInfo(p.raw).value) === normalize(item.value)) ?? -1;
      const p = n >= 0 ? prior.items[n] : null; if (p) tokenUsed.add(n);
      return { ...item, id: p?.id || uid(), disabled: false };
    });
    const result = { id: prior?.id || uid(), label: prior?.label || '', raw, index, offset, items, keepComma: !raw && !!prior?.keepComma }; offset += raw.length + 1; return result;
  });
  if(old.some(l=>l.items?.some(t=>t.disabled))) restoreHiddenSlots(old,lines);
  return { text, lines, visibleTextVersion: 1 };
}

// The textarea owns the visible spelling and caret offsets. Hidden tokens keep their
// own IDs and board slots, including when the user splits or removes their old line.
function restoreHiddenSlots(old, lines) {
  const slots=new Map(), byLine=new Map(lines.map(l=>[l.id,l]));
  const existing=new Set(lines.flatMap(l=>l.items.map(t=>t.id)));
  const unmatched=new Map();
  for(const l of old)for(const t of l.items){
    if(t.disabled||existing.has(t.id))continue;
    const key=normalize(t.value);
    if(!unmatched.has(key))unmatched.set(key,[]);
    unmatched.get(key).push(t.id);
  }
  // A visible neighbour may have crossed a newline. Recover its identity before
  // positioning hidden runs so they follow the same neighbour.
  const oldIds=new Set(old.flatMap(l=>l.items.map(t=>t.id)));
  for(const line of lines)line.items.forEach((t,index)=>{
    if(!oldIds.has(t.id)){
      const bucket=unmatched.get(normalize(t.value)),id=bucket?.shift();
      if(id)t.id=id;
    }
    slots.set(t.id,{line,index});
  });
  const inserts=new Map();
  old.forEach((line,lineIndex)=>{
    let left=null,visibleCount=0;
    for(let i=0;i<line.items.length;){
      const item=line.items[i];
      if(!item.disabled){left=slots.get(item.id);visibleCount++;i++;continue;}
      const run=[];
      while(i<line.items.length && line.items[i].disabled){
        const t=line.items[i++];run.push({...t,start:-1,end:-1});
      }
      const right=slots.get(line.items[i]?.id);
      const target=right?.line || left?.line || byLine.get(line.id) || lines[Math.min(lineIndex,lines.length-1)];
      const at=right ? right.index : left ? left.index+1 : Math.min(visibleCount,target.items.length);
      if(!inserts.has(target))inserts.set(target,new Map());
      const buckets=inserts.get(target);
      if(!buckets.has(at))buckets.set(at,[]);
      buckets.get(at).push(...run);
    }
  });
  for(const [line,buckets] of inserts){
    line.items=line.items.flatMap((t,i)=>[...(buckets.get(i)||[]),t]).concat(buckets.get(line.items.length)||[]);
  }
}


export function editLine(field, lineId, callback) {
  const hints = structuredClone(field), line = hints.lines.find(l => l.id === lineId);
  if (!line) return field;
  callback(line.items, line);
  updateLineText(line, line.items);
  return parseField(hints.lines.map(l => l.raw).join('\n'), hints);
}

export function toggleTag(field, lineId, tagId) {
  return editLine(field,lineId,items=>{
    const item=items.find(t=>t.id===tagId);if(item)item.disabled=!item.disabled;
  });
}

export function setWeight(raw, amount) {
  const info = tagInfo(raw);
  // A compound group or an opaque expression is preserved as its own unit.
  const weight = Math.round(Math.min(3, Math.max(0.1, info.weight + amount)) * 100) / 100;
  return weight === 1 ? info.value : `(${info.value}:${weight})`;
}

export function moveTag(field, fromLine, tagId, toLine, beforeId = null) {
  return moveAcrossGroups([{field}],tagId,toLine,beforeId)[0].field;
}

// Only space separators touched by this edit. Parse complete affected lines so
// commas inside a quote, escape or weighted group retain their original spelling.
function spaceEditedCommas(text, start, end, caret, trailing = false) {
  const first = Math.max(0, start - 1);
  if (end <= start || !text.slice(first,end).includes(',')) return {text,caret};
  const lineStart = text.lastIndexOf('\n', first - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const changedLines = text.slice(lineStart, nextBreak < 0 ? text.length : nextBreak);
  const parts = [];
  let offset = lineStart, copied = 0, newCaret = caret;
  for (const line of changedLines.split('\n')) {
    for (const [,stop] of tagSpans(line)) {
      const comma = offset + stop;
      if (stop === line.length || comma < first || comma >= end) continue;
      const next = text[comma + 1];
      if (next ? /[\s,]/.test(next) : !trailing) continue;
      parts.push(text.slice(copied,comma+1),' ');
      copied = comma + 1;
      if (comma < caret) newCaret++;
    }
    offset += line.length + 1;
  }
  return {text:parts.join('') + text.slice(copied), caret:newCaret};
}

export function formatTagInput(text, start, caret, settings) {
  const typed = convertInput(text.slice(start,caret),settings);
  text = text.slice(0,start) + typed + text.slice(caret);
  caret = start + typed.length;
  return settings.autoTagSpace === false ? {text,caret} : spaceEditedCommas(text,start,caret,caret,typed === ',');
}

export function insertText(field, caret, value, autoSpace = true) {
  caret = Math.max(0, Math.min(field.text.length, caret));
  const begin = field.text.lastIndexOf('\n', caret - 1) + 1;
  const endPos = field.text.indexOf('\n', caret), end = endPos < 0 ? field.text.length : endPos;
  const left = field.text.slice(begin, caret), right = field.text.slice(caret, end);
  const prefix = left.trim() && !/,$/.test(left.trimEnd()) && !/^[\s]*[,\n]/.test(value) ? ',' : '';
  const suffix = right.trim() && !/^\s*,/.test(right) && !/\n$/.test(value) && !/,\s*$/.test(value) ? ',' : '';
  const added = prefix + value + suffix;
  const text = field.text.slice(0,caret) + added + field.text.slice(caret);
  const afterValue = caret + prefix.length + value.length;
  const result = autoSpace ? spaceEditedCommas(text,caret,caret+added.length,afterValue) : {text,caret:afterValue};
  return {field:parseField(result.text,field), caret:result.caret};
}

// Both arguments are normalized. The name match is the primary sort key
// across the whole list, including when an alias or translation also matches.
export function completionNameRank(name, query) {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(' ' + query)) return 2;
  if (name.includes(query)) return 3;
  return 4;
}

export function completionAt(field, caret) {
  const line = field.lines.find(l => caret >= l.offset && caret <= l.offset + l.raw.length);
  if (!line) return null;
  const local = caret - line.offset, item = line.items.findLast(t => !t.disabled && local >= t.start);
  if (!item || (local > item.end && !/^[ \t]+$/.test(line.raw.slice(item.end,local)))) return null;
  const weighted = item.raw.match(/^\((.*):([\d.]+)\)$/), value = weighted ? weighted[1] : item.raw;
  if (/^[<\[{]/.test(value) || /[,\n]/.test(value)) return null;
  return { query: value.replace(/^\(/, ''), start: line.offset + item.start, end: line.offset + item.end, weighted: weighted?.[2], lineId: line.id };
}

export function acceptCompletion(field, context, tag, spaces, escapeBrackets = true, autoSpace = true) {
  let value = spaces ? tag.replaceAll('_',' ') : tag;
  // Escape literal parentheses for SD-style tag names, preserving weighted wrappers.
  if (escapeBrackets) value = value.replace(/(?<!\\)([(){}\[\]])/g, '\\$1');
  if (context.weighted) value = `(${value}:${context.weighted})`;
  const tail = field.text.slice(context.end);
  const boundary = /^[ \t]*(?:,([ \t]*))?/.exec(tail);
  const gap = boundary[1] ?? boundary[0];
  const inserted = value + ',' + gap;
  const text = field.text.slice(0,context.start) + inserted + tail.slice(boundary[0].length);
  const caret = context.start + inserted.length;
  const result = autoSpace ? spaceEditedCommas(text,context.start,caret,caret,true) : {text,caret};
  return {field:parseField(result.text,field), caret:result.caret};
}

export const outputSeparator = settings => settings.keepTagSpaces === false ? ',' : ', ';

function endsWithTagComma(line) {
  return line.endsWith(',') && tagSpans(line).at(-1)[0] === line.length;
}

// Finalize the assembled clipboard text once, after joining lines or groups.
export function withTrailingTagComma(text) {
  const content = text.trimEnd();
  if (!content) return '';
  const lastLine = content.slice(content.lastIndexOf('\n') + 1);
  if (endsWithTagComma(lastLine)) return text;
  return content + ',' + text.slice(content.length);
}

export function outputField(field, settings = {}) {
  let output = field.text;
  if (settings.keepTagSpaces === false) {
    output = output.split('\n').map(line => tagSpans(line).map(([start,end]) => {
      let tag = line.slice(start,end);
      if (start > 0) tag = tag.trimStart();
      if (end < line.length) tag = tag.trimEnd();
      return tag;
    }).join(',')).join('\n');
  }
  if (settings.outputSpaces) output = output.replaceAll('_', ' ');
  if (settings.singleLine) output = output.split('\n').map(raw => {
    const line = raw.trim();
    return endsWithTagComma(line) ? line.slice(0,-1) : line;
  }).filter(Boolean).join(outputSeparator(settings));
  return output;
}

export function duplicateCount(field) {
  const counts = new Map();
  for (const line of field.lines) for (const tag of line.items) { const k = normalize(tag.value); counts.set(k, (counts.get(k) || 0) + 1); }
  return counts;
}

export function newGroup(name = '提示词组 1', field = parseField('')) {
  return { id: uid(), name, hidden: false, height: null, field };
}

export function newDraft(title = '未命名草稿', text = '') {
  return { id: uid(), title, groups: [newGroup('提示词组 1', parseField(text))], createdAt: new Date().toISOString() };
}

function hydrateField(field) {
  if (!field) return parseField('');
  if (!field.visibleTextVersion && field.lines?.some(l=>l.items.some(t=>t.disabled))) {
    const lines=field.lines.map(line=>{
      if(!line.items.some(t=>t.disabled))return line;
      return updateLineText({...line},line.items);
    });
    return rebuild(lines);
  }
  return parseField(field.text,field);
}

export function hydrateDraft(draft) {
  const {positive,negative,...rest}=draft;
  if(draft.groups)return {...rest,groups:draft.groups.map(g=>({...g,field:hydrateField(g.field)}))};
  const groups=[newGroup('提示词组 1',hydrateField(positive))];
  if(negative?.text)groups.push(newGroup('旧版负向',hydrateField(negative)));
  return {...rest,groups};
}

// Work on a single copy, including cross-group edits. Unaffected lines retain their spelling.
export function editGroups(groups, ids, action, value, autoSpace = true) {
  const selected = new Set(ids);
  return groups.map(group => {
    let changed = false;
    const lines = group.field.lines.map(line => {
      if (!line.items.some(t => selected.has(t.id))) return line;
      changed = true;
      let items = line.items.flatMap(t => {
        if (!selected.has(t.id)) return [t];
        if (action === 'remove') return [];
        if (action === 'hide' || action === 'enable') return [{...t, disabled: action === 'hide'}];
        let raw = t.raw;
        if (action === 'weight') raw = setWeight(raw, value - t.weight);
        if (action === 'step') raw = setWeight(raw, value);
        if (action === 'wrap') raw = value[0] + raw + value[1];
        if (action === 'rename') raw = value;
        return [{...t, raw, ...tagInfo(raw)}];
      });
      return updateLineText({...line},items,autoSpace);
    });
    return changed ? {...group, field: rebuild(lines)} : group;
  });
}

function updateLineText(line, items, autoSpace = true) {
  const visible=items.filter(t=>!t.disabled);
  // Editing a hidden tag must not reformat the visible text. During migration
  // the raw spelling still contains hidden tokens, so compare against its spans.
  const spans=splitLine(line.raw);
  if(spans.length!==visible.length || spans.some((t,i)=>t.raw!==visible[i].raw)){
    const comma=/,\s*$/.test(line.raw)||(!line.raw && line.keepComma);
    line.keepComma=!visible.length && !!comma;
    line.raw=visible.map(t=>t.raw).join(autoSpace?', ':',')+(visible.length && comma?',':'');
  }
  line.items=items;
  return line;
}

function rebuild(lines) {
  return parseField(lines.map(l => l.raw).join('\n'), {lines});
}

export function moveAcrossGroups(groups, tagIds, targetLine, beforeId = null, autoSpace = true) {
  const ids = new Set(Array.isArray(tagIds) ? tagIds : [tagIds]);
  const lines = groups.flatMap(g => g.field.lines);
  const target = lines.find(l => l.id === targetLine);
  const moving = lines.flatMap(line => line.items.filter(tag => ids.has(tag.id)));
  if (!target || !moving.length || moving.length !== ids.size) return groups;

  // Count surviving tags before the original drop gap, including when the
  // pointer is over a tag that is itself being moved.
  const before = target.items.findIndex(tag => tag.id === beforeId);
  const cut = before < 0 ? target.items.length : before;
  const insertAt = target.items.slice(0,cut).filter(tag => !ids.has(tag.id)).length;
  const changed = new Map();
  for (const line of lines) {
    if (line !== target && !line.items.some(tag => ids.has(tag.id))) continue;
    let items = line.items.filter(tag => !ids.has(tag.id));
    if (line === target) items = items.slice(0,insertAt).concat(moving,items.slice(insertAt));
    if (items.length !== line.items.length || items.some((tag,i) => tag !== line.items[i])) {
      changed.set(line,updateLineText({...line},items,autoSpace));
    }
  }
  if (!changed.size) return groups;
  return groups.map(group => group.field.lines.some(line => changed.has(line))
    ? {...group, field:rebuild(group.field.lines.map(line => changed.get(line) || line))}
    : group);
}

export function convertInput(text, settings) {
  const pairs = [
    ['convertComma','，',','], ['convertPeriod','。．','..'],
    ['convertBrackets','（）［］【】｛｝','()[][]{}'], ['convertAngles','＜＞〈〉《》','<><><>'],
    ['insertSpaces','_',' ']
  ];
  for (const [key, from, to] of pairs) {
    if (settings[key]) text = text.replace(new RegExp('[' + from + ']', 'g'), c => to[from.indexOf(c)]);
  }
  return text;
}

export function formatLibraryTag(name, settings) {
  const text = convertInput(name, settings);
  return settings.escapeBrackets ? text.replace(/(?<!\\)([(){}\[\]])/g, '\\$1') : text;
}
