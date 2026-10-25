'use strict';
// Queue rapid key presses so each toggle uses the preceding saved state.
let pending = Promise.resolve();
let lastToggle = 0, lastSource = '';
async function updateIcon() {
  const { preferences = {} } = await chrome.storage.local.get('preferences');
  const enabled = preferences.enabled !== false;
  const face = enabled ? 'awake' : 'asleep';
  await chrome.action.setIcon({ path: { 16: `icons/${face}-16.png`, 32: `icons/${face}-32.png`, 48: `icons/${face}-48.png`, 128: `icons/${face}-128.png` } });
  await chrome.action.setTitle({ title: enabled ? '纯黑浏览 · 已开启（Alt+Shift+D）' : '纯黑浏览 · 已关闭（Alt+Shift+D）' });
}
async function notifyToggle(enabled) {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (tab?.id === undefined) return;
  try { await chrome.tabs.sendMessage(tab.id,{type:'pb-effect-ready'},{frameId:0}); }
  catch {
    // Browser-owned pages cannot host a content-script toast.
    await chrome.action.setBadgeBackgroundColor({color:enabled?'#237b59':'#626b83'});
    await chrome.action.setBadgeText({text:enabled?'ON':'OFF',tabId:tab.id});
    setTimeout(() => { void chrome.action.setBadgeText({text:'',tabId:tab.id}); },2000);
  }
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.preferences) void updateIcon().catch(console.error);
});
void updateIcon().catch(console.error);
function toggle(source) {
  const now = Date.now();
  // Some browser versions deliver both the native command and the page event.
  // Count the same physical keypress once, without dropping repeated native keys.
  if (source !== lastSource && now - lastToggle < 400) return pending;
  lastToggle = now; lastSource = source;
  pending = pending.then(async () => {
    const { preferences = {} } = await chrome.storage.local.get('preferences');
    await chrome.storage.local.set({ preferences: { ...preferences, mode:'full', enabled: preferences.enabled === false } });
    await notifyToggle(preferences.enabled === false);
  }).catch(error => console.error('纯黑浏览快捷键失败', error));
  return pending;
}
chrome.commands.onCommand.addListener(command => {
  if (command === 'toggle-pure-black') void toggle('command');
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'pb-toggle' || !sender.tab) return;
  toggle('page-key').then(() => sendResponse({ok:true}));
  return true;
});
