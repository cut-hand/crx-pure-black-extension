(() => {
  'use strict';
  let host, timers=[];
  function cancel(){for(const timer of timers)clearTimeout(timer);timers=[];host?.remove();host=null;}
  function play({dark,color,commit}){
    cancel();if(window!==window.top){commit();return;}
    host=document.createElement('div');host.setAttribute('data-pb-ui','lamp');host.setAttribute('aria-hidden','true');
    host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;overflow:hidden!important;color-scheme:dark!important;';
    const shadow=host.attachShadow({mode:'open'}),sheet=new CSSStyleSheet();
    sheet.replaceSync(`
      :host{all:initial}.scene{position:absolute;inset:0;overflow:hidden;pointer-events:none}
      .veil{position:absolute;inset:0;background:#0d1522;animation:veil 1380ms ease-in-out both}
      .atmosphere{position:absolute;inset:-20%;background:radial-gradient(ellipse at 50% 24%,#a3dbd847,transparent 55%);animation:aura 1380ms ease both}
      .on .atmosphere{background:radial-gradient(ellipse at 50% 24%,#ffd58b5c,transparent 55%)}
      .stage{position:absolute;left:50%;top:clamp(32px,9vh,90px);width:156px;height:156px;margin-left:-78px;animation:stage 1380ms ease both}
      .mascot{position:absolute;inset:14px;width:128px;height:128px;filter:drop-shadow(0 7px 22px #0002);transform-origin:center}
      svg{width:100%;height:100%;overflow:visible}.incoming{animation:rise 1380ms cubic-bezier(.2,.75,.3,1) both}.outgoing{animation:set 1380ms cubic-bezier(.4,0,.6,1) both}
      .stars{position:absolute;inset:-28px;animation:twinkle 1380ms ease both}.on .stars{display:none}.rays{transform-origin:64px 64px;animation:rays 1380ms ease both}
      @keyframes veil{0%,15%{opacity:0}39%,48%{opacity:.75}79%,100%{opacity:0}}
      @keyframes aura{0%{opacity:0;scale:.8}30%,65%{opacity:1;scale:1}100%{opacity:0;scale:1.15}}
      @keyframes stage{0%{opacity:0;transform:translateY(-12px)}12%,80%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-18px)}}
      @keyframes set{0%,15%{opacity:1;transform:translate(0,0) rotate(0) scale(1)}44%,100%{opacity:0;transform:translate(-68px,54px) rotate(-24deg) scale(.6)}}
      @keyframes rise{0%,30%{opacity:0;transform:translate(68px,54px) rotate(24deg) scale(.6)}57%{opacity:1;transform:translate(0,-5px) rotate(-4deg) scale(1.07)}72%,100%{opacity:1;transform:translate(0,0) rotate(0) scale(1)}}
      @keyframes twinkle{0%,35%{opacity:0;transform:scale(.65) rotate(-10deg)}62%{opacity:1;transform:scale(1.05) rotate(3deg)}85%,100%{opacity:0;transform:scale(1.12) rotate(5deg)}}
      @keyframes rays{from{transform:rotate(-12deg)}to{transform:rotate(18deg)}}
    `);
    shadow.adoptedStyleSheets=[sheet];
    const scene=document.createElement('div');scene.className=dark?'scene off':'scene on';
    for(const name of ['veil','atmosphere','stage']){const el=document.createElement('div');el.className=name;scene.append(el);}
    if(dark)scene.querySelector('.veil').style.background=PureBlackTheme.normalize(color);
    const stage=scene.querySelector('.stage'),ns='http://www.w3.org/2000/svg';
    function node(tag,attrs,parent){const el=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);parent?.append(el);return el;}
    function mascot(kind,incoming){
      const wrapper=document.createElement('div');wrapper.className=`mascot ${kind} ${incoming?'incoming':'outgoing'}`;stage.append(wrapper);
      const svg=node('svg',{viewBox:'0 0 128 128'},wrapper),defs=node('defs',{},svg);
      const gradient=node('linearGradient',{id:kind,x1:'28',y1:'20',x2:'94',y2:'105',gradientUnits:'userSpaceOnUse'},defs);
      for(const [offset,fill]of kind==='moon'?[['0','#ffffff'],['1','#cfe8e3']]:[['0','#fff0be'],['1','#ffd18b']])node('stop',{offset,'stop-color':fill},gradient);
      const ink=kind==='moon'?'#263b3c':'#70512e';
      if(kind==='moon'){
        node('path',{d:'M90 21c-5 18 1 32 18 38-1 26-20 47-47 47-27 0-47-19-47-44 0-25 20-44 45-44 11 0 21 1 31 3Z',fill:'url(#moon)'},svg);
        node('path',{d:'m106 13 2.4 6.6L115 22l-6.6 2.4L106 31l-2.4-6.6L97 22l6.6-2.4L106 13Z',fill:'#a4edc9'},svg);
      }else{
        const rays=node('g',{class:'rays',stroke:'#ffd493','stroke-width':'5','stroke-linecap':'round'},svg);
        for(let angle=0;angle<360;angle+=45){const a=angle*Math.PI/180;node('line',{x1:64+48*Math.cos(a),y1:64+48*Math.sin(a),x2:64+56*Math.cos(a),y2:64+56*Math.sin(a)},rays);}
        node('circle',{cx:'64',cy:'64',r:'39',fill:'url(#sun)'},svg);
      }
      const dx=kind==='moon'?0:6;
      node('ellipse',{cx:43+dx,cy:'64',rx:'4',ry:'6',fill:ink},svg);node('ellipse',{cx:73+dx,cy:'64',rx:'4',ry:'6',fill:ink},svg);
      node('path',{d:`M${52+dx} 77q7 7 14 0`,stroke:ink,'stroke-width':'3.5','stroke-linecap':'round',fill:'none'},svg);
      for(const x of [33+dx,83+dx])node('ellipse',{cx:x,cy:'76',rx:'6',ry:'3',fill:'#f4bbb5','fill-opacity':'.7'},svg);
    }
    mascot('sun',!dark);mascot('moon',dark);
    const stars=node('svg',{viewBox:'0 0 212 212',class:'stars'},stage);
    for(const [x,y,size]of [[24,68,6],[176,45,5],[181,139,7],[39,166,4]])node('path',{d:`M${x} ${y-size}l${size*.3} ${size*.7} ${size*.7} ${size*.3}-${size*.7} ${size*.3}-${size*.3} ${size*.7}-${size*.3}-${size*.7}-${size*.7}-${size*.3} ${size*.7}-${size*.3}Z`,fill:'#b5ebd9'},stars);
    shadow.append(scene);document.documentElement.append(host);
    timers.push(setTimeout(commit,560));timers.push(setTimeout(cancel,1420));
  }
  globalThis.PureBlackLamp={play,cancel};
})();
