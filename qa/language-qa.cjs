const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
async function inject(page){
  await page.evaluate(()=>{
    window.values={preferences:{enabled:true}};window.listeners=[];
    window.chrome={runtime:{onMessage:{addListener(){}}},storage:{local:{get:async()=>values},onChanged:{addListener:fn=>listeners.push(fn)}}};
    window.update=preferences=>{values.preferences=preferences;for(const fn of listeners)fn({preferences:{newValue:preferences}},'local');};
  });
  await page.addStyleTag({path:path.join(root,'content.css')});
  for(const file of ['theme.js','lamp.js','content.js'])await page.evaluate(fs.readFileSync(path.join(root,file),'utf8'));
  await page.waitForFunction(()=>listeners.length>0);
}
async function paints(page){return page.locator('devsite-language-selector').first().evaluate(el=>{
  const button=el.shadowRoot.querySelector('button'),menu=el.shadowRoot.querySelector('[role=menu]');
  return {button:getComputedStyle(button).backgroundColor,text:getComputedStyle(button).color,menu:getComputedStyle(menu).backgroundColor,icon:getComputedStyle(el.shadowRoot.querySelector('svg')).fill};
});}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await page.setContent(`<style>:root{--devsite-background-1:white;--devsite-primary-text-color:#202124;--devsite-secondary-text-color:#5f6368}body{background:white;color:#222}</style><devsite-language-selector><ul><li><a>English</a></li><li><a>中文 – 简体</a></li></ul></devsite-language-selector>`);
  await page.evaluate(()=>{
   const host=document.querySelector('devsite-language-selector'),shadow=host.attachShadow({mode:'open'}),sheet=new CSSStyleSheet();
   sheet.replaceSync('button{background-color:var(--devsite-select-background-color,var(--devsite-background-1));color:var(--devsite-select-color,var(--devsite-primary-text-color))}button:hover{background:var(--devsite-select-background-color-hover,var(--devsite-background-1))}svg{fill:var(--devsite-secondary-text-color)}[role=menu]{background:var(--devsite-background-1)}');
   shadow.adoptedStyleSheets=[sheet];shadow.innerHTML='<button>Language<svg width="20" height="20"><path d="M0 0h20v20H0z"/></svg></button><div role="menu"><slot></slot></div>';
  });
  const original=await paints(page);await inject(page);
  assert.deepEqual(await paints(page),{button:'rgb(0, 0, 0)',text:'rgb(232, 232, 232)',menu:'rgb(0, 0, 0)',icon:'rgb(232, 232, 232)'});
  for(const background of ['#eeeeee','#0d1522']){
   await page.evaluate(background=>update({enabled:true,background}),background);
   const rgb=background==='#eeeeee'?'rgb(238, 238, 238)':'rgb(13, 21, 34)';
   await page.waitForFunction(rgb=>getComputedStyle(document.querySelector('devsite-language-selector').shadowRoot.querySelector('button')).backgroundColor===rgb,rgb);
   const result=await paints(page);assert.equal(result.menu,rgb);assert.equal(result.text,background==='#eeeeee'?'rgb(32, 33, 36)':'rgb(232, 232, 232)');
  }
  await page.evaluate(()=>update({enabled:false}));
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
  assert.deepEqual(await paints(page),original);
  console.log('PASS: shadow language button/menu/icon, dark and light palettes, disable restoration.');
  // Appearance is a separate component, with its own tokens and hover states.
  const appearance=await browser.newPage({reducedMotion:'reduce'});
  await appearance.setContent(`<style>:root{--devsite-background-1:white;--devsite-secondary-text-color:#5f6368;--devsite-background-3:#f1f3f4}body{color:#222}</style><devsite-appearance-selector></devsite-appearance-selector>`);
  await appearance.evaluate(()=>{
    const shadow=document.querySelector('devsite-appearance-selector').attachShadow({mode:'open'}),sheet=new CSSStyleSheet();
    sheet.replaceSync('.toggle{color:var(--devsite-appearance-selector-toggle-color,var(--devsite-secondary-text-color))}.toggle:hover{background:var(--devsite-appearance-selector-toggle-background-hover,var(--devsite-background-3))}.menu{background:var(--devsite-appearance-selector-menu-background,var(--devsite-background-1))}label{display:block;padding:12px;color:var(--devsite-appearance-selector-menu-color,var(--devsite-secondary-text-color))}label:hover{background:var(--devsite-appearance-selector-menu-background-hover,var(--devsite-background-3))}label::before{content:"◐";color:var(--devsite-appearance-selector-menu-color,var(--devsite-secondary-text-color))}');
    shadow.adoptedStyleSheets=[sheet];shadow.innerHTML='<button class="toggle">Appearance</button><ul class="menu"><li><label>Light theme</label></li><li><label>Dark theme</label></li></ul>';
  });
  const appearancePaints=()=>appearance.locator('devsite-appearance-selector').evaluate(el=>{
    const root=el.shadowRoot,label=root.querySelector('label'),button=root.querySelector('button');
    return {menu:getComputedStyle(root.querySelector('.menu')).backgroundColor,text:getComputedStyle(label).color,icon:getComputedStyle(label,'::before').color,hover:getComputedStyle(label).backgroundColor,button:getComputedStyle(button).color,buttonBg:getComputedStyle(button).backgroundColor};
  });
  const originalAppearance=await appearancePaints();await inject(appearance);
  for(const background of ['#111111','#eeeeee']){
    await appearance.evaluate(background=>update({enabled:true,background}),background);
    const rgb=background==='#111111'?'rgb(17, 17, 17)':'rgb(238, 238, 238)',foreground=background==='#111111'?'rgb(232, 232, 232)':'rgb(32, 33, 36)';
    await appearance.waitForFunction(rgb=>getComputedStyle(document.querySelector('devsite-appearance-selector').shadowRoot.querySelector('.menu')).backgroundColor===rgb,rgb);
    const colors=await appearancePaints();assert.equal(colors.menu,rgb);assert.equal(colors.text,foreground);assert.equal(colors.icon,foreground);assert.equal(colors.button,foreground);
    await appearance.locator('devsite-appearance-selector label').first().hover();assert.notEqual((await appearancePaints()).hover,'rgb(241, 243, 244)');
    await appearance.locator('devsite-appearance-selector button').hover();assert.notEqual((await appearancePaints()).buttonBg,'rgb(241, 243, 244)');
  }
  await appearance.mouse.move(1000,700);await appearance.evaluate(()=>update({enabled:false}));await appearance.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
  assert.deepEqual(await appearancePaints(),originalAppearance);await appearance.close();
  console.log('PASS: shadow appearance menu, text/icons, hovered button/options, dark/light palettes and disable restoration.');
  if(process.argv.includes('--live')){
   await page.goto('https://developer.chrome.com/docs/extensions/ai/build-with-ai?hl=zh-CN',{waitUntil:'domcontentloaded'});
   const selector=page.locator('devsite-language-selector').first();await selector.locator('button').waitFor();await inject(page);
   await selector.locator('button').click();await page.waitForTimeout(900);
   const result=await paints(page);assert.equal(result.button,'rgb(0, 0, 0)');assert.equal(result.menu,'rgb(0, 0, 0)');assert.equal(result.text,'rgb(232, 232, 232)');
   await page.screenshot({path:path.join(__dirname,'language-fixed.png')});
   await selector.locator('button').click();await selector.locator('button').click();assert.equal((await paints(page)).menu,'rgb(0, 0, 0)');
   console.log('PASS: live Chrome developer documentation language menu, reopen and screenshot.');
   await selector.locator('button').click();
   const theme=page.locator('devsite-appearance-selector');await theme.locator('button').click();await page.waitForTimeout(400);
   const appearanceColors=await theme.evaluate(el=>{const root=el.shadowRoot;return {menu:getComputedStyle(root.querySelector('.menu')).backgroundColor,text:getComputedStyle(root.querySelector('label')).color};});
   assert.equal(appearanceColors.menu,'rgb(0, 0, 0)');assert.equal(appearanceColors.text,'rgb(232, 232, 232)');
   await theme.locator('label').first().hover({force:true});
   const hover=await theme.locator('label').first().evaluate(el=>getComputedStyle(el).backgroundColor);assert.notEqual(hover,'rgb(255, 255, 255)');
   await page.screenshot({path:path.join(__dirname,'appearance-fixed.png')});
   await theme.locator('button').click();await theme.locator('button').click();assert.equal(await theme.locator('.menu').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
   console.log('PASS: live Chrome developer documentation appearance button/menu, hover, reopen and screenshot.');

  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
