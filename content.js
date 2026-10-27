(() => {
  'use strict';
  const defaults = { enabled: true, mode: 'full', shadows: true, background:'#000000' };
  let palette = PureBlackTheme.theme('#000000'), reloadTimer;
  const originalVariables = new Map();
  const themeVariables = ['--pb-background','--pb-foreground','--pb-border','--pb-color-scheme'];
  const siteKey = `site:${location.hostname}`;
  const attrs = ['data-pb-bg', 'data-pb-fg', 'data-pb-border', 'data-pb-shadow', 'data-pb-fill', 'data-pb-before', 'data-pb-after', 'data-pb-before-bg', 'data-pb-after-bg', 'data-pb-svg', 'data-pb-wallpaper', 'data-pb-region', 'data-pb-icon', 'data-pb-raster', 'data-pb-gradient', 'data-pb-before-gradient', 'data-pb-after-gradient'];
  for (const pseudo of ['', '-before', '-after']) for (const side of ['top', 'right', 'bottom', 'left']) {
    attrs.push(`data-pb${pseudo}-border-${side}`, `data-pb${pseudo}-arrow-${side}`);
  }
  const skip = 'img,video,audio,canvas,svg,svg *,picture,iframe,object,embed,script,style,link,meta,source';
  let settings = { ...defaults }, active = false, observer, timer, lastScan = 0;
  const marked = new Set();
  const localStyles = new Map();
  const outlineImages = new Map();
  const rasterSamples=new WeakMap();
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
    const target=(values.preferences?.enabled??true)&&values[siteKey]!==false;
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
    return PureBlackTheme.contrast(composite(c,bg),bg) < 4.5;
  }
  function foreground(bg) {
    return PureBlackTheme.contrast(PureBlackTheme.rgb('#202124'),bg)>PureBlackTheme.contrast(PureBlackTheme.rgb('#e8e8e8'),bg)?'#202124':'#e8e8e8';
  }
  function neutralGradient(style) {
    if(!style.backgroundImage.includes('gradient(')||style.backgroundImage.includes('url(')||style.backgroundClip.includes('text'))return false;
    const stops=(style.backgroundImage.match(/(?:rgba?|oklch|oklab|lab|lch|color)\([^)]*\)/g)||[]).map(color);
    const visible=stops.filter(c=>c&&c.a>.05);
    return visible.length>0&&stops.every(c=>c&&(c.a<=.05||neutral(c)));
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
    const colors = sides.map(side => color(style.getPropertyValue(`border-${side}-color`)));
    const triangle = parseFloat(style.width) === 0 && parseFloat(style.height) === 0 &&
      sides.some(side => parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0);
    for (let i = 0; i < sides.length; i++) {
      const c = colors[i], side = sides[i];
      if (!c || c.a <= .05 || parseFloat(style.getPropertyValue(`border-${side}-width`)) === 0) continue;
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
    for (const el of marked) for (const attr of attrs) el.removeAttribute(attr);
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
    lastScan = performance.now();
    observer?.disconnect();
    // Measure settled site colors rather than a CSS transition's middle frame.
    document.documentElement.setAttribute('data-pb-measuring','');
    // Restore before measuring so decisions always use the site's own styles.
    clearMarks();
    const decisions = [];
    const surface = new WeakMap();
    const originalSurface = new WeakMap();
    const adaptedIcons=new Set();
    for (const el of document.querySelectorAll('*')) {
      if (el.hasAttribute('data-pb-ui')) continue;
      if(el.matches('img')) {
        const rect=el.getBoundingClientRect(),source=el.currentSrc||el.src;
        const parent=surface.get(el.parentElement)||{bg:palette.bg,known:true};
        // This site's footer cat is an external SVG image rather than inline
        // markup. A halo works without reading cross-origin pixels or recoloring it.
        const knownDarkLogo=location.hostname==='music-theory.aizcutei.com'&&source==='https://soundquest.jp/files/svg/logo_plugmon_monster.svg';
        if(rect.width>0&&rect.width<=128&&rect.height>0&&rect.height<=128&&parent.known&&(knownDarkLogo||/\.png(?:$|[?#])|^data:image\/png/i.test(source))) {
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
      // Youdao uses a pale decorative PNG across the translation workspace.
      // Treat only that known wallpaper as a surface; keep actual media intact.
      const wallpaper = location.hostname === 'fanyi.youdao.com' && el.matches('.web-frame-content-scroll-container.index-bg');
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
      const smallIcon = !el.textContent.trim() && parseFloat(style.width) <= 24 && parseFloat(style.height) <= 24;
      if (settings.shadows && !preserveSurface && !smallIcon && (style.boxShadow !== 'none' || style.textShadow !== 'none')) flags.push(attrs[3]);
      if (flags.length) decisions.push([el, flags, paints]);
    }
    for (const [el, flags, paints] of decisions) {
      for (const attr of flags) el.setAttribute(attr, '');
      applyPaints(el,paints);
      marked.add(el);
    }
    void document.documentElement.offsetHeight;
    document.documentElement.removeAttribute('data-pb-measuring');
    observe();
  }
  function schedule() {
    if (active && !timer) timer = setTimeout(scan, Math.max(120, 700 - (performance.now() - lastScan)));
  }
  function observe() {
    if (active && document.documentElement) observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode', 'href', 'src', 'srcset']
    });
  }
  function apply(values) {
    settings = { ...defaults, ...(values.preferences || {}), mode: 'full' };
    active = settings.enabled && values[siteKey] !== false;
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
    observer = new MutationObserver(schedule);
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return;
      if (message?.type === 'pb-preview') {
        clearTimeout(reloadTimer); reloadTimer=null;
        void chrome.storage.local.get(['preferences',siteKey]).then(values => {
          update({...values,preferences:message.preferences},true);
          sendResponse({ok:true,version:'1.8.1',active,background:palette.background});
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
    document.addEventListener('load', schedule, true);
    document.addEventListener('change', schedule, true);
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  }
  if (document.documentElement) void start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
