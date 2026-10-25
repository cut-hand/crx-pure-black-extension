const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.goto('https://fanyi.youdao.com/#/TextTranslate',{waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('body').waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('*').length>150,{timeout:30000});
    const surfaces=await page.evaluate(()=>[...document.querySelectorAll('*')].map(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {tag:el.tagName,cls:el.className,bg:s.backgroundColor,image:s.backgroundImage,area:r.width*r.height};
    }).filter(e=>e.area>100000&&(e.bg!=='rgba(0, 0, 0, 0)'||e.image!=='none')).sort((a,b)=>b.area-a.area).slice(0,12));
    fs.writeFileSync('qa/youdao-surfaces.json',JSON.stringify(surfaces,null,2));
    console.log(JSON.stringify(surfaces,null,2));
    await page.evaluate(()=>{
      window.listeners=[];window.values={preferences:{enabled:true}};
      window.chrome={storage:{local:{get:async()=>values},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{sendMessage:async()=>{},onMessage:{addListener:()=>{}}}};
    });
    await page.addStyleTag({path:path.resolve(__dirname,'../content.css')});
    await page.addScriptTag({path:path.resolve(__dirname,'../theme.js')});
    await page.addScriptTag({path:path.resolve(__dirname,'../lamp.js')});
    await page.addScriptTag({path:path.resolve(__dirname,'../content.js')});
    await page.waitForSelector('[data-pb-active]');
    await page.screenshot({path:'qa/youdao-after.png',fullPage:true});
    const remaining=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width*r.height>100000&&s.backgroundImage!=='none';
    }).map(el=>({tag:el.tagName,cls:el.className,image:getComputedStyle(el).backgroundImage})));
    console.log('Remaining large backgrounds:',JSON.stringify(remaining));
    const wallpaper=page.locator('.web-frame-content-scroll-container.index-bg');
    assert.equal(await wallpaper.evaluate(el=>getComputedStyle(el).backgroundImage),'none');
    assert.equal(await wallpaper.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
    assert.ok(await page.locator('.tab-body[data-pb-region]').count()>0,'Translation card should have a visible outline');
    const membership=page.getByText('开通会员',{exact:true}).first();
    assert.notEqual(await membership.evaluate(el=>getComputedStyle(el).color),'rgb(232, 232, 232)','Peach membership button must keep contrasting dark text');
    assert.equal(await page.locator('.document-upload-entrance-container .text-tip').first().evaluate(el=>getComputedStyle(el).color),'rgb(232, 232, 232)','Transparent SVG outline must not hide upload label');
    await page.evaluate(()=>{values.preferences.enabled=false;for(const fn of listeners)fn({preferences:{newValue:values.preferences}},'local');});
    await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
    assert.match(await wallpaper.evaluate(el=>getComputedStyle(el).backgroundImage),/e245cdfa893ee12bc4a3f6a00d7ea055/);
    assert.equal(await page.locator('.tab-body[data-pb-region]').count(),0);
    console.log('PASS: real Youdao translation workspace becomes black; disabling restores original wallpaper.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
