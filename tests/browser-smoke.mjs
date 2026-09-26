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
  const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
  assert.ok(metrics.scrollWidth<=metrics.clientWidth+3,label+' has horizontal overflow: '+JSON.stringify(metrics));
}
async function waitForText(page,text){
  await page.getByText(text,{exact:false}).first().waitFor({state:'visible',timeout:15000});
}
async function playerFlow(browser){
  const context=await browser.newContext({viewport:{width:1366,height:900}});
  const page=await context.newPage(),errors=collectRuntimeErrors(page,'player-desktop');
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await waitForText(page,'Escolha o modo de carreira.');
  await page.screenshot({path:'browser-artifacts/01-landing-desktop.png',fullPage:true});
  await noHorizontalOverflow(page,'desktop landing');

  await page.getByRole('button',{name:/MODO CARREIRA JOGADOR/i}).click();
  await waitForText(page,'Todo mundo começa com 16.');
  await page.locator('input[placeholder="Digite o nome"]').fill('Browser QA');
  await page.getByRole('button',{name:/Ir para a peneira/i}).click();

  for(let index=0;index<5;index++){
    const choices=page.locator('.pc-trial-choices button');
    await choices.first().waitFor({state:'visible',timeout:15000});
    await choices.first().click();
  }
  await page.getByRole('button',{name:/Ver onde fui aprovado/i}).click();
  await page.locator('.pc-dashboard').waitFor({state:'visible',timeout:15000});
  await waitForText(page,'Valor de mercado');
  await waitForText(page,'Objetivos da temporada');
  await page.screenshot({path:'browser-artifacts/02-player-dashboard.png',fullPage:true});
  await noHorizontalOverflow(page,'player dashboard');

  await page.getByRole('button',{name:/Vida & finanças/i}).click();
  await waitForText(page,'FINANÇAS PESSOAIS');
  await page.getByRole('button',{name:/História/i}).click();
  await waitForText(page,'Linha do tempo');

  await page.getByRole('button',{name:/Menu/i}).click();
  await waitForText(page,'Escolha o modo de carreira.');
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}
async function managerFlow(browser){
  const context=await browser.newContext({viewport:{width:1366,height:900}});
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
  await page.screenshot({path:'browser-artifacts/03-manager-dashboard.png',fullPage:true});

  const tabs=['Bastidores','Competições','Partida','Elenco','Classificação','Transferências','Troféus','Patrocínios','História','Painel'];
  for(const tab of tabs){
    const button=page.getByRole('button',{name:new RegExp('^'+tab+'$','i')}).first();
    await button.waitFor({state:'visible',timeout:15000});
    await button.click();
    await page.waitForTimeout(180);
  }
  await noHorizontalOverflow(page,'manager dashboard');
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}
async function mobileFlow(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=collectRuntimeErrors(page,'mobile');
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await waitForText(page,'Escolha o modo de carreira.');
  await noHorizontalOverflow(page,'mobile landing');
  await page.screenshot({path:'browser-artifacts/04-landing-mobile.png',fullPage:true});

  await page.getByRole('button',{name:/MODO CARREIRA JOGADOR/i}).click();
  await waitForText(page,'Todo mundo começa com 16.');
  await noHorizontalOverflow(page,'mobile player creator');
  await page.screenshot({path:'browser-artifacts/05-player-creator-mobile.png',fullPage:true});
  assert.deepEqual(errors,[],errors.join('\n'));
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await playerFlow(browser);
  await managerFlow(browser);
  await mobileFlow(browser);
  console.log('Browser smoke passed: player, manager and mobile flows.');
}finally{
  await browser.close();
}
