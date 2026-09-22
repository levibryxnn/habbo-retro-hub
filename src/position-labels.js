const normalizePosition = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[_/]+/g, ' ')
  .replace(/\s+/g, ' ');

const aliases = new Map([
  ['goalkeeper','Goleiro'],['keeper','Goleiro'],['gk','Goleiro'],['goleiro','Goleiro'],
  ['sweeper','Líbero'],['libero','Líbero'],['líbero','Líbero'],
  ['defender','Defensor'],['defence','Defensor'],['defense','Defensor'],['defensor','Defensor'],
  ['centre back','Zagueiro'],['center back','Zagueiro'],['centre-back','Zagueiro'],['center-back','Zagueiro'],['cb','Zagueiro'],['zagueiro','Zagueiro'],
  ['right back','Lateral Direito'],['right-back','Lateral Direito'],['rb','Lateral Direito'],['lateral direito','Lateral Direito'],
  ['left back','Lateral Esquerdo'],['left-back','Lateral Esquerdo'],['lb','Lateral Esquerdo'],['lateral esquerdo','Lateral Esquerdo'],
  ['full back','Lateral'],['full-back','Lateral'],['fullback','Lateral'],['lateral','Lateral'],
  ['right wing back','Ala Direito'],['right wing-back','Ala Direito'],['right-wing-back','Ala Direito'],['rwb','Ala Direito'],['ala direito','Ala Direito'],
  ['left wing back','Ala Esquerdo'],['left wing-back','Ala Esquerdo'],['left-wing-back','Ala Esquerdo'],['lwb','Ala Esquerdo'],['ala esquerdo','Ala Esquerdo'],
  ['wing back','Ala'],['wing-back','Ala'],['wingback','Ala'],['ala','Ala'],
  ['midfielder','Meio-campista'],['midfield','Meio-campista'],['meio-campista','Meio-campista'],['meio campo','Meio-campista'],
  ['defensive midfield','Volante'],['defensive midfielder','Volante'],['dm','Volante'],['cdm','Volante'],['volante','Volante'],
  ['central midfield','Meia Central'],['central midfielder','Meia Central'],['centre midfield','Meia Central'],['cm','Meia Central'],['meia central','Meia Central'],
  ['right midfield','Meia Direita'],['right midfielder','Meia Direita'],['rm','Meia Direita'],['meia direita','Meia Direita'],
  ['left midfield','Meia Esquerda'],['left midfielder','Meia Esquerda'],['lm','Meia Esquerda'],['meia esquerda','Meia Esquerda'],
  ['attacking midfield','Meia Ofensivo'],['attacking midfielder','Meia Ofensivo'],['am','Meia Ofensivo'],['cam','Meia Ofensivo'],['meia ofensivo','Meia Ofensivo'],
  ['winger','Ponta'],['wing','Ponta'],['ponta','Ponta'],
  ['right winger','Ponta Direita'],['right wing','Ponta Direita'],['rw','Ponta Direita'],['ponta direita','Ponta Direita'],
  ['left winger','Ponta Esquerda'],['left wing','Ponta Esquerda'],['lw','Ponta Esquerda'],['ponta esquerda','Ponta Esquerda'],
  ['forward','Atacante'],['attacker','Atacante'],['atacante','Atacante'],
  ['second striker','Segundo Atacante'],['second forward','Segundo Atacante'],['ss','Segundo Atacante'],['segundo atacante','Segundo Atacante'],['seg. atacante','Segundo Atacante'],
  ['centre forward','Centroavante'],['center forward','Centroavante'],['centre-forward','Centroavante'],['center-forward','Centroavante'],['cf','Centroavante'],
  ['striker','Centroavante'],['st','Centroavante'],['centroavante','Centroavante'],
]);

export function translatePosition(value) {
  if (!value) return 'Não informada';
  const normalized = normalizePosition(value);
  return aliases.get(normalized) || String(value);
}

export function positionGroup(value) {
  const label = translatePosition(value);
  if (label === 'Goleiro') return 'GOL';
  if (['Líbero','Defensor','Zagueiro','Lateral','Lateral Direito','Lateral Esquerdo','Ala','Ala Direito','Ala Esquerdo'].includes(label)) return 'DEF';
  if (['Meio-campista','Volante','Meia Central','Meia Direita','Meia Esquerda','Meia Ofensivo'].includes(label)) return 'MEI';
  if (['Ponta','Ponta Direita','Ponta Esquerda','Atacante','Segundo Atacante','Centroavante'].includes(label)) return 'ATA';
  return 'NI';
}

export function isGoalkeeper(value) { return positionGroup(value) === 'GOL'; }
export function isDefensivePosition(value) { return positionGroup(value) === 'DEF'; }
export function isMidfieldPosition(value) { return positionGroup(value) === 'MEI'; }
export function isAttackingPosition(value) { return positionGroup(value) === 'ATA'; }
