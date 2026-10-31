const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const player=`<!doctype html><style>
body{margin:0;background:#fff;color:#222;font:18px Arial}
.html5-video-player{position:relative;width:640px;height:360px;background:#000;color:#eee}
video{display:block;width:640px;height:360px}
.ytp-gated-actions-overlay-background-overlay{background-color:rgba(0,0,0,.3);position:absolute;inset:0;z-index:82}
.ytp-gradient-top{position:absolute;inset:0 0 auto;height:60px;background:linear-gradient(rgba(0,0,0,.75),transparent)}
.ytp-chrome-bottom{position:absolute;bottom:0;background:rgba(0,0,0,.6);padding:10px;color:white}
.ytp-chrome-bottom::before{content:'▶';background:rgba(255,255,255,.2)}
.ytp-chrome-bottom svg{width:24px;height:24px;vertical-align:middle}
.external-controls{position:absolute;inset:0;background:rgba(0,0,0,.1);pointer-events:none}
</style><body><p id="outside">Page outside player</p>
<div class="html5-video-player" id="movie_player"><video muted autoplay playsinline></video>
<div class="ytp-gated-actions-overlay-background-overlay"></div><div class="ytp-gradient-top"></div>
<div class="ytp-chrome-bottom"><svg viewBox="0 0 24 24"><path fill="#222" d="M0 0h24v24H0z"/></svg><span>Playback controls</span></div></div>`;
async function inject(frame){
 await frame.evaluate(()=>{
  window.values={preferences:{enabled:true}};window.listeners=[];
  window.chrome={runtime:{id:'test',onMessage:{addListener:()=>{}}},storage:{local:{get:async()=>values},onChanged:{addListener:fn=>listeners.push(fn)}}};
  window.update=preferences=>{values.preferences=preferences;for(const fn of listeners)fn({preferences:{newValue:preferences}},'local');};
 });
 await frame.addStyleTag({path:path.join(root,'content.css')});
 for(const file of ['theme.js','lamp.js','content.js'])await frame.evaluate(fs.readFileSync(path.join(root,file),'utf8'));
 await frame.waitForFunction(()=>listeners.length>0);
}
async function startVideo(frame){
 await frame.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#268cff';ctx.fillRect(0,0,640,360);
  const video=document.querySelector('video');video.srcObject=canvas.captureStream(10);await video.play();
  window.testCanvas=canvas;
 });
 await frame.waitForFunction(()=>document.querySelector('video').videoWidth===640&&!document.querySelector('video').paused);
}
async function assertPlayer(frame,original){
 const current=await frame.evaluate(()=>({
  overlay:getComputedStyle(document.querySelector('.ytp-gated-actions-overlay-background-overlay')).backgroundColor,
  gradient:getComputedStyle(document.querySelector('.ytp-gradient-top')).backgroundImage,
  pseudo:getComputedStyle(document.querySelector('.ytp-chrome-bottom'),'::before').backgroundColor,
  playing:!document.querySelector('video').paused,
  filter:getComputedStyle(document.querySelector('svg')).filter
 }));
 assert.equal(current.overlay,'rgba(0, 0, 0, 0.3)','A translucent player overlay must not become opaque');
 assert.match(current.gradient,/linear-gradient/);assert.equal(current.pseudo,'rgba(255, 255, 255, 0.2)');
 assert.equal(current.playing,true);assert.equal(current.filter,'none');
 const screenshot=await frame.locator('#movie_player').screenshot();
 // Ignore the two-pixel crop edge, which can blend with the now-dark page.
 const same=await frame.evaluate(async({before,after})=>{
  async function pixels(bytes){const image=await createImageBitmap(new Blob([Uint8Array.from(bytes)],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(2,2,image.width-4,image.height-4).data;}
  const a=await pixels(before),b=await pixels(after);return a.length===b.length&&a.every((value,index)=>value===b[index]);
 },{before:[...original],after:[...screenshot]});
 if(!same){fs.writeFileSync(path.join(__dirname,'video-before.png'),original);fs.writeFileSync(path.join(__dirname,'video-after.png'),screenshot);}
 assert(same,'Rendered video and controls must match the original pixels');
}
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:900,height:600}});
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:route.request().url().includes('developer.chrome.com')?`<!doctype html><body style="background:white;color:#222"><p>Documentation</p><iframe style="width:800px;height:500px" src="https://www.youtube.com/embed/test"></iframe>`:player}));
  await page.goto('https://developer.chrome.com/test');
  const embedded=page.frames().find(frame=>frame.url().includes('youtube.com'));
  await startVideo(embedded);const original=await embedded.locator('#movie_player').screenshot();
  await inject(page.mainFrame());await inject(embedded);await assertPlayer(embedded,original);
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
  assert.equal(await embedded.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  // The new YouTube UI also places controls beside, rather than inside, the player.
  await embedded.evaluate(()=>{const el=document.createElement('div');el.className='external-controls';el.id='external';document.body.append(el);});
  await embedded.waitForTimeout(850);
  assert.equal(await embedded.locator('#external').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0.1)');
  await embedded.evaluate(()=>document.querySelector('#external').remove());
  for(const background of ['#eeeeee','#0d1522']){
   await embedded.evaluate(background=>update({enabled:true,background}),background);
   await embedded.waitForFunction(background=>values.preferences.background===background,background);
   await assertPlayer(embedded,original);
  }
  // New controls and full-screen overlays inserted after playback starts stay intact.
  await embedded.evaluate(()=>{const el=document.createElement('div');el.id='dynamic';el.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.1)';document.querySelector('#movie_player').append(el);});
  await embedded.waitForTimeout(850);
  assert.equal(await embedded.locator('#dynamic').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0.1)');
  await embedded.evaluate(()=>document.querySelector('#dynamic').remove());
  await embedded.evaluate(()=>update({enabled:false}));
  await embedded.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
  await embedded.locator('[data-pb-ui="lamp"]').waitFor({state:'detached'});
  await assertPlayer(embedded,original);
  // The privacy-enhanced embed and the regular watch page use the same player.
  for(const url of ['https://www.youtube-nocookie.com/embed/test','https://www.youtube.com/watch?v=test']){
   await page.goto(url);await startVideo(page.mainFrame());
   const before=await page.locator('#movie_player').screenshot();await inject(page.mainFrame());await assertPlayer(page.mainFrame(),before);
  }
  console.log('PASS: playing video pixels, translucent overlays, gradients, controls, dynamic layers, bright/dark palettes and disable restoration in cross-origin YouTube embeds, privacy-enhanced embeds and watch pages.');
  if(process.argv.includes('--live')){
   await page.unroute('**/*');
   await page.goto('https://developer.chrome.com/docs/extensions/ai/build-with-ai?hl=zh-CN',{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('devsite-video iframe').waitFor();
   const live=await (await page.locator('devsite-video iframe').elementHandle()).contentFrame();
   await live.locator('#movie_player video').waitFor({state:'attached'});
   await inject(live);
   assert.equal(await live.locator('[data-pb-bg],[data-pb-fg],[data-pb-fill],[data-pb-active]').count(),0,'The entire live embed, including sibling controls, must stay untouched');
   console.log('PASS: live Chrome documentation YouTube iframe player remains unmodified by extension injection.');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
