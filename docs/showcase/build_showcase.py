"""Build the customer showcase from captured application screens."""
from pathlib import Path
import base64
import html
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[1] / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
PDF = OUT / 'Stockwise Application Showcase.pdf'
W, H = A4
M = 40
CW = W - 2*M
GREEN = HexColor('#365e3c')
INK = HexColor('#17251d')
MUTED = HexColor('#58625d')
body = ParagraphStyle('Body', fontName='Helvetica', fontSize=11, leading=16, textColor=INK)
small = ParagraphStyle('Small', parent=body, fontSize=9, leading=13, textColor=MUTED)

pages = [
 dict(title='Stockwise Smart Inventory', label='OVERVIEW', image='01-overview.jpg',
 intro='Stockwise helps a single-store business manage products, stock, suppliers and purchasing in one web application. This guide shows the main screens using a cleaning-products demonstration inventory.',
 points='The dashboard brings stock value, units on hand, low-stock alerts and open purchase orders together. A sales chart shows recorded demand and a baseline forecast for the next 14 days.',
 caption='Overview with inventory metrics, demand chart and low-stock alerts.'),
 dict(title='Find and manage your products', label='INVENTORY', image='02-inventory.jpg',
 intro='Keep product names, SKUs, barcodes, categories, suppliers, selling prices and unit costs in a central catalogue. Search by name, SKU or barcode, then filter by category, supplier or stock status.',
 points='Add, edit and delete product records from the catalogue. CSV tools support inventory and transaction exports, plus product import. Stock quantities change through receipts, sales, adjustments or stocktakes.',
 caption='Inventory catalogue with cleaning products, search, filters and edit controls.'),
 dict(title='Make changes in clear popup forms', label='EVERYDAY WORK', image='03-product-dialog.jpg',
 intro='Add and edit records in popup dialogs while keeping the current screen in view. Product forms include unit cost, selling price, minimum stock and supplier assignment.',
 points='Record sales, receipts and signed stock adjustments from Stock movements. Barcode lookup can select a product for a movement. Stocktake compares a physical count with the recorded balance. History records changes for review.',
 caption='The Add product dialog presents the information needed to create a catalogue entry.'),
 dict(title='Plan and receive replenishment', label='REORDERING', image='04-reordering-preview.jpg',
 intro='Review demand, days of cover, reorder points, outstanding orders and suggested units together. Type the quantity you want in Order quantity, then choose Create order to use that amount.',
 points='Purchase orders track ordered, received and remaining units, plus an expected delivery date. Receive a full delivery or part of an order as stock arrives. Supplier lead times support replenishment estimates.',
 caption='Reordering shows editable order quantities beside the calculated suggestions.',
 extra='Suggestions use recent sales and supplier lead times. They are baseline estimates and do not model seasonality or lost demand during stockouts.'),
 dict(title='See sales and known cost profit', label='REPORTS', image='05-reports.jpg',
 intro='Choose a date range to view revenue, units sold, known cost and known-cost profit. The product table ranks best sellers and shows units without a recorded cost. Export the report for further review.',
 points='<b>Known cost</b> is the recorded unit cost of sold units. <b>Known-cost profit</b> is the revenue from those costed units minus their recorded cost. It excludes operating expenses and taxes; sales missing a cost are excluded from the profit calculation.',
 caption='Sales report with known cost and known-cost profit summary cards.'),
 dict(title='Ask questions and review stock actions', label='ASK AI', image='06-ask-ai.jpg',
 intro='Use prompts to explore inventory, sales, profit and replenishment, or prepare a stock change or purchase order. Review the proposed action before confirming it.',
 points='Demo mode uses built-in cleaning-product scenarios with no API credits or changes to the main inventory. Live AI uses the backend OpenAI connection and requires available API credits. The API key stays on the server.',
 caption='Ask AI clearly labels the demo experience and offers prompts to begin.'),
]

tech = [
 ('Frontend', 'React 19 and TypeScript', 'Builds the browser screens, forms and interactions.'),
 ('Build and styling', 'Vite 7 and CSS', 'Develops and bundles the interface; CSS defines its layout and appearance.'),
 ('Charts', 'Recharts 3', 'Displays recorded sales and the demand forecast.'),
 ('Backend', 'Node.js, Express 5 and TypeScript', 'Provides the JSON API and applies inventory and purchasing rules.'),
 ('Database', 'PostgreSQL with the pg driver', 'Stores products, suppliers, movements, orders and change history.'),
 ('Validation and jobs', 'Zod and node-cron', 'Validates incoming data and runs scheduled inventory jobs.'),
 ('AI integration', 'OpenAI Responses API', 'Supports live AI requests through server-side tools and reviewed action proposals.'),
]

c = canvas.Canvas(str(PDF), pagesize=A4)
c.setTitle('Stockwise Smart Inventory')
c.setAuthor('Stockwise')
c.setSubject('Application overview, captured screens and technology summary')

def para(text, y, style=body):
 p=Paragraph(text,style)
 _,height=p.wrap(CW,H)
 p.drawOn(c,M,y-height)
 return y-height-12

def heading(label,title):
 c.setFillColor(GREEN); c.setFont('Helvetica-Bold',9)
 c.drawString(M,H-40,'STOCKWISE  /  '+label)
 title_style=ParagraphStyle('Title',fontName='Helvetica-Bold',fontSize=24,leading=28,textColor=HexColor('#000000'))
 return para(title,H-61,title_style)-5

def footer(number):
 c.setFont('Helvetica',8);c.setFillColor(MUTED)
 c.drawString(M,25,'Stockwise Smart Inventory  |  22 October 2026')
 c.drawRightString(W-M,25,str(number))
 c.showPage()

for i,p in enumerate(pages,1):
 y=heading(p['label'],p['title'])
 y=para(p['intro'],y)
 y=para(p['points'],y)
 if p.get('extra'):y=para(p['extra'],y,small)
 image=ImageReader(str(ROOT/'screenshots'/p['image']))
 iw,ih=image.getSize()
 available=y-78
 scale=min(CW/iw,available/ih)
 dw,dh=iw*scale,ih*scale
 c.setStrokeColor(HexColor('#d9dfd9'));c.setLineWidth(.5)
 c.rect(M+(CW-dw)/2-1,y-dh-1,dw+2,dh+2,stroke=1,fill=0)
 c.drawImage(image,M+(CW-dw)/2,y-dh,width=dw,height=dh)
 para(p['caption'],y-dh-10,small)
 footer(i)

y=heading('TECHNOLOGY','How the application is built')
y=para('The frontend is the part users see in the browser. The backend receives requests, checks the data and updates the database. This separation keeps business rules and the AI connection on the server.',y)
cell=ParagraphStyle('Cell',parent=body,fontSize=9,leading=13)
rows=[[Paragraph('<b>Layer</b>',cell),Paragraph('<b>Technology</b>',cell),Paragraph('<b>Purpose</b>',cell)]]
rows += [[Paragraph(html.escape(v),cell) for v in row] for row in tech]
table=Table(rows,colWidths=[87,159,CW-246])
table.setStyle(TableStyle([
 ('BACKGROUND',(0,0),(-1,0),HexColor('#e8eee5')),
 ('GRID',(0,0),(-1,-1),.5,HexColor('#d9d9d9')),
 ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
 ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
 ('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9),
]))
_,th=table.wrap(CW,H);table.drawOn(c,M,y-th);y-=th+25
y=para('<b>How a stock change works</b>',y)
y=para('A user submits a form in React. The Express API validates the request and records the movement in PostgreSQL. The stock balance and history are updated, then the browser refreshes the displayed inventory.',y)
y=para('<b>A short showcase walkthrough</b>',y)
for line in [
 '1. Open Overview and point out the low-stock alerts and demand chart.',
 '2. Search Inventory for Glass Cleaner and open Edit to show the popup form.',
 '3. Open Reordering and explain how Order quantity overrides the suggestion.',
 '4. Open Reports and explain revenue, known cost and known-cost profit.',
 '5. In Ask AI Demo mode, try Add 10 units of Multipurpose Cleaner to stock and review the simulated proposal.'
]:y=para(line,y,small)
para('The captured application is the local single-store edition. The screenshots show the workspace as captured; balances change as transactions are edited or recorded.',y,small)
footer(7)
c.save()

def img_data(name):
 return 'data:image/jpeg;base64,'+base64.b64encode((ROOT/'screenshots'/name).read_bytes()).decode()

sections=[]
for p in pages:
 sections.append(f'''<section><p class="eyebrow">{p['label']}</p><h2>{p['title']}</h2><p>{p['intro']}</p><p>{p['points']}</p>{'<p>'+p['extra']+'</p>' if p.get('extra') else ''}<figure><a href="{img_data(p['image'])}" target="_blank"><img src="{img_data(p['image'])}" alt="{p['caption']}"></a><figcaption>{p['caption']}</figcaption></figure></section>''')
tech_html=''.join('<tr>'+''.join('<td>'+html.escape(v)+'</td>' for v in row)+'</tr>' for row in tech)
sections.append('<section><p class="eyebrow">TECHNOLOGY</p><h2>How the application is built</h2><p>The browser interface sends requests to the backend API. The backend validates them and reads or updates PostgreSQL. The OpenAI connection stays on the server.</p><table><tr><th>Layer</th><th>Technology</th><th>Purpose</th></tr>'+tech_html+'</table><h3>A short showcase walkthrough</h3><ol><li>Start with the Overview metrics and low-stock alerts.</li><li>Search for Glass Cleaner in Inventory and open the Edit popup.</li><li>Show the editable Order quantity field in Reordering.</li><li>Explain known cost and known-cost profit in Reports.</li><li>Use Ask AI Demo mode to prepare a simulated stock receipt and review its confirmation card.</li></ol><p>The current showcase runs as a local single-store workspace. Demo mode is simulated; Live AI needs available API credits.</p></section>')
sections.append('<section><p class="eyebrow">SCREEN CAPTURES</p><h2>More detail</h2><details><summary>Full reordering view</summary><img src="'+img_data('04-reordering.jpg')+'" alt="Full reordering view including purchase orders"></details><details><summary>Ask AI simulated stock proposal</summary><img src="'+img_data('07-ai-proposal.jpg')+'" alt="AI demo proposal showing a receipt of 10 units for review"></details></section>')
document='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stockwise Smart Inventory</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f5f0;color:#17251d;font:17px/1.6 system-ui,sans-serif}main{max-width:1040px;margin:40px auto;padding:0 22px}header,section{background:white;padding:36px;border-radius:16px;margin-bottom:24px}h1{font-size:40px;line-height:1.15;margin:8px 0 18px}h2{font-size:29px;line-height:1.2;color:#000;margin:8px 0 22px}.eyebrow{color:#365e3c;font-size:12px;font-weight:700;letter-spacing:2px}p{max-width:850px}figure{margin:26px 0 0}img{display:block;width:100%;height:auto;border:1px solid #d9dfd9;border-radius:8px}figcaption{font-size:13px;color:#58625d;margin-top:8px}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:12px;text-align:left;border:1px solid #d9d9d9}th{background:#e8eee5}button{background:#365e3c;color:white;border:0;border-radius:8px;padding:12px 18px;cursor:pointer}summary{cursor:pointer;padding:12px 0;font-weight:600}footer{text-align:center;font-size:13px;color:#58625d;margin:32px} @media(max-width:600px){main{padding:0 10px}header,section{padding:20px}h1{font-size:32px}td,th{padding:6px}}@media print{body{background:white}main{margin:0;max-width:none}header,section{padding:15px;break-inside:avoid}button{display:none}img{max-height:700px;object-fit:contain}details{display:none}}</style><main><header><p class="eyebrow">STOCKWISE SMART INVENTORY</p><h1>Stockwise Smart Inventory</h1><p>A simple guide to the features, screens and technologies behind Stockwise. Captured with the cleaning-products inventory on 22 October 2026.</p><button onclick="window.print()">Print this guide</button></header>'''+''.join(sections)+'''<footer>Stockwise Smart Inventory | 22 October 2026</footer></main></html>'''
(ROOT/'Stockwise Application Showcase.html').write_text(document,encoding='utf-8')
print(PDF)
print(ROOT/'Stockwise Application Showcase.html')
