// Mapes i vistes prèvies del web públic: sense el menú de "desa / copia la imatge" (ni la pulsació llarga del mòbil),
// sense arrossegar-ne les imatges i amagats en imprimir. Oriol, 20/10/2026: "en públic, lo just que quedi bé (el que
// hi ha ara) i sense possibilitat de copiar ni descarregar". L'aspecte no canvia (la classe no-save, a global.css,
// només treu la selecció i l'arrossegament). Les captures de pantalla no es poden impedir.
export function noSave(el) {
  if (!el || el.dataset.noSave) return;
  el.dataset.noSave = '1';
  el.classList.add('no-save');
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('dragstart', (e) => e.preventDefault());
}
