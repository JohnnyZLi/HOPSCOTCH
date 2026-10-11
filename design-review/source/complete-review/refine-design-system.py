from pathlib import Path

base=Path('complete-review')
path=base/'review.css'
s=path.read_text()
light='--rv-shadow:rgba(24,44,70,.14);--rv-shadow-soft:rgba(24,44,70,.08);--rv-control-fill:rgba(255,255,255,.64);--rv-control-rim:rgba(70,94,126,.15);--rv-control-crest:rgba(255,255,255,.82);--rv-selected-fill:rgba(218,233,250,.82);--rv-selected-ink:#164b82;--rv-action-fill:#2360af;--rv-action-ink:#ffffff;--rv-divider:rgba(64,88,120,.15);--rv-ambient-span:clamp(680px,96cqi,1120px)'
dark='--rv-shadow:rgba(1,6,15,.50);--rv-shadow-soft:rgba(1,6,15,.28);--rv-control-fill:rgba(26,38,54,.64);--rv-control-rim:rgba(164,194,228,.14);--rv-control-crest:rgba(207,229,255,.18);--rv-selected-fill:rgba(48,76,109,.82);--rv-selected-ink:#deeeff;--rv-action-fill:#a8caff;--rv-action-ink:#12243d;--rv-divider:rgba(181,196,218,.13)'
lines=s.splitlines();lines[0]=lines[0][:-1]+';'+light+'}';lines[1]=lines[1][:-1]+';'+dark+'}';s='\n'.join(lines)+'\n'
changes={
'border:1px solid var(--hs-line);border-radius:14px;background:var(--hs-panel);padding:9px 12px':'border:1px solid var(--rv-control-rim);border-radius:14px;background:var(--rv-control-fill);padding:9px 12px;box-shadow:inset 0 1px 0 var(--rv-control-crest),0 2px 7px var(--rv-shadow-soft);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);transition:background-color 220ms ease,color 220ms ease,box-shadow 220ms ease,border-color 220ms ease',
'border:1px solid var(--hs-line);border-radius:12px;background:var(--hs-panel);padding:10px 12px;width:100%':'border:1px solid var(--rv-control-rim);border-radius:12px;background:var(--rv-control-fill);padding:10px 12px;width:100%;box-shadow:inset 0 1px 0 var(--rv-control-crest);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)',
'container-name:review}':'container-name:review;background:var(--hs-bg)}',
'border-bottom:1px solid var(--hs-line)}':'border-bottom:1px solid var(--rv-divider);--hs-ui-density:.15}',
'.rv-tabbar button[aria-pressed=true]{background:var(--hs-tint);color:var(--hs-accent)}':'.rv-tabbar button[aria-pressed=true]{background:var(--rv-selected-fill);color:var(--rv-selected-ink);box-shadow:inset 0 1px 0 var(--rv-control-crest)}',
'minmax(min(100%,140px),1fr));gap:14px':'minmax(min(100%,120px),1fr));gap:16px 14px',
'border-top:1px solid var(--hs-line);vertical-align:top':'border-top:1px solid var(--rv-divider);vertical-align:top',
'color-mix(in srgb,var(--hs-ink) 11%,transparent)':'var(--rv-shadow)',
'color-mix(in srgb,var(--hs-ink) 10%,transparent)':'var(--rv-shadow-soft)',
'color-mix(in srgb,var(--hs-ink) 8%,transparent)':'var(--rv-shadow-soft)',
'background:var(--hs-panel);color:var(--hs-muted);transition:background-color 220ms ease,color 220ms ease':'background:var(--rv-control-fill);color:var(--hs-muted);transition:background-color 220ms ease,color 220ms ease,box-shadow 220ms ease',
'.rv-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center}':'.rv-toolbar{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;align-items:end}',
}
for old,new in changes.items():
 assert old in s,old
 s=s.replace(old,new)
def after(anchor,rules):
 global s
 line=next(line for line in s.splitlines() if anchor in line)
 s=s.replace(line,line+'\n'+rules,1)
after('button,#__ROOT__ select{','''#__ROOT__ [data-ui-surface=control]{background:var(--rv-control-fill)}
#__ROOT__ button[data-action-role=primary],#__ROOT__ button[type=submit]{background:var(--rv-action-fill);color:var(--rv-action-ink);border-color:transparent;box-shadow:0 3px 9px var(--rv-shadow-soft)}
#__ROOT__ button[aria-pressed=true]{background:var(--rv-selected-fill);color:var(--rv-selected-ink)}''')
after('.rv-main{','''#__ROOT__ .rv-main{isolation:isolate}
#__ROOT__ .rv-main::before{content:"";position:absolute;inset:0 0 auto;height:min(100%,var(--rv-ambient-span));z-index:-1;pointer-events:none;background-image:linear-gradient(to bottom,var(--hs-ambient-base-96),var(--hs-ambient-base-0) 18%,var(--hs-ambient-base-0) 72%,var(--hs-ambient-base)),radial-gradient(ellipse 90% 74% at 104% 38%,var(--hs-ambient-teal),var(--hs-ambient-teal-shadow) 46%,var(--hs-ambient-teal-shadow-0) 78%),radial-gradient(ellipse 112% 90% at 24% 68%,var(--hs-ambient-cobalt),var(--hs-ambient-cobalt-shadow) 44%,var(--hs-ambient-cobalt-shadow-0) 78%),radial-gradient(ellipse 80% 65% at -4% 27%,var(--hs-ambient-violet),var(--hs-ambient-violet-shadow-0) 82%);background-size:100% 100%;background-repeat:no-repeat}''')
after('.rv-tabbar button{','#__ROOT__ .rv-tabbar button{box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}')
after('.rv-record{','''#__ROOT__ .rv-record[data-ui-surface=record]{--hs-ui-density:.85;--hs-glass-depth:.24}
#__ROOT__ .wb-workbench[data-ui-surface=record],#__ROOT__ .ev-inspector[data-ui-surface=record]{--hs-ui-density:1.3;--hs-glass-depth:.26}''')
after('.rv-table td{','''#__ROOT__ .rv-table tr[data-selected=true]{background:color-mix(in srgb,var(--rv-selected-fill) 56%,transparent)}
#__ROOT__ .rv-table .rv-row-note td{padding-top:0;border-top:0;color:var(--hs-muted);font-size:12px;line-height:1.6}
#__ROOT__ .rv-table tr:has(+.rv-row-note) td{padding-bottom:6px}''')
after('.rv-endpoint{','#__ROOT__ .rv-endpoint[data-ui-surface=record]{--hs-ui-density:.2;--hs-glass-depth:.18}')
after('.rv-toolbar{','''#__ROOT__ .rv-toolbar>label{display:flex;flex-direction:column;align-items:stretch;gap:6px;flex:1 1 180px}
#__ROOT__ .rv-toolbar>label>select{width:100%}''')
path.write_text(s)
for name in ['motion','workbench','evidence']:
 p=base/(name+'.html');s=p.read_text().replace('class="rv-shell hs-shell"','class="rv-shell"')
 if name=='motion':s=s.replace('class="rv-play cursor-interaction"','class="rv-play cursor-interaction" data-action-role="primary"')
 if name=='workbench':s=s.replace('class="wb-probe cursor-interaction"','class="wb-probe cursor-interaction" data-action-role="primary"').replace('data-action="repair"','data-action="repair" data-action-role="primary"')
 if name=='evidence':
  s=s.replace('class="ev-load cursor-interaction"','class="ev-load cursor-interaction" data-action-role="primary"')
  anchor=next(line for line in s.splitlines() if '.ev-field-row span{' in line)
  s=s.replace(anchor,anchor+'''\n#__ROOT__ .ev-field-row{position:relative;isolation:isolate}
#__ROOT__ .ev-field-row::before{content:"";position:absolute;inset:3px -8px;z-index:-1;pointer-events:none;border-radius:12px;background:var(--hs-material-wash);opacity:0;transition:opacity 220ms ease}
#__ROOT__ .ev-field-row[data-selected=true]::before{opacity:1}''')
 p.write_text(s)

p=base/'workbench.js';s=p.read_text()
s=s.replace("if(h==='Fact'&&row.Note)td.append(node('small','',row.Note));",'')
old='body.append(tr);}table.append(body);return table;'
new="body.append(tr);if(row.Note){const note=node('tr','rv-row-note'),cell=node('td','',row.Note);cell.setAttribute('colspan',String(headers.length));note.append(cell);body.append(note);}}table.append(body);return table;"
assert old in s;s=s.replace(old,new,1);p.write_text(s)

p=base/'evidence.js';s=p.read_text()
s=s.replace("Array.isArray(value)?value.join(' · ')","typeof value==='boolean'?(value?'Yes':'No'):Array.isArray(value)?value.join(' · ')",1)
line=next(line for line in s.splitlines() if line.startswith('function display('))
formatter="function measuredValue(fact){if(fact.unit==='bits-per-second'&&typeof fact.value==='number'&&Number.isFinite(fact.value)&&fact.value>=0){const exponent=fact.value>0?Math.min(4,Math.max(0,Math.floor(Math.log10(fact.value)/3))):0;return new Intl.NumberFormat('en-US',{maximumSignificantDigits:3}).format(fact.value/10**(3*exponent))+' '+['bit/s','kbit/s','Mbit/s','Gbit/s','Tbit/s'][exponent];}return display(fact.value)+(fact.unit==='bytes'?' B':fact.unit?' '+fact.unit:'');}"
s=s.replace(line,line+'\n'+formatter)
s=s.replace("Value:display(f.value)+(f.unit?' '+f.unit:'')","Value:measuredValue(f)")
s=s.replace("for(const row of rows){const tr=node('tr');headers.forEach", "for(const row of rows){const tr=node('tr');tr.dataset.selected=String(row.selected||false);headers.forEach",1)
s=s.replace("const row=node('div','ev-field-row'),b=button", "const row=node('div','ev-field-row');row.dataset.selected=String(fieldId===field.id);const b=button",1)
old="for(const b of q('.ev-packet')?.querySelectorAll('.ev-fact-button')||[])b.setAttribute('aria-pressed',String(b.dataset.fieldId===fieldId));"
new="for(const b of q('.ev-packet')?.querySelectorAll('.ev-fact-button')||[]){const selected=b.dataset.fieldId===fieldId;b.setAttribute('aria-pressed',String(selected));b.parentElement.dataset.selected=String(selected);}"
assert old in s;s=s.replace(old,new)
p.write_text(s)
print('Shared page, surface roles, actions, shadows, density, row notes and evidence formatting revised.')
