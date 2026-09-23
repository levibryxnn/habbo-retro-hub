import React from 'react';

function gradientId(id,suffix){return 'trophy-'+String(id||'generic').replace(/[^a-z0-9]/gi,'')+'-'+suffix;}
function trophyType(id,shape){
  if(id==='brasileirao')return'brasileirao';
  if(id==='libertadores')return'libertadores';
  if(id==='copa'||id==='copa-do-brasil')return'copa';
  if(id==='sulamericana')return'sulamericana';
  if(id==='world'||id==='mundial')return'world';
  if(id==='champions-league')return'champions';
  if(id==='paulista')return'paulista';
  if(id==='supercopa')return'supercup';
  if(['mineiro','carioca','gaucho','paranaense','baiano','catarinense','paraense'].includes(id))return'state';
  if(['copa-nordeste','copa-verde','copa-sul-sudeste'].includes(id))return'regional';
  return shape||'cup';
}

export default function Trophy3D({id='generic',shape='cup',className=''}) {
  const silver=gradientId(id,'silver'),dark=gradientId(id,'dark'),gold=gradientId(id,'gold'),glass=gradientId(id,'glass'),shadow=gradientId(id,'shadow'),type=trophyType(id,shape);
  return <svg className={'cup-art trophy-3d '+className} viewBox="0 0 140 160" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={silver} x1="24" y1="18" x2="112" y2="142" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset=".18" stopColor="#dce3eb"/><stop offset=".43" stopColor="#8994a2"/><stop offset=".63" stopColor="#f6f8fb"/><stop offset=".82" stopColor="#9ba5b1"/><stop offset="1" stopColor="#646e79"/></linearGradient>
      <linearGradient id={dark} x1="43" y1="28" x2="99" y2="127" gradientUnits="userSpaceOnUse"><stop stopColor="#59636f"/><stop offset=".48" stopColor="#20262d"/><stop offset="1" stopColor="#707b87"/></linearGradient>
      <linearGradient id={gold} x1="38" y1="18" x2="104" y2="136" gradientUnits="userSpaceOnUse"><stop stopColor="#fff5bd"/><stop offset=".24" stopColor="#e0bd5c"/><stop offset=".52" stopColor="#9a7122"/><stop offset=".76" stopColor="#f0d27b"/><stop offset="1" stopColor="#755016"/></linearGradient>
      <linearGradient id={glass} x1="43" y1="18" x2="92" y2="120" gradientUnits="userSpaceOnUse"><stop stopColor="#f9ffff" stopOpacity=".96"/><stop offset=".3" stopColor="#b9d1dc" stopOpacity=".84"/><stop offset=".62" stopColor="#718796" stopOpacity=".84"/><stop offset="1" stopColor="#e6f0f5" stopOpacity=".92"/></linearGradient>
      <radialGradient id={shadow}><stop stopColor="#07110c" stopOpacity=".28"/><stop offset="1" stopColor="#07110c" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="70" cy="147" rx="44" ry="8" fill={'url(#'+shadow+')'}/>
    {type==='brasileirao'?<>
      <path d="M46 17h48l12 24-13 63-23 23-23-23-13-63 12-24Z" fill={'url(#'+glass+')'} stroke="#f8fbff" strokeWidth="2"/>
      <path d="M54 28h32l9 17-9 50-16 17-16-17-9-50 9-17Z" fill={'url(#'+dark+')'} opacity=".78"/>
      <path d="M70 22v91M47 44h46M52 70h36" stroke="#fff" strokeOpacity=".5" strokeWidth="2"/>
      <path d="M59 124h22v9H59zM42 133h56v11H42z" fill={'url(#'+silver+')'}/>
    </>:type==='libertadores'?<>
      <circle cx="70" cy="17" r="10" fill={'url(#'+gold+')'} stroke="#fff1b2" strokeWidth="1.5"/><path d="M66 4h8v13h-8z" fill={'url(#'+gold+')'}/>
      <path d="M48 31h44l-5 46c-2 18-10 29-17 29S55 95 53 77l-5-46Z" fill={'url(#'+silver+')'} stroke="#fff" strokeWidth="2"/>
      <path d="M50 42H31v15c0 16 10 25 25 28M90 42h19v15c0 16-10 25-25 28" stroke="#ccd5df" strokeWidth="6" strokeLinecap="round"/>
      <path d="M62 106h16v23H62zM45 129h50v14H45z" fill={'url(#'+dark+')'}/>
    </>:type==='copa'?<>
      <path d="M40 24h60l-7 44c-3 19-12 31-23 31S50 87 47 68l-7-44Z" fill={'url(#'+silver+')'} stroke="#fff" strokeWidth="2"/>
      <path d="M42 36H23v16c0 20 12 30 28 31M98 36h19v16c0 20-12 30-28 31" stroke="#cbd4dd" strokeWidth="7" strokeLinecap="round"/>
      <path d="M64 99h12v28H64zM42 127h56v15H42z" fill={'url(#'+dark+')'}/>
      <path d="M49 33h42M55 45h30" stroke="#fff" strokeOpacity=".48" strokeWidth="2.5"/>
    </>:type==='sulamericana'?<>
      <path d="M70 14 96 39 84 106 70 124 56 106 44 39 70 14Z" fill={'url(#'+silver+')'} stroke="#fff" strokeWidth="2"/>
      <circle cx="70" cy="45" r="16" fill={'url(#'+dark+')'} opacity=".84"/><circle cx="70" cy="45" r="8" stroke="#fff" strokeOpacity=".5"/>
      <path d="M64 123h12v10H64zM44 133h52v11H44z" fill={'url(#'+dark+')'}/>
    </>:type==='world'?<>
      <circle cx="70" cy="32" r="25" fill={'url(#'+gold+')'} stroke="#fff4c8" strokeWidth="2"/>
      <path d="M47 32h46M70 8c-8 9-12 16-12 24s4 17 12 24M70 8c8 9 12 16 12 24s-4 17-12 24" stroke="#79591c" strokeWidth="2" opacity=".72"/>
      <path d="M61 57h18l13 54H48l13-54Z" fill={'url(#'+silver+')'}/>
      <path d="M55 111h30v18H55zM41 129h58v14H41z" fill={'url(#'+dark+')'}/>
    </>:type==='champions'?<>
      <path d="M51 31H31c0 20 8 31 24 36M89 31h20c0 20-8 31-24 36" stroke="#d3dbe4" strokeWidth="8" strokeLinecap="round"/>
      <path d="M51 30h38l-6 45c-2 16-8 27-13 31-5-4-11-15-13-31l-6-45Z" fill={'url(#'+silver+')'} stroke="#fff" strokeWidth="2"/>
      <path d="M61 106h18v20H61zM42 126h56v15H42z" fill={'url(#'+dark+')'}/>
      <path d="M57 43h26" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5"/>
    </>:type==='paulista'?<>
      <path d="M70 13 98 35 88 105 70 127 52 105 42 35 70 13Z" fill={'url(#'+gold+')'} stroke="#fff0b0" strokeWidth="2"/>
      <path d="M70 24 88 39 81 96 70 112 59 96 52 39 70 24Z" fill={'url(#'+glass+')'} opacity=".9"/>
      <path d="M62 126h16v8H62zM41 134h58v11H41z" fill={'url(#'+dark+')'}/>
      <path d="M57 48h26M61 67h18M64 85h12" stroke="#fff" strokeOpacity=".5" strokeWidth="2"/>
    </>:type==='supercup'?<>
      <circle cx="70" cy="27" r="10" fill={'url(#'+gold+')'}/>
      <path d="M46 42h48l-4 27c-3 18-12 27-20 27s-17-9-20-27l-4-27Z" fill={'url(#'+silver+')'} stroke="#fff" strokeWidth="2"/>
      <path d="M46 48H28c0 18 8 27 23 33M94 48h18c0 18-8 27-23 33" stroke="#cbd4dc" strokeWidth="6" strokeLinecap="round"/>
      <path d="M63 96h14v20H63zM46 116h48v14H46z" fill={'url(#'+dark+')'}/>
    </>:type==='state'?<>
      <path d="M48 27h44l-4 39c-2 20-9 34-18 39-9-5-16-19-18-39l-4-39Z" fill={'url(#'+gold+')'} stroke="#fff0b3" strokeWidth="2"/>
      <path d="M51 38H35v15c0 14 7 23 19 27M89 38h16v15c0 14-7 23-19 27" stroke="#d4b75f" strokeWidth="6" strokeLinecap="round"/>
      <path d="M63 105h14v23H63zM45 128h50v14H45z" fill={'url(#'+dark+')'}/>
    </>:type==='regional'?<>
      <path d="M70 18 91 31 96 58 83 103 70 121 57 103 44 58 49 31 70 18Z" fill={'url(#'+gold+')'} stroke="#fff1bd" strokeWidth="2"/>
      <path d="M70 31 83 40 86 59 78 91 70 102 62 91 54 59 57 40 70 31Z" fill={'url(#'+dark+')'} opacity=".72"/>
      <path d="M63 121h14v11H63zM44 132h52v12H44z" fill={'url(#'+silver+')'}/>
    </>:shape==='league'?<>
      <path d="M45 18h50l10 25-16 64-19 17-19-17-16-64 10-25Z" fill={'url(#'+silver+')'} stroke="#fff" strokeWidth="2"/>
      <path d="M60 123h20v10H60zM44 133h52v10H44z" fill={'url(#'+dark+')'}/>
    </>:<>
      <path d="M40 27h60l-7 43c-3 18-12 29-23 29S50 88 47 70l-7-43Z" fill={'url(#'+silver+')'}/>
      <path d="M43 39H25v15c0 19 12 28 27 30M97 39h18v15c0 19-12 28-27 30" stroke="#c8d0db" strokeWidth="6" strokeLinecap="round"/>
      <path d="M64 99h12v29H64zM43 128h54v14H43z" fill={'url(#'+dark+')'}/>
    </>}
    <path d="M53 27c10-5 24-7 35-3" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}
