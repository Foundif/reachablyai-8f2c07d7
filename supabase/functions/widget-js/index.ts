const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/javascript; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
};

Deno.serve((req) => {
  const url = new URL(req.url);
  const botKey = url.searchParams.get('bot') || '';
  const apiBase = `${url.protocol}//${url.host}/functions/v1/chatbot-message`;

  const js = `(function(){
  var BOT_KEY = ${JSON.stringify(botKey)};
  var API = ${JSON.stringify(apiBase)};
  if (!BOT_KEY) { console.warn('[Reachably] Missing bot key'); return; }
  var VID_KEY = 'reachably_vid_' + BOT_KEY;
  var visitorId = localStorage.getItem(VID_KEY);
  if (!visitorId) { visitorId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(VID_KEY, visitorId); }

  var host = document.createElement('div');
  host.id = 'reachably-chat-root';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  var css = \`
    .wrap{position:fixed;bottom:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
    .right{right:20px}.left{left:20px}
    .launcher{display:flex;align-items:center;gap:8px;background:var(--bc);color:#fff;border:none;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;}
    .launcher:hover{filter:brightness(1.05)}
    .panel{position:fixed;bottom:88px;width:360px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;}
    .panel.open{display:flex}
    .hdr{background:var(--bc);color:#fff;padding:16px;display:flex;align-items:center;gap:10px}
    .hdr img{width:32px;height:32px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,.2)}
    .hdr .name{font-weight:600;font-size:15px}.hdr .sub{font-size:12px;opacity:.85}
    .hdr .close{margin-left:auto;background:transparent;color:#fff;border:none;cursor:pointer;font-size:20px;line-height:1}
    .msgs{flex:1;padding:14px;overflow-y:auto;background:#f7f7f8;display:flex;flex-direction:column;gap:8px}
    .msg{max-width:80%;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}
    .msg.a{align-self:flex-start;background:#fff;color:#111;border:1px solid #eee;border-bottom-left-radius:4px}
    .msg.u{align-self:flex-end;background:var(--bc);color:#fff;border-bottom-right-radius:4px}
    .typing{align-self:flex-start;background:#fff;border:1px solid #eee;padding:10px 14px;border-radius:14px;color:#999;font-size:13px}
    .form{padding:10px;background:#fff;border-top:1px solid #eee;display:flex;gap:8px}
    .form input{flex:1;border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}
    .form input:focus{border-color:var(--bc)}
    .form button{background:var(--bc);color:#fff;border:none;border-radius:10px;padding:0 14px;cursor:pointer;font-weight:600}
    .lead{padding:14px;background:#fff;border-top:1px solid #eee}
    .lead label{font-size:12px;color:#666;display:block;margin-bottom:6px}
    .lead input{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;margin-bottom:8px;font-size:13px;box-sizing:border-box}
    .lead button{width:100%;background:var(--bc);color:#fff;border:none;padding:9px;border-radius:8px;cursor:pointer;font-weight:600}
    .footer{text-align:center;font-size:11px;color:#999;padding:6px}
    .footer a{color:#999;text-decoration:none}
  \`;
  var style = document.createElement('style'); style.textContent = css; root.appendChild(style);

  var wrap = document.createElement('div');
  root.appendChild(wrap);

  var config = { brand_color: '#111827', welcome: 'Hi!', launcher_text: 'Chat with us', position: 'bottom-right', name: 'Support', avatar_url: '' };
  var conversationId = null;
  var humanTakeover = false;
  var leadCaptured = !!localStorage.getItem('reachably_lead_' + BOT_KEY);

  function render(){
    var side = config.position === 'bottom-left' ? 'left' : 'right';
    wrap.innerHTML = '<div class="wrap ' + side + '" style="--bc:' + config.brand_color + '">'
      + '<button class="launcher" id="rlbtn">'
      + (config.avatar_url ? '<img src="' + config.avatar_url + '" style="width:20px;height:20px;border-radius:50%"/>' : '💬')
      + '<span>' + escapeHtml(config.launcher_text) + '</span></button>'
      + '<div class="panel ' + side + '" id="rpanel">'
        + '<div class="hdr">'
          + (config.avatar_url ? '<img src="' + config.avatar_url + '"/>' : '<img/>')
          + '<div><div class="name">' + escapeHtml(config.name) + '</div><div class="sub">Typically replies in minutes</div></div>'
          + '<button class="close" id="rclose">×</button>'
        + '</div>'
        + '<div class="msgs" id="rmsgs"></div>'
        + (leadCaptured ? '' : '<div class="lead" id="rlead"><label>Your name</label><input id="rname" placeholder="Name"/><label>Email</label><input id="remail" type="email" placeholder="you@example.com"/><button id="rleadbtn">Start chat</button></div>')
        + '<form class="form" id="rform" ' + (leadCaptured ? '' : 'style="display:none"') + '><input id="rinput" placeholder="Write a message..." autocomplete="off"/><button type="submit">Send</button></form>'
        + '<div class="footer">Powered by <a href="https://reachably.foundif.com" target="_blank">Reachably</a></div>'
      + '</div></div>';

    wrap.querySelector('#rlbtn').onclick = openPanel;
    wrap.querySelector('#rclose').onclick = function(){ wrap.querySelector('#rpanel').classList.remove('open'); };
    var form = wrap.querySelector('#rform');
    if (form) form.onsubmit = function(e){ e.preventDefault(); var v = wrap.querySelector('#rinput').value.trim(); if (v) { wrap.querySelector('#rinput').value=''; send(v); } };
    var lb = wrap.querySelector('#rleadbtn');
    if (lb) lb.onclick = function(){
      var n = wrap.querySelector('#rname').value.trim();
      var e = wrap.querySelector('#remail').value.trim();
      if (!n) return;
      localStorage.setItem('reachably_lead_' + BOT_KEY, JSON.stringify({ n: n, e: e }));
      leadCaptured = true;
      window.__reachably_lead = { visitor_name: n, visitor_email: e };
      wrap.querySelector('#rlead').style.display = 'none';
      wrap.querySelector('#rform').style.display = 'flex';
      wrap.querySelector('#rinput').focus();
    };
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  function addMsg(role, content){
    var box = wrap.querySelector('#rmsgs'); if (!box) return;
    var el = document.createElement('div'); el.className = 'msg ' + (role === 'user' ? 'u' : 'a'); el.textContent = content;
    box.appendChild(el); box.scrollTop = box.scrollHeight;
  }
  function typing(on){
    var box = wrap.querySelector('#rmsgs'); if (!box) return;
    var t = box.querySelector('.typing');
    if (on && !t) { t = document.createElement('div'); t.className='typing'; t.textContent='typing…'; box.appendChild(t); box.scrollTop = box.scrollHeight; }
    if (!on && t) t.remove();
  }

  function openPanel(){
    wrap.querySelector('#rpanel').classList.add('open');
    if (!conversationId) init();
  }

  async function api(payload){
    var res = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    return res.json();
  }

  async function init(){
    var lead = JSON.parse(localStorage.getItem('reachably_lead_' + BOT_KEY) || '{}');
    var r = await api({ bot_key: BOT_KEY, visitor_id: visitorId, action:'init', page_url: location.href, visitor_name: lead.n, visitor_email: lead.e });
    if (r.error) { addMsg('assistant','Chat unavailable.'); return; }
    conversationId = r.conversation_id;
    humanTakeover = !!r.human_takeover;
    if (r.messages && r.messages.length) {
      r.messages.forEach(function(m){ addMsg(m.role, m.content); });
    } else if (r.welcome) {
      addMsg('assistant', r.welcome);
    }
  }

  async function send(text){
    addMsg('user', text); typing(true);
    var lead = JSON.parse(localStorage.getItem('reachably_lead_' + BOT_KEY) || '{}');
    var r = await api({ bot_key: BOT_KEY, visitor_id: visitorId, message: text, visitor_name: lead.n, visitor_email: lead.e, page_url: location.href });
    typing(false);
    if (r.error) { addMsg('assistant', 'Error: ' + r.error); return; }
    if (r.human_takeover) { addMsg('assistant', 'A team member will reply here shortly.'); return; }
    if (r.reply) addMsg('assistant', r.reply);
  }

  // fetch config first
  api({ bot_key: BOT_KEY, visitor_id: visitorId, action:'init', page_url: location.href }).then(function(r){
    if (r.error) { console.warn('[Reachably] ' + r.error); return; }
    config.brand_color = r.brand_color || config.brand_color;
    config.welcome = r.welcome || config.welcome;
    config.launcher_text = r.launcher_text || config.launcher_text;
    config.position = r.position || config.position;
    config.name = r.name || config.name;
    config.avatar_url = r.avatar_url || '';
    conversationId = r.conversation_id;
    humanTakeover = !!r.human_takeover;
    render();
    // pre-load messages hidden until panel opens
    if (r.messages && r.messages.length) {
      // wait for panel open to render — store on window
      window.__reachably_prev = r.messages;
    }
  });
})();`;

  return new Response(js, { headers });
});
