import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import sharp from 'sharp';

const root = process.cwd();
const dest = path.join(root, 'public/emr-artwork/v1');
const manifestPath = path.join(dest, 'manifest.json');
async function writeManifest(value){
  const temporary=`${manifestPath}.${process.pid}.tmp`;
  await fs.writeFile(temporary,JSON.stringify(value,null,2)+'\n');
  await fs.rename(temporary,manifestPath);
}
const style = 'Use case: illustration-story. Asset type: original premium Sabi EMR hospital software page-banner artwork, landscape 1536x1024. Refined painterly editorial illustration with realistic human proportions, hand-painted paper texture, warm daylight, contemporary Nigerian setting and Black Nigerian people. Palette: forest green, sage, ivory, warm stone, restrained apricot. Calm, dignified, capable and welcoming; avoid stock-photo posing. Right half contains the scene; left half has quiet pale sage/ivory atmospheric negative space for actual HTML heading. Keep the principal subject within the central vertical band for wide-banner crops. ONE coherent scene, not a collage. No lettering, words, numbers, logos, watermarks, UI screenshots, readable patient information, exposed bodies, blood or clinical instructions. No neon, robots, futuristic holograms or ornamental medical crosses. Decorative art, not a medical diagram.';
const scenes = {
  '/workspace': 'A female doctor in sage scrubs and a male hospital administrator review a tablet in a sunny hospital atrium with a leafy courtyard.',
  '/queue': 'A nurse welcomes a seated adult patient in a bright, orderly clinic waiting area; a blank clipboard and comfortable spaced seating suggest an organised clinical queue.',
  '/registration': 'A reception officer warmly welcomes a new adult patient across a curved timber reception desk with a discreet blank registration folder.',
  '/appointments': 'A clinic coordinator plans appointments with a closed diary, simple clock and tablet at a tidy hospital reception desk; no visible calendar numbers.',
  '/consultation': 'An attentive female doctor and an adult male patient talk at eye level in a private consultation room, a closed notebook and stethoscope nearby.',
  '/inpatient': 'A nurse checks in with a comfortable fully clothed adult patient sitting upright in a bright hospital bed beside a sunlit window.',
  '/procedures': 'A clinician in clean scrubs prepares a covered procedure trolley in a peaceful treatment room, no patient procedure or exposed sharps shown.',
  '/history': 'A clinician carefully reviews a closed archival patient folder and a tablet at a private consultation desk, warm shelves behind.',
  '/laboratory': 'A laboratory scientist in lab coat, gloves and protective glasses works beside a microscope and capped sample racks in a tidy clinical laboratory.',
  '/pharmacy': 'A pharmacist in a white coat reviews a medicine pack with a colleague at a clean dispensary counter; neat unbranded sealed boxes behind.',
  '/radiology': 'A radiographer welcomes a fully clothed adult patient into a calm imaging suite with a modern scanner in the background, no diagnostic images.',
  '/anc': 'A midwife in sage scrubs talks warmly with a fully clothed pregnant adult woman in an antenatal consultation room.',
  '/labour': 'A midwife prepares a serene private maternity room with a neatly made bed and folded linens, no labour or invasive procedure shown.',
  '/pnc': 'A nurse talks gently with a seated adult mother holding a safely swaddled infant in a sunlit postnatal room.',
  '/family-planning': 'An adult couple listens to a female clinician in a private family-planning consultation, respectful and nonjudgmental, no intimate content.',
  '/child-health': 'A paediatric nurse smiles at a fully clothed young child beside their parent in a welcoming child-health clinic.',
  '/nutrition': 'A nutrition professional and adult caregiver discuss a small tabletop arrangement of wholesome local vegetables, grains and fruit in a clinic.',
  '/immunization': 'A nurse prepares a calm immunisation station with a closed vaccine carrier while a parent reassures their fully clothed child; no needle insertion.',
  '/ncd': 'A nurse speaks with an older adult about routine long-term care; a resting blood-pressure cuff lies neatly on a consultation desk.',
  '/malaria': 'A community clinician discusses prevention with an adult in a shaded clinic veranda; a neatly hung mosquito net is visible in an adjacent demonstration alcove.',
  '/referrals': 'Two healthcare professionals exchange a closed referral folder at the threshold between clinic spaces, conveying continuity of care.',
  '/transfers': 'A nurse and orderly coordinate a fully clothed adult patient seated safely in a wheelchair along a bright accessible hospital corridor.',
  '/surveillance': 'A public-health analyst examines an abstract unlabelled geographic board and closed field notebooks in a light-filled hospital office.',
  '/outreach': 'A community health worker with a small medical satchel chats with an adult resident on a shaded Nigerian neighbourhood veranda.',
  '/billing': 'A hospital cashier explains a discreet blank invoice to an adult at a welcoming finance desk; no currency, balances or personal data visible.',
  '/inventory': 'A hospital stores officer checks neatly arranged sealed supplies on shelves with a handheld scanner and blank clipboard.',
  '/equipment': 'A biomedical engineer inspects a powered-down clinical device on a tidy maintenance workbench, no unsafe procedure.',
  '/hris': 'A hospital people-operations officer organises staff folders in a bright, calm office with a colleague.',
  '/msf-report': 'A hospital reporting officer reviews neatly arranged unlabelled reporting sheets and a tablet with a colleague in a sunlit office.',
  '/reports': 'A hospital analyst and administrator discuss abstract nonnumeric charts on a tablet at a clean timber meeting table.',
  '/nhmis-sync': 'A health information officer carefully prepares a closed reporting folder beside a laptop, suggesting secure national health reporting without visible data.',
  '/audit-log': 'A privacy officer reviews a closed audit ledger beside a simple brass key and locked filing cabinet, calm trustworthy mood.',
  '/settings': 'A hospital operations professional calmly organises modular desk objects and a tablet in a clean administrative workspace.',
  '/equipment-scada': 'A biomedical engineer and nurse observe a clinical equipment monitoring workstation from the side, screens abstract and unreadable.',
  '/equipment-scada/register': 'A biomedical engineer checks a neatly parked infusion pump beside a blank equipment tag and clipboard in a bright equipment room.',
  '/equipment-scada/analytics': 'Two biomedical engineers compare a small device component and abstract reliability plots on an unreadable tablet at a workbench.',
  '/platform': 'A hospital administrator assembles simple interlocking wooden modules beside a tablet, suggesting connected services in an airy office.',
  '/workflows/inbox': 'A hospital team lead reviews a neat tray of closed approval folders at a bright desk, with an organised in-tray and out-tray.',
  '/settings/workflows': 'An operations designer arranges blank connected process cards on a tabletop beside a colleague, no readable flowchart text.',
  '/settings/letters': 'A hospital administrator prepares a cream document in a folder with an envelope and pen on an elegant timber desk.',
  '/settings/terminology': 'A clinician and information officer review a closed reference book and unlabelled index cards together in a quiet library corner.',
  '/settings/master-data': 'A data steward organises matching sets of blank indexed folders and colour-coded wooden blocks in a secure hospital office.',
};
const workforce = ['a team lead reviewing a shift plan beside a simple clock', 'a nurse coordinator arranging blank shift cards on a wall planner', 'a staff member arriving at a discreet check-in terminal', 'an employee reviewing a blank time log at a calm desk', 'a supervisor thoughtfully checking a staff approval folder', 'a clinician resting in a leafy courtyard while a closed travel bag sits nearby', 'two staff members coordinating task cards at a huddle table', 'an analyst comparing a clock and abstract nonnumeric activity charts', 'a manager discussing fair working-time rules with a colleague'];
const hr = ['a people-operations team sharing an overview at a bright meeting table', 'a diverse group of adult hospital staff standing naturally near an office doorway', 'two department leads collaborating between adjacent hospital offices', 'hospital colleagues gathered around an arrangement of connected blank staff cards', 'an HR adviser discussing a closed policy handbook respectfully with a colleague', 'a department head preparing a blank vacancy request folder', 'a recruiter interviewing an adult candidate at eye level', 'a talent coordinator reviewing a small stack of blank candidate portfolios', 'a mentor welcoming a new adult employee with a folded uniform and welcome folder', 'a manager and departing employee completing a respectful handover of a key and closed folder', 'a supervisor and employee sharing a supportive one-to-one development conversation', 'a clinician receiving warm congratulations from a colleague in a quiet office', 'two hospital colleagues coordinating a move between facilities with a closed transfer folder', 'a payroll officer carefully reconciling a closed payroll folder and calculator with no readable values', 'an asset officer handing a laptop case to a staff member', 'a friendly support adviser wearing a headset at a tidy desk', 'an HR analyst and manager discussing abstract unreadable people reports', 'an administrator planning a hospital organisation using blank modular blocks'];
const acct = {
  '': 'a hospital finance team reviewing a closed ledger and abstract charts at a sunlit meeting table',
  'chart-of-accounts': 'an accountant organising a tiered set of blank indexed ledger folders', 'journals': 'an accountant writing in a blank open journal beside neatly stacked source folders',
  'general-ledger': 'a senior accountant reviewing a substantial open ledger without readable entries', 'trial-balance': 'a finance officer comparing two symmetrical stacks of blank ledgers beside a simple balance scale',
  'customers': 'a finance coordinator speaking with a hospital customer at a welcoming office desk', 'quotations': 'an estimator preparing a blank quotation folder with a pen and calculator',
  'sales-orders': 'a finance officer checking a blank order folder beside neatly packed hospital supplies', 'invoices': 'an accountant organising blank invoice sheets in an orderly tray',
  'sales-receipts': 'a cashier handling a blank receipt across a tidy counter, no banknotes or payment values', 'delayed-charges': 'an accountant reviewing a closed pending-charge folder beside a small clock',
  'receipts': 'a finance clerk carefully matching blank receipts with a closed customer folder', 'credit-notes': 'an accountant comparing a blank correction note with an invoice folder',
  'vendors': 'a hospital purchasing officer meeting a professional supplier representative over a sealed sample box', 'requisitions': 'a department representative discussing a blank supply requisition with a purchasing officer',
  'purchase-orders': 'a procurement officer preparing a closed purchase order folder beside a catalogue with blank covers', 'goods-receipts': 'a receiving officer checking sealed delivered boxes against a blank clipboard',
  'bills': 'a payable officer organising sealed vendor bills in a neat filing tray', 'vendor-payments': 'a finance officer and procurement colleague reviewing a secure payment confirmation on an unreadable laptop',
  'vendor-credits': 'a procurement accountant checking a blank vendor adjustment folder beside a sealed return box', 'bank-accounts': 'a treasury officer reviewing closed banking folders beside a laptop in a secure office',
  'bank-transactions': 'an accountant matching blank bank statement sheets with a ledger', 'bank-feeds': 'a treasury analyst reviewing an abstract unreadable feed on a laptop beside organised paper records',
  'reconciliation': 'an accountant matching two orderly sets of blank records with calm precision', 'expenses': 'a staff member and finance officer reviewing a small stack of blank expense receipts',
  'fixed-assets': 'an asset accountant inspecting an unbranded hospital device beside an asset folder', 'inventory': 'a finance officer and storekeeper comparing sealed supply boxes and a closed stock-value ledger',
  'budgets': 'a finance team arranging simple wooden planning blocks beside a closed budget notebook', 'projects': 'a project accountant and hospital facilities lead discussing a blank project folder beside an architectural model',
  'tax': 'a finance specialist carefully reviewing a closed tax reference book and organised folders', 'reports': 'a finance analyst presenting abstract nonnumeric charts to a colleague',
  'consolidation': 'two finance officers connecting blank folders from multiple hospital branches across a meeting table', 'period-end': 'an accountant closing an orderly ledger beside a small desk calendar with no readable markings',
  'approvals': 'a finance supervisor carefully reviewing a closed approval folder handed over by a colleague', 'notifications': 'a finance coordinator checking a discreet message on an unreadable phone beside a ledger',
  'audit-trail': 'an auditor comparing source folders with a closed ledger beside a locked filing cabinet', 'setup': 'an accountant arranging a new blank ledger set and desk tools in an orderly workspace',
  'integrations': 'a finance and technology professional discussing simple interlocking wooden modules beside a laptop', 'settings': 'a finance manager organising modular account folders at a clean administrative desk',
};
const extras = [
  ['Clinical', '/patients/:id', 'Patient Chart', 'A doctor reviews a private closed patient folder beside a comfortable consultation chair.'],
  ['Clinical', '/ward-round/:admissionId/:roundId?', 'Ward Round', 'A small clinician and nurse team discusses care beside a comfortable fully clothed adult patient in a bright ward.'],
  ['Diagnostics', '/laboratory/test-settings', 'Laboratory Test Settings', 'A laboratory manager reviews a closed laboratory reference catalogue beside clean capped specimen racks.'],
  ['Administration', '/billing/invoices/:invoiceId', 'Invoice Detail', 'A hospital finance adviser explains a single blank invoice folder at a tidy desk.'],
  ['Administration', '/inventory/item/:itemId', 'Inventory Item Detail', 'A storekeeper examines one sealed unbranded supply box beside a blank stock card.'],
  ['Equipment Intelligence', '/equipment-scada/register/:id', 'Equipment Detail', 'A biomedical engineer carefully examines a clinical monitor and a closed service history folder.'],
  ['Human Resources', '/hr/employees/:id', 'Employee Profile', 'A hospital staff member and HR adviser discuss a closed personal development folder in a private office.'],
];
function prop(node,key){return node.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText()===key)?.initializer;}
const value = n => n && ts.isStringLiteral(n) ? n.text : '';
const slug = s => s.replace(/\/:([\w]+)\??/g,'-$1').replace(/^\//,'').replaceAll('/','-').replaceAll('?','') || 'overview';
async function init(){
  const src=ts.createSourceFile('nav.ts',await fs.readFile(path.join(root,'src/data/nav.ts'),'utf8'),ts.ScriptTarget.Latest,true);
  let nav; const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText()==='NAV')nav=n.initializer;ts.forEachChild(n,visit);};visit(src);
  const entries=[];
  for(const group of nav.elements){
    const category=value(prop(group,'title'));let idx=0;
    for(const item of prop(group,'items').elements){
      const children=prop(item,'children');
      for(const leaf of children?.elements??[item]){
        const route=value(prop(leaf,'to')), label=value(prop(leaf,'label'));
        let scene=scenes[route];
        if(category==='Workforce')scene=`Hospital workforce scene: ${workforce[idx++]}.`;
        if(category==='Human Resources')scene=`Hospital human-resources scene: ${hr[idx++]}.`;
        if(category==='Accounting')scene=`Hospital finance scene: ${acct[route.replace(/^\/accounting\/?/,'')]}.`;
        if(!scene||scene.includes('undefined'))throw new Error(`Missing scene for ${route}`);
        entries.push({id:slug(route),route,label,category,scene});
      }
    }
  }
  for(const [category,route,label,scene] of extras)entries.push({id:slug(route),route,label,category,scene});
  let prior;try{prior=JSON.parse(await fs.readFile(manifestPath,'utf8'));}catch{}
  for(const entry of entries){Object.assign(entry,{prompt:`${style}\nSpecific module: ${entry.category} / ${entry.label}. Scene: ${entry.scene}`,status:'pending'});const old=prior?.entries.find(x=>x.id===entry.id);if(old?.status==='ready')Object.assign(entry,old);}
  await fs.mkdir(dest,{recursive:true});await writeManifest({version:1,generatedWith:'Built-in ImageGen',video:'Unavailable in this session; no generated video supplied.',sourceNavigation:'src/data/nav.ts',style,entries});
  console.log(JSON.stringify({count:entries.length,categories:[...new Set(entries.map(x=>x.category))],manifest:manifestPath}));
}
async function attach(id,source){
  const m=JSON.parse(await fs.readFile(manifestPath,'utf8'));const e=m.entries.find(x=>x.id===id);if(!e)throw new Error(`Unknown ${id}`);
  const originals=path.join(root,'output/emr-artwork-v1/originals');await fs.mkdir(originals,{recursive:true});await fs.copyFile(source,path.join(originals,`${id}.png`));
  await sharp(source).rotate().resize({width:1536,withoutEnlargement:true}).webp({quality:82}).toFile(path.join(dest,`${id}-v1.webp`));
  await sharp(source).rotate().resize({width:480,withoutEnlargement:true}).webp({quality:76}).toFile(path.join(dest,`${id}-thumb-v1.webp`));
  Object.assign(e,{status:'ready',image:`${id}-v1.webp`,thumbnail:`${id}-thumb-v1.webp`,original:`output/emr-artwork-v1/originals/${id}.png`});
  await writeManifest(m);console.log(`${id}: saved`);
}
async function gallery(){
  const m=JSON.parse(await fs.readFile(manifestPath,'utf8'));const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const ready=m.entries.filter(x=>x.status==='ready');
  const cards=m.entries.map(e=>`<article data-category="${esc(e.category)}"><div class="art">${e.status==='ready'?`<a href="${e.image}"><img src="${e.thumbnail}" srcset="${e.thumbnail} 480w, ${e.image} 1536w" sizes="(max-width: 640px) calc(100vw - 64px), 360px" width="480" height="320" loading="lazy" decoding="async" alt="${esc(e.label)} editorial illustration"></a>`:'<p>Artwork pending</p>'}</div><div class="caption"><small>${esc(e.category)}</small><h2>${esc(e.label)}</h2><code>${esc(e.route)}</code><p>${e.status==='ready'?'<span class="ready">Generated</span>':'Pending'}</p></div></article>`).join('');
  await fs.writeFile(path.join(dest,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sabi EMR · Artwork Library</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f5f6f0;color:#173e32;font:16px/1.5 system-ui,sans-serif}main{max-width:1440px;margin:auto}h1{font-size:clamp(28px,4vw,48px);letter-spacing:-.04em;margin:8px 0}header p{max-width:800px;color:#526b60}label{display:block;margin:24px 0 8px}select{font:inherit;padding:12px;min-height:44px;border:1px solid #b7cbbb;border-radius:12px;background:white;max-width:100%}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:20px;margin-top:24px}article{border:1px solid #dce3d7;border-radius:20px;background:white;overflow:hidden;min-width:0}.art{aspect-ratio:3/2;background:#e7eddc;display:grid;place-items:center}.art img{width:100%;height:100%;object-fit:cover;display:block}.caption{padding:18px}small{text-transform:uppercase;letter-spacing:.08em;font-size:11px}h2{font-size:20px;margin:6px 0}code{font-size:12px;overflow-wrap:anywhere}.ready{color:#087454}a:focus-visible{outline:3px solid #0b806a;outline-offset:-4px}[hidden]{display:none!important}</style></head><body><main><header><small>Sabi EMR · Original art collection</small><h1>Care, in every department.</h1><p>${ready.length} of ${m.entries.length} route-specific illustrations generated. These are decorative assets, not clinical instructions. This library does not change clinical workflows or sign in to hospital accounts.</p><p>Video generation is unavailable in this session.</p><label for="category">Browse modules</label><select id="category"><option value="">All modules</option>${[...new Set(m.entries.map(x=>x.category))].map(c=>`<option>${esc(c)}</option>`).join('')}</select></header><section class="grid">${cards}</section></main><script>document.getElementById('category').addEventListener('change',event=>{for(const card of document.querySelectorAll('article'))card.hidden=!!event.target.value&&card.dataset.category!==event.target.value;});</script></body></html>`);
  console.log(JSON.stringify({ready:ready.length,total:m.entries.length,gallery:path.join(dest,'index.html')}));
}
async function verify(requireComplete=false){
  const m=JSON.parse(await fs.readFile(manifestPath,'utf8'));const ids=new Set();const hashes=new Map();const failures=[];let bytes=0,ready=0;
  for(const e of m.entries){
    if(ids.has(e.id))failures.push(`Duplicate id ${e.id}`);ids.add(e.id);
    if(!e.scene||e.prompt.includes('undefined'))failures.push(`Invalid prompt ${e.id}`);
    if(e.status!=='ready')continue;
    ready++;
    try{
      const original=path.join(root,e.original);const meta=await sharp(original).metadata();
      if(meta.format!=='png'||!meta.width||!meta.height)failures.push(`Invalid original: ${e.id}`);
      const hash=createHash('sha256').update(await fs.readFile(path.join(dest,e.image))).digest('hex');
      if(hashes.has(hash))failures.push(`Duplicate artwork: ${e.id} and ${hashes.get(hash)}`);
      hashes.set(hash,e.id);
    }catch(err){failures.push(`${e.id}: ${err.message}`);}
    for(const [key,width] of [['image',1536],['thumbnail',480]]){
      try{const file=path.join(dest,e[key]);const meta=await sharp(file).metadata();bytes+=(await fs.stat(file)).size;
        if(meta.format!=='webp'||meta.width>width||!meta.height)failures.push(`Invalid ${key}: ${e.id}`);
      }catch(err){failures.push(`${e.id}: ${err.message}`);}
    }
  }
  if(requireComplete&&ready!==m.entries.length)failures.push(`${m.entries.length-ready} images are not ready`);
  console.log(JSON.stringify({ready,total:m.entries.length,webpBytes:bytes,failures},null,2));if(failures.length)process.exitCode=1;
}
async function sheets(){
  const m=JSON.parse(await fs.readFile(manifestPath,'utf8'));const dir=path.join(root,'output/emr-artwork-v1/qa');await fs.mkdir(dir,{recursive:true});
  const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  for(const category of [...new Set(m.entries.map(x=>x.category))]){
    const entries=m.entries.filter(x=>x.category===category&&x.status==='ready');if(!entries.length)continue;const cols=3,w=320,h=254,composite=[];
    for(const [i,e] of entries.entries()){
      const left=i%cols*w,top=Math.floor(i/cols)*h;
      composite.push({input:await sharp(path.join(dest,e.thumbnail)).resize(320,213).png().toBuffer(),left,top});
      composite.push({input:Buffer.from(`<svg width="320" height="41"><rect width="320" height="41" fill="#f5f6ef"/><text x="12" y="26" font-family="Arial" font-size="14" fill="#173e32">${esc(e.label).slice(0,44)}</text></svg>`),left,top:top+213});
    }
    const file=path.join(dir,`${category.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-')}.png`);
    await sharp({create:{width:w*cols,height:h*Math.ceil(entries.length/cols),channels:3,background:'#f5f6ef'}}).composite(composite).png().toFile(file);console.log(file);
  }
}
const [cmd,...args]=process.argv.slice(2);if(cmd==='init')await init();else if(cmd==='attach')await attach(...args);else if(cmd==='gallery')await gallery();else if(cmd==='verify')await verify(args.includes('--complete'));else if(cmd==='sheets')await sheets();else if(cmd==='pending'){const m=JSON.parse(await fs.readFile(manifestPath,'utf8'));console.log(JSON.stringify(m.entries.filter(x=>x.status!=='ready').map(({id,prompt})=>({id,prompt}))));}else throw new Error('Use init | attach id source | gallery | pending | verify [--complete] | sheets');
