import {Progress} from './progress.js';
import {QuestPlayer} from './player.js';
const $ = id => document.getElementById(id);
let config, progress, demo = false, active = null, tracking = null, session = null;
let inQuest = false, ready = false, interacted = false, cameraTimer, helpTimer;
const player = new QuestPlayer(updatePlayback);
const dialog = $('dialog');
const icon = id => '<svg aria-hidden="true"><use href="#'+id+'"/></svg>';
function button(label, fn, primary = false) {
  const b = document.createElement('button');
  b.className = primary ? 'primary' : 'smallbtn';
  b.textContent = label;
  b.onclick = fn;
  return b;
}
function message(text) {
  const p = document.createElement('p'); p.textContent = text; return p;
}
function modal(title,...content) {
  $('dlgTitle').textContent = title;
  $('dlgBody').replaceChildren(...content);
  if (!dialog.open) dialog.showModal();
  player.pause();
}
function close() { dialog.close(); }
$('closeModal').onclick = close;
dialog.addEventListener('close',()=>{if (active && ready && !document.hidden) playActive();});
dialog.addEventListener('click',e=>{if (e.target === dialog && (e.clientX<dialog.getBoundingClientRect().left || e.clientX>dialog.getBoundingClientRect().right)) close();});
$('help').onclick = () => {
  const list = document.createElement('ol');
  for (const text of ['プリントとえんぴつを用意しよう。探索をはじめたら、カメラの使用を許可してね。','立ち止まって先生の写真にカメラをかざそう。写真に動画が重なるよ。四つの角が画面からはみ出したら、少しうしろに下がろう。','先生の好きなものを聞いてプリントに書こう。5人分そろったら、番号順に文字を読んでスタッフに見せよう。']) {
    const li = document.createElement('li'); li.textContent = text; list.append(li);
  }
  modal('遊び方',list,button('わかった',close,true));
};
function render() {
  const n = progress.ids.size, total = config.teachers.length;
  $('count').innerHTML = n+' <small>/ '+total+'</small>';
  document.querySelector('.scan-count').textContent = '発見した先生 '+n+' / '+total;
  $('complete').hidden = n !== total;
  $('complete').textContent = total+'人全員発見！ プリントの謎を解こう！';
  $('roster').replaceChildren(...config.teachers.map(t=>{
    const card = document.createElement('figure');
    const seen = progress.ids.has(t.id);
    card.className = 'teacher'+(seen?' found':'');
    card.innerHTML = '<div class="portrait"><img><span class="file-id"></span></div><figcaption><span class="role"></span><div class="name"></div><span class="state"></span></figcaption>';
    const img = card.querySelector('img');
    img.src = t.image; img.alt = t.name+'先生の写真';
    card.querySelector('.file-id').textContent = t.id;
    card.querySelector('.role').textContent = t.role;
    card.querySelector('.name').textContent = t.name;
    const suffix = document.createElement('small');suffix.textContent = '先生'; card.querySelector('.name').append(suffix);
    card.querySelector('.state').textContent = seen?'発見済み':'未発見';
    return card;
  }));
  if (!progress.available) { $('notice').hidden=false; $('notice').textContent='この端末に進み具合を保存できません。このページを開いたまま探索してね。'; }
}
function setStatus(text,action='') {
  $('scanStatus').textContent = text;
  $('play').hidden = !action;
  if (action) $('play').textContent = action;
}
function updatePlayback(state) {
  if (!active) return;
  const name = config.teachers.find(t=>t.id===active).name;
  const statuses = {
    playing:[name+'先生の動画を再生中'],
    ended:['もう一度見ることができるよ','もう一度見る'],
    blocked:['再生ボタンを押して動画を見よう','動画を再生'],
    error:['動画を読み込めません。通信を確かめてね。スタッフにも聞けるよ。','動画を再試行']
  };
  setStatus(...statuses[state]);
}
function playActive() {
  if (active && !document.hidden && !dialog.open) player.play(config.teachers.find(t=>t.id===active));
}
function found(id) {
  if (!inQuest || document.hidden || !config.teachers.some(t=>t.id===id)) return;
  if (active === id) return;
  clearTimeout(helpTimer);
  active = id;
  progress.add(id);
  document.querySelector('.viewer').classList.add('tracking');
  setStatus('先生を発見！ 動画を準備しています…');
  render();
  playActive();
}
function recognitionHint() {
  clearTimeout(helpTimer);
  if (ready && !demo) helpTimer = setTimeout(()=>{
    if (!active && inQuest) setStatus('見つからないときは、写真全体を正面から映してね。難しいときはスタッフに聞こう。');
  },12000);
}
function lost(id) {
  if (!id || active !== id) return;
  active = null; player.pause();
  document.querySelector('.viewer').classList.remove('tracking');
  setStatus('先生の写真にカメラをかざそう');
  recognitionHint();
}
function stopCamera() {
  clearTimeout(cameraTimer);
  session?.abort();
  session = null;
  tracking?.remove(); tracking = null;
  lost(active); player.pause(); ready = false;
  clearTimeout(helpTimer);
  $('surface').replaceChildren();
}
function leave() {
  inQuest = false; stopCamera();
  $('explore').hidden = true; $('home').hidden = false;
  window.scrollTo(0,0);
}
function cameraError(error) {
  stopCamera();
  $('cameraNotice').hidden = false;
  const text = error.name === 'NotAllowedError' ? 'カメラを使えるようにしよう' : error.name === 'NotFoundError' ? 'カメラが見つかりません' : error.message === 'secure' ? '安全な接続で開いてね' : 'カメラの準備ができませんでした';
  $('cameraNotice').textContent = text;
  setStatus(error.name === 'NotAllowedError' ? 'Safariのページ設定でカメラを「許可」にして、もう一度ためしてね。' : error.message === 'secure' ? '学校のHTTPSアドレスから開き直してね。' : 'カメラと通信を確かめてね。難しいときはスタッフに聞こう。');
  $('retry').hidden = false;
}
async function start() {
  if (dialog.open) close();
  interacted = true;
  stopCamera(); inQuest = true;
  $('home').hidden = true; $('explore').hidden = false;
  $('retry').hidden = true; $('demoControls').hidden = !demo;
  $('cameraNotice').hidden = false;
  $('cameraNotice').textContent = 'カメラを準備しています…';
  setStatus('カメラの使用を許可してね');
  player.prepare(config.teachers[0]);
  window.scrollTo(0,0);
  if (demo) {
    ready = true;
    $('surface').append(player.video);
    $('cameraNotice').hidden = true;
    setStatus('開発用デモ：写真の認識を試してみよう');
    $('demoControls').replaceChildren(...config.teachers.map(t=>button(t.id+' を認識',()=>found(t.id))),button('写真を外す',()=>lost(active)));
    return;
  }
  session = new AbortController();
  const signal = session.signal;
  const frame = document.createElement('iframe');
  tracking = frame;
  frame.title = 'AR探索カメラ';
  frame.allow = 'camera; autoplay';
  frame.src = 'js/camera.html?v=photo-overlay';
  cameraTimer = setTimeout(()=>{if(!signal.aborted) cameraError(Error('timeout'));},60000);
  frame.onload = async () => {
    if (signal.aborted) return;
    try {
      await frame.contentWindow.startTracking({config,player,signal,found:id=>{if(!signal.aborted) found(id);},lost:id=>{if(!signal.aborted) lost(id);}});
      if (signal.aborted) return;
      clearTimeout(cameraTimer);
      ready = true; $('cameraNotice').hidden = true;
      if (!active) {setStatus('先生の写真にカメラをかざそう');recognitionHint();}
    } catch(error) { if (!signal.aborted) cameraError(error); }
  };
  $('surface').append(frame);
}
function reset() {
  stopCamera(); player.reset(); progress.reset(); interacted = false; render(); leave();
  if (dialog.open) close();
}
function confirmReset(after) {
  modal('発見の記録を消しますか？',message('この端末の、このクエストの記録を消して、0人からはじめます。'),
    button('記録を消す',()=>{ reset(); after?.(); },true),button('キャンセル',close));
}
$('start').onclick = () => {
  if (!interacted && progress.ids.size) {
    modal('前回の記録があります',message('発見した先生は'+progress.ids.size+'人です。'),
      button('続きからはじめる',start,true),button('新しくはじめる',()=>confirmReset(start)));
  } else start();
};
$('back').onclick = leave;
$('retry').onclick = start;
$('play').onclick = playActive;
$('staff').disabled = true;
$('staff').onclick = () => {
  const label = document.createElement('label');label.textContent = '救済する先生';
  const select = document.createElement('select');
  for(const t of config.teachers) select.add(new Option(t.id+'　'+t.name+'先生',t.id));
  label.append(select);
  modal('スタッフ用の操作',message('認識が難しいときは、本人動画または紙のヒントを提示してから、先生を選んでください。'),label,
    button('この先生を発見済みにする',()=>{progress.add(select.value);render();close();},true),
    button('次の参加者へリセット',()=>confirmReset()));
};
document.addEventListener('visibilitychange',()=>{
  if (document.hidden && inQuest) {
    stopCamera();
    $('cameraNotice').hidden = false; $('cameraNotice').textContent = '探索を一時停止しました';
    setStatus('準備ができたら探索を再開してね'); $('retry').hidden = false;
  }
});
window.addEventListener('pagehide',stopCamera);
async function load() {
  try {
    const r = await fetch('config/quest.json',{cache:'no-cache'});
    if (!r.ok) throw Error('config');
    config = await r.json();
    if (new URLSearchParams(location.search).get('mode') === 'demo') {
      const mode = await fetch('demo/enabled.json');
      demo = mode.ok && (await mode.json()).enabled === true;
    }
    progress = new Progress(config,demo);
    $('modeLabel').hidden = !demo;
    render(); $('start').disabled = false; $('staff').disabled = false;
  } catch {
    $('notice').hidden = false;
    $('notice').replaceChildren(message('設定を読み込めません。通信を確かめてね。'), button('再読み込み',()=>location.reload()));
  }
}
load();
