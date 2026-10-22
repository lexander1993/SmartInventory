export function download(name:string,contents:string,type='text/csv;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function exportCsv(name:string,columns:string[],rows:Record<string,unknown>[]){
 download(name,csvContents(columns,rows));
}
export function csvContents(columns:string[],rows:Record<string,unknown>[]){
 const cell=(value:unknown)=>{let text=String(value ?? '');if(/^[\s]*[=+\-@]/.test(text) && typeof value!=='number')text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\uFEFF'+[columns.map(cell).join(','),...rows.map(row=>columns.map(c=>cell(row[c])).join(','))].join('\r\n');
}
export function parseCsv(text:string):Record<string,string>[] {
 text=text.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
  if(c==='"'){if(value || closed)throw new Error('Invalid quote in CSV');quoted=true;}
  else if(c===','){row.push(value);value='';closed=false;}
  else if(c==='\n' || c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v!==''))rows.push(row);row=[];value='';closed=false;}
  else{if(closed)throw new Error('Unexpected text after quoted CSV field');value+=c;}
 }
 if(quoted)throw new Error('Unclosed quoted CSV field');row.push(value);if(row.some(v=>v!==''))rows.push(row);
 const headers=rows.shift()?.map(h=>h.trim());if(!headers?.length)throw new Error('CSV file is empty');if(new Set(headers).size!==headers.length)throw new Error('Duplicate CSV column');
 return rows.map((values,i)=>{if(values.length!==headers.length)throw new Error('Wrong number of fields on CSV row '+(i+2));return Object.fromEntries(headers.map((h,n)=>[h,values[n]]));});
}
