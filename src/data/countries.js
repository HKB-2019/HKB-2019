/* Countries for the checkout's COUNTRY list: ISO 3166-1 codes, named by the
 * browser in English (Intl.DisplayNames), so the list stays short here. The
 * order stores the name, as the server and the VISITORS map expect. */

const CODES = `AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS
MT MU MV MW MX MY MZ NA NC NE NF NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU
RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG
UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(/\s+/);

let cached = null;

/** Every country but Nigeria, by name, A to Z. */
export function countriesAbroad() {
  if (cached) return cached;
  let names = null;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* codes then */ }
  const name = (c) => { try { return names?.of(c) ?? c; } catch { return c; } };
  cached = [...new Set(CODES.map(name))].sort((a, b) => a.localeCompare(b, 'en'));
  return cached;
}
