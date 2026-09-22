"""Import a dated ESPN season roster snapshot. Python standard library only."""
import concurrent.futures, datetime, json, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
API = 'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1'
EXPECTED = {'3458','7632','9967','6086','9318','874','3456','2022','819','3445','6273','1936','9169','2029','6079','4936','2674','2026','3454','3457'}
def get(url):
    with urllib.request.urlopen(url, timeout=45) as response: return response.read()
def fetch(t):
    t = t['team']; url = f"{API}/teams/{t['id']}/roster?season=2026"
    d = json.loads(get(url)); assert d['season']['year'] == 2026
    players = []
    for a in d['athletes']:
        position = a.get('position', {}).get('name', 'Unknown')
        players.append({'id':a['id'], 'name':a['displayName'], 'number':a.get('jersey'), 'birthDate':a.get('dateOfBirth'), 'age':a.get('age'), 'nationality':a.get('citizenship'), 'countryCode':a.get('citizenshipCountry',{}).get('abbreviation'), 'position':position, 'heightCm':round(a['height']*2.54) if a.get('height') else None})
    assert players and len({p['id'] for p in players}) == len(players)
    logo = t.get('logos',[{}])[0].get('href')
    logo_data = None
    if logo:
        try:
            logo_bytes = get(logo)
            logo_path = ROOT / 'public' / 'crests' / (t['id'] + '.png')
            logo_path.parent.mkdir(parents=True, exist_ok=True)
            logo_path.write_bytes(logo_bytes)
            logo_data = '/crests/' + t['id'] + '.png'
        except Exception: pass
    print(t['displayName'],len(players), flush=True)
    return {'id':t['id'], 'name':t['displayName'], 'abbreviation':t['abbreviation'], 'color':'#'+t.get('color','314b39'), 'logo':logo_data, 'source':url, 'sourcePage':f"https://www.espn.com.br/futebol/time/elenco/_/id/{t['id']}/temporada/2026", 'players':players}
def main():
    data=json.loads(get(API+'/teams?limit=100'))
    league=data['sports'][0]['leagues'][0]
    assert league['season']['year']==2026
    teams=league['teams']; assert {t['team']['id'] for t in teams}==EXPECTED
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: clubs=list(pool.map(fetch,teams))
    snapshot={'season':2026, 'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sourceName':'ESPN', 'source':API+'/teams?limit=100', 'note':'Elencos da temporada conforme o cadastro da ESPN na data da consulta. Podem incluir atletas transferidos e não equivalem à lista oficial de inscrições da CBF.', 'clubs':clubs}
    destination=ROOT/'src/data/serie-a-2026.json'; temporary=destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)); temporary.replace(destination)
    print('TOTAL',sum(len(c['players']) for c in clubs))
if __name__=='__main__': main()
