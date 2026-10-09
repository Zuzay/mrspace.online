// ms-square · Mr. Space Square baglantisi
// Musteri kendi Square hesabini panelden baglar. Stok, katalog, urun ekleme, etiket verisi buradan.
//   GET  /ms-square/callback   Square'in geri dondugu adres (Square uygulamasinda Redirect URL olarak yazilir)
//   GET  /ms-square/public?site=rufcut   sitede gosterilecek stok (sadece "public_catalog" acikken)
//   POST /ms-square  {action, site, ...}  panel islemleri (giris yapmis kullanici)
// Supabase'de "Enforce JWT verification" KAPALI olmali (callback ve public girissiz cagrilir; POST'ta kullanici ayrica dogrulanir).
// Ortam degiskenleri: SQUARE_APP_ID, SQUARE_APP_SECRET, SQUARE_ENV (production | sandbox)

import { createClient } from "jsr:@supabase/supabase-js@2";
import "../../../assets/ms-site-catalog.js";
import "../../../assets/ms-commerce.js";
// @ts-ignore Shared pre-launch commerce contract.
const Commerce = globalThis.MsCommerce;
// @ts-ignore Shared browser/server publication contract.
const SiteCatalog = globalThis.MsSiteCatalog;

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_ID = Deno.env.get("SQUARE_APP_ID") || "";
const APP_SECRET = Deno.env.get("SQUARE_APP_SECRET") || "";
const SANDBOX = Deno.env.get("SQUARE_ENV") === "sandbox";
const API = SANDBOX ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
const VERSION = "2025-01-23";
const PANEL = "https://mrspace.online/panel/";
const CALLBACK = `${SB_URL}/functions/v1/ms-square/callback`;
const SCOPES = ["MERCHANT_PROFILE_READ", "ITEMS_READ", "ITEMS_WRITE", "INVENTORY_READ", "INVENTORY_WRITE", "ORDERS_READ"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
};
const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

// ---------- imzali state (baglanti sirasinda sahteciligi onler) ----------
const te = new TextEncoder();
const b64url = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
async function sign(data: string) {
  const key = await crypto.subtle.importKey("raw", te.encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(data))));
}

// ---------- Square ----------
async function sq(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, "Square-Version": VERSION, "Content-Type": "application/json" } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.errors?.[0]?.detail || `square_${r.status}`);
  return d;
}
async function oauthToken(body: Record<string, string>) {
  const r = await fetch(API + "/oauth2/token", {
    method: "POST", headers: { "Square-Version": VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: APP_ID, client_secret: APP_SECRET, ...body }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.errors?.[0]?.detail || d.message || "token_failed");
  return d;
}
type Acc = { site: string; access_token: string; refresh_token: string | null; expires_at: string | null; location_id: string | null;
  location_name: string | null; currency: string; sku_prefix: string | null; public_catalog: boolean; merchant_id: string | null;
  hidden_catalog_items?: string[] };
async function account(site: string): Promise<Acc | null> {
  const { data } = await db.from("ms_square").select("*").eq("site", site).maybeSingle();
  if (!data || !data.access_token) return null;
  if (data.refresh_token && data.expires_at && new Date(data.expires_at).getTime() < Date.now() + 3 * 86400e3) {
    const t = await oauthToken({ grant_type: "refresh_token", refresh_token: data.refresh_token });
    await db.from("ms_square").update({ access_token: t.access_token, refresh_token: t.refresh_token || data.refresh_token,
      expires_at: t.expires_at, updated_at: new Date().toISOString() }).eq("site", site);
    data.access_token = t.access_token;
  }
  return data as Acc;
}

type Variation = { id: string; name: string; sku: string; upc: string; price: number | null; currency: string; track: boolean; stock: number | null; image?: string | null };
type Item = { id: string; name: string; description: string; image: string | null; variations: Variation[] };
async function uploadSquareImage(acc: Acc, itemId: string, dataUrl: string, name: string, primary: boolean) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("bad_image");
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (bytes.length > 5 * 1024 * 1024) throw new Error("image_too_large");
  const form = new FormData();
  form.append("request", JSON.stringify({
    idempotency_key: crypto.randomUUID(), object_id: itemId, is_primary: primary,
    image: { type: "IMAGE", id: "#img", image_data: { name } },
  }));
  form.append("image_file", new Blob([bytes], { type: m[1] }), `${name}.${m[1].split("/")[1]}`);
  const res = await fetch(API + "/v2/catalog/images", { method: "POST", headers: { Authorization: `Bearer ${acc.access_token}`, "Square-Version": VERSION }, body: form });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.errors?.[0]?.detail || `square_image_${res.status}`);
}
// deno-lint-ignore no-explicit-any
async function catalog(acc: Acc): Promise<Item[]> {
  // deno-lint-ignore no-explicit-any
  const objs: any[] = []; let cursor = "";
  for (let i = 0; i < 30; i++) {
    const d = await sq(acc.access_token, `/v2/catalog/list?types=ITEM,IMAGE${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    objs.push(...(d.objects || [])); if (!d.cursor) break; cursor = d.cursor;
  }
  const images = new Map(objs.filter((o) => o.type === "IMAGE").map((o) => [o.id, o.image_data?.url as string]));
  const items: Item[] = objs.filter((o) => o.type === "ITEM" && !o.is_deleted).map((o) => ({
    id: o.id, name: o.item_data?.name || "",
    description: o.item_data?.description_plaintext || o.item_data?.description || "",
    image: images.get((o.item_data?.image_ids || [])[0]) || null,
    // deno-lint-ignore no-explicit-any
    variations: (o.item_data?.variations || []).filter((v: any) => !v.is_deleted).map((v: any) => ({
      id: v.id, name: v.item_variation_data?.name || "", sku: v.item_variation_data?.sku || "", upc: v.item_variation_data?.upc || "",
      price: v.item_variation_data?.price_money?.amount ?? null, currency: v.item_variation_data?.price_money?.currency || acc.currency,
      track: !!v.item_variation_data?.track_inventory, stock: null,
      image: images.get((v.item_variation_data?.image_ids || [])[0]) || null,
    })),
  }));
  const ids = items.flatMap((i) => i.variations.map((v) => v.id));
  const stock = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 500) {
    let c = "";
    do {
      const d = await sq(acc.access_token, "/v2/inventory/counts/batch-retrieve", { method: "POST", body: JSON.stringify({
        catalog_object_ids: ids.slice(i, i + 500), location_ids: acc.location_id ? [acc.location_id] : undefined, states: ["IN_STOCK"], cursor: c || undefined }) });
      for (const k of d.counts || []) stock.set(k.catalog_object_id, (stock.get(k.catalog_object_id) || 0) + Number(k.quantity || 0));
      c = d.cursor || "";
    } while (c);
  }
  items.forEach((it) => it.variations.forEach((v) => { v.stock = stock.has(v.id) ? stock.get(v.id)! : (v.track ? 0 : null); }));
  return items.sort((a, b) => a.name.localeCompare(b.name));
}
async function rawCatalogItems(acc: Acc) {
  // deno-lint-ignore no-explicit-any
  const out: any[] = []; let cursor = "";
  for (let i = 0; i < 30; i++) {
    const d = await sq(acc.access_token, `/v2/catalog/list?types=ITEM${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    out.push(...(d.objects || [])); if (!d.cursor) break; cursor = d.cursor;
  }
  return out;
}
async function setCount(acc: Acc, variationId: string, qty: number) {
  if (!acc.location_id) throw new Error("no_location");
  await sq(acc.access_token, "/v2/inventory/changes/batch-create", { method: "POST", body: JSON.stringify({
    idempotency_key: crypto.randomUUID(),
    changes: [{ type: "PHYSICAL_COUNT", physical_count: { catalog_object_id: variationId, state: "IN_STOCK", location_id: acc.location_id,
      quantity: String(Math.max(0, Math.floor(qty))), occurred_at: new Date().toISOString() } }] }) });
}
async function publications(site: string) {
  const {data,error}=await db.from("ms_catalog_publications").select("*").eq("site",site);
  if(error)throw new Error("catalog_settings_unavailable");
  return new Map((data||[]).map((rule: any)=>[rule.item_id,rule]));
}
async function savePublication(site: string,item: Item,input: any,email: string) {
  // Older open panel tabs do not send these fields; retain the curated placement.
  const previous=input&&(input.category===undefined||input.display_order===undefined)?(await publications(site)).get(item.id):null;
  const clean=SiteCatalog.validate(item,input?{...input,category:input.category===undefined?previous?.category:input.category,display_order:input.display_order===undefined?previous?.display_order:input.display_order}:input,site);
  const {error}=await db.from("ms_catalog_publications").upsert({site,item_id:item.id,...clean,updated_by:email,updated_at:new Date().toISOString()},{onConflict:"site,item_id"});
  if(error)throw new Error("catalog_save_failed");
  return clean;
}
const uuid=(value: unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:crypto.randomUUID();
const log = (site: string, action: string, who = "client") => db.from("ms_activity").insert({ site, who, action });

// ---------- kim cagiriyor ----------
async function who(req: Request) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await db.auth.getUser(jwt);
  return data?.user?.email?.toLowerCase() || null;
}
async function role(email: string | null, site: string): Promise<"admin" | "client" | null> {
  if (!email || !site) return null;
  const a = await db.from("ms_admins").select("email").eq("email", email).maybeSingle();
  if (a.error) throw new Error("access_check_failed");
  if (a.data) return "admin";
  const viewer=await db.from("ms_viewers").select("until").eq("email",email).maybeSingle();
  if(viewer.error)throw new Error("access_check_failed");
  if(viewer.data&&(!viewer.data.until||viewer.data.until>=new Date().toISOString().slice(0,10)))return null;
  const m = await db.from("ms_site_users").select("email").eq("email", email).eq("site", site).maybeSingle();
  if(m.error)throw new Error("access_check_failed");
  return m.data ? "client" : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  try {
    // ----- Square'den donus -----
    if (url.pathname.endsWith("/callback")) {
      const back = (q: string) => Response.redirect(PANEL + q, 302);
      const state = url.searchParams.get("state") || "", code = url.searchParams.get("code");
      const [payload, sig] = state.split(".");
      if (!payload || !sig || sig !== await sign(payload)) return back("?square=bad_state");
      const st = JSON.parse(unb64(payload));
      if (st.exp < Date.now()) return back("?square=expired");
      if (!code) return back(`?square=${encodeURIComponent(url.searchParams.get("error") || "cancelled")}&site=${st.site}`);
      const t = await oauthToken({ grant_type: "authorization_code", code, redirect_uri: CALLBACK });
      const locs = await sq(t.access_token, "/v2/locations");
      // deno-lint-ignore no-explicit-any
      const loc = (locs.locations || []).find((l: any) => l.status === "ACTIVE") || (locs.locations || [])[0] || {};
      await db.from("ms_square").upsert({
        site: st.site, merchant_id: t.merchant_id, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at,
        location_id: loc.id || null, location_name: loc.name || null, currency: loc.currency || "USD",
        sku_prefix: st.site.slice(0, 2).toUpperCase(), connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      await log(st.site, `Square connected (${loc.name || "location"})`, st.role === "admin" ? "uzay" : "client");
      return back(`?square=ok&site=${st.site}`);
    }

    // ----- sitenin kendisi icin stok -----
    if (url.pathname.endsWith("/public")) {
      const site = url.searchParams.get("site") || "";
      const acc = await account(site);
      if (!acc || !acc.public_catalog) return json({ items: [] }, 200, { "Cache-Control": "public, max-age=60" });
      const rules=await publications(site),hidden=new Set(acc.hidden_catalog_items||[]);
      const items=SiteCatalog.sort((await catalog(acc)).filter(i=>!hidden.has(i.id)).flatMap(i=>SiteCatalog.cards(i,rules.get(i.id))));
      return json({items},200,{"Cache-Control":"public, max-age=30"});
    }

    // ----- panel islemleri -----
    if (req.method !== "POST") return json({ error: "method" }, 405);
    const body = await req.json().catch(() => ({}));
    const site = String(body.site || "");
    const email = await who(req);
    const r = await role(email, site);
    if (!r) return json({ error: "not_allowed" }, 403);
    const action = body.action;

    if (action === "connect") {
      if (!APP_ID || !APP_SECRET) return json({ error: "square_not_configured" }, 500);
      const payload = b64url(te.encode(JSON.stringify({ site, role: r, exp: Date.now() + 15 * 60e3 })));
      const state = `${payload}.${await sign(payload)}`;
      const auth = `${API}/oauth2/authorize?client_id=${encodeURIComponent(APP_ID)}&scope=${[...new Set([...SCOPES,...(body.commerce===true?Commerce.permissions:[])])].join("+")}` +
        `${SANDBOX ? "" : "&session=false"}&redirect_uri=${encodeURIComponent(CALLBACK)}&state=${encodeURIComponent(state)}`;
      return json({ url: auth });
    }

    const acc = await account(site);
    if (action === "status") {
      return json(acc ? { connected: true, location: acc.location_name, currency: acc.currency, public: acc.public_catalog, sandbox: SANDBOX }
                      : { connected: false, configured: !!APP_ID, sandbox: SANDBOX });
    }
    if (["commerce_status","commerce_save","commerce_quote"].includes(action)) {
      const {data,error}=await db.from("ms_commerce_setups").select("setup").eq("site",site).maybeSingle();
      if(error)throw new Error("commerce_load_failed");
      const setup=data?.setup||Commerce.blank(),rules=acc?await publications(site):new Map();
      const all=acc?await catalog(acc):[],items=all.filter(i=>rules.get(i.id)?.section==="shop"&&!acc?.hidden_catalog_items?.includes(i.id)).map(i=>({...i,variations:i.variations.filter(v=>rules.get(i.id)?.variations?.[v.id]?.visible===true)}));
      if(action==="commerce_save") {
        const clean=Commerce.validate(body.setup,new Set(all.map(i=>i.id)));
        const {error}=await db.from("ms_commerce_setups").upsert({site,setup:clean,updated_at:new Date().toISOString(),updated_by:email},{onConflict:"site"});
        if(error)throw new Error("commerce_save_failed");
        return json({setup:clean,checkout_live:false});
      }
      if(action==="commerce_quote")return json(Commerce.quote(setup,items,body.quote,acc?.currency));
      let scopes=null; if(acc)try{scopes=(await sq(acc.access_token,"/oauth2/token/status",{method:"POST"})).scopes||[];}catch{/* Unknown permissions are never treated as granted. */}
      return json({setup,currency:acc?.currency||null,connected:!!acc,items,readiness:Commerce.readiness(setup,acc,scopes,items)});
    }
    if (!acc) return json({ error: "not_connected" }, 400);

    if (action === "catalog") {
      const rules=await publications(site);
      return json({items:(await catalog(acc)).map(i=>({...i,publication:SiteCatalog.settings(i,rules.get(i.id)),needs_review:SiteCatalog.pending(i,rules.get(i.id))})),sections:SiteCatalog.sections(site),public:acc.public_catalog,location:acc.location_name,currency:acc.currency});
    }

    if (action === "set_count") {
      const owner=(await catalog(acc)).find(i=>i.variations.some(v=>v.id===body.variation));
      if(!owner)return json({error:"item_not_found"},404);
      if(!Number.isSafeInteger(body.qty)||body.qty<0||body.qty>1000000)return json({error:"bad_quantity"},400);
      await setCount(acc, String(body.variation), Number(body.qty));
      await log(site, `Stock set: ${String(body.label || body.variation).slice(0, 80)} = ${Math.max(0, Math.floor(Number(body.qty)))}`, r === "admin" ? "uzay" : "client");
      return json({ ok: true });
    }

    if (action === "assign_missing_skus") {
      const objects = await rawCatalogItems(acc), used = new Set<string>();
      for (const item of objects) for (const v of item.item_data?.variations || []) {
        const sku = String(v.item_variation_data?.sku || "").trim(); if (sku) used.add(sku.toLowerCase());
      }
      const updates = [];
      for (const item of objects) {
        if (item.is_deleted) continue;
        for (const v of item.item_data?.variations || []) {
          const data = v.item_variation_data || {};
          if (v.is_deleted || String(data.sku || "").trim()) continue;
          let sku = "";
          do { sku = `${acc.sku_prefix || site.slice(0, 2).toUpperCase()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`; }
          while (used.has(sku.toLowerCase()));
          used.add(sku.toLowerCase());
          updates.push({ ...v, item_variation_data: { ...data, sku } });
        }
      }
      for (let i = 0; i < updates.length; i += 1000) {
        const d = await sq(acc.access_token, "/v2/catalog/batch-upsert", { method: "POST", body: JSON.stringify({
          idempotency_key: crypto.randomUUID(), batches: [{ objects: updates.slice(i, i + 1000) }],
        }) });
        if (d.errors?.length) throw new Error(d.errors[0].detail || "sku_update_failed");
      }
      await log(site, `Missing SKUs assigned: ${updates.length}`, r === "admin" ? "uzay" : "client");
      return json({ ok: true, updated: updates.length });
    }

    if (action === "save_publication") {
      const item=(await catalog(acc)).find(i=>i.id===body.item);
      if(!item)return json({error:"item_not_found"},404);
      const publication=await savePublication(site,item,body.publication,email!);
      await log(site,`Website placement: ${item.name} -> ${publication.section} / ${publication.layout}`,r==="admin"?"uzay":"client");
      return json({ok:true,publication});
    }

    if (action === "add_item" || action === "add_variation") {
      const isVariant=action==="add_variation",name=String(body.name||"").trim().slice(0,255),cents=Math.round(Number(body.price)*100),qty=Number(body.qty||0);
      const parent=isVariant?(await catalog(acc)).find(i=>i.id===body.item):null;
      if(isVariant&&!parent)return json({error:"item_not_found"},404);
      if((!isVariant&&!name)||!String(body.variant||"").trim()&&isVariant||typeof body.price!=="number"||!Number.isSafeInteger(cents)||cents<0||!Number.isSafeInteger(qty)||qty<0||qty>1000000)return json({error:"bad_item"},400);
      // Validate placement before any Square write. Variant IDs are assigned by Square below.
      if(!isVariant)SiteCatalog.validate({variations:[{id:"new"}]},{section:body.section||"review",category:body.category??"other",display_order:body.display_order??100,layout:"grouped",title:"",variations:{new:{visible:true,title:""}}},site);
      const sku=String(body.sku||"").trim().slice(0,40)||`${acc.sku_prefix||site.slice(0,2).toUpperCase()}-${uuid(body.submission_token).replace(/-/g,"").slice(0,12).toUpperCase()}`;
      const variationData={item_id:parent?.id||"#item",name:String(body.variant||"Regular").trim().slice(0,255),sku,pricing_type:"FIXED_PRICING",price_money:{amount:cents,currency:acc.currency||"USD"},track_inventory:body.track!==false};
      const variantObject={type:"ITEM_VARIATION",id:"#var",present_at_all_locations:true,item_variation_data:variationData};
      const d=await sq(acc.access_token,"/v2/catalog/object",{method:"POST",body:JSON.stringify({idempotency_key:uuid(body.submission_token),object:isVariant?variantObject:{type:"ITEM",id:"#item",present_at_all_locations:true,item_data:{name,description:body.description?String(body.description).slice(0,4000):undefined,variations:[variantObject]}}})});
      const itemId=parent?.id||d.catalog_object?.id,variation=isVariant?d.catalog_object?.id:d.catalog_object?.item_data?.variations?.[0]?.id;
      if(!itemId||!variation)throw new Error("square_item_not_confirmed");
      let stock_error: string|null=null,image_error: string|null=null,publication_error: string|null=null,photos_uploaded=0;
      if(variationData.track_inventory&&qty)try{await setCount(acc,variation,qty);}catch(e){stock_error=String(e.message||e).slice(0,200);}
      const images=Array.isArray(body.images)?body.images.slice(0,6):[];
      for(let i=0;i<images.length;i++)try{await uploadSquareImage(acc,itemId,String(images[i]),`${sku}-${i+1}`,i===0);photos_uploaded++;}catch(e){image_error=String(e.message||e).slice(0,200);break;}
      if(!isVariant)try{await savePublication(site,{id:itemId,name,description:"",image:null,variations:[{id:variation,name:variationData.name,sku,upc:"",price:cents,currency:acc.currency,track:variationData.track_inventory,stock:qty}]},{section:body.section||"review",category:body.category??"other",display_order:body.display_order??100,layout:"grouped",title:"",variations:{[variation]:{visible:true,title:""}}},email!);}catch(e){publication_error=String(e.message||e).slice(0,200);}
      await log(site,`Square ${isVariant?"variation":"item"} added: ${name||parent?.name} (${sku})`,r==="admin"?"uzay":"client");
      return json({ok:true,item:itemId,variation,sku,photos_uploaded,image_error,stock_error,publication_error});
    }

    if (action === "add_photos") {
      const itemId = String(body.item || ""), images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
      if (!itemId || !images.length || !(await catalog(acc)).some((i) => i.id === itemId)) return json({ error: "bad_photo_request" }, 400);
      let photos_uploaded = 0;
      for (let i = 0; i < images.length; i++) await uploadSquareImage(acc, itemId, String(images[i]), `${itemId}-${Date.now()}-${i + 1}`, i === 0);
      photos_uploaded = images.length;
      await log(site, `Photos added to Square item: ${itemId}`, r === "admin" ? "uzay" : "client");
      return json({ ok: true, photos_uploaded });
    }

    if (action === "set_public") {
      const {error}=await db.from("ms_square").update({ public_catalog: !!body.value, updated_at: new Date().toISOString() }).eq("site", site);
      if(error)throw new Error("catalog_save_failed");
      await log(site, body.value ? "Stock shown on the site" : "Stock hidden from the site", r === "admin" ? "uzay" : "client");
      return json({ ok: true });
    }


    if (action === "disconnect") {
      await fetch(API + "/oauth2/revoke", { method: "POST",
        headers: { Authorization: `Client ${APP_SECRET}`, "Square-Version": VERSION, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: APP_ID, access_token: acc.access_token }) }).catch(() => {});
      await db.from("ms_square").delete().eq("site", site);
      await log(site, "Square disconnected", r === "admin" ? "uzay" : "client");
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, /^(catalog_invalid|catalog_no_variations|commerce_invalid|commerce_unavailable|commerce_delivery|commerce_shipping_pending)$/.test(String((e as Error).message||e))?400:500);
  }
});
