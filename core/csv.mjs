export function parseCSV(input) {
  input = String(input).replace(/^\uFEFF/,'');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i=0;i<input.length;i++) {
    const c=input[i];
    if (quoted) { if (c==='"' && input[i+1]==='"') { cell+='"'; i++; } else if (c==='"') quoted=false; else cell+=c; }
    else if (c==='"' && !cell) quoted=true;
    else if (c===',') { row.push(cell); cell=''; }
    else if (c==='\n' || c==='\r') { if(c==='\r'&&input[i+1]==='\n')i++; row.push(cell); if(row.some(v=>v.trim()))rows.push(row);row=[];cell=''; }
    else cell+=c;
  }
  if(quoted)throw new Error('CSV 存在未闭合的双引号，请检查文件。');
  row.push(cell); if(row.some(v=>v.trim()))rows.push(row); return rows;
}

const types = { '0':'通用', '1':'画师', '3':'作品', '4':'角色', '5':'元信息' };
export function importRows(input, kind='tags') {
  const rows=parseCSV(input), first=rows[0];
  const header=first?.map(v=>v.trim().toLowerCase());
  const headered=!!header && /^(name|tag|english|英文|标签)$/.test(header[0]||'');
  const columns=headered?Object.fromEntries(header.map((v,i)=>[v,i])):{};
  if(headered)rows.shift();
  let skipped=0; const unique = new Map();
  for(const r of rows) {
    const name=r[0]?.trim(); if(!name || name.length>500 || /[\r\n]/.test(name)){skipped++;continue;}
    if(kind==='glossary') {
      const at=(...keys)=>{for(const key of keys)if(columns[key]!=null)return r[columns[key]];return '';};
      const translation=at('translation')?.trim()||'',entryKind=at('kind')?.trim()||'';
      if(entryKind==='缺口'){
        const source=at('source')?.trim().slice(0,5000)||'';
        if(source){unique.set(name,{name,translation:'',translationKind:'缺口',source});continue;}
        skipped++;continue;
      }
      if(!translation){skipped++;continue;}
      unique.set(name,{name,translation:translation.slice(0,1000),translationKind:entryKind,source:at('source')?.trim().slice(0,5000)||''});
      continue;
    }
    if(kind==='translations') {
      const translation=(columns.translation!=null?r[columns.translation]:(r.length>=3 ? r[2] : r[1]))?.trim();
      const translationKind=columns.kind!=null?r[columns.kind]?.trim():'';
      if(!translation||translationKind==='缺口'){skipped++;continue;}
      unique.set(name,{name,translation:translation.slice(0,1000),translationKind:translationKind||'zh',source:columns.source!=null?r[columns.source]?.trim().slice(0,5000)||'':''});
    } else {
      unique.set(name,{name,category:types[r[1]] || r[1]?.trim().slice(0,80) || '自定义', count:Math.max(0,Number(r[2])||0), aliases:(r[3]||'').split(',').map(a=>a.trim()).filter(Boolean).slice(0,100), translation:(r[4]||'').trim().slice(0,1000),note:''});
    }
  }
  return {entries:[...unique.values()],skipped};
}
export const toCSV = rows => '\uFEFF' + rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
