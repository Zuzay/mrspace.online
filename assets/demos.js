/* Mr. Space coded demos. Each demo is a scripted, silent loop under one minute. */
(function(){
"use strict";
var STOP = {};
var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- small drawing helpers ---------- */
function garment(color, kind){
  var c = color || "#1D1A16";
  if (kind === "jacket") return '<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M30 6 L44 2 L50 14 L56 2 L70 6 L96 26 L88 48 L78 42 L78 110 L22 110 L22 42 L12 48 L4 26 Z" fill="'+c+'"/><path d="M50 14 V110" stroke="#0002" stroke-width="2"/></svg>';
  if (kind === "boot") return '<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M34 4 H62 V74 L92 88 Q96 104 84 106 H30 Z" fill="'+c+'"/></svg>';
  if (kind === "bag") return '<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M34 40 Q34 10 50 10 Q66 10 66 40" stroke="'+c+'" stroke-width="6" fill="none"/><rect x="16" y="40" width="68" height="64" rx="6" fill="'+c+'"/></svg>';
  if (kind === "blouse") return '<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M34 6 Q50 18 66 6 L94 22 L86 46 L76 40 L78 108 L22 108 L24 40 L14 46 L6 22 Z" fill="'+c+'"/></svg>';
  return '<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M38 2 V22 M62 2 V22" stroke="'+c+'" stroke-width="2"/><path d="M36 20 H64 L70 46 L90 108 H10 L30 46 Z" fill="'+c+'"/></svg>';
}
function barcode(seed){
  var x = 0, out = "", s = seed || 7;
  for (var i = 0; i < 46; i++) { s = (s * 9301 + 49297) % 233280; var w = 1 + (s % 3); if (i % 2 === 0) out += '<rect x="'+x+'" y="0" width="'+w+'" height="28" fill="#000"/>'; x += w; }
  return '<svg class="bc" viewBox="0 0 '+x+' 28" preserveAspectRatio="none" width="100%" aria-hidden="true">'+out+'</svg>';
}
var CURSOR = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 1 L2 15 L6 11 L9 17 L11.5 16 L8.6 10 L14 10 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';

/* ---------- the player ---------- */
function Player(root, def){
  this.root = root; this.def = def; this.gen = 0; this.paused = false; this.visible = false; this.skipTo = -1;
  var phone = def.kind === "phone";
  root.innerHTML =
    '<div class="screen'+(phone?' phone':'')+'" role="img" aria-label="'+def.label+'">' +
      '<div class="vp">' +
        (phone ? '' : '<div class="chrome"><b></b><b></b><b></b><div class="url"></div></div>') +
        '<div class="stage"></div><div class="cursor">'+CURSOR+'</div><div class="toast"><i></i><span></span></div>' +
      '</div>' +
    '</div>' +
    '<div class="ctl"><button class="pp" type="button" aria-label="Pause demo"></button><ol class="chapters"></ol></div>';
  this.screen = root.querySelector(".screen");
  this.vp = root.querySelector(".vp");
  this.stage = root.querySelector(".stage");
  this.cursorEl = root.querySelector(".cursor");
  this.toastEl = root.querySelector(".toast");
  this.urlEl = root.querySelector(".url");
  this.pp = root.querySelector(".pp");
  var ol = root.querySelector(".chapters"), self = this;
  def.chapters.forEach(function(name, i){
    var li = document.createElement("li"); li.innerHTML = name + "<i></i>"; li.tabIndex = 0;
    li.addEventListener("click", function(){ self.jump(i); });
    li.addEventListener("keydown", function(e){ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.jump(i); } });
    ol.appendChild(li);
  });
  this.lis = ol.children;
  this.pp.addEventListener("click", function(){ self.setPaused(!self.paused); });
  this.fit(); window.addEventListener("resize", function(){ self.fit(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function(es){ es.forEach(function(e){ self.visible = e.isIntersecting; }); }, {threshold: .25}).observe(root);
  } else this.visible = true;
  this.reset();
  this.setPaused(reduce);
  this.loop();
}
Player.prototype.fit = function(){
  var w = this.screen.clientWidth, W = this.def.kind === "phone" ? 314 : 760;
  this.scale = w / W; this.vp.style.transform = "scale(" + this.scale + ")";
};
Player.prototype.setPaused = function(p){
  this.paused = p;
  this.pp.innerHTML = p ? '<svg viewBox="0 0 14 14"><path d="M3 1 L13 7 L3 13 Z"/></svg>' : '<svg viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12"/><rect x="8.5" y="1" width="3.5" height="12"/></svg>';
  this.pp.setAttribute("aria-label", p ? "Play demo" : "Pause demo");
};
Player.prototype.reset = function(){
  this.stage.innerHTML = this.def.html;
  this.toastEl.classList.remove("on");
  if (this.urlEl) this.urlEl.textContent = "";
  for (var i = 0; i < this.lis.length; i++) this.lis[i].className = "";
};
Player.prototype.jump = function(i){ this.skipTo = i; this.gen++; this.setPaused(false); };
Player.prototype.loop = function(){
  var self = this;
  (function next(){
    var g = self.gen;
    self.reset();
    self.fast = self.skipTo > 0;
    var api = self.api(g);
    Promise.resolve().then(function(){ return self.def.run(api); })
      .then(function(){ return api.wait(1200); })
      .catch(function(e){ if (e !== STOP) console.error(e); })
      .then(function(){ if (self.gen === g) self.skipTo = -1; setTimeout(next, 30); });
  })();
};
Player.prototype.api = function(g){
  var self = this, stage = this.stage;
  function alive(){ if (self.gen !== g) throw STOP; }
  var api = {
    $: function(s){ return stage.querySelector(s); },
    $$: function(s){ return stage.querySelectorAll(s); },
    wait: function(ms){
      return new Promise(function(res, rej){
        if (self.gen !== g) return rej(STOP);
        if (self.fast) return res();
        var left = ms, last = performance.now();
        (function tick(){
          if (self.gen !== g) return rej(STOP);
          var now = performance.now(), dt = now - last; last = now;
          if (!self.paused && self.visible && !document.hidden) left -= dt;
          if (left <= 0) return res();
          requestAnimationFrame(tick);
        })();
      });
    },
    chapter: function(i){
      alive();
      if (self.fast && i >= self.skipTo) self.fast = false;
      for (var k = 0; k < self.lis.length; k++) self.lis[k].className = k < i ? "done" : (k === i ? "now" : "");
    },
    scene: function(name){
      alive();
      var ss = stage.querySelectorAll(".scene");
      for (var k = 0; k < ss.length; k++) ss[k].classList.toggle("on", ss[k].getAttribute("data-s") === name);
    },
    url: function(t){ alive(); if (!self.urlEl) return; self.urlEl.textContent = t; self.urlEl.classList.add("flash"); setTimeout(function(){ self.urlEl.classList.remove("flash"); }, 500); },
    go: function(sel, dx, dy){
      alive();
      var el = typeof sel === "string" ? stage.querySelector(sel) : sel;
      if (!el) return api.wait(0);
      var r = el.getBoundingClientRect(), v = self.vp.getBoundingClientRect(), s = self.scale || 1;
      self.cursorEl.style.left = ((r.left - v.left + r.width * (dx == null ? .5 : dx)) / s) + "px";
      self.cursorEl.style.top = ((r.top - v.top + r.height * (dy == null ? .55 : dy)) / s) + "px";
      return api.wait(750);
    },
    tap: function(sel){
      return api.go(sel).then(function(){
        var el = typeof sel === "string" ? stage.querySelector(sel) : sel;
        self.cursorEl.classList.remove("tap"); void self.cursorEl.offsetWidth; self.cursorEl.classList.add("tap");
        if (el) { el.classList.remove("press"); void el.offsetWidth; el.classList.add("press"); }
        return api.wait(280);
      });
    },
    type: function(sel, text, ms){
      var el = typeof sel === "string" ? stage.querySelector(sel) : sel, i = 0;
      el.classList.add("typing"); el.textContent = "";
      if (self.fast) { el.textContent = text; el.classList.remove("typing"); return Promise.resolve(); }
      return new Promise(function(res, rej){
        (function step(){
          if (i >= text.length) { el.classList.remove("typing"); return res(); }
          el.textContent += text[i++];
          api.wait(ms || 45).then(step, rej);
        })();
      });
    },
    toast: function(t, ms){
      alive();
      self.toastEl.querySelector("span").textContent = t;
      self.toastEl.classList.add("on");
      return api.wait(ms || 2400).then(function(){ self.toastEl.classList.remove("on"); });
    }
  };
  return api;
};

/* ---------- HERON CA ---------- */
var heronCards = [
  ["Kika Vargas Print Dress","S","$252","$280","#C9B79A","dress"],
  ["Vince Playsuit Romper","M","$81","$90","#8B705A","blouse"],
  ["Hunter Rain Boots","8","$40.50","$45","#3C4A5C","boot"],
  ["Kate Spade Cream Blouse","L","$22.50","$25","#B85C49","blouse"],
  ["LeSportsac Striped Bag","","$34.20","$38","#5D6E52","bag"]
];
function heronCard(c, isNew){
  return '<div class="hr-card'+(isNew?' enter':'')+'"><div class="ph" style="background:'+(isNew?'#E9E4DA':'#F1EEE8')+'">'+(isNew?'<span class="new">NEW</span>':'')+garment(c[4], c[5])+'</div>' +
    '<p>'+c[0]+'</p><p>'+(c[1]?c[1]+' · ':'')+'<b>'+c[2]+'</b> <s>'+c[3]+'</s></p></div>';
}
var HERON = {
  label: "Demo: adding a product to Heron CA, from the admin panel to a printed price label and the live shop",
  chapters: ["The shop","Add an item","AI writes it","Photo from Google","Synced to Square","Label printed","Live on the site"],
  html:
   '<div class="scene hr on" data-s="shop">' +
     '<div class="hr-top"><span class="hr-logo">HERON <span style="font-size:12px;letter-spacing:0;border:1px solid;border-radius:50%;padding:0 4px">ca</span></span><span class="hr-bag">BAG 0</span></div>' +
     '<div class="hr-hero"><small>Venice Beach, California</small><div class="serif">Vintage. New. Ours.</div></div>' +
     '<div class="hr-grid" id="hgrid">' + heronCards.slice(0,4).map(function(c){ return heronCard(c); }).join("") + '</div>' +
   '</div>' +
   '<div class="scene hr" data-s="admin">' +
     '<div class="hr-top"><span class="yb"><i></i>YOUR BRAND</span><span style="font-size:10px;letter-spacing:.16em">ADMIN</span></div>' +
     '<div class="hr-admin" style="height:calc(100% - 46px)">' +
       '<div class="col">' +
         '<div class="hr-tabs"><span class="on">Add item</span><span>Inventory</span><span>Import eBay</span><span>Labels</span></div>' +
         '<div class="f"><label>Photos (first one is the cover)</label><div class="hr-photos"><div class="slot" id="s1">+</div><div class="slot" id="s2">+</div><div class="slot">+</div></div></div>' +
         '<div class="f"><label>Title</label><div class="in" id="ti"></div></div>' +
         '<div class="two"><div class="f"><label>Size</label><div class="in" id="sz"></div></div><div class="f"><label>Price ($)</label><div class="in" id="pr"></div></div></div>' +
         '<div class="f"><label>Description</label><div class="in tall" id="de"></div></div>' +
         '<div class="two"><div class="hb" id="ai">Write with AI<small>runs on your own AI key</small></div><div class="hb" id="gp">Find photo<small>your Google account</small></div></div>' +
         '<div class="two"><div class="hb dark" id="sv">Save to Square + site</div><div class="hb" id="pl">Print label</div></div>' +
       '</div>' +
       '<div class="col side">' +
         '<div class="hr-preview"><div class="ph" id="pvph"></div><p style="font-size:10px" id="pvt">Title</p><p style="font-size:10px"><b id="pvp">$0</b></p></div>' +
         '<div class="meter" id="m1"><span>AI writing · <b class="num" id="m1v">12</b>% of your monthly limit</span><div class="bar"><i style="width:12%"></i></div></div>' +
         '<div class="meter warn" id="m2"><span>Google images · <b class="num" id="m2v">82</b>% of your monthly limit</span><div class="bar"><i style="width:82%"></i></div></div>' +
         '<div class="meter"><span>Square · connected · last sync 2 min ago</span></div>' +
       '</div>' +
     '</div>' +
     '<div class="gpick" id="gk"><div class="q">&#128269; vince silk slip dress black</div><div class="g">' +
        '<div style="background:#EFEDE9">'+garment("#222")+'</div><div style="background:#E8E4DC" id="gsel">'+garment("#141414")+'</div><div style="background:#F2F0EC">'+garment("#2A2A2A","blouse")+'</div><div style="background:#ECE9E3">'+garment("#333")+'</div>' +
        '</div><small>Image search runs on your Google account. You set the monthly limit, we warn you before you reach it.</small></div>' +
     '<div class="printer" id="pn"><div class="lbl"><div class="t">Vince Silk Slip Dress, Black</div><div class="r"><span class="p">$128</span><span class="s">SIZE M</span></div>'+barcode(42)+'<div class="sku"><span>HC-V-DR-0042</span><span>ALL SALES FINAL</span></div></div><div class="body"></div></div>' +
   '</div>',
  run: async function(a){
    a.chapter(0); a.scene("shop"); a.url("heronca.com");
    await a.wait(1400); await a.go(".hr-card:nth-child(2)"); await a.wait(1100); await a.go(".hr-card:nth-child(4)"); await a.wait(900);
    a.chapter(1); a.url("heronca.com/admin"); a.scene("admin"); await a.wait(900);
    await a.tap("#s1"); a.$("#s1").classList.add("filled"); a.$("#s1").innerHTML = garment("#141414"); a.$("#pvph").innerHTML = garment("#141414"); await a.wait(400);
    await a.go("#ti"); await a.type("#ti", "Vince Silk Slip Dress, Black", 38); a.$("#pvt").textContent = "Vince Silk Slip Dress, Black";
    await a.go("#sz"); await a.type("#sz", "M", 80);
    await a.go("#pr"); await a.type("#pr", "128", 90); a.$("#pvp").textContent = "$128"; await a.wait(400);
    a.chapter(2); await a.tap("#ai"); a.$("#ai").firstChild.textContent = "Writing...";
    await a.type("#de", "Black silk slip dress by Vince. Bias cut, thin adjustable straps, midi length. Pre-owned in excellent condition. Pit to pit 17 in, length 46 in.", 18);
    a.$("#ai").firstChild.textContent = "Write with AI"; a.$("#m1v").textContent = "13"; a.$("#m1 .bar i").style.width = "13%";
    await a.toast("AI used your own key. Cost logged in your panel.", 2200);
    a.chapter(3); await a.tap("#gp"); a.$("#gk").classList.add("on"); await a.wait(900);
    await a.tap("#gsel"); a.$("#gsel").classList.add("sel"); await a.wait(700);
    a.$("#gk").classList.remove("on"); a.$("#s2").classList.add("filled"); a.$("#s2").innerHTML = garment("#141414");
    a.$("#m2v").textContent = "84"; a.$("#m2 .bar i").style.width = "84%";
    await a.toast("Google images at 84% of your limit. Email sent to you.", 2400);
    a.chapter(4); await a.tap("#sv"); a.$("#sv").textContent = "Saving..."; await a.wait(800); a.$("#sv").textContent = "Saved";
    await a.toast("Synced to Square and heronca.com · SKU HC-V-DR-0042", 2300);
    a.chapter(5); await a.tap("#pl"); a.$("#pn").classList.add("on"); await a.wait(500); a.$("#pn").classList.add("out"); await a.wait(3000);
    a.$("#pn").classList.remove("on"); await a.wait(400);
    a.chapter(6); a.url("heronca.com"); a.scene("shop");
    var g = a.$("#hgrid"); g.insertAdjacentHTML("afterbegin", heronCard(["Vince Silk Slip Dress","M","$128","$140","#141414","dress"], true)); g.lastElementChild.remove();
    await a.go(g.firstElementChild); await a.wait(3600);
  }
};

/* ---------- RUFCUT ---------- */
var FITS = {
  Slim:    "M14 22 H106 L100 196 H70 L60 76 L50 196 H20 Z",
  Straight:"M14 22 H106 L106 196 H68 L60 76 L52 196 H14 Z",
  Relaxed: "M12 22 H108 L114 196 H70 L60 76 L50 196 H6 Z"
};
var WASH = { Raw:"#1B2A4E", Rinse:"#2D4677", Stone:"#6C86B5" };
var THREAD = { Copper:"#E08A3C", Gold:"#D9B44A", Tonal:"#4A5E8C" };
function bit(cls, txt, m, t){ /* m,t: [x,y,w,h,rot] messy and tidy */
  return '<div class="bit '+cls+'" data-t="'+t.join(",")+'" style="left:'+m[0]+'px;top:'+m[1]+'px;'+(m[2]?'width:'+m[2]+'px;':'')+(m[3]?'height:'+m[3]+'px;':'')+'transform:rotate('+m[4]+'deg)">'+txt+'</div>';
}
var RUFCUT = {
  label: "Demo: Rufcut's cluttered site cleaned up, then the jeans builder and the workshop order board",
  chapters: ["The old site","Cleaned up","Jeans builder","Order in the workshop","Customer gets a text"],
  html:
   '<div class="scene rc-old on" data-s="old" id="old"><span class="rc-before" id="bf">BEFORE</span>' +
     bit("rc-nav","<span>HOME</span>|<span>Jeans</span>|<span>ABOUT US</span>|<span>press</span>|<span>Contact!!</span>|<span>Reviews</span>",[300,14,330,0,2],[30,22,520,0,0]) +
     bit("rc-banner","WELCOME 2 RUFCUT JEANS!!! CUSTOM DENIM!!!",[24,48,400,0,-3],[30,70,350,0,0]) +
     bit("rc-pic","",[520,70,170,120,6],[420,60,300,300,0]) +
     bit("rc-txt","We make custom jeans in Venice!! Call us or come by the shop. We also have vintage levis and do repairs. Click here for more info about our workshop and press!!!",[190,150,230,0,2],[30,200,330,0,0]) +
     bit("rc-pic","",[50,250,120,90,-7],[30,330,105,90,0]) +
     bit("rc-pic","",[300,320,150,100,4],[145,330,105,90,0]) +
     bit("rc-btn","CLICK HERE",[590,290,0,0,-10],[30,272,0,0,0]) +
     bit("rc-stamp","AS SEEN IN PRESS!!",[40,170,0,0,-8],[40,170,0,0,0]) +
     bit("rc-txt","Hours: mon-fri 11-6 sat sun 10-7 (sometimes)",[480,380,200,0,-2],[260,330,150,0,0]) +
   '</div>' +
   '<div class="scene" data-s="build"><div class="rc-b">' +
     '<div class="opts">' +
       '<div style="font:400 26px/1 var(--display)">BUILD YOUR PAIR</div>' +
       '<div class="grp"><span>01 FIT</span><div class="chips" data-g="fit"><b>Slim</b><b class="on">Relaxed</b><b>Straight</b></div></div>' +
       '<div class="grp"><span>02 DENIM</span><div class="chips"><b class="on">Raw selvedge</b><b>Stretch</b></div></div>' +
       '<div class="grp"><span>03 WASH</span><div class="chips" data-g="wash"><b class="on">Raw</b><b>Rinse</b><b>Stone</b></div></div>' +
       '<div class="grp"><span>04 THREAD</span><div class="chips" data-g="thread"><b class="on">Tonal</b><b>Gold</b><b>Copper</b></div></div>' +
       '<div class="grp"><span>05 HEM</span><div class="chips" data-g="hem"><b class="on">Cuffed</b><b>Chain stitch</b></div></div>' +
       '<div class="grp" style="margin-top:4px"><b id="ord" style="display:inline-block;background:#E08A3C;color:#16223F;font:500 11px var(--mono);letter-spacing:.06em;padding:10px 14px;width:max-content">ORDER · $45 DEPOSIT</b></div>' +
     '</div>' +
     '<div class="pants"><svg viewBox="0 0 120 200" aria-hidden="true"><rect x="12" y="6" width="96" height="16" fill="#0F1A33"/><path id="leg" d="'+FITS.Relaxed+'" fill="'+WASH.Raw+'" style="transition:fill .5s"/><path id="st" d="M18 28 H102 M60 28 V74 M24 40 Q40 52 52 40" stroke="'+THREAD.Tonal+'" stroke-width="1.6" stroke-dasharray="3 2.4" fill="none" style="transition:stroke .5s"/><circle cx="60" cy="14" r="3.5" fill="#B87333"/></svg>' +
       '<div class="ready"><span>READY</span><strong id="rd">THURSDAY, OCT 8</strong></div></div>' +
   '</div></div>' +
   '<div class="scene" data-s="board"><div class="rc-k">' +
     '<div class="h"><span class="yb"><i></i>YOUR BRAND</span><b>WORKSHOP · ORDERS</b><span>Today · 6 open</span></div>' +
     '<div class="cols" id="cols">' +
       '<div class="col"><span>Cut <em>2</em></span><div class="card old">#1039 · Slim · Rinse</div></div>' +
       '<div class="col"><span>Sew <em>2</em></span><div class="card old">#1036 · Jacket · Raw</div><div class="card old">#1037 · Straight · Stone</div></div>' +
       '<div class="col"><span>Finish <em>1</em></span><div class="card old">#1034 · Relaxed · Raw</div></div>' +
       '<div class="col"><span>Ready <em>1</em></span><div class="card old">#1031 · Repair · Knee patch</div></div>' +
       '<div class="card mv" id="mv" style="opacity:0"><b>#1042 · Maya R.</b><br>Straight · Rinse · <em>Copper</em><br>Chain stitch hem</div>' +
     '</div>' +
   '</div></div>',
  run: async function(a){
    a.chapter(0); a.scene("old"); a.url("rufcut.com");
    await a.wait(900); await a.go(".rc-btn"); await a.wait(700); await a.go(".rc-nav"); await a.wait(800); await a.go(".rc-stamp"); await a.wait(900);
    a.chapter(1);
    var old = a.$("#old"); old.classList.add("tidy"); a.$("#bf").textContent = "AFTER · SAME CONTENT, ORGANIZED";
    a.$$(".bit").forEach(function(b){ var t = b.getAttribute("data-t").split(","); b.style.left = t[0]+"px"; b.style.top = t[1]+"px"; if (+t[2]) b.style.width = t[2]+"px"; if (+t[3]) b.style.height = t[3]+"px"; b.style.transform = "rotate(0deg)"; });
    await a.wait(600);
    a.$(".rc-banner").textContent = "YOUR FIT. CUT IN 3 TO 5 DAYS.";
    a.$(".rc-nav").innerHTML = "<span>BUILD YOUR JEANS</span><span>VINTAGE</span><span>REPAIRS</span><span>VISIT</span>";
    a.$(".rc-txt").textContent = "A denim workshop in Venice Beach. Build your pair online, see the ready date, pick it up in 3 to 5 days. Vintage Levi's and repairs too.";
    a.$$(".rc-txt")[1].textContent = "Open daily. Hours update from the panel.";
    a.$(".rc-btn").textContent = "Build your pair";
    await a.wait(2400); await a.tap(".rc-btn");
    a.chapter(2); a.url("rufcut.com/build"); a.scene("build"); await a.wait(700);
    function pick(group, name){ var bs = a.$$('[data-g="'+group+'"] b'); var el; bs.forEach(function(b){ var on = b.textContent === name; b.classList.toggle("on", on); if (on) el = b; }); return el; }
    function chip(group, name){ var bs = a.$$('[data-g="'+group+'"] b'); for (var i = 0; i < bs.length; i++) if (bs[i].textContent === name) return bs[i]; }
    await a.tap(chip("fit","Straight")); pick("fit","Straight"); a.$("#leg").setAttribute("d", FITS.Straight); await a.wait(500);
    await a.tap(chip("wash","Rinse")); pick("wash","Rinse"); a.$("#leg").style.fill = WASH.Rinse; await a.wait(500);
    await a.tap(chip("thread","Copper")); pick("thread","Copper"); a.$("#st").style.stroke = THREAD.Copper; await a.wait(500);
    await a.tap(chip("hem","Chain stitch")); pick("hem","Chain stitch"); a.$("#rd").textContent = "FRIDAY, OCT 9"; await a.wait(900);
    await a.tap("#ord"); await a.toast("Deposit paid · order #1042 · ready Friday", 2000);
    a.chapter(3); a.url("rufcut.com/admin/orders"); a.scene("board"); await a.wait(600);
    var cols = a.$$("#cols .col"), mv = a.$("#mv");
    function place(i){ var cs = cols[i].querySelectorAll(".card"), last = cs[cs.length-1]; mv.style.left = (cols[i].offsetLeft + 8) + "px"; mv.style.width = (cols[i].offsetWidth - 16) + "px"; mv.style.top = (last.offsetTop + last.offsetHeight + 6) + "px"; }
    mv.style.transition = "none"; place(0); void mv.offsetWidth; mv.style.transition = ""; mv.style.opacity = 1;
    await a.go(mv); await a.wait(1100);
    for (var i = 1; i < 4; i++) { place(i); await a.wait(300); await a.go(mv); await a.wait(900); }
    a.chapter(4); await a.toast("Text sent to Maya: your jeans are ready for pickup.", 3400);
  }
};

/* ---------- LALOO ---------- */
var LL_TXT = {
  EN:{s:"Restroom near me",q:"Where to?", t1:"Public restroom · Windward Plaza", r1:"<b>3 min</b> walk · Free · ★ 4.6 · Open now", go:"Walk there", ad:"On your way · 1 min off route", ad2:"Vintage and coastal apparel. Show laloo for 10% off.", sp:"Local · sponsored"},
  TR:{s:"Yakındaki tuvalet",q:"Nereye?", t1:"Umumi tuvalet · Windward Plaza", r1:"<b>3 dk</b> yürüme · Ücretsiz · ★ 4.6 · Açık", go:"Yürü", ad:"Yolunun üstünde · 1 dk sapma", ad2:"Vintage ve sahil giyim. laloo'yu göster, %10 indirim.", sp:"Yerel · sponsorlu"},
  ES:{s:"Baño cerca de mí",q:"¿Adónde?", t1:"Baño público · Windward Plaza", r1:"<b>3 min</b> a pie · Gratis · ★ 4.6 · Abierto", go:"Ir caminando", ad:"En tu camino · 1 min de desvío", ad2:"Ropa vintage y costera. Muestra laloo: 10% menos.", sp:"Local · patrocinado"},
  JA:{s:"近くのトイレ",q:"どこへ？", t1:"公衆トイレ · Windward Plaza", r1:"徒歩<b>3分</b> · 無料 · ★ 4.6 · 営業中", go:"歩いて行く", ad:"ルート上 · 1分の寄り道", ad2:"ヴィンテージとコースタル服。laloo提示で10%オフ。", sp:"地元 · スポンサー"}
};
var LALOO = {
  kind: "phone",
  label: "Demo: the laloo map finding the nearest restroom, a local shop on the route, language switching and the admin approving a business",
  chapters: ["Find the nearest loo","Walk there","Shops on the way","12 languages","Admin approves a shop"],
  html:
   '<div class="scene ll on" data-s="map">' +
     '<div class="ll-map"><div class="ll-sea"></div><div class="ll-sand"></div><div class="ll-park"></div></div>' +
     '<svg class="ll-route" viewBox="0 0 314 624" aria-hidden="true"><path id="rt" d="M176 430 L176 360 L132 330 L118 268" style="opacity:0"/></svg>' +
     '<div class="ll-search"><img src="assets/laloo-logo.png" alt=""><span id="q">Where to?</span></div>' +
     '<div class="ll-langs" id="lg"><b class="on">EN</b><b>TR</b><b>ES</b><b>JA</b><b>+8</b></div>' +
     '<i class="pin" style="left:226px;top:200px"></i><i class="pin" style="left:250px;top:330px"></i><i class="pin" style="left:90px;top:420px"></i><i class="pin best" id="best" style="left:118px;top:268px"></i>' +
     '<i class="pin shop" id="shop" style="left:150px;top:340px"></i>' +
     '<span class="me" style="left:176px;top:430px"></span>' +
     '<div class="sheet" id="sh1"><h4 id="t1"></h4><div class="row" id="r1"></div><div class="go" id="go"></div></div>' +
     '<div class="sheet" id="sh2"><span class="tagline" id="sp"></span><div class="ad"><span class="lg">H</span><div><h4>Heron CA</h4><div class="row" id="ad"></div></div></div><div class="row" id="ad2"></div></div>' +
   '</div>' +
   '<div class="scene" data-s="admin"><div class="ll-admin">' +
     '<div class="h"><span class="yb"><i></i>YOUR BRAND</span><span>ADMIN</span></div>' +
     '<div class="ll-stats"><div><small>Places listed</small><b id="pl">1,284</b></div><div><small>QR scans today</small><b id="sc">312</b></div></div>' +
     '<div class="ll-req hl" id="rq"><div class="top2"><span class="lg">H</span><div><b style="font-size:13px">Heron CA wants to join</b><p>Shop · Venice Beach · on 3 walking routes · Sponsored plan</p></div></div>' +
       '<div class="btns"><span>Reject</span><span class="ok" id="ap">Approve</span></div><div class="st">Approved · now on the map in 12 languages</div></div>' +
     '<div class="ll-feed" id="fd"><div><span><b>New review</b> ★5 · Rose Ave</span><span>2m</span></div><div><span><b>QR scan</b> · Windward Plaza</span><span>4m</span></div></div>' +
   '</div></div>',
  run: async function(a){
    function lang(k, typed){ var T = LL_TXT[k]; a.$("#q").textContent = typed ? T.s : T.q; a.$("#t1").textContent = T.t1; a.$("#r1").innerHTML = T.r1; a.$("#go").textContent = T.go; a.$("#ad").textContent = T.ad; a.$("#ad2").textContent = T.ad2; a.$("#sp").textContent = T.sp;
      a.$$("#lg b").forEach(function(b){ b.classList.toggle("on", b.textContent === k); }); }
    a.chapter(0); a.scene("map"); lang("EN"); await a.wait(900);
    await a.tap(".ll-search"); await a.type("#q", "Restroom near me", 55);
    var pins = a.$$(".pin:not(.shop)"); for (var i = 0; i < pins.length; i++) { pins[i].classList.add("on"); await a.wait(220); }
    await a.wait(300); a.$("#sh1").classList.add("on"); await a.wait(1600);
    a.chapter(1); await a.tap("#go");
    var p = a.$("#rt"), L = p.getTotalLength(); p.style.opacity = 1; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.style.transition = "none"; void p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset 1.8s ease-in-out"; p.style.strokeDashoffset = 0; await a.wait(2000);
    a.chapter(2); a.$("#shop").classList.add("on"); await a.wait(500); a.$("#sh1").classList.remove("on"); a.$("#sh2").classList.add("on"); await a.go("#shop"); await a.wait(2200);
    a.chapter(3); a.$("#sh2").classList.remove("on"); a.$("#sh1").classList.add("on");
    var ks = ["TR","ES","JA","EN"];
    for (var j = 0; j < ks.length; j++) { var b; a.$$("#lg b").forEach(function(x){ if (x.textContent === ks[j]) b = x; }); await a.tap(b); lang(ks[j], true); await a.wait(1100); }
    a.chapter(4); a.scene("admin"); await a.wait(1000);
    await a.tap("#ap"); a.$("#rq").classList.add("done"); a.$("#rq").classList.remove("hl"); a.$("#pl").textContent = "1,285";
    a.$("#fd").insertAdjacentHTML("afterbegin", '<div><span><b>Heron CA</b> is live on the map</span><span>now</span></div>');
    await a.wait(1200); a.$("#sc").textContent = "313"; await a.wait(2600);
  }
};

var DEFS = { heron: HERON, rufcut: RUFCUT, laloo: LALOO };
function mount(el){ if (el.__player) return el.__player; var d = DEFS[el.getAttribute("data-demo")]; if (d) el.__player = new Player(el, d); return el.__player; }
window.MrDemos = { mount: mount };
document.querySelectorAll("[data-demo]:not([data-lazy])").forEach(mount);
})();
