"""Read-only extraction of the supplied workbook, including Excel rich-value photos."""
import zipfile, xml.etree.ElementTree as E, json, pathlib, datetime, posixpath, sys
source = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else r'C:\Users\user\Downloads\CAPA SMSI WORKSHOP 01 SEPTEMBER 2026.xlsx')
base = pathlib.Path(__file__).resolve().parents[1]
z=zipfile.ZipFile(source)
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','x':'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
strings=[''.join(e.itertext()) for e in E.fromstring(z.read('xl/sharedStrings.xml'))]
sheet=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
def relationships(path): return {e.get('Id'):posixpath.normpath(posixpath.join(posixpath.dirname(posixpath.dirname(path)),e.get('Target'))) for e in E.fromstring(z.read(path))}
rid='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
richrels=relationships('xl/richData/_rels/richValueRel.xml.rels')
richlist=[richrels[e.get(rid+'id')] for e in E.fromstring(z.read('xl/richData/richValueRel.xml'))]
richvals=[int(e[0].text) for e in E.fromstring(z.read('xl/richData/rdrichvalue.xml'))]
metadata=E.fromstring(z.read('xl/metadata.xml'))
valueids=[int(e[0].get('v')) for e in metadata.find('m:valueMetadata',ns)]
future=[int(next(e.iter('{http://schemas.microsoft.com/office/spreadsheetml/2017/richdata}rvb')).get('i')) for e in metadata.find('m:futureMetadata',ns)]
photos={}
for c in sheet.findall('.//m:c',ns):
 if c.get('vm'): photos[c.get('r')]=richlist[richvals[future[valueids[int(c.get('vm'))-1]]]]
drels=relationships('xl/drawings/_rels/drawing1.xml.rels')
for anchor in E.fromstring(z.read('xl/drawings/drawing1.xml')):
 start=anchor.find('x:from',ns); blip=anchor.find('.//a:blip',ns)
 if start is not None and blip is not None and int(start.find('x:col',ns).text)==6:
  photos['G'+str(int(start.find('x:row',ns).text)+1)]=drels[blip.get(rid+'embed')]
records=[]
def date(v): return (datetime.date(1899,12,30)+datetime.timedelta(days=float(v))).isoformat()
for row in sheet.findall('.//m:sheetData/m:row',ns):
 r=int(row.get('r'))
 if not 5<=r<=12: continue
 vals={}
 for c in row:
  v=c.find('m:v',ns)
  if v is not None: vals[''.join(filter(str.isalpha,c.get('r')))]=strings[int(v.text)] if c.get('t')=='s' else v.text
 image=photos.get('G'+str(r)); url=''
 if image:
  filename=f'finding-{r-4}'+pathlib.Path(image).suffix
  (base/'public/evidence'/filename).write_bytes(z.read(image)); url='/evidence/'+filename
 records.append(dict(id=f'CAPA-2026-{r-4:03}',issueDate=date(vals['B']),week=int(vals['C']),enteredBy=vals['D'],raisedBy=vals['E'],description=vals['F'].strip(),location=vals['H'],pic=vals['I'],company=vals['J'],recommendation=vals['K'].strip(),dueDate=date(vals['M']),status=vals['N'],remark=vals.get('O',''),photo=url,action='',rootCause='',prevention='',evidence=[],history=[dict(at='2026-09-01T00:00:00.000Z',text=f'Imported from {source.name}, row {r}')],version=1,sourceRow=r))
(base/'data/seed.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'records':len(records),'photos':len(photos),'issueDates':sorted(set(r['issueDate'] for r in records)),'dueDates':sorted(set(r['dueDate'] for r in records))}))
