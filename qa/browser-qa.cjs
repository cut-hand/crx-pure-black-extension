const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
(async () => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setContent(`<!doctype html><style>
      body{background:white;color:#111;font:18px Arial;padding:30px}
      .arrow{display:inline-block;width:0;height:0;border:5px solid transparent;border-top-color:#aab1bc}
      .dark-arrow{border-top-color:#222}
      .pseudo::after{content:'';display:inline-block;width:0;height:0;border:5px solid transparent;border-top-color:#222}
      .card{border:1px solid #ddd;background:#eee}
      #pseudo-text::before{content:'Visible text';color:black}
    </style><h1>Pure black compatibility</h1><button>Type <span class="arrow" id="arrow"></span></button>
    <button>Language <span class="arrow dark-arrow" id="dark-arrow"></span></button><button class="pseudo" id="pseudo">Sort</button>
    <p style="color:navy" id="blue">Dark blue text</p><p id="fill" style="color:white;-webkit-text-fill-color:black">Text fill</p>
    <p id="pseudo-text"></p><div class="card" id="card">Neutral card</div><img id="image" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E">
    <button id="green" style="background:green;color:white">New</button>
    <button id="peach" style="background:#ffdbba;color:#e8e8e8"><span id="peach-text">Membership</span></button>
    <button id="gradient-button" style="background:linear-gradient(90deg,#ffe8d2,#ffd5b0);color:#e8e8e8"><span id="gradient-button-text">Gradient membership</span></button>
    <button id="yellow" style="background:#ffff99;color:inherit"><span id="yellow-text">Inherited dark text</span></button>
    <div id="white-region" style="background:#fff;border-radius:12px;width:500px;height:100px;padding:16px"><span id="region-text">Separate white card</span></div>`);
    await page.addStyleTag({content:`
      #neutral-gradient{background:linear-gradient(transparent,#222);height:80px}
      #pseudo-gradient::before{content:'';display:block;height:80px;background:linear-gradient(#eee,#222)}
      #gradient-text{background:linear-gradient(#eee,#111);background-clip:text;color:transparent}
      #layered-gradient{background-image:linear-gradient(#eee,#111),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E")}
    `});
    await page.evaluate(()=>{for(const id of ['neutral-gradient','pseudo-gradient','gradient-text','layered-gradient']){const el=document.createElement('div');el.id=id;el.textContent='Gradient sample';document.body.append(el);}});
    const originalRegion=await page.locator('#white-region').boundingBox();
    await page.evaluate(()=>{
      for(const transparent of [true,false]) {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=24;
        const ctx=canvas.getContext('2d');if(!transparent){ctx.fillStyle='#000';ctx.fillRect(0,0,24,24);}
        ctx.fillStyle='#000';ctx.fillRect(4,4,16,16);ctx.fillStyle='#49c4ff';ctx.fillRect(9,9,2,2);
        const img=document.createElement('img');img.id=transparent?'dark-png':'opaque-png';img.width=img.height=24;img.src=canvas.toDataURL();document.body.append(img);
      }
    });
    await page.locator('#dark-png').evaluate(image=>image.decode());
    await page.locator('#opaque-png').evaluate(image=>image.decode());
    await page.evaluate(() => {
      window.values = {};
      window.listeners = [];
      window.sentMessages=[];
      window.messageListeners=[];
      window.chrome={runtime:{id:'test-extension',onMessage:{addListener:fn=>messageListeners.push(fn)},sendMessage:async message=>{sentMessages.push(message);await update({enabled:values.preferences?.enabled===false});}},storage:{local:{get:async()=>values},onChanged:{addListener:fn=>listeners.push(fn)}}};
      window.update=async preferences=>{values.preferences=preferences;for(const fn of listeners)fn({preferences:{newValue:preferences}},'local');};
    });
    await page.addStyleTag({path:path.join(root,'content.css')});
    await page.addScriptTag({path:path.join(root,'theme.js')});
    await page.addScriptTag({path:path.join(root,'lamp.js')});
    await page.addScriptTag({path:path.join(root,'content.js')});
    await page.waitForSelector('[data-pb-active]');
    const style=(id,prop,pseudo=null)=>page.$eval(id,(el,{prop,pseudo})=>getComputedStyle(el,pseudo)[prop],{prop,pseudo});
    assert.equal(await style('body','backgroundColor'),'rgb(0, 0, 0)');
    assert.equal(await style('#neutral-gradient','backgroundImage'),'none');
    assert.equal(await style('#neutral-gradient','backgroundColor'),'rgb(0, 0, 0)');
    assert.equal(await style('#pseudo-gradient','backgroundImage','::before'),'none');
    assert.equal(await style('#pseudo-gradient','backgroundColor','::before'),'rgba(0, 0, 0, 0)');
    for(const id of ['#gradient-button','#gradient-text','#layered-gradient'])assert.match(await style(id,'backgroundImage'),/gradient/);
    for(const id of ['#arrow','#dark-arrow']) {
      assert.equal(await style(id,'borderLeftColor'),'rgba(0, 0, 0, 0)');
      assert.equal(await style(id,'borderBottomColor'),'rgba(0, 0, 0, 0)');
      assert.notEqual(await style(id,'borderTopColor'),'rgb(0, 0, 0)');
    }
    assert.equal(await style('#dark-arrow','borderTopColor'),'rgb(232, 232, 232)');
    assert.equal(await style('#pseudo','borderLeftColor','::after'),'rgba(0, 0, 0, 0)');
    assert.equal(await style('#pseudo','borderTopColor','::after'),'rgb(232, 232, 232)');
    assert.equal(await style('#blue','color'),'rgb(232, 232, 232)');
    assert.equal(await style('#fill','webkitTextFillColor'),'rgb(232, 232, 232)');
    assert.equal(await style('#pseudo-text','color','::before'),'rgb(232, 232, 232)');
    assert.equal(await style('#green','backgroundColor'),'rgb(0, 128, 0)');
    assert.match(await style('#dark-png','filter'),/drop-shadow/);
    assert.equal(await style('#opaque-png','filter'),'none');
    for(const id of ['#peach-text','#gradient-button-text']) {
      assert.equal(await style(id,'color'),'rgb(32, 33, 36)');
      assert.equal(await style(id,'webkitTextFillColor'),'rgb(32, 33, 36)');
    }
    assert.equal(await style('#yellow-text','color'),'rgb(17, 17, 17)');
    assert.equal(await style('#white-region','outlineWidth'),'1px');
    assert.equal(await style('#region-text','outlineStyle'),'none');
    assert.deepEqual(await page.locator('#white-region').boundingBox(),originalRegion);
    await page.evaluate(()=>{const p=document.createElement('p');p.id='new';p.style.color='black';p.textContent='New';document.body.append(p);});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#new')).color==='rgb(232, 232, 232)');
    await page.evaluate(()=>update({enabled:false}));
    await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
    assert.equal(await style('#dark-arrow','borderTopColor'),'rgb(34, 34, 34)');
    assert.equal(await style('#pseudo','borderTopColor','::after'),'rgb(34, 34, 34)');
    assert.equal(await style('body','backgroundColor'),'rgb(255, 255, 255)');
    assert.match(await style('#neutral-gradient','backgroundImage'),/gradient/);
    assert.match(await style('#pseudo-gradient','backgroundImage','::before'),/gradient/);
    assert.equal(await style('#dark-png','filter'),'none');
    assert.equal(await style('#white-region','outlineStyle'),'none');
    assert.equal(await style('#peach-text','color'),'rgb(232, 232, 232)');
    assert.equal(await page.locator('#peach-text').evaluate(el=>el.style.getPropertyValue('--pb-local-text')),'');
    // Use real browser key events to cover the content-script shortcut fallback.
    await page.keyboard.press('Alt+Shift+KeyD');
    await page.waitForSelector('[data-pb-active]');
    await page.keyboard.press('Alt+Shift+KeyD');
    await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
    assert.equal(await page.evaluate(()=>sentMessages.length),2);
    await page.evaluate(()=>update({enabled:true,mode:'dark'}));
    await page.waitForSelector('[data-pb-active="full"]');
    await page.evaluate(()=>update({enabled:true,background:'#0d1522'}));
    await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(13, 21, 34)');
    assert.equal(await style('#card','backgroundColor'),'rgb(13, 21, 34)');
    assert.equal(await style('#neutral-gradient','backgroundColor'),'rgb(13, 21, 34)');
    assert.equal(await style('#pseudo-gradient','backgroundColor','::before'),'rgba(0, 0, 0, 0)');
    assert.equal(await style('#green','backgroundColor'),'rgb(0, 128, 0)');
    await page.evaluate(()=>update({enabled:true,background:'#eeeeee'}));
    await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(238, 238, 238)');
    assert.equal(await style('#fill','webkitTextFillColor'),'rgb(0, 0, 0)');
    await page.evaluate(()=>update({enabled:false,background:'#eeeeee'}));
    await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
    assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--pb-background')),'');
    await page.waitForSelector('[data-pb-ui="lamp"]',{state:'detached'});
    await page.evaluate(()=>update({enabled:true,background:'#111111'}));
    await page.waitForSelector('[data-pb-ui="lamp"]');
    assert.equal(await page.locator('[data-pb-ui="toast"]').count(),0);
    const lampBox=await page.locator('[data-pb-ui="lamp"]').boundingBox();
    assert.equal(lampBox.width,page.viewportSize().width);
    assert.equal(lampBox.height,page.viewportSize().height);
    assert.equal(await page.locator('[data-pb-ui="lamp"]').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.locator('[data-pb-ui="lamp"]').evaluate(el=>{
      for(const node of el.shadowRoot.querySelectorAll('*'))for(const animation of node.getAnimations()) {animation.pause();animation.currentTime=500;}
    });
    await page.screenshot({path:'qa/lamp-off.png'});
    await page.waitForSelector('[data-pb-active="full"]');
    await page.waitForSelector('[data-pb-ui="lamp"]',{state:'detached'});
    await page.evaluate(()=>update({enabled:false}));
    await page.waitForSelector('[data-pb-ui="lamp"]');
    assert.equal(await page.locator('[data-pb-ui="lamp"]').evaluate(el=>el.shadowRoot.querySelector('.scene').classList.contains('on')),true);
    await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-pb-active'));
    await page.waitForSelector('[data-pb-ui="lamp"]',{state:'detached'});
    // A new switch interrupts the first animation without applying stale state.
    await page.evaluate(()=>update({enabled:true}));
    await page.waitForSelector('[data-pb-ui="lamp"]');
    await page.evaluate(()=>update({enabled:false}));
    await page.waitForFunction(()=>document.querySelector('[data-pb-ui="lamp"]')?.shadowRoot.querySelector('.scene').classList.contains('on'));
    assert.equal(await page.locator('[data-pb-ui="lamp"]').count(),1);
    await page.waitForSelector('[data-pb-ui="lamp"]',{state:'detached'});
    assert.equal(await page.locator('[data-pb-active]').count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>update({enabled:true}));
    await page.waitForSelector('[data-pb-ui="lamp"]');
    await page.waitForSelector('[data-pb-active="full"]');
    await page.waitForSelector('[data-pb-ui="lamp"]',{state:'detached'});
    await page.emulateMedia({reducedMotion:'no-preference'});
    // Strict page security must not reject animation markup or inline styles.
    const secure=await browser.newPage();
    await secure.setContent('<!doctype html><body>Strict security fixture</body>');
    for(const file of ['theme.js','lamp.js'])await secure.addScriptTag({path:path.join(root,file)});
    await secure.evaluate(()=>{
      const meta=document.createElement('meta');meta.httpEquiv='Content-Security-Policy';meta.content="require-trusted-types-for 'script'; style-src 'none'";document.head.append(meta);
      window.committed=false;PureBlackLamp.play({dark:true,color:'#000000',commit:()=>{window.committed=true;}});
    });
    await secure.waitForSelector('[data-pb-ui="lamp"]');
    assert.equal(await secure.locator('[data-pb-ui="lamp"]').evaluate(el=>el.shadowRoot.adoptedStyleSheets[0].cssRules.length>0),true);
    await secure.waitForFunction(()=>committed);
    await secure.waitForSelector('[data-pb-ui="lamp"]',{state:'detached'});
    assert.deepEqual(errors,[]);

    // Rasterize the original vector mascot for Chromium toolbar icon sizes.
    const asset = await browser.newPage();
    for(const face of ['awake','asleep']) for(const size of [16,32,48,128]) {
      await asset.setViewportSize({width:size,height:size});
      await asset.goto(pathToFileURL(path.join(root,`icons/${face}.svg`)).href);
      // Fill the toolbar cell; popup mascots keep their original spacing.
      await asset.evaluate(()=>document.documentElement.setAttribute('viewBox','12 11 104 98'));
      await asset.screenshot({path:path.join(root,`icons/${face}-${size}.png`),omitBackground:true});
    }
    const popup = await browser.newPage({viewport:{width:330,height:700},deviceScaleFactor:2});
    await popup.exposeFunction('saveToContentPage',async values=>page.evaluate(values=>{
      Object.assign(window.values,values);
      for(const fn of listeners)fn(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])),'local');
    },values));
    await popup.exposeFunction('sendToContentPage',async message=>page.evaluate(message=>new Promise(resolve=>messageListeners[0](message,{id:'test-extension'},resolve)),message));
    popup.on('pageerror',e=>errors.push(e.message));
    await popup.addInitScript(()=>{
      window.saved={};window.changeListeners=[];window.testShortcut=new URL(location.href).searchParams.get('shortcut')||'';
      window.opened=[];
      window.chrome={commands:{getAll:async()=>[{name:'toggle-pure-black',shortcut:window.testShortcut}]},tabs:{sendMessage:async(id,message)=>sendToContentPage(message),create:async value=>opened.push(value),query:async()=>[{id:1,url:'https://github.com/user/project'}]},storage:{local:{get:async()=>saved,set:async values=>{Object.assign(saved,values);await saveToContentPage(values);for(const fn of changeListeners)fn(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])),'local');}},onChanged:{addListener:fn=>changeListeners.push(fn)}}};
    });
    await popup.goto(pathToFileURL(path.join(root,'popup.html')).href);
    await popup.waitForFunction(()=>document.querySelector('#host').textContent==='github.com');
    await popup.locator('#mascot').evaluate(img=>img.decode());
    const brandLayout=await popup.evaluate(()=>{const logo=document.querySelector('#mascot').getBoundingClientRect(),title=document.querySelector('h1').getBoundingClientRect();return {logoRight:logo.right,titleLeft:title.left,overlap:logo.bottom>title.top&&logo.top<title.bottom};});
    assert.ok(brandLayout.logoRight<brandLayout.titleLeft&&brandLayout.overlap,'Logo must sit to the left of the title');
    const shortcutLayout=await popup.evaluate(()=>{const logo=document.querySelector('#mascot').getBoundingClientRect(),key=document.querySelector('#shortcut-status').getBoundingClientRect();return {aligned:Math.abs((logo.top+logo.bottom-key.top-key.bottom)/2)<1,right:key.right,scroll:document.body.scrollWidth};});
    assert.ok(shortcutLayout.aligned&&shortcutLayout.right<=330&&shortcutLayout.scroll===330,'Shortcut must align with the mascot without horizontal overflow');
    const height=await popup.evaluate(()=>document.body.scrollHeight);
    assert.ok(height<=600,`Popup height ${height} exceeds Chromium's 600px limit`);
    await popup.setViewportSize({width:330,height});
    await popup.waitForTimeout(200);
    await popup.screenshot({path:'qa/popup-on.png',animations:'disabled',scale:'css'});
    assert.equal(await popup.$eval('#mascot',el=>el.getAttribute('src')),'icons/awake.svg');
    await popup.uncheck('#enabled');
    await popup.waitForFunction(()=>document.querySelector('#mascot').getAttribute('src')==='icons/asleep.svg');
    await popup.locator('#mascot').evaluate(img=>img.decode());
    assert.equal(await popup.$eval('#state-pill',el=>el.textContent),'休息中');
    assert.equal(await popup.isChecked('#enabled'),false);
    await popup.screenshot({path:'qa/popup-off.png',animations:'disabled',scale:'css'});
    assert.equal(await popup.locator('#mode').count(),0);
    assert.equal(await popup.locator('#shadows').count(),0);
    assert.equal(await popup.evaluate(()=>saved.preferences.mode),'full');
    await popup.locator('[data-color="#0d1522"]').click();
    await popup.waitForFunction(()=>saved.preferences.background==='#0d1522');
    await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(13, 21, 34)');
    await popup.waitForFunction(()=>document.querySelector('#status').textContent==='已应用到当前网页');
    assert.equal(await popup.isChecked('#enabled'),true);
    assert.equal(await popup.locator('[data-color="#0d1522"]').getAttribute('aria-pressed'),'true');
    await popup.locator('#hex-color').fill('#123456');
    await popup.waitForFunction(()=>saved.preferences.background==='#123456');
    await popup.locator('#darkness').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await popup.waitForFunction(()=>saved.preferences.background==='#000000');
    await popup.locator('#darkness').evaluate(el=>{el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await popup.waitForFunction(()=>saved.preferences.background!=='#000000');
    const newShade=await popup.evaluate(()=>PureBlackTheme.hsl(saved.preferences.background));
    assert.ok(Math.abs(newShade.l-.3)<.005);
    assert.ok(newShade.s>.5,'Hue and saturation should survive dragging to black and back');
    const previousColor=await popup.evaluate(()=>saved.preferences.background);
    await popup.locator('#hex-color').fill('invalid');
    assert.equal(await popup.evaluate(()=>saved.preferences.background),previousColor);
    await popup.locator('#hex-color').blur();
    // Selecting pure black after pine green resets saturation. Slider movement
    // must produce neutral gray, in both saved settings and the rendered page.
    await popup.locator('[data-color="#101b18"]').click();
    await popup.waitForFunction(()=>saved.preferences.background==='#101b18');
    await popup.locator('[data-color="#000000"]').click();
    await popup.waitForFunction(()=>saved.preferences.background==='#000000');
    await popup.locator('#darkness').evaluate(el=>{el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await popup.waitForFunction(()=>saved.preferences.background==='#4d4d4d');
    await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(77, 77, 77)');
    assert.equal(await popup.locator('#hex-color').inputValue(),'#4D4D4D');
    await popup.locator('[data-color="#000000"]').click();
    await popup.waitForFunction(()=>saved.preferences.background==='#000000');
    const savedPreferences=await popup.evaluate(()=>JSON.parse(JSON.stringify(saved.preferences)));
    await popup.addInitScript(value=>{saved.preferences=value;},savedPreferences);
    await popup.reload();
    await popup.waitForFunction(()=>document.querySelector('#host').textContent==='github.com');
    assert.equal(await popup.locator('#hex-color').inputValue(),'#000000');
    assert.match(await popup.locator('#shortcut-status').textContent(),/未绑定/);
    for(const shortcut of ['Alt+Shift+D','⌥⇧D']) {
      await popup.goto(`${pathToFileURL(path.join(root,'popup.html')).href}?shortcut=${encodeURIComponent(shortcut)}`);
      await popup.waitForFunction(shortcut=>document.querySelector('#shortcut-status').textContent===shortcut,shortcut);
      assert.equal(await popup.locator('#shortcut-status').textContent(),shortcut);
      const fits=await popup.evaluate(()=>{const button=document.querySelector('#shortcut-status').getBoundingClientRect(),title=document.querySelector('.hero-title').getBoundingClientRect();return button.left>=title.right&&button.right<=330&&document.body.scrollWidth===330;});
      assert.ok(fits,`Platform shortcut ${shortcut} must fit the compact popup`);
      await popup.waitForTimeout(200);
      await popup.screenshot({path:shortcut.includes('Alt')?'qa/popup-windows.png':'qa/popup-mac.png',animations:'disabled',scale:'css'});
    }

    await popup.locator('#shortcut-status').click();
    assert.equal(await popup.evaluate(()=>opened.at(-1).url),'chrome://extensions/shortcuts');
    await popup.uncheck('#site');
    await popup.waitForFunction(()=>saved['site:github.com']===false);
    // A storage event from the keyboard command also updates the visible logo.
    await popup.evaluate(()=>chrome.storage.local.set({preferences:{enabled:true,mode:'dark',shadows:false}}));
    await popup.waitForFunction(()=>document.querySelector('#mascot').getAttribute('src')==='icons/awake.svg');
    assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const vm=require('node:vm');
    const store={preferences:{enabled:true,mode:'dark',shadows:false}};
    let onCommand, onStorage, onMessage;const iconCalls=[];
    vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),{console,chrome:{
      commands:{onCommand:{addListener:fn=>onCommand=fn}},
      runtime:{id:'test-extension',onMessage:{addListener:fn=>onMessage=fn}},
      tabs:{query:async()=>[{id:1}],sendMessage:async()=>({ok:true})},
      action:{setIcon:async v=>iconCalls.push(v),setTitle:async()=>{}},
      storage:{onChanged:{addListener:fn=>onStorage=fn},local:{get:async()=>structuredClone(store),set:async v=>{Object.assign(store,v);onStorage({preferences:{newValue:v.preferences}},'local');}}}
    }});
    await new Promise(r=>setTimeout(r,0));
    assert.match(iconCalls.at(-1).path[16],/awake/);
    onCommand('toggle-pure-black');await new Promise(r=>setTimeout(r,0));
    assert.equal(store.preferences.enabled,false);assert.match(iconCalls.at(-1).path[16],/asleep/);
    onCommand('toggle-pure-black');await new Promise(r=>setTimeout(r,0));
    assert.equal(store.preferences.enabled,true);assert.match(iconCalls.at(-1).path[16],/awake/);
    // A duplicate DOM event must not undo a native shortcut event.
    await new Promise(resolve=>onMessage({type:'pb-toggle'},{id:'test-extension',tab:{id:1}},resolve));
    assert.equal(store.preferences.enabled,true);
    assert.equal(store.preferences.mode,'full');
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
    for(const file of [...Object.values(manifest.icons),...Object.values(manifest.action.default_icon)])assert.ok(fs.existsSync(path.join(root,file)));
    assert.equal(manifest.commands['toggle-pure-black'].suggested_key.default,'Alt+Shift+D');
    assert.deepEqual(errors,[]);
    console.log('PASS: CSS border triangles including pseudo-elements, transparent edges, dark text, dynamic content, restore, popup controls, both mascot states, toolbar icons, shortcut state synchronization, icon assets, popup layout.');
    console.log('PASS: palette presets, custom hex, darkness slider, hue preservation, invalid input, saved color reload, page color application, bright color contrast, logo to the left of title.');
    console.log('PASS: popup-to-page live color preview, selection activates paused coloring, full-size toolbar assets.');
    console.log('PASS: colored button contrast, card outline with stable geometry, local styles restored.');
    console.log('PASS: full-page lamp, cleanup, rapid reversal, reduced-motion visibility, strict Trusted Types and CSP compatibility.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
