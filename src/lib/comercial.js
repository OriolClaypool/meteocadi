// Configuració comercial i de comunitat de Meteocadí (un sol fitxer per activar patrocinis, apadrinaments i canals).
//
// Regla de llicències (vegeu 07 Diners.md):
// - Mentre PATROCINI_NEU.actiu sigui false i ESTACIONS_APADRINADES / RECOMANATS_FAMILIA estiguin buits, el web no
//   mostra cap patrocini comercial (només enllaços informatius cap a /colabora i suport voluntari).
// - Quan es tanqui el primer patrocini de pagament, posa actiu: true (o afegeix l'estació/negoci) i activa el pla
//   comercial d'Open-Meteo (i Vercel Pro o migració a Cloudflare Pages/Workers).

// Canal d'avisos de neu i temps (WhatsApp o Telegram). Es pot posar aquí o a PUBLIC_WHATSAPP_URL (Vercel).
// Mentre estigui buit (''), els botons del canal no es mostren i es prioritza Instagram @meteocadi.
export const CANAL_AVISOS = {
  url: (import.meta.env?.PUBLIC_WHATSAPP_URL || '').trim(),
  nom: 'Canal de WhatsApp',
  cta: 'Segueix el canal de WhatsApp per rebre els avisos de nevada',
};

// Enllaç d'aportació voluntària («Amics de Meteocadí»: Ko-fi, Buy Me a Coffee o Stripe).
// Els donatius voluntaris sense contingut tancat no compten com a ús comercial a Vercel Hobby ni a Open-Meteo.
// Si està buit (''), els botons porten a /colabora#amics.
export const AMICS_SUPORT = {
  url: (import.meta.env?.PUBLIC_SUPORT_URL || '').trim(),
  cta: 'Fes una aportació a la xarxa',
};

// Patrocini principal de Meteocadí Neu (/neu).
// Exemple: { actiu: true, etiqueta: 'Amb el suport de', nom: 'Esports Cerdanya', frase: '10 % en lloguer amb el codi METEOCADI10', url: 'https://...' }
export const PATROCINI_NEU = {
  actiu: false,
  etiqueta: 'Amb el suport de',
  nom: '',
  frase: '',
  url: '',
};

// Estacions de la xarxa apadrinades per negocis, refugis o ajuntaments (/estacions/<slug>).
// Clau = slug de l'estació (p. ex. 'pedraforca', 'gosol', 'coll-de-pal', 'baga-centre', 'la-pobla-de-lillet').
// Exemple: 'gosol': { nom: 'Forner de Gósol', url: 'https://...', frase: 'Col·labora amb el manteniment de l’estació' }
export const ESTACIONS_APADRINADES = {};

// Negocis locals recomanats a la guia «Neu amb nens i trineus» (/neu-amb-nens i /es/nieve-con-ninos).
// Exemple: { nom: 'Restaurant Cal...', zona: 'Berguedà · Saldes', tipus: 'On dinar', frase: 'Cuina de muntanya a 10 min del Pedraforca.', url: 'https://...', codi: '' }
export const RECOMANATS_FAMILIA = [];
