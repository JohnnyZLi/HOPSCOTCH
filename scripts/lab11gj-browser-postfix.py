from pathlib import Path

p=Path('scripts/performance-profile.mjs')
t=p.read_text()

start=t.index("  // Lab 11J: returning from Lab 02 recreates the Builder selection shell")
end=t.index("  // Labs 11E-H: first show ARP resolution, STP blocking, same-VLAN switching, and MAC learning.", start)
# Keep the LAN section marker after the Packet Microscope return, but remove the ACL sequence from there.
t=t[:start]+t[end:]

marker="  // Cross-link one TTL-scoped probe into the actual Packet Microscope and return."
block=r'''  // Lab 11J: evaluate policy while the OSPF failover path is still live.
  const aclEdgeSelected = await cdp.evaluate(`(()=>{
    const node=[...document.querySelectorAll('.builder-node')].find((candidate)=>candidate.querySelector('strong')?.textContent?.trim()==='EDGE');
    if(!node)return false;
    node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,isPrimary:true,pointerType:'mouse'}));
    return true;
  })()`);
  if (!aclEdgeSelected) throw new Error(`${profile.id} could not select EDGE for ACL policy testing.`);
  await waitForExpression(cdp, `document.querySelector('.builder-acl-section .control-title')?.innerText.includes('0 RULES')`, 8000);
  await measuredClickButton(cdp, '.builder-acl-section button', 'ADD ACL RULE');
  await waitForExpression(cdp, `document.querySelector('.builder-policy-panel')?.classList.contains('denied')`, 8000);
  const deniedPolicy = await cdp.evaluate(`(()=>({policy:document.querySelector('.builder-policy-panel')?.innerText??'',forwarding:document.querySelector('.builder-forwarding')?.innerText??'',rules:document.querySelectorAll('.builder-acl-rules>div').length}))()`);
  if (!deniedPolicy.policy.includes('DENIED') || !deniedPolicy.forwarding.includes('EDGE → R2 → CORE') || deniedPolicy.rules !== 1) throw new Error(`${profile.id} ACL denial did not remain separate from OSPF forwarding truth.`);
  await measuredClickButton(cdp, '.builder-probe-section button', 'PING');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('PING') && document.querySelector('.builder-probe-panel')?.classList.contains('failed')`, 8000);
  const aclPing = await cdp.evaluate(`document.querySelector('.builder-probe-panel')?.innerText??''`);
  if (!/ACL|POLICY|DENIED/i.test(aclPing)) throw new Error(`${profile.id} Ping did not surface ACL policy denial.`);
  const deletedAcl = await cdp.evaluate(`(()=>{const button=document.querySelector('.builder-acl-rules button');if(!button)return false;button.click();return true})()`);
  if (!deletedAcl) throw new Error(`${profile.id} could not remove the temporary ACL rule.`);
  await waitForExpression(cdp, `!document.querySelector('.builder-policy-panel')?.classList.contains('denied')`, 8000);
  await measuredClickButton(cdp, '.builder-probe-section button', 'PING');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('PING') && document.querySelector('.builder-probe-panel')?.classList.contains('success')`, 8000);

'''
if marker not in t:
    raise SystemExit('Packet Microscope insertion marker missing')
t=t.replace(marker,block+marker,1)
p.write_text(t)
