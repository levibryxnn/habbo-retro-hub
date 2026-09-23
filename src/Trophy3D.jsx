import React from 'react';

function gradientId(id,suffix){return 'trophy-'+String(id||'generic').replace(/[^a-z0-9]/gi,'')+'-'+suffix;}

export default function Trophy3D({id='generic',shape='cup',className=''}) {
  const silver=gradientId(id,'silver'),dark=gradientId(id,'dark'),gold=gradientId(id,'gold');
  const type=id==='brasileirao'?'brasileirao':id==='libertadores'?'libertadores':id==='copa'?'copa':id==='sulamericana'?'sulamericana':id==='world'?'world':shape;
  return <svg className={'cup-art trophy-3d '+className} viewBox="0 0 140 160" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={silver} x1="24" y1="18" x2="112" y2="142" gradientUnits="userSpaceOnUse"><stop stopColor="#f9fbff"/><stop offset=".28" stopColor="#cdd5df"/><stop offset=".58" stopColor="#8f99a7"/><stop offset=".82" stopColor="#e8edf3"/><stop offset="1" stopColor="#737d89"/></linearGradient>
      <linearGradient id={dark} x1="43" y1="28" x2="99" y2="127" gradientUnits="userSpaceOnUse"><stop stopColor="#5e6874"/><stop offset=".48" stopColor="#262d35"/><stop offset="1" stopColor="#707b87"/></linearGradient>
      <linearGradient id={gold} x1="40" y1="21" x2="103" y2="133" gradientUnits="userSpaceOnUse"><stop stopColor="#fff3b3"/><stop offset=".34" stopColor="#d9af4f"/><stop offset=".7" stopColor="#90671d"/><stop offset="1" stopColor="#f2d47b"/></linearGradient>
    </defs>
    <ellipse cx="70" cy="147" rx="43" ry="7" fill="#0a120d" opacity=".13"/>
    {type==='brasileirao'?<>
      <path d="M45 18h50l11 22-14 65-22 20-22-20-14-65 11-22Z" fill={'url(#'+silver+')'} stroke="#eef2f6" strokeWidth="2"/>
      <path d="M52 27h36l8 16-10 53-16 15-16-15-10-53 8-16Z" fill={'url(#'+dark+')'} opacity=".72"/>
      <path d="M70 23v88M47 43h46M52 70h36" stroke="#fff" strokeOpacity=".42" strokeWidth="2"/>
      <path d="M60 121h20v12H60zM44 134h52v9H44z" fill={'url(#'+silver+')'}/>
    </>:type==='libertadores'?<>
      <circle cx="70" cy="20" r="9" fill={'url(#'+gold+')'}/><path d="M66 7h8v14h-8z" fill={'url(#'+gold+')'}/>
      <path d="M48 31h44l-5 47c-2 18-10 28-17 28S55 96 53 78l-5-47Z" fill={'url(#'+silver+')'} stroke="#eef2f6" strokeWidth="2"/>
      <path d="M51 42H34v15c0 15 10 23 22 26M89 42h17v15c0 15-10 23-22 26" stroke="#cfd6df" strokeWidth="6" strokeLinecap="round"/>
      <path d="M64 106h12v24H64zM46 130h48v13H46z" fill={'url(#'+dark+')'}/>
    </>:type==='copa'?<>
      <path d="M40 23h60l-7 45c-3 19-12 31-23 31S50 87 47 68l-7-45Z" fill={'url(#'+silver+')'} stroke="#f4f7fa" strokeWidth="2"/>
      <path d="M42 35H24v16c0 20 12 30 27 31M98 35h18v16c0 20-12 30-27 31" stroke="#c8d0db" strokeWidth="7" strokeLinecap="round"/>
      <path d="M65 99h10v29H65zM43 128h54v14H43z" fill={'url(#'+silver+')'}/>
      <path d="M49 31h42" stroke="#fff" strokeOpacity=".5" strokeWidth="3"/>
    </>:type==='sulamericana'?<>
      <path d="M70 18 94 41 83 105 70 122 57 105 46 41 70 18Z" fill={'url(#'+silver+')'} stroke="#f2f5f8" strokeWidth="2"/>
      <circle cx="70" cy="45" r="15" fill={'url(#'+dark+')'} opacity=".78"/>
      <path d="M70 30v30M55 45h30" stroke="#fff" strokeOpacity=".45" strokeWidth="2"/>
      <path d="M64 121h12v12H64zM45 133h50v10H45z" fill={'url(#'+dark+')'}/>
    </>:type==='world'?<>
      <circle cx="70" cy="34" r="24" fill={'url(#'+gold+')'} stroke="#fff5cf" strokeWidth="2"/>
      <path d="M49 34h42M70 10c-8 9-11 16-11 24s3 16 11 24M70 10c8 9 11 16 11 24s-3 16-11 24" stroke="#7b5c1f" strokeWidth="2" opacity=".7"/>
      <path d="M61 58h18l12 53H49l12-53Z" fill={'url(#'+silver+')'}/>
      <path d="M56 111h28v18H56zM42 129h56v14H42z" fill={'url(#'+dark+')'}/>
    </>:shape==='league'?<>
      <path d="M45 18h50l10 25-16 64-19 17-19-17-16-64 10-25Z" fill={'url(#'+silver+')'} stroke="#f2f5f8" strokeWidth="2"/>
      <path d="M60 123h20v10H60zM44 133h52v10H44z" fill={'url(#'+dark+')'}/>
    </>:<>
      <path d="M40 27h60l-7 43c-3 18-12 29-23 29S50 88 47 70l-7-43Z" fill={'url(#'+silver+')'}/>
      <path d="M43 39H25v15c0 19 12 28 27 30M97 39h18v15c0 19-12 28-27 30" stroke="#c8d0db" strokeWidth="6" strokeLinecap="round"/>
      <path d="M64 99h12v29H64zM43 128h54v14H43z" fill={'url(#'+dark+')'}/>
    </>}
    <path d="M53 27c10-5 24-7 35-3" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}
