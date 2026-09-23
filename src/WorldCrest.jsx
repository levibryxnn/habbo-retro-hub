import React,{useEffect,useRef,useState}from'react';
import './competition.css';

const memory=new Map();
let active=0;
const queue=[];
function drain(){
  if(active>=3||!queue.length)return;
  const job=queue.shift();active++;
  job().finally(()=>{active--;drain();});
}
function schedule(job){queue.push(job);drain();}
function assetUrl(source){
  if(!source)return'';
  if(/^(data:|blob:|https?:\/\/)/i.test(source))return source;
  const base=String(import.meta.env.BASE_URL||'./').replace(/\/$/,'');
  return source.startsWith('/')?base+source:base+'/'+source.replace(/^\.\//,'');
}
function keyFor(club){return String(club?.id||club?.name||'club');}
function fallbackText(club){return String(club?.abbreviation||club?.name||'?').replace(/[^A-Za-zÀ-ÿ0-9]/g,'').slice(0,3).toUpperCase();}

export default function WorldCrest({club,size='normal'}){
  const ref=useRef(null),key=keyFor(club),local=assetUrl(club?.logo),[src,setSrc]=useState(()=>local||memory.get(key)||''),[visible,setVisible]=useState(Boolean(local)),[failed,setFailed]=useState(false);
  useEffect(()=>{setSrc(local||memory.get(key)||'');setFailed(false);},[key,local]);
  useEffect(()=>{
    if(local||src||failed)return;
    const node=ref.current;if(!node)return;
    if(!('IntersectionObserver'in window)){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'160px'});
    observer.observe(node);return()=>observer.disconnect();
  },[key,local,src,failed]);
  useEffect(()=>{
    if(!visible||local||src||failed||!club?.external||!navigator.onLine)return;
    let cancelled=false;
    schedule(async()=>{
      try{
        const cached=sessionStorage.getItem('ldf.worldcrest.'+key);
        if(cached){if(!cancelled){memory.set(key,cached);setSrc(cached);}return;}
        const query=encodeURIComponent(club.wikiQuery||club.name+' football club');
        const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+query+'&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=160&format=json&origin=*';
        const response=await fetch(url,{mode:'cors',credentials:'omit'});if(!response.ok)throw new Error('crest');
        const data=await response.json(),page=Object.values(data?.query?.pages||{})[0],image=page?.thumbnail?.source;
        if(image&&!cancelled){memory.set(key,image);try{sessionStorage.setItem('ldf.worldcrest.'+key,image);}catch{}setSrc(image);}
      }catch{if(!cancelled)setFailed(true);}
    });
    return()=>{cancelled=true;};
  },[visible,key,club?.wikiQuery,club?.name,club?.external,local,src,failed]);
  return <span ref={ref} className={'world-crest '+size}>{src&&!failed?<img src={src} alt="" loading="lazy" decoding="async" onError={()=>{setFailed(true);setSrc('');}}/>:<span>{fallbackText(club)}</span>}</span>;
}
