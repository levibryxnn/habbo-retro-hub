import React,{useEffect,useRef,useState} from 'react';
import { getClubWorld } from './club-world.js';
import { OPTICAL_CREST_SCALE, OPTICAL_CREST_SHIFT } from './crest-config.js';
import './crest.css';

const memory=new Map();
let active=0;
const queue=[];
const CACHE_PREFIX='ldf.crest.v4.';
function drain(){if(active>=3||!queue.length)return;const job=queue.shift();active++;job().finally(()=>{active--;drain();});}
function schedule(job){queue.push(job);drain();}
function assetUrl(source){
  if(!source)return'';
  if(/^(data:|blob:|https?:\/\/)/i.test(source))return source;
  const base=String(import.meta.env.BASE_URL||'./').replace(/\/$/,'');
  return source.startsWith('/')?base+source:base+'/'+source.replace(/^\.\//,'');
}
function keyFor(club){return String(club?.id||club?.name||'club');}
function initials(club){return String(club?.abbreviation||club?.name||'?').replace(/[^A-Za-zÀ-ÿ0-9]/g,'').slice(0,3).toUpperCase();}
function safeWikiTitle(club){return typeof club?.wikiQuery==='string'&&club.wikiQuery.trim()?club.wikiQuery.trim():'';}

export default function Crest({club,size='normal',large=false}){
  const resolvedSize=large?'large':size,key=keyFor(club),ref=useRef(null),local=assetUrl(club?.logo),wikiTitle=safeWikiTitle(club),[src,setSrc]=useState(()=>local||memory.get(key)||''),[visible,setVisible]=useState(Boolean(local)),[failed,setFailed]=useState(false);
  useEffect(()=>{setSrc(local||memory.get(key)||'');setFailed(false);setVisible(Boolean(local));},[key,local]);
  useEffect(()=>{
    if(local||src||failed||!wikiTitle)return;
    const node=ref.current;if(!node)return;
    if(typeof IntersectionObserver==='undefined'){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'180px'});
    observer.observe(node);return()=>observer.disconnect();
  },[key,local,src,failed,wikiTitle]);
  useEffect(()=>{
    if(!visible||local||src||failed||!club?.external||!wikiTitle||typeof navigator==='undefined'||!navigator.onLine)return;
    let cancelled=false;
    schedule(async()=>{
      try{
        const cacheKey=CACHE_PREFIX+key,cached=sessionStorage.getItem(cacheKey);
        if(cached){if(!cancelled){memory.set(key,cached);setSrc(cached);}return;}
        const host=club?.country==='BRA'?'pt.wikipedia.org':'en.wikipedia.org',url='https://'+host+'/w/api.php?action=query&titles='+encodeURIComponent(wikiTitle)+'&prop=pageimages&piprop=thumbnail&pithumbsize=220&format=json&origin=*';
        const response=await fetch(url,{mode:'cors',credentials:'omit'});if(!response.ok)throw new Error('crest');
        const data=await response.json(),page=Object.values(data?.query?.pages||{})[0],image=page?.thumbnail?.source;
        if(!page||page.missing!==undefined||!image)throw new Error('crest');
        if(!cancelled){memory.set(key,image);try{sessionStorage.setItem(cacheKey,image);}catch{}setSrc(image);}
      }catch{if(!cancelled)setFailed(true);}
    });
    return()=>{cancelled=true;};
  },[visible,key,wikiTitle,club?.external,local,src,failed]);
  const meta=getClubWorld(club?.id),fallback=initials(club),scale=OPTICAL_CREST_SCALE[String(club?.id)]||1,shift=OPTICAL_CREST_SHIFT[String(club?.id)]||'0 0';
  const style={'--crest-optical-scale':scale,'--crest-optical-shift':shift,'--crest-primary':club?.primary||meta.primary||'#315f43','--crest-secondary':club?.secondary||meta.secondary||'#f4f5ef'};
  const hasImage=Boolean(src&&!failed);
  return <span ref={ref} style={style} className={'crest world-crest unified-crest '+resolvedSize+(hasImage?'':' fallback')} data-club-id={key}>
    {hasImage?<img src={src} alt={'Escudo do '+(club?.name||'clube')} loading={resolvedSize==='large'?'eager':'lazy'} decoding="async" fetchPriority={resolvedSize==='large'?'high':'auto'} onError={()=>{setFailed(true);setSrc('');}}/>:
      <span className="crest-fallback" role="img" aria-label={'Escudo alternativo do '+(club?.name||fallback)}><i/><b>{fallback}</b></span>}
  </span>;
}
