(() => {
  'use strict';
  const valid = value => /^#[0-9a-f]{6}$/i.test(value || '');
  const normalize = value => valid(value) ? value.toLowerCase() : '#000000';
  const rgb = hex => { hex = normalize(hex); return {r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16),a:1}; };
  const luminance = c => {
    const linear = n => { n/=255; return n<=.04045 ? n/12.92 : ((n+.055)/1.055)**2.4; };
    return .2126*linear(c.r)+.7152*linear(c.g)+.0722*linear(c.b);
  };
  const contrast = (a,b) => { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
  function theme(value) {
    const background=normalize(value), bg=rgb(background);
    const light='#e8e8e8', dark='#202124';
    const foreground=contrast(rgb(light),bg)>=contrast(rgb(dark),bg)?light:dark;
    return {background,bg,foreground,border:foreground===light?'#50535a':'#8b8d91',scheme:foreground===light?'dark':'light'};
  }
  function hsl(value) {
    const c=rgb(value), r=c.r/255,g=c.g/255,b=c.b/255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
    let h=0,s=0;
    if(d) { s=d/(1-Math.abs(2*l-1)); h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4; h=(h*60+360)%360; }
    return {h,s,l};
  }
  function fromHsl({h,s,l}) {
    const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
    const parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return '#'+parts.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
  }
  globalThis.PureBlackTheme={valid,normalize,rgb,contrast,theme,hsl,fromHsl};
})();
