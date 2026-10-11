from pathlib import Path
p=Path('complete-review/motion.js');s=p.read_text()
a=s.index('function reflow(){')
s=s[:a]+'''function reserveState(){
 if(['failure','http'].includes(sceneId))return;
 const cards=[q('.rv-client-record'),q('.rv-server-record')];
 for(const [index,card]of cards.entries()){
  const width=card.clientWidth;if(!width)continue;const clone=card.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.inert=true;Object.assign(clone.style,{position:'absolute',visibility:'hidden',width:width+'px',minHeight:'0',height:'auto'});q('.rv-main').append(clone);let maximum=0;
  for(const frame of frames){const values=frame.records||[],half=Math.ceil(values.length/2);drawFacts(clone.querySelector('dl'),index?values.slice(half):values.slice(0,half));const phase=clone.querySelector('.rv-phase');if(phase)phase.textContent=titleCase(frame.state?.phase||'')+(frame.state?.phase==='closed-cleanly'?' · wire exchange complete; endpoint cleanup is outside this model':'');maximum=Math.max(maximum,clone.getBoundingClientRect().height);}clone.remove();card.style.minHeight=Math.ceil(maximum)+'px';
 }
}
''' +s[a:]
s=s.replace(" root.surfacePainter.prepare(Math.max(cardWidth,compactW),Math.max(maxHeight,compactH));", " reserveState();root.surfacePainter.prepare(Math.max(cardWidth,compactW),Math.max(maxHeight,compactH));")
# Give compact labels a measured footprint, with wrapping when two endpoints need
# to share a small width. The value scanner remains independently skinny.
s=s.replace("const envelopeH=sceneId", "const envelopeH=sceneId")
s=s.replace("compactW=Math.min(112,Math.max(88,width*.3)),compactH=44,ports=", "compactLabelStyle=getComputedStyle(q('.rv-capsule')||q('.rv-title')),compactFont=parseFloat(compactLabelStyle.fontSize)||13,compactContext=document.createElement('canvas').getContext('2d');compactContext.font='500 '+compactFont+'px '+compactLabelStyle.fontFamily;const compactLabels=frames.map(f=>f.local?'Local state':f.kind==='anatomy'?'Frame':f.objectTitle),compactText=Math.max(...compactLabels.map(text=>compactContext.measureText(text).width)),compactW=Math.min((width-24)/2,Math.max(88,compactText+32)),compactH=Math.max(44,Math.ceil(compactText/Math.max(1,compactW-32))*compactFont*1.2+16),ports=")
s=s.replace("capsule.append(node('span','rv-protocol'),node('span','',f.objectTitle))", "capsule.append(node('span','rv-protocol'),node('span','',f.local?'Local state':f.objectTitle))")
p.write_text(s)
p=Path('complete-review/review.css');s=p.read_text().replace('color:var(--hs-material-ink);white-space:nowrap}', 'color:var(--hs-material-ink);white-space:normal;text-align:center;overflow-wrap:anywhere;padding:6px 10px}')
p.write_text(s)
