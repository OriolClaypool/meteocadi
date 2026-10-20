// Enllaços al mapa de previsió (/mapa/previsio): amagats (hidden) fins que la previsió AROME respon (/api/capes/arome,
// a la CDN 10 minuts). Amb data-arome-var, només si la passada té aquesta variable (per exemple, la neu).
export function aromeLinks() {
  const els = [...document.querySelectorAll('[data-arome-link]')];
  if (!els.length) return;
  fetch('/api/capes/arome')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || j.error || !j.vars?.length || !j.times?.length) return;
      for (const el of els) {
        const v = el.dataset.aromeVar;
        if (!v || j.vars.some((x) => x.key === v)) el.hidden = false;
      }
    })
    .catch(() => {});
}
