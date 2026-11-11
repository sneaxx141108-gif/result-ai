// Wettschein-Tipps → Wett-Code → nach dem Abpfiff gewonnen/verloren. Prüft die Funktionen direkt aus web/app.js
// (die App ist eine einzige Datei ohne Exporte – deshalb werden die Funktionen hier herausgeschnitten).
// Aufruf: node tests/pick.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'web', 'app.js'), 'utf8').split('\n');
const grab = (head) => {
  const i = src.findIndex((l) => l.startsWith(head));
  if (i < 0) throw new Error('nicht gefunden: ' + head);
  if (!head.startsWith('  function')) return src[i];
  let j = i;
  while (src[j] !== '  }') j++;
  return src.slice(i, j + 1).join('\n');
};
const code = ['  const norm =', '  function sideScore(', '  function sideOf(', '  const NO_CODE =', '  function pickCode(', '  function mirror(',
  '  const FAM =', '  const ouRes =', '  function wonCode(', '  const lineTxt =', '  function tipLabel('].map(grab).join('\n');
const { pickCode, wonCode, tipLabel, mirror } = new Function(`const resolveTeam = () => null;
  const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  ${code}
  return { pickCode, wonCode, tipLabel, mirror };`)();

let bad = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${ok ? '' : ` → ${got} (erwartet ${want})`}`);
};

// Tipps, wie sie auf Wettscheinen stehen (Heim: Bayern München, Gast: 1. FC Köln)
const H = 'Bayern München';
const A = '1. FC Köln';
[
  ['Spielergebnis', 'Bayern München', 'H'], ['Spielergebnis', '1', 'H'], ['3-Weg', 'X', 'D'], ['Endergebnis', 'Unentschieden', 'D'],
  ['Spielergebnis', '1. FC Köln', 'A'], ['Doppelte Chance', '1X', 'HD'], ['Doppelte Chance', 'X2', 'DA'], ['Doppelte Chance', '12', 'HA'],
  ['Doppelte Chance', 'Bayern München oder Unentschieden', 'HD'], ['Über/Unter 2,5 Tore', 'Über 2,5', 'O25'], ['Über/Unter 2,5 Tore', 'Unter 2,5', 'U25'],
  ['Über/Unter', 'Über 3,5', 'O35'], ['Tore Über/Unter 2,5', 'Über', 'O25'], ['Anzahl Tore Über/Unter 1,5', 'Unter', 'U15'],
  ['Beide Teams treffen', 'Ja', 'BY'], ['Beide Teams treffen', 'Nein', 'BN'], ['Halbzeit - Ergebnis', 'Bayern München', 'H1'],
  ['1. Halbzeit 3-Weg', 'X', 'D1'], ['Ergebniswette', '2:1', 'CS2:1'], ['Unentschieden keine Wette', 'Bayern München', 'HN'],
  ['Tore Bayern München Über/Unter', 'Über 1,5', 'HO15'], ['Bayern München trifft', 'Ja', 'HS'],
  // lieber gar nicht als falsch: das rechnet man selbst ab
  ['Torschütze', 'Harry Kane', null], ['Ecken Über/Unter 9,5', 'Über 9,5', null], ['Handicap', 'Bayern München (-1)', null],
  ['Gelbe Karten', 'Über 3,5', null], ['Spielergebnis & Über/Unter', 'Bayern München & Über 2,5', null], ['Halbzeit/Endstand', '1/1', null],
  ['Spielerwetten', 'Kane trifft', null], ['2. Halbzeit', '1', null], ['Anzahl Tore', '2-3', null],
].forEach(([market, pick, want]) => check(`Tipp „${market}: ${pick}“ = ${want}`, pickCode({ market, pick }, H, A), want));

// Abrechnung nach 90 Minuten (x:y Endstand, h1:a1 zur Pause)
[
  ['O25', 2, 1, true], ['U25', 2, 1, false], ['O20', 1, 1, 'void'], ['BY', 1, 0, false], ['BN', 1, 0, true], ['HN', 1, 1, 'void'], ['AN', 0, 2, true],
  ['HD', 1, 1, true], ['DA', 2, 0, false], ['HO15', 2, 0, true], ['AS', 2, 0, false], ['CS2:1', 2, 1, true],
].forEach(([c, x, y, want]) => check(`${c} bei ${x}:${y} = ${want}`, wonCode(c, x, y), want));
check('Halbzeit ohne Pausenstand = offen', wonCode('H1', 2, 0), null);
check('Halbzeit 1:0 zur Pause, Tipp Heim vorn', wonCode('H1', 1, 2, 1, 0), true);
check('Heim/Gast getauscht: 1X wird X2', mirror('HD'), 'DA');
check('Heim/Gast getauscht: Ergebnis 2:1 wird 1:2', mirror('CS2:1'), 'CS1:2');
check('Text für O25', tipLabel('O25', 'Bayern', 'Köln'), 'Über 2,5 Tore');

console.log(bad ? `\n${bad} FEHLER` : '\nALLE TESTS OK');
process.exit(bad ? 1 : 0);
