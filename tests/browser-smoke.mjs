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
async function createAndFinishPlayer(page,name='Browser QA'){
  await page.getByRole('button',{name:/MODO CARREIRA JOGADOR/i}).click();
  await waitForText(page,'Comece aos 16.');
  assert.equal(await page.locator('.pc-face-controls,.pc-face').count(),0,'facial creator returned to RC7');
  await page.locator('input[placeholder="Digite o nome"]').fill(name);
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
  await waitForText(page,'Escolha o modo de carreira.');
  await noHorizontalOverflow(page,'desktop landing');
  await page.screenshot({path:'browser-artifacts/01-landing-desktop.png',fullPage:true});

  await createAndFinishPlayer(page);
  for(const text of ['Condição','Moral','Confiança','AGENDA','Até o próximo jogo'])await waitForText(page,text);
  await noHorizontalOverflow(page,'player today at 1366x768');
  const hero=await page.locator('.pc-status-hero').boundingBox();
  assert.ok(hero&&hero.width<=1180&&hero.height<220,'player essential HUD is too large at 100% zoom: '+JSON.stringify(hero));
  const mark=await page.locator('.pc-status-identity .pc-player-mark').boundingBox();
  assert.ok(mark&&mark.width<=70&&mark.height<=70,'neutral player identifier is oversized: '+JSON.stringify(mark));
  await page.screenshot({path:'browser-artifacts/02-player-today-1366x768.png',fullPage:true});

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

  await page.getByRole('button',{name:/Finanças/i}).click();
  await waitForText(page,'FINANÇAS PESSOAIS');
  await waitForText(page,'Equipe de performance');
  await waitForText(page,'Patrimônio & projetos');
  await noHorizontalOverflow(page,'player finance');

  await page.getByRole('button',{name:/Hoje/i}).click();
  const before=await page.getByText(/Semana \d+/).first().textContent();
  await page.getByRole('button',{name:/1 dia/i}).click();
  await page.waitForTimeout(120);
  assert.ok(await page.locator('.pc-last-day').count()>=1,'daily engine did not produce a last-day event');
  await page.getByRole('button',{name:/Até o próximo jogo/i}).click();
  await page.waitForTimeout(120);
  assert.ok(await page.locator('.pc-postmatch').count()>=1,'advance-until-match did not return to a match context');
  const after=await page.getByText(/Semana \d+/).first().textContent();
  assert.ok(before!==null&&after!==null);

  await page.getByRole('button',{name:/História/i}).click();
  await waitForText(page,'Linha do tempo');
  await page.screenshot({path:'browser-artifacts/03-player-history.png',fullPage:true});
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
  const tabs=['Bastidores','Competições','Partida','Elenco','Classificação','Transferências','Troféus','Patrocínios','História','Painel'];
  for(const tab of tabs){const button=page.getByRole('button',{name:new RegExp('^'+tab+'$','i')}).first();await button.waitFor({state:'visible',timeout:15000});await button.click();await page.waitForTimeout(120);}
  await noHorizontalOverflow(page,'manager dashboard');
  await page.screenshot({path:'browser-artifacts/04-manager-dashboard.png',fullPage:true});
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}

async function mobileFlow(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=collectRuntimeErrors(page,'mobile');
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await waitForText(page,'Escolha o modo de carreira.');
  await noHorizontalOverflow(page,'mobile landing');
  await createAndFinishPlayer(page,'Mobile QA');
  await noHorizontalOverflow(page,'mobile player today');
  const tabs=page.locator('.pc-mode-tabs');
  assert.ok(await tabs.isVisible(),'player mobile tabs are not visible');
  await page.getByRole('button',{name:/Desenvolvimento/i}).click();
  await waitForText(page,'CONCORRÊNCIA NA POSIÇÃO');
  await noHorizontalOverflow(page,'mobile development');
  await page.getByRole('button',{name:/Finanças/i}).click();
  await waitForText(page,'FINANÇAS PESSOAIS');
  await noHorizontalOverflow(page,'mobile finance');
  await page.screenshot({path:'browser-artifacts/05-player-mobile.png',fullPage:true});
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await playerFlow(browser);
  await managerFlow(browser);
  await mobileFlow(browser);
  console.log('Browser smoke passed: RC7 player at 100% zoom, manager regression and mobile flows.');
}finally{await browser.close();}
