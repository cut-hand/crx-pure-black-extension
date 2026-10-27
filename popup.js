'use strict';
const defaults = { enabled: true, mode: 'full', shadows: true, background: '#000000' };
const $ = id => document.getElementById(id);
let siteKey = null, tabId = null, preferences;
let shade = {h:0,s:0}, writeQueue = Promise.resolve(), pendingWrites = 0;
function renderPalette(updateHue = true) {
  const background = PureBlackTheme.normalize(preferences.background);
  const hsl = PureBlackTheme.hsl(background);
  // Explicit color selections, including black/white, replace the old hue.
  // Slider updates pass false so dragging a colored shade to black and back
  // still preserves that shade without leaking it into a later black preset.
  if (updateHue) shade = {h:hsl.h,s:hsl.s};
  $('background-color').value = background;
  $('hex-color').value = background.toUpperCase();
  const darkness = Math.round((1-hsl.l)*100);
  $('darkness').value = darkness;
  $('darkness-value').textContent = `${darkness}%`;
  $('darkness').style.setProperty('--shade-light', PureBlackTheme.fromHsl({...shade,l:.85}));
  for (const button of document.querySelectorAll('.swatch')) {
    button.style.backgroundColor = button.dataset.color;
    button.setAttribute('aria-pressed', String(button.dataset.color === background));
  }
}
function savePreferences() {
  const snapshot = {...preferences,mode:'full'};
  pendingWrites++;
  writeQueue = writeQueue.then(() => chrome.storage.local.set({preferences:snapshot})).then(async () => {
    if (tabId === null || !siteKey) { $('status').textContent='已保存，普通网页中生效'; return; }
    try {
      const result = await chrome.tabs.sendMessage(tabId,{type:'pb-preview',preferences:snapshot},{frameId:0});
      $('status').textContent = result?.version === '1.8.1' ? '已应用到当前网页' : '已保存，请刷新网页以应用新版配色';
    } catch { $('status').textContent='已保存，请刷新网页以应用新版配色'; }
  }).catch(() => { $('status').textContent = '保存失败，请重新打开扩展再试'; }).finally(() => { pendingWrites--; });
  return writeQueue;
}
function setBackground(value, updateHue = true) {
  if (!PureBlackTheme.valid(value)) return;
  preferences.background = value.toLowerCase();
  // Picking a color is a preview action: make the selected color visible even
  // when the user previously paused the extension or excluded this site.
  preferences.enabled = true;
  $('enabled').checked = true;
  if (siteKey && !$('site').checked) { $('site').checked=true; writeQueue=writeQueue.then(()=>chrome.storage.local.set({[siteKey]:true})); }
  renderState();
  $('hex-color').removeAttribute('aria-invalid');
  renderPalette(updateHue);
  void savePreferences();
}
function renderState() {
  const enabled = $('enabled').checked;
  document.body.classList.toggle('is-off', !enabled);
  $('mascot').src = enabled ? 'icons/awake.svg' : 'icons/asleep.svg';
  $('mascot').alt = enabled ? '睁眼微笑的小月亮' : '闭眼休息的小月亮';
  $('state-pill').textContent = enabled ? '已开启' : '休息中';
  $('state-description').textContent = enabled ? '选一个舒服的底色，让页面安静下来。' : '小月亮休息中，网页已恢复原来的配色。';
}
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  let hostname = '';
  try { const url = new URL(tab.url); if (/^https?:$/.test(url.protocol)) hostname = url.hostname; } catch {}
  siteKey = hostname ? `site:${hostname}` : null;
  const values = await chrome.storage.local.get(siteKey ? ['preferences', siteKey] : ['preferences']);
  preferences = { ...defaults, ...(values.preferences || {}) };
  $('enabled').checked = preferences.enabled;
  $('host').textContent = hostname || '请在普通 HTTP / HTTPS 网页使用';
  $('site').disabled = !siteKey;
  $('site').checked = siteKey ? values[siteKey] !== false : false;
  renderState();
  renderPalette();
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.preferences && !pendingWrites) {
      preferences = { ...defaults, ...(changes.preferences.newValue || {}) };
      $('enabled').checked = preferences.enabled;
      renderPalette();
    }
    if (siteKey && changes[siteKey]) $('site').checked = changes[siteKey].newValue !== false;
    renderState();
  });
  for (const button of document.querySelectorAll('.shortcut-settings')) button.addEventListener('click', () => {
    const scheme = navigator.userAgent.includes('Edg/') ? 'edge' : 'chrome';
    void chrome.tabs.create({url:`${scheme}://extensions/shortcuts`});
  });
  if (chrome.commands?.getAll) {
    const commands = await chrome.commands.getAll();
    const shortcut = commands.find(command => command.name === 'toggle-pure-black')?.shortcut;
    $('shortcut-status').textContent = shortcut ? `${shortcut} · 设置快捷键` : '浏览器快捷键未绑定 · 点击设置';
  }
  for (const button of document.querySelectorAll('.swatch')) button.addEventListener('click', () => setBackground(button.dataset.color));
  $('background-color').addEventListener('input', event => setBackground(event.target.value));
  $('background-color').addEventListener('change', event => setBackground(event.target.value));
  $('hex-color').addEventListener('input', event => {
    const value = event.target.value.trim();
    if (PureBlackTheme.valid(value)) setBackground(value);
    else event.target.setAttribute('aria-invalid','true');
  });
  $('hex-color').addEventListener('blur', () => { if (!PureBlackTheme.valid($('hex-color').value)) renderPalette(); });
  $('darkness').addEventListener('input', event => {
    setBackground(PureBlackTheme.fromHsl({...shade,l:1-Number(event.target.value)/100}),false);
  });
  for (const id of ['enabled', 'site']) $(id).addEventListener('change', async () => {
    try {
      if (id === 'site') await chrome.storage.local.set({ [siteKey]: $('site').checked });
      else {
        preferences = {...preferences, enabled: $('enabled').checked, mode: 'full'};
        await savePreferences();
      }
      if (id === 'site') $('status').textContent = '已保存网站设置';
      renderState();
    } catch { $('status').textContent = '保存失败，请重新打开扩展再试'; }
  });
}
init().catch(() => { $('status').textContent = '读取失败，请重新打开扩展'; });
