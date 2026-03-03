
// Common helpers for API calls, tokens, and seat utilities
const API_BASE = '/api';

export function getTokenFromUrl(){
  // Support /s/:token route or ?token= param
  const path = window.location.pathname;
  const segs = path.split('/').filter(Boolean);
  let token = null;
  if(segs[0] === 's' && segs[1]) token = segs[1];
  const url = new URL(window.location.href);
  if(!token && url.searchParams.get('token')) token = url.searchParams.get('token');
  return token;
}

export async function api(path, {method='GET', body, headers}={}){
  const opts = { method, headers: { 'Content-Type':'application/json', ...(headers||{}) } };
  if(body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if(!res.ok){
    const t = await res.text().catch(()=> '');
    throw new Error(`API ${path} failed: ${res.status} ${t}`);
  }
  return res.json();
}

export function seatCode(rowIndex, colIndex){
  // Rows: 0..3 => A..D; Cols: 0..8; col 4 is aisle; Seat codes A1..A9
  const rowLetter = String.fromCharCode('A'.charCodeAt(0) + rowIndex);
  const num = colIndex + 1; // 1..9
  return `${rowLetter}${num}`;
}

export function seatZone(colIndex){
  if(colIndex < 4) return 'door';
  if(colIndex > 4) return 'window';
  return 'aisle';
}

export function parseSeatCode(code){
  // Returns {rowIndex, colIndex} or null
  if(!code || typeof code !== 'string') return null;
  const m = code.toUpperCase().match(/^([A-D])(\d)$/);
  if(!m) return null;
  const row = m[1].charCodeAt(0) - 'A'.charCodeAt(0);
  const num = parseInt(m[2],10);
  if(num<1 || num>9) return null;
  return { rowIndex: row, colIndex: num-1 };
}

export function buildSeatGrid(container, onSelect){
  // Builds a 4x9 grid with aisle at col 4; returns a handle {select(code), getSelected()}
  container.innerHTML='';
  const seats=[]; let selected=null;
  for(let r=0;r<4;r++){
    for(let c=0;c<9;c++){
      if(c===4){
        const d=document.createElement('div'); d.className='aisle'; d.textContent='Aisle';
        container.appendChild(d);
        continue;
      }
      const div=document.createElement('div');
      div.className='seat';
      const code = seatCode(r,c);
      const zone = seatZone(c);
      div.dataset.code = code; div.dataset.zone = zone;
      const label=document.createElement('div'); label.className='code'; label.textContent=code;
      div.appendChild(label);
      div.addEventListener('click', ()=>{
        if(div.classList.contains('disabled')) return;
        container.querySelectorAll('.seat.selected').forEach(el=>el.classList.remove('selected'));
        div.classList.add('selected'); selected=code; if(onSelect) onSelect(code);
      });
      container.appendChild(div);
      seats.push(div);
    }
  }
  return {
    select:(code)=>{
      const target = seats.find(el=>el.dataset.code===code);
      if(target){
        container.querySelectorAll('.seat.selected').forEach(el=>el.classList.remove('selected'));
        target.classList.add('selected');
        selected=code;
      }
    },
    getSelected:()=>selected
  };
}

export function createEl(tag, props={}, children=[]) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k,v])=>{
    if(k==='class') el.className=v;
    else if(k==='text') el.textContent=v;
    else if(k.startsWith('on') && typeof v==='function') el.addEventListener(k.substring(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  (Array.isArray(children)?children:[children]).forEach(ch=>{ if(ch) el.appendChild(ch) });
  return el;
}
