// Escales de colors del radar (visor de l'estudi i imatges per a xarxes).
// Escala del radar del Meteocat (de feble a calamarsa) i la de Meteocadí: el mateix ordre i la mateixa intensitat de
// color, però la pluja feble comença en blau (no en violeta) i els verds i grocs són menys fluorescents
export const PAL = {
  meteocat: ['#7E1BCE', '#4214C9', '#151AE8', '#0328FF', '#01DEFE', '#00FFB2', '#08FF36', '#64FF00', '#A8FF00', '#EEFF00', '#FDB700', '#FF7B00', '#FF3B00', '#E40000', '#C5002C', '#ED006A', '#F300C3', '#E300FF', '#FFFFFF'],
  meteocadi: ['#5aa5e6', '#3a86da', '#2566cb', '#1c49b5', '#0aa2cc', '#08b98f', '#16bf45', '#62c81a', '#b2d10c', '#f0cd00', '#f7a600', '#f57a00', '#ec4c0e', '#d62215', '#ad0f1f', '#cc1478', '#be12bd', '#8519d6', '#ffffff'],
  // Tipus de precipitació (pluja, aiguaneu, neu), de feble a forta dins de cada tipus
  plujaneu: ['#F9C7CB', '#F49F9F', '#EE7777', '#E94F4F', '#D73030', '#A61C1C', '#DDF5CD', '#BDF2AA', '#91F080', '#54E747', '#1EAA14', '#098402', '#CAECFA', '#9FCAE6', '#73A8D3', '#4A87C1', '#2264AC', '#0D4293'],
};
