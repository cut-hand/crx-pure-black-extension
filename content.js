(() => {
  'use strict';
  const defaults = { enabled: true, mode: 'full', shadows: true, background:'#000000' };
  let palette = PureBlackTheme.theme('#000000'), reloadTimer;
  const originalVariables = new Map();
  const themeVariables = ['--pb-background','--pb-foreground','--pb-border','--pb-color-scheme'];
  const siteKey = `site:${location.hostname}`;
  const youtubeHost = /(^|\.)youtube(?:-nocookie)?\.com$/.test(location.hostname);
  // Embedded YouTube controls can be siblings of the video player. Treat the
  // entire embed document as media so paused/hover overlays also stay intact.
  const youtubeEmbed = youtubeHost && /^\/embed(?:\/|$)/.test(location.pathname);
  const attrs = ['data-pb-bg', 'data-pb-fg', 'data-pb-border', 'data-pb-shadow', 'data-pb-fill', 'data-pb-before', 'data-pb-after', 'data-pb-before-bg', 'data-pb-after-bg', 'data-pb-svg', 'data-pb-wallpaper', 'data-pb-region', 'data-pb-icon', 'data-pb-raster', 'data-pb-gradient', 'data-pb-before-gradient', 'data-pb-after-gradient'];
  for (const pseudo of ['', '-before', '-after']) for (const side of ['top', 'right', 'bottom', 'left']) {
    attrs.push(`data-pb${pseudo}-border-${side}`, `data-pb${pseudo}-arrow-${side}`);
  }
  const skip = 'img,video,audio,canvas,svg,svg *,picture,iframe,object,embed,script,style,link,meta,source';
  let settings = { ...defaults }, active = false, observer, timer, lastScan = 0;
  const marked = new Map();
  const localStyles = new Map();
  const outlineImages = new Map();
  const rasterSamples=new WeakMap();
  const colorCache=new Map();
  const contrastCache=new Map(), foregroundCache=new Map();
  const darkText=PureBlackTheme.rgb('#202124'), lightText=PureBlackTheme.rgb('#e8e8e8');
  function sampleRaster(image) {
    const source=image.currentSrc||image.src,cached=rasterSamples.get(image);
    if(cached?.source===source)return cached.samples;
    if(!image.complete||!image.naturalWidth)return null;
    let samples=null;
    try {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=24;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,24,24);
      const pixels=ctx.getImageData(0,0,24,24).data,opaque=[];let transparent=0;
      for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<24)transparent++;else opaque.push({r:pixels[i],g:pixels[i+1],b:pixels[i+2],a:pixels[i+3]/255});}
      if(transparent>24&&opaque.length>8)samples=opaque;
    }catch{/* Cross-origin photos remain untouched; no extra network requests. */}
    rasterSamples.set(image,{source,samples});return samples;
  }
  let transitionTarget=null, transitionValues=null;
  function update(values,animate=false) {
    const target=(values.preferences?.enabled??true)&&values[siteKey]!==false&&!youtubeEmbed;
    if(transitionTarget!==null&&target===transitionTarget){transitionValues=values;return;}
    if((animate&&target!==active)||transitionTarget!==null) {
      transitionTarget=target;transitionValues=values;
      PureBlackLamp.play({dark:target,color:values.preferences?.background,commit:()=>{
        const finalValues=transitionValues;transitionTarget=null;transitionValues=null;apply(finalValues);
      }});
    } else apply(values);
  }
  let colorContext;
  function color(value) {
    if(colorCache.has(value))return colorCache.get(value);
    const parsed=parseColor(value);colorCache.set(value,parsed);return parsed;
  }
  function parseColor(value) {
    const m = value.match(/^rgba?\(([^)]+)\)$/);
    if (!m) {
      // Modern sites can return oklch(), lab() or color(display-p3 ...) from
      // computed styles. Convert those to sRGB before testing contrast.
      if (!value || !CSS.supports('color', value)) return null;
      colorContext ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      colorContext.clearRect(0, 0, 1, 1);
      colorContext.fillStyle = value;
      colorContext.fillRect(0, 0, 1, 1);
      const [r,g,b,a] = colorContext.getImageData(0, 0, 1, 1).data;
      return { r,g,b,a:a/255 };
    }
    const n = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 };
  }
  function neutral(c) { return c && Math.max(c.r,c.g,c.b) - Math.min(c.r,c.g,c.b) <= 24; }
  function brightness(c) { return (c.r * .2126 + c.g * .7152 + c.b * .0722); }
  function composite(c,bg) {
    const alpha=c?.a??0;
    return {r:(c?.r??0)*alpha+bg.r*(1-alpha),g:(c?.g??0)*alpha+bg.g*(1-alpha),b:(c?.b??0)*alpha+bg.b*(1-alpha),a:1};
  }
  function needsLight(c, bg = palette.bg) {
    if (!c || c.a <= .05) return false;
    const key=`${c.r},${c.g},${c.b},${c.a}|${bg.r},${bg.g},${bg.b}`;
    if(!contrastCache.has(key))contrastCache.set(key,PureBlackTheme.contrast(composite(c,bg),bg)<4.5);
    return contrastCache.get(key);
  }
  function foreground(bg) {
    const key=`${bg.r},${bg.g},${bg.b}`;
    if(!foregroundCache.has(key))foregroundCache.set(key,PureBlackTheme.contrast(darkText,bg)>PureBlackTheme.contrast(lightText,bg)?'#202124':'#e8e8e8');
    return foregroundCache.get(key);
  }
  function neutralGradient(style) {
    if(!style.backgroundImage.includes('gradient(')||style.backgroundImage.includes('url(')||style.backgroundClip.includes('text'))return false;
    const stops=(style.backgroundImage.match(/(?:rgba?|oklch|oklab|lab|lch|color)\([^)]*\)/g)||[]).map(color);
    const visible=stops.filter(c=>c&&c.a>.05);
    return visible.length>0&&stops.every(c=>c&&(c.a<=.05||neutral(c)));
  }
  function surfaceWallpaper(el, style) {
    if (location.hostname === 'fanyi.youdao.com') return el.matches('.web-frame-content-scroll-container.index-bg');
    if (location.hostname !== 'music.163.com') return false;
    // NetEase paints its columns and several panels with light PNG skins.
    // Match both the surface and its asset, since the same sprite also holds
    // colored controls and icons that must remain intact.
    const image = style.backgroundImage;
    if (el.matches('.g-bd1,.g-bd2,.g-bd3,.g-bd4,.g-bd5,.g-bd6,.g-bd10')) {
      return /^url\("https?:\/\/s[\d]+\.music\.126\.net\/style\/web2\/img\/frame\/wrap(?:[1-6]|10)\.png(?:\?[^"\s]*)?"\)$/.test(image);
    }
    if (el.matches('.n-myinfo')) return /^url\("https?:\/\/s[\d]+\.music\.126\.net\/style\/web2\/img\/index\/index\.png(?:\?[^"\s]*)?"\)$/.test(image);
    if (el.matches('.n-bilst')) return /^url\("https?:\/\/s[\d]+\.music\.126\.net\/style\/web2\/img\/index\/index_bill\.png(?:\?[^"\s]*)?"\)$/.test(image);
    if (el.matches('.m-table th,.m-table th .wp,.m-table td')) return /^url\("https?:\/\/s[\d]+\.music\.126\.net\/style\/web2\/img\/table\.png(?:\?[^"\s]*)?"\)$/.test(image);
    return false;
  }
  function visibleBackground(style,parentBg,changeBg,wallpaper=false) {
    if(changeBg||wallpaper) return {bg:palette.bg,known:true};
    let bg=composite(color(style.backgroundColor),parentBg);
    if(style.backgroundImage==='none'||style.backgroundClip.includes('text')) return {bg,known:true};
    // Inline SVGs used only to draw a dashed outline have transparent centers.
    // They must not make the text inside the drop zone an unknown image surface.
    if(!outlineImages.has(style.backgroundImage)) {
      let transparentOutline=false;
      const data=style.backgroundImage.match(/^url\("data:image\/svg\+xml[^,]*,([^"]*)"\)$/);
      if(data)try{
        const svg=new DOMParser().parseFromString(decodeURIComponent(data[1]),'image/svg+xml');
        const shapes=[...svg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')];
        transparentOutline=shapes.length>0&&!svg.querySelector('parsererror,image,text,foreignObject,use')&&shapes.every(shape=>shape.tagName==='line'||['none','transparent'].includes(shape.getAttribute('fill')||shape.closest('[fill]')?.getAttribute('fill')));
      }catch{}
      outlineImages.set(style.backgroundImage,transparentOutline);
    }
    if(outlineImages.get(style.backgroundImage))return {bg,known:true};
    if(!style.backgroundImage.includes('url(')) {
      const stops=(style.backgroundImage.match(/(?:rgba?|oklch|lab|color)\([^)]*\)/g)||[]).map(color).filter(Boolean);
      if(stops.length) {
        const samples=stops.map(c=>composite(c,bg));
        bg={r:0,g:0,b:0,a:1};
        for(const c of samples) for(const channel of ['r','g','b']) bg[channel]+=c[channel]/samples.length;
        return {bg,known:true};
      }
    }
    return {bg,known:false};
  }
  function borders(style, flags, blackSurface, pseudo = '', bg = palette.bg, paints = []) {
    const sides = ['top', 'right', 'bottom', 'left'];
    const widths = sides.map(side => parseFloat(style.getPropertyValue(`border-${side}-width`)));
    if(!widths.some(width=>width>0))return;
    const triangle = parseFloat(style.width) === 0 && parseFloat(style.height) === 0 &&
      widths.some(width=>width>0);
    for (let i = 0; i < sides.length; i++) {
      if(widths[i]===0)continue;
      const side = sides[i], c = color(style.getPropertyValue(`border-${side}-color`));
      if (!c || c.a <= .05) continue;
      // A CSS triangle depends on transparent borders. Never overwrite all four
      // edges with one border-color; only adjust its painted edge for contrast.
      if (triangle) {
        if (blackSurface && needsLight(c,bg)) { flags.push(`data-pb${pseudo}-arrow-${side}`); paints.push([`--pb${pseudo}-arrow-${side}`,foreground(bg)]); }
      } else if (settings.mode === 'full' && blackSurface && neutral(c) && brightness(c) > 100) {
        flags.push(`data-pb${pseudo}-border-${side}`);
      }
    }
  }
  function clearMarks() {
    for(const [el,properties] of localStyles) for(const [name,[value,priority]] of properties) {
      if(value) el.style.setProperty(name,value,priority); else el.style.removeProperty(name);
    }
    localStyles.clear();
    for (const [el,flags] of marked) for (const attr of flags) el.removeAttribute(attr);
    marked.clear();
  }
  function applyPaints(el,paints) {
    if(!paints.length)return;
    const originals=new Map();
    for(const [name,value] of paints) {
      originals.set(name,[el.style.getPropertyValue(name),el.style.getPropertyPriority(name)]);
      el.style.setProperty(name,value,'important');
    }
    localStyles.set(el,originals);
  }
  function scan() {
    timer = null;
    if (!active || !document.documentElement) return;
    if (document.hidden) { observe(); return; }
    lastScan = performance.now();
    colorCache.clear();
    contrastCache.clear();foregroundCache.clear();
    observer?.disconnect();
    // Measure settled site colors rather than a CSS transition's middle frame.
    document.documentElement.setAttribute('data-pb-measuring','');
    // Restore before measuring so decisions always use the site's own styles.
    clearMarks();
    const decisions = [];
    const surface = new WeakMap();
    const originalSurface = new WeakMap();
    const adaptedIcons=new Set();
    // Keep the player's own text paints so ancestor recoloring cannot leak in.
    // Its video, translucent overlays, gradients and controls remain untouched.
    if(youtubeHost)for(const player of document.querySelectorAll('.html5-video-player')){
      const style=getComputedStyle(player);
      decisions.push([player,['data-pb-fg','data-pb-fill'],[['--pb-local-text',style.color],['--pb-local-fill',style.webkitTextFillColor===style.color?'currentColor':style.webkitTextFillColor]]]);
    }
    // Prune independent media/UI subtrees instead of allocating and visiting a
    // flat list of every descendant on each pass.
    const walker=document.createTreeWalker(document,NodeFilter.SHOW_ELEMENT,{acceptNode:el=>
      el.hasAttribute('data-pb-ui')||(youtubeHost&&el.matches('.html5-video-player'))?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT
    });
    for(let el=walker.nextNode();el;el=walker.nextNode()) {
      if(el.matches('img')) {
        const source=el.currentSrc||el.src;
        // This site's footer cat is an external SVG image rather than inline
        // markup. A halo works without reading cross-origin pixels or recoloring it.
        const knownDarkLogo=location.hostname==='music-theory.aizcutei.com'&&source==='https://soundquest.jp/files/svg/logo_plugmon_monster.svg';
        if(!knownDarkLogo&&!/\.png(?:$|[?#])|^data:image\/png/i.test(source))continue;
        const rect=el.getBoundingClientRect(),parent=surface.get(el.parentElement)||{bg:palette.bg,known:true};
        if(rect.width>0&&rect.width<=128&&rect.height>0&&rect.height<=128&&parent.known) {
          const samples=sampleRaster(el),bg=visibleBackground(getComputedStyle(el),parent.bg,false).bg;
          if(foreground(bg)==='#e8e8e8'&&(knownDarkLogo||(samples&&samples.filter(c=>needsLight(c,bg)).length/samples.length>.6))) {
            const original=getComputedStyle(el).filter;
            decisions.push([el,['data-pb-raster'],[['--pb-raster-filter',`${original==='none'?'':original+' '}drop-shadow(0 0 1px rgba(240,248,255,.95)) drop-shadow(0 0 2px rgba(240,248,255,.55))`]]]);
          }
        }
        continue;
      }
      if(el.ownerSVGElement&&adaptedIcons.has(el.closest('svg')))continue;
      if(el.matches('svg')) {
        const rect=el.getBoundingClientRect(),parent=surface.get(el.parentElement)||{bg:palette.bg,known:true};
        if(rect.width>0&&rect.width<=128&&rect.height>0&&rect.height<=128&&parent.known&&foreground(parent.bg)==='#e8e8e8'&&!el.querySelector('image,foreignObject,linearGradient,radialGradient')) {
          const shapes=[...el.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line,use')];
          const paints=shapes.flatMap(shape=>{const s=getComputedStyle(shape);return [s.fill,s.stroke];}).filter(value=>value!=='none').map(color).filter(c=>c&&c.a>.05);
          if(paints.length&&paints.every(neutral)&&paints.some(c=>needsLight(c,parent.bg))) {
            const original=getComputedStyle(el);
            decisions.push([el,['data-pb-icon'],[['--pb-icon-filter',`${original.filter==='none'?'':original.filter+' '}invert(1)`],['--pb-icon-color',original.color]]]);
            adaptedIcons.add(el);
          }
        }
        continue;
      }
      const svgText = el.matches('svg text, svg tspan');
      if (el.matches(skip) && !svgText) continue;
      const style = getComputedStyle(el);
      const bg = color(style.backgroundColor), fg = color(style.color);
      const ownSurface = bg && bg.a >= .5;
      const wallpaper = surfaceWallpaper(el, style);
      const flattenGradient=neutralGradient(style);
      const hasImage = style.backgroundImage !== 'none' && !wallpaper && !flattenGradient;
      const parent = svgText ? el.closest('svg').parentElement : el.parentElement;
      const parentSurface=surface.get(parent)||{bg:palette.bg,known:true};
      const parentOriginal=originalSurface.get(parent)||palette.bg;
      originalSurface.set(el,composite(bg,parentOriginal));
      const flags = [], paints=[];
      const changeBg=flattenGradient||(neutral(bg)&&bg.a>.05&&!hasImage);
      if(flattenGradient)flags.push('data-pb-gradient');
      if (wallpaper) flags.push('data-pb-wallpaper', 'data-pb-bg');
      if (changeBg) flags.push(attrs[0]);
      const resolved=visibleBackground(style,parentSurface.bg,changeBg,wallpaper);
      // Section headings share the index sprite, but only paint a small red
      // decoration. Their text sits on the parent surface, not on a photo.
      if(location.hostname==='music.163.com'&&el.matches('.v-hd2')&&/^url\("https?:\/\/s[\d]+\.music\.126\.net\/style\/web2\/img\/index\/index\.png(?:\?[^"\s]*)?"\)$/.test(style.backgroundImage))resolved.known=parentSurface.known;
      if(!ownSurface&&!hasImage&&!parentSurface.known)resolved.known=false;
      surface.set(el,resolved);
      const preserveSurface=!changeBg&&!wallpaper&&(hasImage||(!neutral(bg)&&ownSurface)||parentSurface.preserve);
      resolved.preserve=preserveSurface;
      const textPaint=(value,attribute,variable,target=resolved) => {
        const c=color(value);
        if(!c||c.a<=.05)return;
        // Preserve an explicit local paint on colored/image surfaces so a
        // recolored ancestor cannot turn dark button text into inherited white.
        if((target.known&&needsLight(c,target.bg))||preserveSurface) {
          flags.push(attribute);
          paints.push([variable,target.known&&needsLight(c,target.bg)?foreground(target.bg):value]);
        }
      };
      textPaint(style.color,attrs[1],'--pb-local-text');
      textPaint(style.webkitTextFillColor,'data-pb-fill','--pb-local-fill');
      if(svgText)textPaint(style.fill,'data-pb-svg','--pb-local-svg');
      // Outline only substantial surfaces that lost their original separation.
      // An inset outline leaves dimensions and content flow unchanged.
      if(changeBg&&ownSurface&&!el.matches('html,body')&&/^(block|flex|grid|inline-block|table|flow-root)/.test(style.display)) {
        const width=parseFloat(style.width),height=parseFloat(style.height);
        const difference=Math.abs(bg.r-parentOriginal.r)+Math.abs(bg.g-parentOriginal.g)+Math.abs(bg.b-parentOriginal.b);
        const shaped=parseFloat(style.borderTopLeftRadius)>0||style.boxShadow!=='none';
        const edges=['Top','Right','Bottom','Left'];
        const alreadyBordered=edges.every(side=>parseFloat(style[`border${side}Width`])>0&&(color(style[`border${side}Color`])?.a??0)>.05);
        if(width>=80&&height>=40&&!alreadyBordered&&(difference>=12||shaped))flags.push('data-pb-region');
      }
      if (!svgText) for (const pseudo of ['before', 'after']) {
        const ps = getComputedStyle(el, `::${pseudo}`);
        if (ps.content === 'none' || ps.content === 'normal') continue;
        const pb = color(ps.backgroundColor);
        const pseudoGradient=neutralGradient(ps);
        const pseudoImage = ps.backgroundImage !== 'none'&&!pseudoGradient;
        // Fade overlays must remain transparent after removing the gradient;
        // an opaque replacement would cover carousel cards and their labels.
        const pseudoChange = !pseudoImage && neutral(pb) && pb.a > .05;
        if(pseudoGradient)flags.push(`data-pb-${pseudo}-gradient`);
        if (pseudoChange) flags.push(`data-pb-${pseudo}-bg`);
        const pseudoSurface=visibleBackground(ps,resolved.bg,pseudoChange);
        if(pseudoSurface.known&&(needsLight(color(ps.color),pseudoSurface.bg)||needsLight(color(ps.webkitTextFillColor),pseudoSurface.bg))) {
          flags.push(`data-pb-${pseudo}`);
          paints.push([`--pb-${pseudo}-text`,needsLight(color(ps.color),pseudoSurface.bg)?foreground(pseudoSurface.bg):ps.color]);
          paints.push([`--pb-${pseudo}-fill`,needsLight(color(ps.webkitTextFillColor),pseudoSurface.bg)?foreground(pseudoSurface.bg):ps.webkitTextFillColor]);
        }
        borders(ps, flags, pseudoSurface.known, `-${pseudo}`,pseudoSurface.bg,paints);
      }
      borders(style, flags, resolved.known,'',resolved.bg,paints);
      if (settings.shadows && !preserveSurface && (style.boxShadow !== 'none' || style.textShadow !== 'none')) {
        const smallIcon = !el.textContent.trim() && parseFloat(style.width) <= 24 && parseFloat(style.height) <= 24;
        if(!smallIcon)flags.push(attrs[3]);
      }
      if (flags.length) decisions.push([el, flags, paints]);
    }
    for (const [el, flags, paints] of decisions) {
      for (const attr of flags) el.setAttribute(attr, '');
      applyPaints(el,paints);
      marked.set(el,flags);
    }
    void document.documentElement.offsetHeight;
    document.documentElement.removeAttribute('data-pb-measuring');
    observe();
  }
  function schedule() {
    if (active && !document.hidden && !timer) timer = setTimeout(scan, Math.max(120, 700 - (performance.now() - lastScan)));
  }
  function protectedRegion(el) {
    return el.closest('[data-pb-ui]')||(youtubeHost&&el.closest('.html5-video-player'));
  }
  function relevantMutation(record) {
    const el=record.target.nodeType===Node.ELEMENT_NODE?record.target:record.target.parentElement;
    if(!el?.isConnected||protectedRegion(el))return false;
    // Existing text changing from "1" to "2" doesn't change its paints. Keep
    // empty/non-empty transitions and stylesheet edits, which can affect CSS.
    if(record.type==='characterData'&&!el.closest('style')){
      const before=record.oldValue||'', after=record.target.textContent||'';
      return (before.length===0)!==(after.length===0)||Boolean(before.trim())!==Boolean(after.trim());
    }
    return true;
  }
  function observe() {
    if (active && document.documentElement) observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, characterDataOldValue: true, attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode', 'href', 'src', 'srcset']
    });
  }
  function apply(values) {
    settings = { ...defaults, ...(values.preferences || {}), mode: 'full' };
    active = settings.enabled && values[siteKey] !== false && !youtubeEmbed;
    observer?.disconnect();
    clearTimeout(timer); timer = null;
    clearMarks();
    if (active) {
      palette = PureBlackTheme.theme(settings.background);
      const variables = [palette.background,palette.foreground,palette.border,palette.scheme];
      themeVariables.forEach((name,i) => {
        if (!originalVariables.has(name)) originalVariables.set(name,[document.documentElement.style.getPropertyValue(name),document.documentElement.style.getPropertyPriority(name)]);
        document.documentElement.style.setProperty(name,variables[i],'important');
      });
      document.documentElement.setAttribute('data-pb-active', settings.mode);
      scan();
    } else {
      document.documentElement.removeAttribute('data-pb-active');
      for (const [name,[value,priority]] of originalVariables) {
        if (value) document.documentElement.style.setProperty(name,value,priority);
        else document.documentElement.style.removeProperty(name);
      }
      originalVariables.clear();
    }
  }
  async function reload(animate=false) { update(await chrome.storage.local.get(['preferences', siteKey]),animate); }
  async function start() {
    observer = new MutationObserver(records=>{if(records.some(relevantMutation))schedule();});
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return;
      if (message?.type === 'pb-preview') {
        clearTimeout(reloadTimer); reloadTimer=null;
        void chrome.storage.local.get(['preferences',siteKey]).then(values => {
          update({...values,preferences:message.preferences},true);
          sendResponse({ok:true,version:'1.8.2',active,background:palette.background});
        });
        return true;
      }
      if (message?.type === 'pb-effect-ready') {sendResponse({ok:true});return;}
    });
    // Fallback when Chromium leaves the suggested command unassigned. Listening
    // while disabled is intentional, so the same key can turn the feature on.
    document.addEventListener('keydown', event => {
      if (event.code !== 'KeyD' || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat || event.isComposing) return;
      event.preventDefault();
      void chrome.runtime.sendMessage({type:'pb-toggle', source:'page-key'}).catch(() => {});
    }, true);
    await reload();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[siteKey] || (changes.preferences && (changes.preferences.newValue?.enabled !== settings.enabled))) {
        clearTimeout(reloadTimer); reloadTimer = null; void reload(true);
      } else if (changes.preferences && !reloadTimer) reloadTimer = setTimeout(() => { reloadTimer=null; void reload(); },80);
    });
    const scheduleEvent=event=>{if(!(event.target instanceof Element)||!protectedRegion(event.target))schedule();};
    document.addEventListener('load', scheduleEvent, true);
    document.addEventListener('change', scheduleEvent, true);
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearTimeout(timer); timer=null; }
      else schedule();
    });
  }
  if (document.documentElement) void start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
