import { Screen, BADGE_SIZE_PX, BadgeSize } from './types'

export async function exportAsHtml(screens: Screen[]): Promise<void> {
  const screensJson = JSON.stringify(
    screens.map(s => ({
      id: s.id,
      name: s.frame.name,
      figmaUrl: s.frame.figmaUrl,
      imageUrl: s.frame.imageUrl,   // ← base64 변환 없이 URL 직접 사용 (img 태그는 CORS 무관)
      badges: s.badges.map(b => ({
        id: b.id,
        label: b.label,
        x: b.x,
        y: b.y,
        description: b.description,
        size: b.size ?? 'M',
      })),
    }))
  )

  // 뱃지 크기 맵 (S/M/L/XL → px)
  const sizePxJson = JSON.stringify(
    Object.fromEntries(
      (['S', 'M', 'L', 'XL'] as BadgeSize[]).map(s => [s, BADGE_SIZE_PX[s]])
    )
  )

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Storyboard</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0f0f11;--surface:#1a1a1f;--surface2:#242429;--border:#2e2e36;
  --accent:#7c6ef7;--accent-h:#9b90f9;--text:#e8e8ef;--text-muted:#7a7a8a;
  --badge:#7c6ef7;--radius:8px;
}
html,body{height:100%;background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;
  font-size:14px;line-height:1.5}
button{cursor:pointer;border:none;background:none;font:inherit;color:inherit}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

.app{display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* ── 상단 바 ── */
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:52px;
  background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;gap:16px}
.brand{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700}
.screen-title{font-size:13px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px}
.figma-link{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--accent);
  text-decoration:none;font-weight:500;white-space:nowrap;transition:color .15s;
  padding:6px 12px;background:rgba(124,110,247,.1);border:1px solid rgba(124,110,247,.25);
  border-radius:20px}
.figma-link:hover{color:var(--accent-h);background:rgba(124,110,247,.18)}

/* ── 본문 ── */
.body{display:flex;flex:1;overflow:hidden}

/* ── 캔버스 ── */
.canvas{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;
  background:radial-gradient(circle,rgba(124,110,247,.04) 0%,transparent 70%),
    repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%,transparent 0% 50%) 0 0/24px 24px;
  padding:32px}
.img-wrap{position:relative;display:inline-block;line-height:0;max-width:100%}
.img-wrap img{max-width:100%;height:auto;border-radius:6px;
  box-shadow:0 8px 40px rgba(0,0,0,.6);display:block;user-select:none;background:#fff}

/* ── 뱃지 핀 ── */
.badge{position:absolute;transform:translate(-50%,-50%);
  border-radius:50%;background:var(--badge);color:#fff;
  font-weight:700;display:flex;align-items:center;justify-content:center;
  cursor:pointer;user-select:none;
  box-shadow:0 2px 8px rgba(0,0,0,.5),0 0 0 2px rgba(255,255,255,.12);
  transition:transform .15s,box-shadow .15s;z-index:10}
.badge:hover{transform:translate(-50%,-50%) scale(1.15);
  box-shadow:0 4px 16px rgba(124,110,247,.6),0 0 0 2px rgba(255,255,255,.2)}
.badge.active{background:#fff;color:var(--accent);
  box-shadow:0 0 0 3px var(--accent),0 4px 16px rgba(124,110,247,.5);
  transform:translate(-50%,-50%) scale(1.15);z-index:20}

/* ── 우측 패널 ── */
.panel{width:320px;min-width:320px;background:var(--surface);
  border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}

/* 화면 탭 */
.screen-tabs-section{border-bottom:1px solid var(--border);flex-shrink:0}
.screen-tabs-header{display:flex;align-items:center;gap:8px;padding:12px 16px 8px}
.screen-tabs-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)}
.screen-count-badge{background:var(--surface2);color:var(--text-muted);font-size:11px;
  font-weight:600;padding:1px 6px;border-radius:8px;border:1px solid var(--border)}
.screen-tabs-list{display:flex;flex-direction:column;gap:2px;padding:0 8px 10px;max-height:200px;overflow-y:auto}
.screen-tab{display:flex;align-items:center;border-radius:8px;transition:background .12s}
.screen-tab:hover{background:var(--surface2)}
.screen-tab.active{background:rgba(124,110,247,.1)}
.screen-tab-btn{flex:1;display:flex;align-items:center;gap:8px;padding:7px 8px;
  text-align:left;min-width:0;background:transparent;color:var(--text);cursor:pointer;border:none}
.screen-tab-num{width:20px;height:20px;border-radius:50%;background:var(--surface2);
  color:var(--text-muted);font-size:11px;font-weight:700;display:flex;align-items:center;
  justify-content:center;flex-shrink:0;border:1px solid var(--border)}
.screen-tab.active .screen-tab-num{background:var(--accent);color:#fff;border-color:var(--accent)}
.screen-tab-name{font-size:12px;font-weight:500;color:var(--text-muted);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.screen-tab.active .screen-tab-name{color:var(--text);font-weight:600}
.screen-tab-badge-count{background:var(--accent);color:#fff;font-size:10px;font-weight:700;
  padding:1px 5px;border-radius:8px;flex-shrink:0}
.copy-link-btn{display:flex;align-items:center;justify-content:center;width:24px;height:24px;
  border-radius:6px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;
  transition:background .12s,color .12s}
.copy-link-btn:hover{background:rgba(124,110,247,.15);color:var(--accent)}
.copy-link-btn.copied{color:#4ade80}

/* 주석 목록 */
.panel-head{display:flex;align-items:center;gap:8px;padding:16px 20px;
  border-bottom:1px solid var(--border);flex-shrink:0}
.panel-head h2{font-size:14px;font-weight:700}
.cnt{background:var(--accent);color:#fff;font-size:11px;font-weight:700;
  padding:1px 6px;border-radius:10px;line-height:18px}
.list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.entry{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);
  padding:12px 14px;cursor:pointer;transition:border-color .15s,background .15s}
.entry:hover{border-color:rgba(124,110,247,.4)}
.entry.active{border-color:var(--accent);background:rgba(124,110,247,.08)}
.entry-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.pin{border-radius:50%;background:var(--badge);color:#fff;font-weight:700;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.entry.active .pin{background:var(--accent-h);box-shadow:0 0 0 2px rgba(124,110,247,.4)}
.entry-label{font-size:13px;font-weight:600;color:var(--text)}
.entry-desc{font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap;word-break:break-word}
.entry-desc.empty{color:var(--text-muted);font-style:italic}
.screen-link-chip{display:inline-flex;align-items:center;gap:4px;background:rgba(124,110,247,.12);
  color:var(--accent);border:1px solid rgba(124,110,247,.3);border-radius:5px;padding:1px 7px;
  font-size:12px;font-weight:600;cursor:pointer;transition:background .12s;line-height:1.6;vertical-align:middle}
.screen-link-chip:hover{background:rgba(124,110,247,.22)}
.empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:16px;padding:32px;color:var(--text-muted);text-align:center}
.empty-state svg{opacity:.3}
.empty-state p{font-size:13px;line-height:1.6}

@media(max-width:640px){
  .panel{width:100%;min-width:unset;border-left:none;border-top:1px solid var(--border);max-height:45vh}
  .body{flex-direction:column}
}
</style>
</head>
<body>
<div class="app">
  <header class="topbar">
    <div class="brand">
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#7c6ef7"/>
        <path d="M8 10h6a4 4 0 010 8H8V10z" fill="white" opacity=".9"/>
        <circle cx="20" cy="22" r="4" fill="white" opacity=".7"/>
      </svg>
      Storyboard
    </div>
    <span class="screen-title" id="screenTitle"></span>
    <a id="figmaLinkTop" class="figma-link" href="#" target="_blank" rel="noreferrer">
      <svg width="13" height="13" viewBox="0 0 38 57" fill="none">
        <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE"/>
        <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 0 1-19 0z" fill="#0ACF83"/>
        <path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" fill="#FF7262"/>
        <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/>
        <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/>
      </svg>
      Figma 스펙 확인 ↗
    </a>
  </header>
  <div class="body">
    <div class="canvas">
      <div class="img-wrap" id="imgWrap">
        <img id="mainImg" src="" alt="" draggable="false"/>
      </div>
    </div>
    <aside class="panel">
      <div class="screen-tabs-section">
        <div class="screen-tabs-header">
          <span class="screen-tabs-label">화면</span>
          <span class="screen-count-badge" id="screenCnt"></span>
        </div>
        <div class="screen-tabs-list" id="screenTabsList"></div>
      </div>
      <div class="panel-head">
        <h2>주석</h2>
        <span class="cnt" id="cnt">0</span>
      </div>
      <div class="list" id="list"></div>
    </aside>
  </div>
</div>

<script>
(function(){
  var screens  = ${screensJson};
  var sizePx   = ${sizePxJson};
  var activeIdx = 0;
  var selected  = null;

  var img        = document.getElementById('mainImg');
  var wrap       = document.getElementById('imgWrap');
  var list       = document.getElementById('list');
  var cnt        = document.getElementById('cnt');
  var screenTitle= document.getElementById('screenTitle');
  var figmaLinkT = document.getElementById('figmaLinkTop');
  var tabsList   = document.getElementById('screenTabsList');
  var screenCnt  = document.getElementById('screenCnt');

  screenCnt.textContent = screens.length;

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  function renderDesc(desc) {
    return desc.replace(/\\[\\[([^\\]]+)\\]\\]/g, function(match, name) {
      var idx = screens.findIndex(function(s){ return s.name === name; });
      if (idx >= 0) {
        return '<button class="screen-link-chip" onclick="switchScreen('+idx+')">'
          + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" style="vertical-align:middle">'
          + '<rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>'
          + '<path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
          + '</svg> '+esc(name)+' \\u2192</button>';
      }
      return '<span style="color:var(--text-muted);text-decoration:line-through">'+esc(match)+'</span>';
    });
  }

  function switchScreen(idx) {
    activeIdx = idx;
    selected  = null;
    render();
  }
  window.switchScreen = switchScreen;

  function copyLink(i) {
    navigator.clipboard.writeText(screens[i].figmaUrl).then(function(){
      var btn = document.getElementById('copyBtn'+i);
      if (!btn) return;
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      setTimeout(function(){ renderTabs(); }, 2000);
    });
  }
  window.copyLink = copyLink;

  function renderTabs() {
    tabsList.innerHTML = '';
    screens.forEach(function(s, i) {
      var tab = document.createElement('div');
      tab.className = 'screen-tab' + (i === activeIdx ? ' active' : '');
      var bc = s.badges.length > 0 ? '<span class="screen-tab-badge-count">'+s.badges.length+'</span>' : '';
      tab.innerHTML =
        '<button class="screen-tab-btn" onclick="switchScreen('+i+')">'
        +'<span class="screen-tab-num">'+(i+1)+'</span>'
        +'<span class="screen-tab-name">'+esc(s.name)+'</span>'+bc
        +'</button>'
        +'<div style="display:flex;align-items:center;gap:2px;padding-right:6px">'
        +'<button class="copy-link-btn" id="copyBtn'+i+'" onclick="copyLink('+i+')" title="Figma 링크 복사">'
        +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8"/></svg>'
        +'</button></div>';
      tabsList.appendChild(tab);
    });
  }

  function renderBadges() {
    wrap.querySelectorAll('.badge').forEach(function(el){ el.remove(); });
    var imgEl = document.getElementById('mainImg');
    var iw = imgEl.offsetWidth, ih = imgEl.offsetHeight;
    screens[activeIdx].badges.forEach(function(b){
      var sp  = sizePx[b.size] || sizePx['M'];
      var el  = document.createElement('div');
      el.className = 'badge'+(b.id === selected ? ' active' : '');
      el.style.left      = (b.x*100)+'%';
      el.style.top       = (b.y*100)+'%';
      el.style.width     = sp.diameter+'px';
      el.style.height    = sp.diameter+'px';
      el.style.fontSize  = sp.fontSize+'px';
      el.textContent     = b.label;
      el.dataset.id      = b.id;
      el.addEventListener('click', function(){ selectBadge(b.id); });
      wrap.appendChild(el);
    });
  }

  function renderList() {
    var s = screens[activeIdx];
    cnt.textContent = s.badges.length;
    list.innerHTML  = '';
    if (s.badges.length === 0) {
      list.innerHTML = '<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><p>등록된 주석이 없습니다.</p></div>';
      return;
    }
    s.badges.forEach(function(b, i){
      var sp  = sizePx[b.size] || sizePx['M'];
      var el  = document.createElement('div');
      el.className   = 'entry'+(b.id === selected ? ' active' : '');
      el.dataset.id  = b.id;
      el.innerHTML   =
        '<div class="entry-top">'
        +'<div class="pin" style="width:'+sp.diameter+'px;height:'+sp.diameter+'px;font-size:'+sp.fontSize+'px">'+esc(b.label)+'</div>'
        +'<span class="entry-label">#'+(i+1)+'</span>'
        +'</div>'
        +'<div class="entry-desc '+(b.description ? '' : 'empty')+'">'
        +(b.description ? renderDesc(b.description) : '설명 없음')
        +'</div>';
      el.addEventListener('click', function(){ selectBadge(b.id); });
      list.appendChild(el);
    });
  }

  function selectBadge(id) {
    selected = selected === id ? null : id;
    renderBadges();
    renderList();
    if (selected) {
      var entry = list.querySelector('[data-id="'+selected+'"]');
      if (entry) entry.scrollIntoView({block:'nearest', behavior:'smooth'});
    }
  }

  function render() {
    var s = screens[activeIdx];
    img.src = s.imageUrl;   // ← URL 직접 사용 (fetch 없음, CORS 무관)
    img.alt = s.name;
    screenTitle.textContent = s.name;
    figmaLinkT.href = s.figmaUrl;
    renderTabs();
    renderList();
  }

  img.addEventListener('load', function(){ renderBadges(); });
  render();
})();
</script>
</body>
</html>`

  const title = screens.length === 1 ? screens[0].frame.name : 'storyboard'
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `${title.replace(/[\s/\\:*?"<>|]+/g, '-')}-storyboard.html`
  a.click()
  URL.revokeObjectURL(blobUrl)
}
