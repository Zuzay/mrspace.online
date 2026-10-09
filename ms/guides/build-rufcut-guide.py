"""Rebuild the clickable English guide from capture-rufcut-guide.mjs screenshots."""
from pathlib import Path
import os
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[2]
ASSETS = Path(os.getenv('MS_GUIDE_ASSETS', '/private/tmp/rufcut-guide'))
OUTPUT = Path(os.getenv('MS_GUIDE_OUTPUT', str(ROOT / 'output/pdf/rufcut-system-guide.pdf')))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
for name, file in [('Body', 'Arial.ttf'), ('Bold', 'Arial Bold.ttf'), ('Display', 'Impact.ttf')]:
    pdfmetrics.registerFont(TTFont(name, '/System/Library/Fonts/Supplemental/' + file))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='Bold', italic='Body', boldItalic='Bold')
W, H = A4
M, CW = 42, W - 84
INK, PAPER, GOLD, MUTED, LINE = [colors.HexColor(v) for v in ['#111c2e', '#f5f2eb', '#f6b93b', '#56616e', '#c9cdd0']]
URL = {
    'panel':'https://mrspace.online/panel/?site=rufcut&lang=en',
    'catalog':'https://mrspace.online/panel/?site=rufcut&view=catalog&lang=en',
    'welcome':'https://mrspace.online/panel/?site=rufcut&view=help&lang=en',
    'orders':'https://mrspace.online/panel/?site=rufcut&view=orders&lang=en',
    'shop':'https://mrspace.online/rufcut/',
    'repair':'https://mrspace.online/rufcut/repair/',
    'jeans':'https://mrspace.online/rufcut/#build',
    'track':'https://mrspace.online/rufcut/#order',
    'edit':'https://mrspace.online/edit/?site=rufcut',
    'preview':'https://mrspace.online/request/?preview=rufcut',
    'pdf':'https://mrspace.online/rufcut/docs/rufcut-system-guide.pdf',
    'apple':'https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios',
    'chrome':'https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en',
}
c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
c.setTitle('Rufcut | Your shop, one place - System guide')
c.setAuthor('Mr. Space')
c.setSubject('Clickable English guide to Rufcut work orders, the shared site editor and the phone panel')
c.setCreator('Mr. Space | Rufcut system guide')
c.setViewerPreference('DisplayDocTitle', 'true')

def rect(x, top, w, h, color, stroke=None):
    c.setFillColor(color)
    if stroke: c.setStrokeColor(stroke)
    c.rect(x, H-top-h, w, h, fill=1, stroke=bool(stroke))

def text(value, x, top, font='Body', size=11, color=INK):
    c.setFont(font, size); c.setFillColor(color); c.drawString(x, H-top-size, value)

def para(value, x, top, width=CW, size=11, color=INK, leading=None):
    p=Paragraph(value, ParagraphStyle('body',fontName='Body',fontSize=size,leading=leading or size*1.42,textColor=color))
    _, height=p.wrap(width, H)
    assert top+height < H-49, (c.getPageNumber(), value, top, height)
    p.drawOn(c,x,H-top-height)
    return top+height

def button(label, x, top, width, url=None, dest=None, dark=True, small=False):
    height=36 if small else 43
    rect(x,top,width,height,INK if dark else GOLD)
    text(label,x+13,top+12,'Bold',10,colors.white if dark else INK)
    area=(x,H-top-height,x+width,H-top)
    if url:c.linkURL(url,area,relative=0,thickness=0)
    else:c.linkRect('',dest,area,relative=0,thickness=0)
    return top+height

def link(label, url, x, top, size=10):
    text(label,x,top,'Bold',size)
    width=pdfmetrics.stringWidth(label,'Bold',size)
    c.setStrokeColor(INK);c.setLineWidth(.4);c.line(x,H-top-size-2,x+width,H-top-size-2)
    c.linkURL(url,(x,H-top-size-5,x+width,H-top+1),relative=0,thickness=0)

def image(name, x, top, width, maxheight=400, crop=None):
    source=ImageReader(str(ASSETS/(name+'.png'))); iw,ih=source.getSize()
    if crop:
        left, up, cw, ch=crop;scale=min(width/cw,maxheight/ch);w,h=cw*scale,ch*scale
        c.saveState();p=c.beginPath();p.rect(x,H-top-h,w,h);c.clipPath(p,stroke=0,fill=0)
        c.drawImage(source,x-left*scale,H-top-(ih-up)*scale,width=iw*scale,height=ih*scale,mask='auto');c.restoreState()
    else:
        scale=min(width/iw,maxheight/ih);w,h=iw*scale,ih*scale
        c.drawImage(source,x,H-top-h,width=w,height=h,mask='auto')
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.rect(x,H-top-h,w,h,fill=0,stroke=1)
    return top+h

def step(number,title,body,x,top,width=CW):
    text(f'{number:02}',x,top,'Display',21)
    text(title,x+33,top+2,'Bold',11.2)
    return para(body,x+33,top+24,width-33,10.6,MUTED)+13

def note(title,body,top,x=M,width=CW):
    p=Paragraph(body,ParagraphStyle('note',fontName='Body',fontSize=10.4,leading=14.8,textColor=INK));_,h=p.wrap(width-28,H)
    rect(x,top,width,h+51,GOLD);text(title,x+14,top+12,'Bold',10.5);p.drawOn(c,x+14,H-top-36-h)
    return top+h+51

def start(number,section,title,subtitle,dest):
    rect(0,0,W,H,PAPER);c.bookmarkPage(dest);c.addOutlineEntry(section,dest,level=0,closed=False)
    text('RUFCUT',M,23,'Display',21)
    text('SYSTEM GUIDE / '+section.upper(),M+97,30,'Body',8,MUTED)
    c.setStrokeColor(INK);c.setLineWidth(.65);c.line(M,H-57,W-M,H-57)
    text(f'{number:02}',M,78,'Display',24,MUTED)
    text(title,M+43,77,'Display',30)
    para(subtitle,M,125,CW,11,MUTED)
    # Page-level navigation remains clickable in a normal PDF reader.
    text('MR. SPACE / OCTOBER 2026',M,H-32,'Body',8,MUTED)
    text('CONTENTS',W-151,H-32,'Bold',8,INK)
    c.linkRect('Back to contents','start',(W-153,16,W-92,34),relative=0,thickness=0)
    text(f'{number:02} / 11',W-77,H-32,'Body',8,MUTED)

def end():c.showPage()

# 1 - A short starting point with links, rather than an account/password handoff.
rect(0,0,W,H,INK);c.bookmarkPage('start');c.addOutlineEntry('Start here','start',0,False)
text('RUFCUT',M,31,'Display',35,PAPER)
text('THE SHOP SYSTEM / FIELD GUIDE 02',M,89,'Body',9,GOLD)
text('YOUR SHOP.',M,127,'Display',57,PAPER)
text('ONE PLACE.',M,193,'Display',57,PAPER)
para('Open the panel. See what arrived. Keep the work moving.',M,279,CW,15,PAPER,21)
button('OPEN YOUR PANEL',M,337,246,URL['panel'],dark=False)
button('OPEN YOUR WEBSITE',M+263,337,248,URL['shop'])
para('<b>First visit?</b> Sign in with the Rufcut username and password supplied by Mr. Space. You can enter <b>rufcut</b> in the Username field. For a safe first look, choose <b>Look with sample data</b> on the sign-in screen.',M,400,CW,11,PAPER)
text('JUMP TO A TASK',M,478,'Body',9,GOLD)
chapters=[('02 / Find new work','inbox'),('03 / Save & print a ticket','ticket'),('04 / Plan a repair','repair'),('05 / Send a jeans design','jeans'),('06 / Edit text & photos','editor'),('07 / Stock & labels','stock'),('08 / Organize the site catalog','catalog'),('09 / Your shortcut guide','welcome'),('10 / Set up your phone','phone'),('11 / Help & useful links','help')]
for i,(label,dest) in enumerate(chapters):
    x=M+(i%2)*263;y=504+(i//2)*41
    text(label,x,y,'Bold',11,PAPER);c.linkRect(label,dest,(x,H-y-25,x+246,H-y+4),relative=0,thickness=0)
para('Buttons, underlined links and the task list are clickable. Screens show the real interface with sample customer data. The live website creates real work orders when you press Send.',M,734,CW,9.2,colors.HexColor('#c4ccd5'))
text('POWERED BY MR. SPACE',M,798,'Body',8,GOLD);text('ENGLISH / OCTOBER 2026',W-195,798,'Body',8,PAPER);end()

# 2 - Inbox.
start(2,'Work orders','Everything arrives here.','Repairs and jeans designs share one inbox. No separate email thread is needed to find a request.','inbox')
y=image('inbox',M,176,CW,359);para('Work orders / sample tickets shown',M,y+8,CW,8.5,MUTED)
y=step(1,'Open Work orders','Sign in to your Rufcut panel. From the start guide, choose <b>New requests and printable tickets</b>, or open <b>Work orders</b>.',M,565)
y=step(2,'Find the right job','Choose <b>Repairs</b> or <b>Jean Maker</b>. Search a ticket, customer name, email or phone; use <b>Status</b> to narrow the list.',M,y)
y=step(3,'Open ticket','Click the customer card. Inside are the contact details, selections, drawing and workshop fields.',M,y)
link('OPEN THE WORK-ORDER INBOX',URL['orders'],M,770);end()

# 3 - A saved workshop ticket.
start(3,'The workshop ticket','Open it. Work it. Print it.','Every order has a ticket number. Keep fitting measurements, workshop notes and progress together.','ticket')
y=image('ticket',M,174,CW,280);para('Example repair ticket. Red numbered marks identify the requested work.',M,y+7,CW,8.5,MUTED)
left=M;right=M+271
y=step(1,'Read the request','Check the garment or jeans choices, the marked drawing and the customer contact details.',left,490,240)
y=step(2,'Record the fitting','Fill <b>Measurements from fitting</b> and <b>Workshop notes</b>. Choose the actual work status.',left,y,240)
y=step(3,'Save, then print','Press <b>Save work order</b>. Use <b>Print saved ticket</b> for an A4 job sheet or Save as PDF in your print dialog.',left,y,240)
text('USE THE STATUS THAT MATCHES THE WORK',right,493,'Bold',9)
statuses=[('Received','The request reached the shop.'),('In progress','The work has started.'),('Finishing','Final work and checks.'),('Ready','Ready for the customer to collect.'),('Completed','The job is closed.')]
yy=519
for label,description in statuses:
    text(label,right,yy,'Bold',10.5);yy=para(description,right,yy+17,240,9.7,MUTED)+14
para('Printing uses the last <b>saved</b> values. The sheet is a workshop job ticket; confirm price and payment separately.',M,753,CW,10.2,MUTED);end()

# 4 - Repair map.
start(4,'Customer repair','Mark the work on the garment.','Customers can open Repair from the shop home page or use the dedicated repair page.','repair')
y=image('repair',M,176,CW,359);para('Repair Atelier / jacket with Take in and Add a patch selected',M,y+8,CW,8.5,MUTED)
yy=565
for n,title,body in [(1,'Choose the garment','Select the piece and fit, then choose the type of work.'),(2,'Place each mark','Select a work type, then tap the garment at the right spot. Drag the numbered mark to adjust it, or use a location button. Use <b>Save &amp; add another garment</b> for another piece.'),(3,'Review and send','Continue to <b>Review work order</b>. Check every garment, enter name and email, then press <b>Send work order</b>. Phone is optional.')]:
    yy=step(n,title,body,M,yy)
link('OPEN REPAIR ATELIER',URL['repair'],M,772)
link('CUSTOMER TICKET TRACKER',URL['track'],M+285,772);end()

# 5 - Jeans request.
start(5,'Jean Maker','A design becomes a work order.','The selected jeans design goes directly to the shop panel, together with the customer details.','jeans')
col=235
yy=180
for n,title,body in [(1,'Build the pair','Use <b>Cut &amp; Denim</b>, <b>Color &amp; thread</b> and <b>The finish</b> to choose fit, denim, wash, thread, fly and hem.'),(2,'Open the request','Press <b>Send this design</b>. The form shows the choices and the drawing.'),(3,'Add contact details','Name and email are required. Phone, measurements and a note are optional. Scroll down in the form to reach <b>Send to Rufcut</b>.'),(4,'Keep the ticket','After a confirmed save, the customer sees a ticket number. The shop finds the same order under <b>Work orders &gt; Jean Maker</b>.')]:
    yy=step(n,title,body,M,yy,col)
image('jeans',M+270,179,241,415,crop=(330,45,620,810))
para('The actual design form. Scroll inside it to reach the remaining fields and Send button.',M+270,503,241,9,MUTED)
note('THE SHOP CONFIRMS THE DETAILS','A submitted design is a request for the workshop. Confirm the final fit, fitting appointment, price and timing with the customer.',664)
link('OPEN JEAN MAKER',URL['jeans'],M,772);end()

# 6 - Shared visual editor.
start(6,'Website editor','Change the right place.','The shared Mr. Space editor names the page area and shows what will change before you send a request.','editor')
y=image('editor',M,176,CW,359);para('Workshop photo selected / safe preview; uploads and sending require site access',M,y+8,CW,8.5,MUTED)
yy=565
yy=step(1,'Open your site editor','Sign in first, then use the link below. Search the named areas or tap the preview. Use the <b>Photo</b> filter for the two homepage photos.',M,yy)
yy=step(2,'Edit text or choose a photo','For text, enter the new wording. For a photo, press <b>Choose a photo</b> and select a JPG, PNG, WebP or GIF up to 5 MB. Check the current/change preview, then <b>Add to draft</b>.',M,yy)
yy=step(3,'Review the affected areas','Press <b>Review</b>, add your details, then <b>Confirm the affected areas</b>. Check before/after and press <b>Send changes</b>. Mr. Space reviews before publication.',M,yy)
link('OPEN YOUR SITE EDITOR',URL['edit'],M,772)
link('TRY THE SAFE EDITOR PREVIEW',URL['preview'],M+252,772);end()

# 7 - Square catalog and barcode labels.
start(7,'Stock & labels','Keep the shelves in sync.','Square supplies the stock catalog. The same panel prepares barcode labels for your products.','stock')
y=image('stock',M,176,CW,326);para('Stock / sample data; demo prices are examples',M,y+8,CW,8.5,MUTED)
yy=535
yy=step(1,'Connect your own Square','In <b>Overview</b>, press <b>Connect Square</b> and authorize your shop account. Stock tools become available once connected.',M,yy,245)
yy=step(2,'Update a product','In <b>Stock</b>, search the item, change the quantity and press <b>Save</b>. Use <b>Add photos</b> for product images. Website placement is managed in <b>Site catalog</b>.',M,yy,245)
image('labels',M+270,535,241,170)
para('<b>Print product labels</b><br/>In Stock, press <b>Label</b> on an item. Open <b>Labels</b>, choose copies and label size, then <b>Print labels</b>. Match paper size and use 100% scale.',M+270,712,241,10.3,MUTED)
link('OPEN THE PANEL',URL['panel'],M,772);end()

# 8 - Shared catalog publication workspace.
start(8,'Site catalog','Choose what goes where.','Square holds prices, stock and SKUs. Site catalog controls website placement and how choices are displayed.','catalog')
y=image('catalog',M,176,CW,308);para('Same product, two sizes: one card with choices. Preview before saving.',M,y+8,CW,8.5,MUTED)
yy=515
for n,title,body in [(1,'Choose the destination','Open <b>Site catalog</b>, expand the product and choose <b>Shop</b>, <b>Workshop</b>, <b>Repair</b> or <b>Square only</b>. Fees, shipping and deposits normally stay Square only.'),(2,'Set the shop category and order','Choose <b>Shop category</b>: jeans, jackets, shirts or accessories. A belt belongs in <b>Accessories</b>. Lower <b>Order within category</b> numbers appear first. Group sizes on one card; separate different models.'),(3,'Check, confirm and save','Select the included variations. Review the destination, category, order and <b>Website preview</b>. Tick the confirmation and press <b>Save website placement</b>. Sold-out tracked choices do not appear.')]:
    yy=step(n,title,body,M,yy)
link('OPEN SITE CATALOG',URL['catalog'],M,772);end()

# 9 - Repeatable onboarding, shortcuts and user-controlled dismissal.
start(9,'Start guide','Your shortcuts stay close.','The start guide opens on your first normal panel entry and remains available from Need help?','welcome')
y=image('welcome',M,176,CW,295);para('The panel guide links directly to each daily task and to this PDF.',M,y+8,CW,8.5,MUTED)
yy=505
for n,title,body in [(1,'Use the shortcut for your task','Open work orders, Site catalog, Stock or the website editor directly. Read the troubleshooting answers before asking for support.'),(2,'Keep new products organized','For a new product, use <b>+ Add product or service</b> and choose its website destination. For another size or fabric, use <b>+ Add variation to this product</b>. New Square items and variations stay unpublished until reviewed.'),(3,'Skip the guide when you are ready','At the very bottom of the guide, tick <b>I know my way around</b>, then press <b>Save preference and open my panel</b>. This preference applies on this device. Reopen <b>Need help?</b> any time; untick and save to restore the guide at entry.')]:
    yy=step(n,title,body,M,yy)
link('OPEN THE SHORTCUT GUIDE',URL['welcome'],M,772);end()

# 8 - Installable panel and honest email setup state.
start(10,'Your phone','Open the shop like an app.','Add the panel to your home screen, then enable notifications on the device you use at the shop.','phone')
image('phone',M+295,178,216,451)
yy=178
text('IPHONE / IPAD',M,yy,'Bold',11)
yy=para('Open the panel in <b>Safari</b>. Choose <b>Share &gt; Add to Home Screen</b>. If shown, keep <b>Open as Web App</b> enabled, then tap <b>Add</b>. Open the new icon and sign in there.',M,yy+24,268,11,MUTED)+22
text('ANDROID / CHROME',M,yy,'Bold',11)
yy=para('Tap <b>Add to home screen</b> in the panel and follow the install prompt. You can also use Chrome\'s menu: <b>Install and create shortcut &gt; Install</b>. Menu wording varies by version.',M,yy+24,268,11,MUTED)+23
text('TURN ON NEW-WORK ALERTS',M,yy,'Bold',11)
yy=para('Open <b>Notifications &gt; Phone notifications</b>. Tap <b>Enable on this device</b>, then allow the browser prompt. On iPhone/iPad, do this from the installed home-screen app.',M,yy+24,268,11,MUTED)+15
para('Repeat on each device that needs alerts. Tap a new-work notification to open its ticket; sign in if asked. Signing out disables notifications on that device.',M,yy,268,10.4,MUTED)
note('RUFCUT EMAIL: CONNECT AT HANDOVER','We will connect the shop\'s own Rufcut sender address when you are ready to switch to the system. Until sender setup is complete, work orders remain available in the panel. Saving an email preference alone does not activate delivery.',663)
link('APPLE INSTALLATION HELP',URL['apple'],M,772,9)
link('CHROME INSTALLATION HELP',URL['chrome'],M+278,772,9);end()

# 9 - Quick reference / recover without losing work.
start(11,'Help & links','If something needs a second try.','Keep this PDF on your phone. Its buttons open the live pages or the safe editor preview.','help')
yy=178
for n,title,body in [(1,'A customer cannot send','Check the internet connection and required contact fields, then retry. Failed requests keep their draft on that device. A successful submission shows a ticket number; a repeated retry returns the same saved ticket.'),(2,'An order looks missing','Open <b>Work orders</b>, select <b>All</b>, clear search and status filters, and press <b>Refresh</b>. Check that you are signed into the Rufcut account. The list shows the newest 200 orders.'),(3,'A phone alert does not arrive','Open Notifications and check the device is enabled. Check the browser/phone notification permission. On iPhone/iPad, open from the home-screen app. You can always inspect Work orders directly.'),(4,'Your edit is not on the live website','Saving in the editor prepares a draft. Review and send the request; Mr. Space checks it before publishing. Keep the request receipt or edit link for follow-up.')]:
    yy=step(n,title,body,M,yy)
text('YOUR CLICKABLE SHORTCUTS',M,yy+6,'Bold',11)
rows=[('Shop panel / sign in','panel'),('Work orders / find a ticket','orders'),('Site catalog / website placement','catalog'),('Start guide / Need help?','welcome'),('Repair Atelier / customer request','repair'),('Jean Maker / build a pair','jeans'),('Ticket tracker / customer status','track'),('Website editor / requires site access','edit'),('Safe editor preview / no live sending','preview')]
top=yy+34
for i,(label,key) in enumerate(rows):
    ty=top+i*23
    if i%2==0:rect(M,ty-3,CW,22,colors.HexColor('#eae7df'))
    link(label,URL[key],M+10,ty,9.8)
para('<b>Try safely first:</b> open the panel sign-in screen and choose <b>Look with sample data</b> for Stock and Labels. The safe editor preview cannot send or upload. For a live end-to-end trial, submit one clearly named test request and confirm its ticket in your panel.',M,top+len(rows)*23+10,CW,10.2,MUTED)
link('LATEST GUIDE',URL['pdf'],W-267,H-32,8)
end()
c.save()
print(str(OUTPUT))
