import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const baseURL=process.env.LDF_PREVIEW_URL||'http://127.0.0.1:8080/';
fs.mkdirSync('browser-artifacts',{recursive:true});

function collectRuntimeErrors(page,label){
  const errors=[];
  page.on('pageerror',error=>errors.push(label+' pageerror: '+error.message));
  page.on('console',message=>{
    if(message.type()==='error'){
      const text=message.text();
      if(!/favicon|Failed to load resource.*404/i.test(text))errors.push(label+' console: '+text);
    }
  });
  return errors;
}
async function noHorizontalOverflow(page,label){
  const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scale:window.visualViewport?.scale||1}));
  assert.ok(metrics.scrollWidth<=metrics.clientWidth+3,label+' has horizontal overflow: '+JSON.stringify(metrics));
  assert.equal(metrics.scale,1,label+' is not being validated at browser zoom 100%');
}
async function waitForText(page,text){await page.getByText(text,{exact:false}).first().waitFor({state:'visible',timeout:15000});}
async function dismissPlayerMoment(page){const dialog=page.locator('.pc-moment-overlay');if(await dialog.count()){await dialog.first().waitFor({state:'visible',timeout:5000});await page.getByRole('button',{name:/Continuar a história/i}).click();}}
async function createAndFinishPlayer(page,name='Browser QA'){
  await page.getByRole('button',{name:/MODO CARREIRA JOGADOR/i}).click();
  await waitForText(page,'Crie seu craque.');
  if(name==='Browser QA')await page.screenshot({path:'browser-artifacts/02-player-creator.png',fullPage:true});
  assert.equal(await page.locator('.pc-face-controls,.pc-face').count(),0,'facial creator returned to RC9');
  await page.locator('input[placeholder="Digite o nome"]').fill(name);
  const mobileNext=page.getByRole('button',{name:/Próximo/i});
  if(await mobileNext.isVisible()){
    for(let step=0;step<3;step++)await mobileNext.click();
  }
  await page.getByRole('button',{name:/Ir para a peneira/i}).click();
  for(let index=0;index<5;index++){
    const choices=page.locator('.pc-trial-choices button');
    await choices.first().waitFor({state:'visible',timeout:15000});
    await choices.first().click();
  }
  await page.getByRole('button',{name:/Ver onde fui aprovado/i}).click();
  await page.locator('.pc-dashboard').waitFor({state:'visible',timeout:15000});
}

async function playerFlow(browser){
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  const page=await context.newPage(),errors=collectRuntimeErrors(page,'player-desktop');
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await waitForText(page,'Escolha onde sua carreira começa.');
  await noHorizontalOverflow(page,'desktop landing');
  await page.screenshot({path:'browser-artifacts/01-landing-desktop.png',fullPage:true});

  await createAndFinishPlayer(page);
  await page.screenshot({path:'browser-artifacts/03-player-dashboard.png',fullPage:true});
  for(const text of ['Condição','Moral','Confiança','AGENDA','Até o próximo jogo'])await waitForText(page,text);
  await noHorizontalOverflow(page,'player today at 1366x768');
  const hero=await page.locator('.pc-status-hero').boundingBox();
  assert.ok(hero&&hero.width<=1180&&hero.height<220,'player essential HUD is too large at 100% zoom: '+JSON.stringify(hero));
  const mark=await page.locator('.pc-status-identity .pc-player-mark').boundingBox();
  assert.ok(mark&&mark.width<=70&&mark.height<=70,'neutral player identifier is oversized: '+JSON.stringify(mark));
  await page.locator('.pc-today-grid').screenshot({path:'browser-artifacts/04-player-today.png'});

  await page.getByRole('button',{name:/Desenvolvimento/i}).click();
  await waitForText(page,'HIERARQUIA DO ELENCO');
  await waitForText(page,'CONCORRÊNCIA NA POSIÇÃO');
  await waitForText(page,'Objetivos individuais');
  await noHorizontalOverflow(page,'player development');

  await page.getByRole('button',{name:/Contrato & mercado/i}).click();
  await waitForText(page,'SUA POSIÇÃO SOBRE O FUTURO');
  await waitForText(page,'Alcance do empresário');
  await waitForText(page,'Espanha');
  await noHorizontalOverflow(page,'player contract');
  await page.screenshot({path:'browser-artifacts/09-player-contracts.png',fullPage:true});

  await page.getByRole('button',{name:/Finanças/i}).click();
  await waitForText(page,'FINANÇAS PESSOAIS');
  await waitForText(page,'Equipe de performance');
  await waitForText(page,'Patrimônio & projetos');
  await noHorizontalOverflow(page,'player finance');
  await page.screenshot({path:'browser-artifacts/08-player-life-finances.png',fullPage:true});

  await page.getByRole('button',{name:/Hoje/i}).click();
  await page.locator('.pc-prematch').waitFor({state:'visible',timeout:15000});
  await page.locator('.pc-prematch').screenshot({path:'browser-artifacts/05-player-pregame.png'});
  const before=await page.getByText(/Semana \d+/).first().textContent();
  await page.getByRole('button',{name:/1 dia/i}).click();
  await page.waitForTimeout(120);
  assert.ok(await page.locator('.pc-last-day').count()>=1,'daily engine did not produce a last-day event');
  await page.getByRole('button',{name:/Até o próximo jogo/i}).click();
  await page.locator('.pc-live-player-match').waitFor({state:'visible',timeout:15000});
  await waitForText(page,'NOTA AO VIVO');
  await waitForText(page,'ENERGIA');
  await noHorizontalOverflow(page,'interactive player match');
  const liveBox=await page.locator('.pc-live-player-match').boundingBox();
  assert.ok(liveBox&&liveBox.height<720,'live player match is too tall for 1366x768 at 100% zoom: '+JSON.stringify(liveBox));
  await page.screenshot({path:'browser-artifacts/06-player-live-match.png',fullPage:true});
  const aggressive=page.getByRole('button',{name:/Buscar o protagonismo/i}).first();
  if(await aggressive.isEnabled())await aggressive.click();
  await page.getByRole('button',{name:/Avançar 15 min/i}).click();
  await waitForText(page,"15'");
  await page.getByRole('button',{name:/Simular até o fim/i}).click();
  await page.locator('.pc-postmatch').waitFor({state:'visible',timeout:15000});
  await waitForText(page,'PÓS-JOGO');
  await dismissPlayerMoment(page);
  await page.locator('.pc-postmatch').screenshot({path:'browser-artifacts/07-player-postmatch.png'});
  const after=await page.getByText(/Semana \d+/).first().textContent();
  assert.ok(before!==null&&after!==null);

  await page.getByRole('button',{name:'História',exact:true}).first().click();
  await waitForText(page,'Linha do tempo');
  await page.screenshot({path:'browser-artifacts/player-history.png',fullPage:true});
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}

async function managerFlow(browser){
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  const page=await context.newPage(),errors=collectRuntimeErrors(page,'manager-desktop');
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/MODO CARREIRA TREINADOR/i}).click();
  await waitForText(page,'Escolha o clube que você quer comandar.');
  await noHorizontalOverflow(page,'manager club selector');
  await page.getByRole('button',{name:/Conhecer este projeto/i}).click();
  await page.getByRole('button',{name:/Começar carreira/i}).click();
  await page.locator('input[placeholder="Digite o nome do técnico"]').fill('Técnico QA');
  await page.getByRole('button',{name:/Assumir o clube/i}).click();
  await page.getByRole('button',{name:/Ir para a temporada/i}).click();
  await waitForText(page,'CENTRO DE COMANDO');
  await noHorizontalOverflow(page,'manager dashboard');
  await page.screenshot({path:'browser-artifacts/10-manager-dashboard.png',fullPage:true});

  await page.getByRole('button',{name:/^Partida$/i}).first().click();
  await waitForText(page,'PLANO DE JOGO');
  await page.getByRole('button',{name:/Ajustes finos/i}).first().click();
  await waitForText(page,'Ataque');
  await noHorizontalOverflow(page,'manager tactics');
  await page.locator('.match-tactic-strip').first().screenshot({path:'browser-artifacts/11-manager-tactics.png'});

  await page.getByRole('button',{name:/^Transferências$/i}).first().click();
  await waitForText(page,'Buscar jogador');
  await noHorizontalOverflow(page,'manager transfer market');
  await page.screenshot({path:'browser-artifacts/12-manager-market.png',fullPage:true});

  await page.getByRole('button',{name:/^Classificação$/i}).first().click();
  await waitForText(page,'Classificação do Brasileirão');
  await noHorizontalOverflow(page,'manager standings');
  await page.screenshot({path:'browser-artifacts/13-manager-standings.png',fullPage:true});

  const tabs=['Bastidores','Competições','Elenco','Troféus','Patrocínios','História','Painel'];
  for(const tab of tabs){
    const button=page.getByRole('button',{name:new RegExp('^'+tab+'$','i')}).first();
    await button.waitFor({state:'visible',timeout:15000});
    await button.click();
    await page.waitForTimeout(120);
    await noHorizontalOverflow(page,'manager '+tab.toLowerCase());
  }
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}


async function mobileCreatorLayout(browser,width,height,label){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=collectRuntimeErrors(page,'creator-'+label);
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await waitForText(page,'Escolha onde sua carreira começa.');
  await page.getByRole('button',{name:/MODO CARREIRA JOGADOR/i}).click();
  await waitForText(page,'Crie seu craque.');
  await page.locator('input[placeholder="Digite o nome"]').fill('Levi QA');
  await noHorizontalOverflow(page,'player creator '+label);

  const metrics=await page.evaluate(()=>{
    const box=selector=>{
      const el=document.querySelector(selector);
      if(!el)return null;
      const r=el.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
    };
    const visible=el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
    };
    const offenders=[...document.querySelectorAll('.pc-creator *')]
      .filter(visible)
      .map(el=>({tag:el.tagName,cls:el.className||'',text:(el.textContent||'').trim().slice(0,50),rect:el.getBoundingClientRect()}))
      .filter(item=>item.rect.left<-2||item.rect.right>window.innerWidth+2)
      .map(item=>({tag:item.tag,cls:String(item.cls),text:item.text,left:item.rect.left,right:item.rect.right}));
    return {
      viewport:{width:window.innerWidth,height:window.innerHeight,scale:window.visualViewport?.scale||1,textAdjust:getComputedStyle(document.documentElement).webkitTextSizeAdjust||getComputedStyle(document.documentElement).textSizeAdjust},
      topbar:box('.pc-topbar'),
      intro:box('.pc-creator-intro'),
      identity:box('.pc-identity-preview'),
      form:box('.pc-form'),
      offenders
    };
  });

  assert.equal(metrics.viewport.scale,1,'player creator '+label+' is not at 100% browser zoom');
  assert.ok(String(metrics.viewport.textAdjust).includes('100'),'mobile browser text autosizing is not normalized at '+label+': '+JSON.stringify(metrics.viewport));
  assert.ok(metrics.topbar&&metrics.topbar.height<=56,'mobile topbar is too tall at '+label+': '+JSON.stringify(metrics.topbar));
  assert.ok(metrics.intro&&metrics.intro.height<=100,'creator intro is too tall at '+label+': '+JSON.stringify(metrics.intro));
  assert.ok(metrics.identity&&metrics.identity.height<=90,'identity preview is too tall at '+label+': '+JSON.stringify(metrics.identity));
  assert.ok(metrics.form&&metrics.form.width<=width-8,'creator form exceeds viewport at '+label+': '+JSON.stringify(metrics.form));
  assert.deepEqual(metrics.offenders,[],'creator elements escape viewport at '+label+': '+JSON.stringify(metrics.offenders));

  async function assertStep(stepIndex,expectedLabel){
    await waitForText(page,expectedLabel);
    const active=page.locator('.pc-creator-step.active');
    const stepBox=await active.boundingBox();
    const formBox=await page.locator('.pc-form').boundingBox();
    assert.ok(stepBox,'creator step '+stepIndex+' is not visible at '+label);
    assert.ok(formBox&&formBox.y+formBox.height<=height-8,'creator step '+stepIndex+' does not fit at 100% zoom at '+label+': '+JSON.stringify(formBox));
    await noHorizontalOverflow(page,'player creator '+label+' step '+stepIndex);
    const visibleButtons=active.locator('button:visible');
    const count=await visibleButtons.count();
    for(let i=0;i<count;i++){
      const b=await visibleButtons.nth(i).boundingBox();
      assert.ok(b&&b.height<=72,'creator choice is too tall at '+label+' step '+stepIndex+': '+JSON.stringify(b));
    }
  }

  await assertStep(0,'Perfil');
  await page.screenshot({path:'browser-artifacts/player-creator-'+label+'-01-profile.png',fullPage:true});
  const next=page.getByRole('button',{name:/Próximo/i});
  await next.click();
  await assertStep(1,'Estilo');
  await next.click();
  await assertStep(2,'Personalidade');
  await next.click();
  await assertStep(3,'Detalhes');

  const cta=page.getByRole('button',{name:/Ir para a peneira/i});
  const ctaBox=await cta.boundingBox();
  const ruleBox=await page.locator('.pc-rule-note').boundingBox();
  assert.ok(ctaBox&&ctaBox.x>=0&&ctaBox.x+ctaBox.width<=width+1,'creator CTA is horizontally clipped at '+label+': '+JSON.stringify(ctaBox));
  assert.ok(ctaBox&&ctaBox.y+ctaBox.height<=height-8,'creator CTA is not visible at 100% zoom at '+label+': '+JSON.stringify(ctaBox));
  assert.ok(ctaBox&&ruleBox&&ctaBox.y>=ruleBox.y+ruleBox.height,'creator CTA overlaps the final form content at '+label+': '+JSON.stringify({ctaBox,ruleBox}));
  await page.screenshot({path:'browser-artifacts/player-creator-'+label+'-04-details.png',fullPage:true});
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}

async function mobileFlow(browser){
  const context=await browser.newContext({viewport:{width:393,height:660},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=collectRuntimeErrors(page,'mobile');
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await waitForText(page,'Escolha onde sua carreira começa.');
  await noHorizontalOverflow(page,'mobile landing');
  await page.screenshot({path:'browser-artifacts/02-landing-mobile.png',fullPage:true});
  await createAndFinishPlayer(page,'Mobile QA');
  await noHorizontalOverflow(page,'mobile player today');
  const tabs=page.locator('.pc-mode-tabs');
  assert.ok(await tabs.isVisible(),'player mobile tabs are not visible');
  await page.getByRole('button',{name:/Desenvolvimento/i}).click();
  await waitForText(page,'CONCORRÊNCIA NA POSIÇÃO');
  await noHorizontalOverflow(page,'mobile development');
  await page.getByRole('button',{name:/Hoje/i}).click();
  await page.getByRole('button',{name:/Até o próximo jogo/i}).click();
  await page.locator('.pc-live-player-match').waitFor({state:'visible',timeout:15000});
  await noHorizontalOverflow(page,'mobile interactive match');
  await page.screenshot({path:'browser-artifacts/mobile-player-live.png',fullPage:true});
  await page.getByRole('button',{name:/Simular até o fim/i}).click();
  await page.locator('.pc-postmatch').waitFor({state:'visible',timeout:15000});
  await dismissPlayerMoment(page);
  await page.getByRole('button',{name:/Finanças/i}).click();
  await waitForText(page,'FINANÇAS PESSOAIS');
  await noHorizontalOverflow(page,'mobile finance');
  await page.screenshot({path:'browser-artifacts/mobile-player-finance.png',fullPage:true});
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await mobileCreatorLayout(browser,360,600,'360x600');
  await mobileCreatorLayout(browser,393,660,'393x660');
  await mobileCreatorLayout(browser,412,700,'412x700');
  await playerFlow(browser);
  await managerFlow(browser);
  await mobileFlow(browser);
  console.log('Browser smoke passed: RC9.2 real mobile viewport audit at 360x600, 393x660 and 412x700; 100% zoom, text autosizing, overflow, manager regression and mobile flows.');
}finally{await browser.close();}
