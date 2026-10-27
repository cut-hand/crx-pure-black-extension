const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('chrome://whats-new/',{waitUntil:'domcontentloaded'});
 await page.locator('iframe').first().waitFor({state:'attached',timeout:15000}).catch(()=>{});
 console.log('Frames:',page.frames().map(frame=>frame.url()));
 const url=await page.locator('iframe').count()?await page.locator('iframe').first().getAttribute('src'):'https://www.google.com/chrome/whats-new/';console.log('Embedded URL:',url);
 const content=await browser.newPage({viewport:{width:1440,height:1000}});
 await content.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await content.waitForURL('**/editions/**',{waitUntil:'domcontentloaded',timeout:30000});
 await content.goto('https://www.google.com/intl/zh-CN/chrome/whats-new/milestones/m154/?internal=true',{waitUntil:'load',timeout:60000});
 await content.waitForTimeout(1800);
 await content.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await content.screenshot({path:'qa/whats-new-before.png'});
 const originals=await content.evaluate(()=>[...document.querySelectorAll('*')].flatMap(el=>[null,'::before','::after'].map(pseudo=>({cls:el.className,pseudo,image:getComputedStyle(el,pseudo).backgroundImage}))).filter(s=>s.image.includes('gradient(')));
 await content.evaluate(()=>{
  window.values={preferences:{enabled:true}};window.listeners=[];
  window.chrome={storage:{local:{get:async()=>values},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{id:'test',onMessage:{addListener:()=>{}},sendMessage:async()=>{}}};
 });
 await content.addStyleTag({path:path.resolve(__dirname,'../content.css')});
 for(const file of ['theme.js','lamp.js','content.js'])await content.addScriptTag({path:path.resolve(__dirname,'..',file)});
 await content.waitForSelector('[data-pb-active]',{state:'attached'});
 await content.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 const gradients=await content.evaluate(()=>[...document.querySelectorAll('*')].flatMap(el=>[null,'::before','::after'].map(pseudo=>{
  const r=el.getBoundingClientRect(),s=getComputedStyle(el,pseudo);return {tag:el.tagName,cls:el.className,pseudo,image:s.backgroundImage,bg:s.backgroundColor,w:r.width,h:r.height,y:r.y,content:s.content};
 })).filter(item=>item.image.includes('gradient(')));
 fs.writeFileSync('qa/whats-new-gradients.json',JSON.stringify(gradients,null,2));
 await content.screenshot({path:'qa/whats-new-after.png'});
 const navigator=content.locator('.chr-carousel-navigator--type-sticky');
 assert.match(originals.find(s=>s.cls.includes('chr-carousel-navigator--type-sticky')&&s.pseudo==='::before').image,/gradient/);
 assert.equal(await navigator.evaluate(el=>getComputedStyle(el,'::before').backgroundImage),'none');
 for(const pseudo of ['::before','::after']){
  assert.equal(await content.locator('.chr-carousel-navigator__wrapper').evaluate((el,p)=>getComputedStyle(el,p).backgroundImage,pseudo),'none');
  assert.equal(await content.locator('.chr-carousel-navigator__wrapper').evaluate((el,p)=>getComputedStyle(el,p).backgroundColor,pseudo),'rgba(0, 0, 0, 0)');
 }
 await content.evaluate(()=>{values.preferences={enabled:false};for(const fn of listeners)fn({preferences:{newValue:values.preferences}},'local');});
 await content.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
 assert.match(await navigator.evaluate(el=>getComputedStyle(el,'::before').backgroundImage),/gradient/);
 console.log('PASS: real Chrome Whats New footer gradients removed, fade overlays remain transparent, original gradients restored when disabled.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});


