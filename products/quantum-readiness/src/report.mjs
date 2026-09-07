export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const para=(label,value)=>`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
const sourceLink=source=>/^https:\/\//.test(source.url)?`<a href="${escapeHtml(source.url)}" rel="noreferrer">${escapeHtml(source.title)}</a>`:escapeHtml(source.title);
const referenceLinks=refs=>refs.map(ref=>`<a href="#observation-${escapeHtml(encodeURIComponent(ref))}">${escapeHtml(ref)}</a>`).join(', ');

export function renderReport(report) {
  const findings=report.findings.map(f=>`<section>
    <h3>${escapeHtml(f.title)}</h3>
    ${['category','priority','observation','interpretation','confidence','priorityRationale','action','owner','dependencies','validation','rollback'].map(k=>para(k,f[k])).join('')}
    <p><strong>Observation references:</strong> ${referenceLinks(f.observationRefs)}</p>
    ${para('Rule',`${f.id} / ${f.ruleVersion}`)}
    <ul>${f.sources.map(s=>`<li>${sourceLink(s)} (reviewed ${escapeHtml(s.reviewedOn)})</li>`).join('')}</ul>
  </section>`).join('');
  const observations=report.observations.map(o=>`<section id="observation-${escapeHtml(encodeURIComponent(o.id))}">
    <h3>${escapeHtml(o.id)}</h3><pre>${escapeHtml(JSON.stringify(o,null,2))}</pre>
  </section>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Quantum-readiness assessment</title>
  <style>body{font:16px/1.6 system-ui;max-width:1050px;margin:3rem auto;padding:0 1.5rem;color:#172a3a}h1,h2,h3{line-height:1.2}section{border-top:1px solid #ccd5da;padding:1.3rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5f6;padding:1rem}li{margin:.5rem 0}.tag{font-weight:700;color:#8d3510}a{overflow-wrap:anywhere}</style>
  <body><p class="tag">${report.scope.demo?'CONTROLLED DEMONSTRATION · TASK-OWNED FIXTURES':'PRIVATE AUTHORIZED ENDPOINT ASSESSMENT'}</p>
  <h1>Quantum-readiness assessment</h1>${para('Hostname',report.scope.hostname)}${para('Created',report.createdAt)}${para('Coverage',report.coverage)}
  <p>${escapeHtml(report.summary)}</p><h2>Scope and business context</h2>
  ${para('Address / port',`${report.scope.address}:${report.scope.port}`)}${para('Provider',report.scope.provider)}
  ${para('Sensitivity',report.business.sensitivity)}${para('Confidentiality lifetime',report.business.confidentiality)}<p>${escapeHtml(report.business.source)}</p>
  <ul>${report.scope.limitations.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>
  <h2>Findings and proposed actions</h2>${findings}
  <h2>Migration sequence</h2><ol>${report.plan.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol>
  <h2>Technical evidence appendix</h2><p>Original observation data, rule version, scanner/runtime and scope are preserved below. Only non-secret handshake evidence is collected.</p>
  ${observations}<h3>Complete original report</h3><pre>${escapeHtml(JSON.stringify(report,null,2))}</pre>
  <h2>Retention</h2><p>${escapeHtml(report.retention)}</p></body></html>`;
}
