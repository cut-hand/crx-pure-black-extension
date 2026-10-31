const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'content.css'),'utf8');
const scripts=['theme.js','lamp.js','content.js'].map(file=>fs.readFileSync(path.join(root,file),'utf8'));
const asset='https://s2.music.126.net/style/web2/img/';
// These are the surface/sprite rules used by the live NetEase desktop site.
const fixture=`<!doctype html><style>
body{background:#f5f5f5;color:#333;font:16px Arial}
.g-bd1,.g-bd2,.g-bd3,.g-bd4,.g-bd5,.g-bd6,.g-bd10{width:980px;min-height:100px;margin:12px auto}
${[1,2,3,4,5,6,10].map(n=>`.g-bd${n}{background:url('${asset}frame/wrap${n}.png?test') repeat-y}`).join('')}
.n-myinfo{background:url('${asset}index/index.png?test') no-repeat;width:250px;height:126px}
.n-bilst{background:url('${asset}index/index_bill.png?test');width:689px;height:120px}
.v-hd2{background:url('${asset}index/index.png?test') no-repeat -225px -156px;border-bottom:2px solid #c10d0c}
.m-table th,.m-table th .wp,.m-table td,.ply{background:url('${asset}table.png?test') no-repeat}
.btn{display:block;background:url('${asset}index/index.png?test');width:100px;height:30px;color:#fff}
.photo{background:url('https://p1.music.126.net/banner.jpg');width:350px;height:100px}
.custom{background-image:url('https://example.com/custom-art.png')}
</style><body>
${[1,2,3,4,5,6,10].map(n=>`<div class="g-bd${n}" id="wrap${n}"><span>歌单和推荐文字 ${n}</span></div>`).join('')}
<div class="v-hd2"><a class="tit">热门推荐</a></div>
<div class="n-myinfo"><span>用户信息</span><a class="btn">用户登录</a></div>
<div class="n-bilst">榜单</div>
<table class="m-table"><thead><tr><th><div class="wp">歌曲标题</div></th></tr></thead><tbody><tr><td>歌曲名称 <i class="ply">▶</i></td></tr></tbody></table>
<div class="photo">轮播图</div><div class="g-bd1 custom">自定义图片</div><img src="https://p1.music.126.net/cover.jpg">
<iframe id="content" src="/inner"></iframe>
</body>`;
async function inject(frame){
  await frame.evaluate(()=>{
    window.values={preferences:{enabled:true}};window.listeners=[];
    window.chrome={runtime:{id:'test',onMessage:{addListener:()=>{}},sendMessage:async()=>{}},storage:{local:{get:async()=>values},onChanged:{addListener:fn=>listeners.push(fn)}}};
    window.update=preferences=>{values.preferences=preferences;for(const fn of listeners)fn({preferences:{newValue:preferences}},'local');};
  });
  await frame.addStyleTag({content:css});
  for(const content of scripts)await frame.addScriptTag({content});
  await frame.waitForFunction(()=>document.documentElement.hasAttribute('data-pb-active'));
}
async function check(frame){
  const result=await frame.evaluate(()=>({
    surfaces:[...document.querySelectorAll('[id^=wrap],.n-myinfo,.n-bilst,.m-table th,.m-table th .wp,.m-table td')].map(el=>({image:getComputedStyle(el).backgroundImage,bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})),
    preserved:[...document.querySelectorAll('.btn,.ply,.photo,.custom,.v-hd2')].map(el=>getComputedStyle(el).backgroundImage),
    heading:getComputedStyle(document.querySelector('.v-hd2 .tit')).color,
    image:document.querySelector('img').getAttribute('src')
  }));
  for(const s of result.surfaces){assert.equal(s.image,'none');assert.equal(s.bg,'rgb(0, 0, 0)');assert.equal(s.color,'rgb(232, 232, 232)');}
  assert(result.preserved.every(image=>image.includes('url(')));
  assert.equal(result.heading,'rgb(232, 232, 232)');
  assert.equal(result.image,'https://p1.music.126.net/cover.jpg');
}
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(route.request().resourceType()==='document')return route.fulfill({contentType:'text/html',body:new URL(url).pathname==='/inner'?fixture.replace(/<iframe[^>]*><\/iframe>/,''):fixture});
    return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="980" height="200"><path fill="#eee" d="M0 0h980v200H0z"/></svg>'});
  });
  await page.goto('https://music.163.com/');
  const inner=await page.locator('#content').elementHandle().then(el=>el.contentFrame());
  for(const frame of [page.mainFrame(),inner]){await inject(frame);await check(frame);}
  // A fresh document reached by the site's iframe navigation gets the same fix.
  await page.locator('#content').evaluate(el=>{el.src='/inner?playlist';});
  await page.waitForFunction(()=>document.querySelector('#content').contentDocument?.readyState==='complete'&&document.querySelector('#content').contentWindow.location.search==='?playlist');
  const navigated=page.frames().find(frame=>frame.url().endsWith('/inner?playlist'));
  await inject(navigated);await check(navigated);
  await page.evaluate(()=>update({enabled:true,background:'#0d1522'}));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#wrap1')).backgroundColor==='rgb(13, 21, 34)');
  await page.evaluate(()=>update({enabled:false}));
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
  for(const selector of ['#wrap1','.n-myinfo','.n-bilst','.m-table th'])assert.match(await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundImage),/url\(/);
  assert.equal(await page.locator('#wrap1 span').evaluate(el=>getComputedStyle(el).color),'rgb(51, 51, 51)');
  await page.goto('https://example.com/');await inject(page.mainFrame());
  assert.match(await page.locator('#wrap1').evaluate(el=>getComputedStyle(el).backgroundImage),/wrap1\.png/);
  assert.deepEqual(errors,[]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).content_scripts[0].all_frames,true);
  console.log('PASS: NetEase column skins, profile, charts and table surfaces; iframe navigation, readable text, palette, disable restoration, media/control and other-host preservation.');
  if(process.argv.includes('--live')){
    const live=await browser.newPage({viewport:{width:1440,height:1000}});
    // Keep the original HTML/CSS/media; remove scripts including the inline
    // frame redirect, so the discovery document can be inspected on its own.
    await live.route('**/*',async route=>{
      if(route.request().resourceType()==='script')return route.abort();
      if(route.request().resourceType()==='document'){
        const response=await route.fetch();
        return route.fulfill({response,body:(await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')});
      }
      return route.continue();
    });
    await live.goto('https://music.163.com/discover',{waitUntil:'domcontentloaded',timeout:60000});
    await live.locator('#discover-module').waitFor();
    await live.waitForFunction(()=>getComputedStyle(document.querySelector('#discover-module')).backgroundImage.includes('wrap1.png'));
    const original=await live.locator('#discover-module').evaluate(el=>getComputedStyle(el).backgroundImage);
    assert.match(original,/wrap1\.png/);
    await inject(live.mainFrame());
    for(const selector of ['#discover-module','.n-myinfo','.n-bilst']){
      assert.equal(await live.locator(selector).evaluate(el=>getComputedStyle(el).backgroundImage),'none');
      assert.equal(await live.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
    }
    assert.match(await live.locator('.bg-normal').evaluate(el=>getComputedStyle(el).backgroundImage),/downloadNoHover/);
    assert.equal(await live.locator('.v-hd2 .tit').first().evaluate(el=>getComputedStyle(el).color),'rgb(232, 232, 232)');
    await live.screenshot({path:path.join(__dirname,'netease-after.png')});
    await live.evaluate(()=>update({enabled:false}));
    await live.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
    assert.equal(await live.locator('#discover-module').evaluate(el=>getComputedStyle(el).backgroundImage),original);
    console.log('PASS: live NetEase discovery HTML/CSS, decorative skins removed, download artwork preserved, original skin restored on disable.');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
