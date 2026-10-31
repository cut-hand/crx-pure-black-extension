const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const baseline=process.argv.includes('--baseline');
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><style>body{background:#fff;color:#222}.card{background:#eee;border-radius:4px}.card:empty{background:navy}.html5-video-player{background:#000;color:#fff}</style><body><p id="counter">1</p><div class="html5-video-player"><span id="clock">0:00</span>${'<div class="control"><span>Control</span></div>'.repeat(1000)}</div><main>${'<section class="card"><h2>Title</h2><p>Text</p></section>'.repeat(1000)}</main></body>`}));
  await page.goto('https://www.youtube.com/watch?v=performance');
  await page.evaluate(()=>{
   window.stats={reads:0,removes:0,scans:[]};window.scanStart=0;
   const computed=window.getComputedStyle;window.getComputedStyle=(...args)=>{stats.reads++;return computed(...args);};
   const set=Element.prototype.setAttribute,remove=Element.prototype.removeAttribute;
   Element.prototype.setAttribute=function(name,...args){if(name==='data-pb-measuring')scanStart=performance.now();return set.call(this,name,...args);};
   Element.prototype.removeAttribute=function(name){if(name==='data-pb-measuring')stats.scans.push(performance.now()-scanStart);if(name.startsWith('data-pb-'))stats.removes++;return remove.call(this,name);};
   window.values={preferences:{enabled:true}};window.listeners=[];
   window.chrome={runtime:{id:'test',onMessage:{addListener:()=>{}}},storage:{local:{get:async()=>values},onChanged:{addListener:fn=>listeners.push(fn)}}};
   window.update=preferences=>{values.preferences=preferences;for(const fn of listeners)fn({preferences:{newValue:preferences}},'local');};
   window.testHidden=false;Object.defineProperty(document,'hidden',{get:()=>testHidden,configurable:true});
  });
  await page.addStyleTag({path:path.join(root,'content.css')});
  for(const file of ['theme.js','lamp.js'])await page.evaluate(fs.readFileSync(path.join(root,file),'utf8'));
  await page.evaluate(fs.readFileSync(baseline?'/tmp/pb-before-performance.js':path.join(root,'content.js'),'utf8'));
  await page.waitForFunction(()=>document.documentElement.hasAttribute('data-pb-active'));
  const initial=await page.evaluate(()=>structuredClone(stats));
  await page.evaluate(()=>{stats.reads=stats.removes=0;stats.scans=[];window.dispatchEvent(new Event('resize'));});
  await page.waitForTimeout(900);
  const resize=await page.evaluate(()=>structuredClone(stats));
  await page.evaluate(()=>{
   stats.reads=stats.removes=0;stats.scans=[];
   let count=0;window.ticks=setInterval(()=>{const clock=document.querySelector('#clock');clock.firstChild.data=String(++count);clock.style.transform=`translateX(${count%2}px)`;const node=document.createElement('i');clock.append(node);node.remove();if(count===30)clearInterval(ticks);},50);
  });
  await page.waitForTimeout(2400);
  const playback=await page.evaluate(()=>structuredClone(stats));
  if(!baseline)assert.equal(playback.reads,0,'Player updates should not rescan the surrounding page');
  await page.evaluate(()=>{stats.reads=0;document.querySelector('#counter').firstChild.data='2';});
  await page.waitForTimeout(850);
  const counterReads=await page.evaluate(()=>stats.reads);
  if(!baseline)assert.equal(counterReads,0,'Updating existing text should not rescan all styles');
  await page.evaluate(()=>{
   stats.reads=0;testHidden=true;document.dispatchEvent(new Event('visibilitychange'));
   const el=document.createElement('div');el.id='background-card';el.style.cssText='background:white;color:black';el.textContent='Added while hidden';document.body.append(el);
  });
  await page.waitForTimeout(900);
  const hiddenReads=await page.evaluate(()=>stats.reads);
  if(!baseline)assert.equal(hiddenReads,0,'Hidden documents should defer automatic scans');
  await page.evaluate(()=>{testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#background-card')).backgroundColor==='rgb(0, 0, 0)');
  // Stylesheet text changes and genuinely new content still invalidate the theme.
  await page.evaluate(()=>{const sheet=document.createElement('style');sheet.id='dynamic-sheet';sheet.textContent='.card h2{color:navy}';document.head.append(sheet);});
  await page.waitForTimeout(850);
  await page.evaluate(()=>document.querySelector('#dynamic-sheet').firstChild.data='.card h2{color:#ff00ff}');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.card h2')).color==='rgb(255, 0, 255)');
  await page.evaluate(()=>{const el=document.createElement('div');el.id='empty-card';el.className='card';el.append(document.createTextNode(''));document.body.append(el);});
  await page.waitForTimeout(850);
  await page.evaluate(()=>document.querySelector('#empty-card').firstChild.data=' ');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#empty-card')).backgroundColor==='rgb(0, 0, 0)');
  await page.evaluate(()=>update({enabled:false}));
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
  assert.equal(await page.locator('[data-pb-bg],[data-pb-fg],[data-pb-fill]').count(),0);
  console.log(JSON.stringify({mode:baseline?'before':'after',initial,resize,playback,counterReads,hiddenReads}));
  console.log('PASS: video and counter updates, hidden-page deferral/resume, stylesheet invalidation and disabled cleanup.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
