/* Progressive enhancement: every link and every section works without motion. */
(function () {
 'use strict';
 const root = document.documentElement;
 const heading = document.getElementById('heroTitle');
 function fitHeading() {
  heading.style.removeProperty('--hero-fit');
  const available = heading.parentElement.clientWidth;
  const natural = heading.scrollWidth;
  if (natural > available) {
   const size = parseFloat(getComputedStyle(heading).fontSize);
   heading.style.setProperty('--hero-fit', (size * available / natural * 0.99) + 'px');
  }
 }
 const ready = window.MSI18N ? MSI18N.ready : Promise.resolve();
 Promise.all([ready, document.fonts.ready]).then(function () {
  fitHeading();
  document.querySelectorAll('img[alt]').forEach(function (img) { if (window.MSI18N) img.alt = MSI18N.t(img.alt); });
 });
 if ('ResizeObserver' in window) new ResizeObserver(fitHeading).observe(heading.parentElement);
 else window.addEventListener('resize', fitHeading);
 const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
 const theme = document.querySelector('.theme-toggle');
 const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
 function dark() { return root.dataset.theme ? root.dataset.theme === 'dark' : systemTheme.matches; }
 function themeState() { theme.setAttribute('aria-pressed', String(dark())); }
 themeState();
 theme.addEventListener('click', function () {
  root.dataset.theme = dark() ? 'light' : 'dark';
  try { localStorage.setItem('ms_theme', root.dataset.theme); } catch (e) {}
  themeState();
 });
 systemTheme.addEventListener('change', themeState);
 const menu = document.querySelector('.menu-toggle');
 const links = document.querySelector('.nav-links');
 function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', window.MSI18N ? MSI18N.t(open ? 'Close menu' : 'Open menu') : (open ? 'Close menu' : 'Open menu'));
  links.classList.toggle('menu-open', open);
 }
 menu.addEventListener('click', function () { setMenu(menu.getAttribute('aria-expanded') !== 'true'); });
 links.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
 document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } });
 document.addEventListener('click', function (e) { if (!e.target.closest('.studio-nav')) setMenu(false); });
 const narrow = window.matchMedia('(max-width: 960px)');
 narrow.addEventListener('change', function () { setMenu(false); });
 const tabs = Array.from(document.querySelectorAll('[data-service]'));
 function selectTab(tab) {
  tabs.forEach(function (t) {
   const selected = t === tab;
   t.setAttribute('aria-selected', String(selected));
   t.tabIndex = selected ? 0 : -1;
   document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  });
  document.querySelector('.system-map').dataset.active = tab.dataset.service;
 }
 tabs.forEach(function (tab, i) {
  tab.addEventListener('click', function () { selectTab(tab); });
  tab.addEventListener('keydown', function (e) {
   let next;
   if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
   if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
   if (e.key === 'Home') next = 0;
   if (e.key === 'End') next = tabs.length - 1;
   if (next !== undefined) { e.preventDefault(); selectTab(tabs[next]); tabs[next].focus(); }
  });
 });
 if ('IntersectionObserver' in window && !reduce.matches) {
  const observer = new IntersectionObserver(function (entries) {
   entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.remove('reveal-pending'); observer.unobserve(entry.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('reveal-pending'); observer.observe(el); });
  reduce.addEventListener('change', function (e) { if (e.matches) { observer.disconnect(); document.querySelectorAll('.reveal-pending').forEach(function (el) { el.classList.remove('reveal-pending'); }); } });
 }
 const art = document.querySelector('.hero-art');
 const object = art.querySelector('.orbit-object');
 const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
 let frame = 0;
 art.addEventListener('pointermove', function (e) {
  if (reduce.matches || !pointer.matches) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(function () {
   const box = art.getBoundingClientRect();
   const x = (e.clientX - box.left) / box.width - 0.5;
   const y = (e.clientY - box.top) / box.height - 0.5;
   object.style.transform = 'rotateX(' + (-y * 9) + 'deg) rotateY(' + (x * 12) + 'deg) translate3d(' + (x * 10) + 'px,' + (y * 10) + 'px,0)';
  });
 });
 function resetArt() { cancelAnimationFrame(frame); object.style.transform = ''; }
 art.addEventListener('pointerleave', resetArt);
 reduce.addEventListener('change', resetArt);
 document.querySelectorAll('[data-out]').forEach(function (link) {
  link.addEventListener('click', function () {
   try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({path: 'open/' + link.dataset.out, title: 'Opened site', event: true}); } catch (e) {}
  });
 });
})();
