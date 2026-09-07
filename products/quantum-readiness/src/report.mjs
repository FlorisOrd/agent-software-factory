export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const para = (label, value) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
const findingAnchor = id => `finding-${escapeHtml(encodeURIComponent(id))}`;
const referenceLinks = (refs = []) => refs.map(ref => `<a href="#observation-${escapeHtml(encodeURIComponent(ref))}">${escapeHtml(ref)}</a>`).join(', ');
const addressList = (addresses = []) => addresses.length
  ? `<ul>${addresses.map(item => `<li>${escapeHtml(item.address)} · IPv${escapeHtml(item.family)}</li>`).join('')}</ul>`
  : '<p>None recorded.</p>';

function profileLabel(observation) {
  const id = observation.profile?.id ?? observation.id;
  return ({
    'classical-tls13-v1': 'Classical TLS 1.3 offer',
    'hybrid-mlkem-tls13-v1': 'Hybrid ML-KEM TLS 1.3 offer',
  })[id] ?? id;
}

function outcomeLabel(status) {
  return ({
    negotiated: 'Validated TLS connection',
    'bounded-negative': 'This bounded offer was not accepted',
    'certificate-error': 'Certificate validation failed',
    timeout: 'Time limit reached',
    'tool-unsupported': 'Client could not configure this offer',
    'limit-exceeded': 'Byte limit reached',
    error: 'Connection failed',
    inconclusive: 'Incomplete evidence',
  })[status] ?? status;
}

function sourceLink(source) {
  try {
    const url = new URL(source.url);
    if (url.protocol === 'https:' && !url.username && !url.password) return `<a href="${escapeHtml(url.href)}" rel="noreferrer">${escapeHtml(source.title)}</a>`;
  } catch { /* Malformed source URLs remain plain text. */ }
  return escapeHtml(source.title);
}

function renderFinding(finding) {
  const fields = [
    ['category', 'Category'], ['priority', 'Priority'], ['observation', 'Observation'],
    ['interpretation', 'What this means'], ['confidence', 'Confidence and limitations'],
    ['priorityRationale', 'Why this priority'], ['action', 'Proposed next action'],
    ['owner', 'Responsible party to confirm'], ['dependencies', 'Dependencies'],
    ['validation', 'How to validate'], ['rollback', 'Rollback considerations'],
  ];
  return `<section id="${findingAnchor(finding.id)}">
    <h3>${escapeHtml(finding.title)}</h3>
    ${fields.map(([key, label]) => para(label, finding[key])).join('')}
    <p><strong>Observation references:</strong> ${referenceLinks(finding.observationRefs)}</p>
    ${para('Rule', `${finding.id} / ${finding.ruleVersion}`)}
    <ul>${(finding.sources ?? []).map(source => `<li>${sourceLink(source)} (reviewed ${escapeHtml(source.reviewedOn)})</li>`).join('')}</ul>
  </section>`;
}

function renderCoverage(scope) {
  const sampling = scope.sampling;
  if (!sampling) return '<h2>Address coverage</h2><p>Sampling metadata is unavailable. Review the original observations before drawing a coverage conclusion.</p>';
  return `<h2>Address coverage</h2><div class="coverage">
    ${para(scope.demo ? 'Validated fixture addresses' : 'Validated DNS addresses', sampling.totalValidatedAddresses)}
    ${para('Addresses assessed', sampling.assessedCount)}${para('Addresses unassessed', sampling.unassessedCount)}
    </div>${para('Sampling reason / cap', sampling.reason)}${para('Maximum selected addresses', sampling.maxAddresses)}
    <p>An address is assessed when a connection was attempted; its probe profiles may still be incomplete or unsuccessful. Unassessed addresses have no measured readiness conclusion.</p>
    ${scope.demo ? '<p>Task-owned local fixture results; these addresses were not validated as public production destinations.</p>' : ''}
    <h3>Exact assessed addresses</h3>${addressList(sampling.assessedAddresses)}
    <h3>Selected for probing</h3>${addressList(sampling.selectedAddresses)}
    <h3>Not selected by the sample</h3>${addressList(sampling.unselectedAddresses)}
    <h3>All validated addresses</h3>${addressList(scope.resolvedAddresses)}`;
}

function renderAddressEvidence(report) {
  const observations = new Map(report.observations.map(observation => [observation.id, observation]));
  return (report.addressSummaries ?? []).map(summary => {
    const profiles = (summary.observationRefs ?? []).map(reference => {
      const observation = observations.get(reference);
      if (!observation) return '';
      return `<div class="profile"><h4>${escapeHtml(profileLabel(observation))}</h4>
        ${para('Outcome', outcomeLabel(observation.status))}${para('Connected address', observation.connectedAddress ?? 'Not connected / unobserved')}
        ${para('Key establishment group', observation.keyExchangeGroup ?? 'Not successfully measured')}
        ${para('Certificate validation', observation.certificateValidation?.status ?? 'Not completed')}
        ${para('Measured at', observation.timestamp ?? 'Unknown')}
        <p><strong>Original evidence:</strong> ${referenceLinks([reference])}</p></div>`;
    }).join('');
    const findings = report.findings.filter(finding => (finding.observationRefs ?? []).some(reference => summary.observationRefs?.includes(reference)));
    return `<section><h3>${escapeHtml(summary.address)} · IPv${escapeHtml(summary.family)}</h3>
      <p>${summary.assessed ? 'Assessed · review each profile below' : 'Unassessed · no readiness conclusion'}</p>
      ${para('Evidence coverage', summary.coverage)}${profiles}
      ${findings.length ? `<h4>Findings and actions for this address</h4><ul>${findings.map(finding => `<li><a href="#${findingAnchor(finding.id)}">${escapeHtml(finding.title)}</a></li>`).join('')}</ul>` : ''}
    </section>`;
  }).join('') || '<p>Per-address summaries were not recorded. Original observations remain available in the appendix.</p>';
}

export function renderReport(report) {
  const crossFindings = report.crossAddressFindings ?? [];
  const crossIds = new Set(crossFindings.map(finding => finding.id));
  const findings = report.findings.filter(finding => !crossIds.has(finding.id)).map(renderFinding).join('');
  const differences = crossFindings.length ? crossFindings.map(renderFinding).join('')
    : `<p>${(report.scope.sampling?.assessedCount ?? 0) < 2
      ? 'Fewer than two addresses were assessed. Cross-address consistency cannot be established.'
      : 'No cross-address inconsistency was identified in the measured profiles. This does not establish readiness of unassessed addresses, the origin or internal systems.'}</p>`;
  const observations = report.observations.map(observation => `<section id="observation-${escapeHtml(encodeURIComponent(observation.id))}">
    <h3>${escapeHtml(observation.id)}</h3><pre>${escapeHtml(JSON.stringify(observation, null, 2))}</pre>
  </section>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Quantum-readiness assessment</title>
  <style>body{font:16px/1.6 system-ui;max-width:1050px;margin:3rem auto;padding:0 1.5rem;color:#172a3a;overflow-wrap:anywhere}h1,h2,h3{line-height:1.2}section{border-top:1px solid #ccd5da;padding:1.3rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5f6;padding:1rem}li{margin:.5rem 0}.tag{font-weight:700;color:#8d3510}a{overflow-wrap:anywhere}.coverage,.profile{background:#f2f5f6;border:1px solid #ccd5da;border-radius:8px;padding:1rem;margin:1rem 0}.profile p{margin:.35rem 0}@media print{a{color:inherit}pre{font-size:10px}}</style>
  <body><p class="tag">${report.scope.demo ? 'CONTROLLED DEMONSTRATION · TASK-OWNED FIXTURES' : 'PRIVATE AUTHORIZED ENDPOINT ASSESSMENT'}</p>
  <h1>Quantum-readiness assessment</h1>${para('Hostname', report.scope.hostname)}${para('Created', report.createdAt)}${para('Coverage', report.coverage)}
  <p>${escapeHtml(report.summary)}</p>${renderCoverage(report.scope)}
  <h2>Scope and business context</h2>${para('Port', report.scope.port)}${para('Provider', report.scope.provider)}
  ${para('Sensitivity', report.business.sensitivity)}${para('Confidentiality lifetime', report.business.confidentiality)}<p>${escapeHtml(report.business.source)}</p>
  <ul>${report.scope.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  <h2>Per-address findings and evidence</h2>${renderAddressEvidence(report)}
  <h2>Observed differences between addresses</h2>${differences}
  <h2>Findings and proposed actions</h2>${findings}
  <h2>Migration sequence</h2><ol>${report.plan.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
  <h2>Technical evidence appendix</h2><p>The complete original observations, sampling metadata, rule version, scanner/runtime and scope are preserved below and in JSON. Only non-secret handshake evidence is collected.</p>
  ${observations}<h3>Complete original report</h3><pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
  <h2>Retention</h2><p>${escapeHtml(report.retention)}</p></body></html>`;
}
