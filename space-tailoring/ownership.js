/* No client-side paid flag: marks stay until a reviewed, verified-payment release. */
(function(){'use strict';
const words={"en": ["This website belongs to mrspace.online.", "Pause scrolling text", "Resume scrolling text"], "tr": ["Bu site mrspace.online sitesidir.", "Kayan yazıyı duraklat", "Kayan yazıyı devam ettir"], "es": ["Este sitio web pertenece a mrspace.online.", "Pausar el texto en movimiento", "Reanudar el texto en movimiento"], "de": ["Diese Website gehört mrspace.online.", "Lauftext pausieren", "Lauftext fortsetzen"], "fr": ["Ce site appartient à mrspace.online.", "Mettre le texte défilant en pause", "Reprendre le texte défilant"]};
function update(){const copy=words[document.documentElement.lang]||words.en;document.querySelectorAll('.ms-ownership').forEach(bar=>{bar.querySelectorAll('[data-ownership-copy]').forEach(el=>el.textContent=copy[0]);const button=bar.querySelector('button');button.hidden=false;button.setAttribute('aria-label',copy[bar.hasAttribute('data-paused')?2:1]);});}
document.querySelectorAll('.ms-ownership button').forEach(button=>button.onclick=()=>{const bar=button.closest('.ms-ownership'),paused=bar.toggleAttribute('data-paused');button.textContent=paused?'▶':'Ⅱ';update();});
update();new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
