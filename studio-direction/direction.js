/* Progressive enhancement only. No timers, scroll interception or dependencies. */
(function () {
 'use strict';
 document.addEventListener('click', function (event) {
  const link = event.target.closest('[data-out]');
  if (link) try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({path:'open/' + link.dataset.out,title:'Opened site',event:true}); } catch (_) {}
 });
 const root = document.documentElement;
 const reduce = matchMedia('(prefers-reduced-motion: reduce)');
 const systemTheme = matchMedia('(prefers-color-scheme: dark)');
 const theme = document.querySelector('.theme-toggle');
 function isDark() { return root.dataset.theme ? root.dataset.theme === 'dark' : systemTheme.matches; }
 function syncTheme() { theme.setAttribute('aria-pressed', String(isDark())); }
 syncTheme();
 theme.addEventListener('click', function () {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('ms_theme', root.dataset.theme); } catch (_) {}
  syncTheme();
 });
 systemTheme.addEventListener('change', syncTheme);
 const menu = document.querySelector('.menu-toggle');
 const links = document.querySelector('.nav-links');
 function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', window.MSI18N ? MSI18N.t(open ? 'Close menu' : 'Open menu') : (open ? 'Close menu' : 'Open menu'));
  links.classList.toggle('menu-open', open);
 }
 menu.addEventListener('click', function () { setMenu(menu.getAttribute('aria-expanded') !== 'true'); });
 links.addEventListener('click', function (event) { if (event.target.closest('a')) setMenu(false); });
 document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } });
 document.addEventListener('click', function (event) { if (!event.target.closest('.studio-nav')) setMenu(false); });
 matchMedia('(max-width: 960px)').addEventListener('change', function () { setMenu(false); });
 function wireTabs(tabs, activate) {
  tabs.forEach(function (tab, index) {
   tab.addEventListener('click', function () { activate(tab); });
   tab.addEventListener('keydown', function (event) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); activate(tabs[next]); tabs[next].focus(); }
   });
  });
 }
 function tabState(tabs, selected) {
  tabs.forEach(function (tab) { const active = tab === selected; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
 }
 const serviceTabs = Array.from(document.querySelectorAll('[data-service]'));
 wireTabs(serviceTabs, function (selected) {
  tabState(serviceTabs, selected);
  serviceTabs.forEach(function (tab) { document.getElementById(tab.getAttribute('aria-controls')).hidden = tab !== selected; });
 });
 const stage = document.querySelector('.work-stage');
 const visual = document.querySelector('.stage-visual');
 const photo = document.getElementById('stage-photo');
 const screen = document.getElementById('stage-screen');
 const stageLink = document.querySelector('.stage-link');
 const stageTabs = Array.from(document.querySelectorAll('[data-stage-project]'));
 const projects = {
  iwona: {photo:'iwona-ash/assets/campaign.webp', screen:'studio-direction/media/iwona-desktop.webp', alt:'Iwona Ash leather collection campaign', screenAlt:'Iwona Ash storefront design', anchor:'#iwona-ash-project'},
  'space-tailoring': {photo:'space-tailoring/media/atelier.webp', screen:'studio-direction/media/space-tailoring-desktop.webp', alt:'Space Tailoring denim and tailoring tools', screenAlt:'Space Tailoring custom denim storefront design', anchor:'#space-tailoring-project'},
  heron: {photo:'assets/home/heron-site.webp', screen:'assets/home/heron-site.webp', alt:'Heron CA storefront with its vintage clothing collection', screenAlt:'Heron CA storefront with its vintage clothing collection', anchor:'#heron-project'},
  laloo: {photo:'assets/home/laloo-site.webp', screen:'assets/home/laloo-site.webp', alt:'The laloo map for finding restrooms and nearby places', screenAlt:'The laloo map for finding restrooms and nearby places', anchor:'#laloo-project'}
 };
 function translate(text) { return window.MSI18N ? MSI18N.t(text) : text; }
 wireTabs(stageTabs, function (selected) {
  const key = selected.dataset.stageProject;
  if (stage.dataset.stage === key) return;
  const project = projects[key];
  tabState(stageTabs, selected);
  stage.dataset.stage = key;
  visual.setAttribute('aria-labelledby', selected.id);
  photo.src = project.photo; photo.alt = translate(project.alt);
  screen.src = project.screen; screen.alt = translate(project.screenAlt);
  stageLink.setAttribute('href', project.anchor);
  if (!reduce.matches) { visual.classList.remove('is-changing'); void visual.offsetWidth; visual.classList.add('is-changing'); }
 });
 visual.addEventListener('animationend', function () { visual.classList.remove('is-changing'); });
 const heading = document.getElementById('heroTitle');
 function fitHeading() {
  heading.style.removeProperty('--hero-fit');
  const available = heading.clientWidth;
  const natural = Math.max.apply(null, Array.from(heading.children).map(function (line) { return line.scrollWidth; }));
  if (natural > available && available > 0) {
   const size = parseFloat(getComputedStyle(heading).fontSize);
   heading.style.setProperty('--hero-fit', (size * available / natural * .985) + 'px');
  }
 }
 if ('ResizeObserver' in window) new ResizeObserver(fitHeading).observe(heading.parentElement);
 else window.addEventListener('resize', fitHeading);
 const ready = window.MSI18N ? MSI18N.ready : Promise.resolve();
 Promise.all([ready, document.fonts.ready]).then(fitHeading);
 ready.then(function () { document.querySelectorAll('img[alt]').forEach(function (img) { img.alt = translate(img.alt); }); });
 if ('IntersectionObserver' in window && !reduce.matches) {
  const observer = new IntersectionObserver(function (entries) {
   entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.remove('reveal-pending'); observer.unobserve(entry.target); } });
  }, {threshold:.04});
  document.querySelectorAll('[data-reveal]').forEach(function (element) { element.classList.add('reveal-pending'); observer.observe(element); });
  reduce.addEventListener('change', function () { if (reduce.matches) { observer.disconnect(); document.querySelectorAll('.reveal-pending').forEach(function (el) { el.classList.remove('reveal-pending'); }); } });
 }
 /* Native dialog provides focus containment and Escape without a library. */
 const viewer = document.getElementById('design-viewer');
 if (viewer && typeof viewer.showModal === 'function') {
  root.classList.add('has-inspector');
  const inspectButtons = Array.from(document.querySelectorAll('[data-inspect]'));
  const viewerImage = document.getElementById('viewer-image');
  const canvas = viewer.querySelector('.viewer-canvas');
  const error = viewer.querySelector('.viewer-error');
  let current = 0, trigger = null, previousOverflow = '';
  function showDesign(index) {
   current = (index + inspectButtons.length) % inspectButtons.length;
   const project = inspectButtons[current].closest('.project');
   const image = project.querySelector('.project-screen img');
   document.getElementById('viewer-title').textContent = project.querySelector('h3').textContent;
   document.getElementById('viewer-status').textContent = project.querySelector('.project-state').textContent;
   viewer.querySelector('.viewer-open').href = project.querySelector('.project-scene').href;
   canvas.setAttribute('aria-busy', 'true');
   canvas.classList.remove('has-error');
   error.hidden = true;
   viewerImage.alt = image.alt;
   viewerImage.src = image.src;
   if (viewerImage.complete) imageReady();
  }
  function imageReady() {
   canvas.setAttribute('aria-busy', 'false');
   const failed = !viewerImage.naturalWidth;
   canvas.classList.toggle('has-error', failed);
   error.hidden = !failed;
  }
  viewerImage.addEventListener('load', imageReady);
  viewerImage.addEventListener('error', imageReady);
  inspectButtons.forEach(function (button, index) {
   button.addEventListener('click', function () {
    trigger = button;
    showDesign(index);
    if (!viewer.open) {
     previousOverflow = document.body.style.overflow;
     document.body.style.overflow = 'hidden';
     viewer.showModal();
    }
   });
  });
  viewer.querySelector('.viewer-close').addEventListener('click', function () { viewer.close(); });
  viewer.querySelectorAll('[data-viewer-step]').forEach(function (button) {
   button.addEventListener('click', function () { showDesign(current + Number(button.dataset.viewerStep)); });
  });
  viewer.addEventListener('keydown', function (event) {
   if (event.key === 'Tab') {
    const controls = Array.from(viewer.querySelectorAll('button:not([disabled]),a[href]')).filter(function (el) { return el.getClientRects().length > 0; });
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !viewer.contains(document.activeElement))) {
     event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !viewer.contains(document.activeElement))) {
     event.preventDefault(); first.focus();
    }
    return;
   }
   if (event.altKey || event.ctrlKey || event.metaKey) return;
   if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault(); showDesign(current + (event.key === 'ArrowRight' ? 1 : -1));
   }
  });
  viewer.addEventListener('click', function (event) {
   if (event.target !== viewer) return;
   const box = viewer.getBoundingClientRect();
   if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) viewer.close();
  });
  viewer.addEventListener('close', function () {
   document.body.style.overflow = previousOverflow;
   if (trigger && trigger.isConnected) trigger.focus({preventScroll:true});
  });
 }
 /* Keep the existing outbound event names when the proposal is integrated. */
 document.querySelectorAll('[data-out]').forEach(function (link) {
  link.addEventListener('click', function () { try { if (window.goatcounter) window.goatcounter.count({path:'open/'+link.dataset.out,title:'Opened site',event:true}); } catch (_) {} });
 });
})();
