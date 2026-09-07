'use strict';

const byId = (id) => document.getElementById(id);
const form = byId('assessment-form');
const hostnameInput = byId('hostname');
const authorizationInput = byId('authorized');
const assessButton = byId('assess-button');
let configuration;
let authorizedHostname = '';
let busy = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

function normalizeHostname() {
  return hostnameInput.value.trim().toLowerCase();
}

function describe(value) {
  if (value === undefined || value === null) return 'Not observed / unknown';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function titleCase(value) {
  return String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

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
  })[status] ?? titleCase(status ?? 'unknown');
}

function renderValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return element('p', 'None recorded.', 'hint');
    const list = element('ul', undefined, 'value-list');
    for (const item of value) {
      const li = element('li');
      li.append(renderValue(item));
      list.append(li);
    }
    return list;
  }
  if (value && typeof value === 'object') {
    const list = element('dl', undefined, 'detail-list');
    for (const [key, item] of Object.entries(value)) {
      list.append(element('dt', titleCase(key)));
      const description = element('dd');
      description.append(renderValue(item));
      list.append(description);
    }
    return list;
  }
  if (typeof value === 'string' && /^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        const link = element('a', value);
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        return link;
      }
    } catch { /* A malformed source remains visible as plain text. */ }
  }
  return element('p', describe(value));
}

function reportSection(title, content, className = '') {
  const section = element('section', undefined, `report-section ${className}`.trim());
  section.append(element('h3', title));
  section.append(renderValue(content));
  return section;
}

function evidenceReferences(references, observationAnchors) {
  const list = element('ul', undefined, 'value-list');
  for (const reference of references ?? []) {
    const item = element('li');
    if (observationAnchors.has(reference)) {
      const link = element('a', reference);
      link.href = `#${observationAnchors.get(reference)}`;
      link.addEventListener('click', () => { byId('technical-appendix').open = true; });
      item.append(link);
    } else item.textContent = describe(reference);
    list.append(item);
  }
  return list;
}

function renderFinding(finding, observationAnchors, anchor) {
  const article = element('article', undefined, 'finding');
  if (anchor) article.id = anchor;
  const heading = element('div', undefined, 'finding-heading');
  const category = element('p', titleCase(finding.category ?? 'Finding'), 'eyebrow');
  const title = element('h4', finding.title ?? finding.id ?? 'Finding');
  heading.append(category, title);
  if (finding.priority) heading.append(element('span', titleCase(finding.priority), 'priority-badge'));
  article.append(heading);
  const detail = element('dl', undefined, 'detail-list finding-details');
  const fields = [
    ['observationRefs', 'Evidence references'], ['observation', 'Observation'],
    ['interpretation', 'What this means'], ['confidence', 'Confidence and limitations'],
    ['priorityRationale', 'Why this priority'], ['action', 'Proposed next action'],
    ['owner', 'Responsible party to confirm'], ['dependencies', 'Dependencies'],
    ['validation', 'How to validate'], ['rollback', 'Rollback considerations'],
    ['sources', 'Dated rule sources'],
  ];
  for (const [key, label] of fields) {
    detail.append(element('dt', label));
    const description = element('dd');
    if (key === 'observationRefs' && Array.isArray(finding[key])) {
      description.append(evidenceReferences(finding[key], observationAnchors));
    } else description.append(renderValue(finding[key]));
    detail.append(description);
  }
  article.append(detail);
  return article;
}

function addressList(addresses) {
  if (!Array.isArray(addresses) || !addresses.length) return element('p', 'None recorded.', 'hint');
  const list = element('ul', undefined, 'address-list');
  for (const entry of addresses) list.append(element('li', `${entry.address} · IPv${entry.family}`));
  return list;
}

function renderAddressCoverage(scope) {
  const section = element('section', undefined, 'report-section');
  section.id = 'address-coverage';
  section.append(element('h3', 'Address coverage'));
  const sampling = scope.sampling;
  if (!sampling) {
    section.append(element('p', 'Sampling metadata is unavailable. Review the original observations before drawing a coverage conclusion.'));
    return section;
  }
  const metrics = element('dl', undefined, 'coverage-metrics');
  for (const [id, label, value] of [
    ['coverage-total', scope.demo ? 'Validated fixture addresses' : 'Validated DNS addresses', sampling.totalValidatedAddresses],
    ['coverage-assessed', 'Addresses assessed', sampling.assessedCount],
    ['coverage-unassessed', 'Addresses unassessed', sampling.unassessedCount],
  ]) {
    const metric = element('div');
    metric.append(element('dt', label));
    const count = element('dd', value ?? 'Unknown');
    count.id = id;
    metric.append(count);
    metrics.append(metric);
  }
  section.append(metrics);
  section.append(element('p', sampling.reason ?? 'Sampling reason was not recorded.', 'sampling-note'));
  section.append(element('p', `At most ${sampling.maxAddresses ?? 'unknown'} addresses are selected. An address is assessed when a connection was attempted; its probe profiles may still be incomplete or unsuccessful. Unassessed addresses have no measured readiness conclusion.`, 'hint'));
  if (scope.demo) section.append(element('p', 'Task-owned local fixture results; these addresses were not validated as public production destinations.', 'hint'));
  const lists = element('div', undefined, 'address-selection');
  for (const [label, addresses] of [
    ['Exact assessed addresses', sampling.assessedAddresses],
    ['Selected for probing', sampling.selectedAddresses],
    ['Not selected by the sample', sampling.unselectedAddresses],
    ['All validated addresses', scope.resolvedAddresses],
  ]) {
    const group = element('div');
    group.append(element('h4', label), addressList(addresses));
    lists.append(group);
  }
  section.append(lists);
  return section;
}

function renderAddressEvidence(report, observationAnchors, findingAnchors) {
  const section = element('section', undefined, 'report-section');
  section.id = 'per-address-evidence';
  section.append(element('h3', 'Per-address findings and evidence'));
  const observations = new Map((report.observations ?? []).map((observation) => [observation.id, observation]));
  for (const summary of report.addressSummaries ?? []) {
    const card = element('article', undefined, 'address-card panel');
    card.append(element('h4', `${summary.address} · IPv${summary.family}`));
    card.append(element('p', summary.assessed ? 'Assessed · review each profile below' : 'Unassessed · no readiness conclusion', 'address-status'));
    card.append(renderValue(summary.coverage));
    const profiles = element('div', undefined, 'profile-grid');
    for (const reference of summary.observationRefs ?? []) {
      const observation = observations.get(reference);
      if (!observation) continue;
      const profile = element('div', undefined, 'profile-evidence');
      profile.append(element('h5', profileLabel(observation)));
      profile.append(renderValue({
        outcome: outcomeLabel(observation.status),
        connectedAddress: observation.connectedAddress ?? 'Not connected / unobserved',
        keyEstablishmentGroup: observation.keyExchangeGroup ?? 'Not successfully measured',
        certificateValidation: observation.certificateValidation?.status ?? 'Not completed',
        measuredAt: observation.timestamp ?? 'Unknown',
      }));
      profile.append(evidenceReferences([reference], observationAnchors));
      profiles.append(profile);
    }
    card.append(profiles);
    const addressFindings = (report.findings ?? []).filter((finding) => (finding.observationRefs ?? []).some((reference) => summary.observationRefs?.includes(reference)));
    if (addressFindings.length) {
      card.append(element('h5', 'Findings and actions for this address'));
      const list = element('ul', undefined, 'value-list');
      for (const finding of addressFindings) {
        const item = element('li');
        const link = element('a', finding.title);
        link.href = `#${findingAnchors.get(finding.id)}`;
        item.append(link);
        list.append(item);
      }
      card.append(list);
    }
    section.append(card);
  }
  if (!(report.addressSummaries ?? []).length) section.append(element('p', 'Per-address summaries were not recorded. Original observations remain available in the appendix.'));
  return section;
}

function renderReport(report) {
  if (!report || typeof report.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(report.id)) {
    throw new Error('The service returned an invalid report identifier. Assessment results could not be displayed.');
  }
  const content = byId('report-content');
  content.replaceChildren();
  const observations = Array.isArray(report.observations) ? report.observations : [];
  const observationAnchors = new Map(observations.map((observation, index) => [observation.id, `measured-observation-${index}`]));
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const findingAnchors = new Map(findings.map((finding, index) => [finding.id, `finding-${index}`]));
  const scope = report.scope ?? {};
  const scopeCard = element('div', undefined, 'report-scope panel');
  if (scope.demo) scopeCard.append(element('p', 'CONTROLLED DEMONSTRATION · task-owned endpoints', 'eyebrow'));
  scopeCard.append(element('h3', scope.hostname ?? 'Unknown hostname'));
  const metadata = element('p', `Port ${scope.port ?? 'unknown'} · ${report.createdAt ?? 'Time not recorded'}`, 'report-meta');
  scopeCard.append(metadata);
  scopeCard.append(element('p', `Provider attribution: ${scope.provider ?? 'unknown'}`, 'report-meta'));
  scopeCard.append(renderValue(report.summary));
  content.append(scopeCard);
  content.append(renderAddressCoverage(scope));
  content.append(reportSection('Evidence coverage', report.coverage));
  content.append(reportSection('Assessment boundaries', scope.limitations));
  content.append(reportSection('Business context', report.business));
  content.append(renderAddressEvidence(report, observationAnchors, findingAnchors));
  const crossSection = element('section', undefined, 'report-section');
  crossSection.id = 'cross-address-findings';
  crossSection.append(element('h3', 'Observed differences between addresses'));
  const crossFindings = Array.isArray(report.crossAddressFindings) ? report.crossAddressFindings : [];
  const crossIds = new Set(crossFindings.map((finding) => finding.id));
  if (crossFindings.length) {
    for (const finding of crossFindings) crossSection.append(renderFinding(finding, observationAnchors, findingAnchors.get(finding.id)));
  } else {
    crossSection.append(element('p', (scope.sampling?.assessedCount ?? 0) < 2
      ? 'Fewer than two addresses were assessed. Cross-address consistency cannot be established.'
      : 'No cross-address inconsistency was identified in the measured profiles. This does not establish readiness of unassessed addresses, the origin or internal systems.'));
  }
  content.append(crossSection);
  const findingsSection = element('section', undefined, 'report-section');
  findingsSection.append(element('h3', 'Findings and proposed actions'));
  if (findings.length) {
    for (const finding of findings.filter((finding) => !crossIds.has(finding.id))) findingsSection.append(renderFinding(finding, observationAnchors, findingAnchors.get(finding.id)));
  } else {
    findingsSection.append(element('p', 'No findings were generated. Review evidence coverage and incomplete observations; this is not a clean bill of health.'));
  }
  content.append(findingsSection);
  const planSection = element('section', undefined, 'report-section plan-section');
  planSection.append(element('h3', 'Migration sequence'));
  const plan = element('ol', undefined, 'migration-plan');
  for (const action of Array.isArray(report.plan) ? report.plan : []) {
    const item = element('li');
    item.append(renderValue(action));
    plan.append(item);
  }
  planSection.append(plan);
  content.append(planSection);
  const appendix = element('details', undefined, 'evidence-appendix');
  appendix.id = 'technical-appendix';
  appendix.append(element('summary', 'Technical evidence appendix — original observations, sampling and rule version'));
  appendix.append(element('p', 'Both exports preserve the complete original report, including every observation, client profile and sampling decision. These observations do not infer untested systems.', 'hint'));
  for (const [index, observation] of observations.entries()) {
    const measured = element('section', undefined, 'original-observation');
    measured.id = `measured-observation-${index}`;
    measured.append(element('h4', observation.id ?? `Observation ${index + 1}`));
    measured.append(element('pre', JSON.stringify(observation, null, 2)));
    appendix.append(measured);
  }
  appendix.append(element('h4', 'Complete original report'));
  appendix.append(element('pre', JSON.stringify(report, null, 2)));
  content.append(appendix);
  byId('export-html').href = `/api/reports/${encodeURIComponent(report.id)}.html`;
  byId('export-json').href = `/api/reports/${encodeURIComponent(report.id)}.json`;
  byId('report').hidden = false;
  byId('report').focus({ preventScroll: true });
  byId('report').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showError(message) {
  byId('form-error').textContent = message;
  byId('form-error').hidden = false;
}

hostnameInput.addEventListener('input', () => {
  const normalized = normalizeHostname();
  byId('permission-host').textContent = normalized || 'this exact hostname';
  if (normalized !== authorizedHostname) authorizationInput.checked = false;
});

authorizationInput.addEventListener('change', () => {
  authorizedHostname = authorizationInput.checked ? normalizeHostname() : '';
});

byId('demo-target').addEventListener('change', (event) => {
  hostnameInput.value = event.target.value;
  hostnameInput.dispatchEvent(new Event('input'));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !configuration) return;
  byId('form-error').hidden = true;
  const hostname = normalizeHostname();
  if (!hostname) {
    showError('Enter the exact HTTPS hostname you are authorized to assess.');
    hostnameInput.focus();
    return;
  }
  if (!authorizationInput.checked || authorizedHostname !== hostname) {
    showError('Confirm that you have permission to assess this exact hostname before continuing.');
    authorizationInput.focus();
    return;
  }
  busy = true;
  assessButton.disabled = true;
  form.setAttribute('aria-busy', 'true');
  byId('report').hidden = true;
  byId('request-status').textContent = 'Measuring up to 3 selected addresses with at most 6 sequential TLS connections and a 30-second assessment budget. Incomplete profiles will remain explicit…';
  try {
    const response = await fetch('/api/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-QR-CSRF': configuration.csrfToken },
      body: JSON.stringify({
        hostname, authorized: true, authorizedHostname,
        sensitivity: byId('sensitivity').value,
        confidentiality: byId('confidentiality').value,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'The assessment could not be completed.');
    renderReport(payload.report);
    byId('request-status').textContent = 'Assessment recorded. Review its evidence coverage and limitations below.';
  } catch (error) {
    showError(error.message || 'The local service could not be reached.');
    byId('request-status').textContent = 'Assessment not completed. No readiness conclusion is available.';
  } finally {
    busy = false;
    assessButton.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

async function initialize() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('The local assessment service is unavailable.');
    configuration = await response.json();
    if (typeof configuration.csrfToken !== 'string' || !configuration.csrfToken) throw new Error('The local assessment service did not provide a request token.');
    if (configuration.demo) {
      byId('demo-banner').hidden = false;
      byId('demo-picker').hidden = false;
      const labels = {
        'classical.qr.test': 'Classical TLS endpoint',
        'hybrid.qr.test': 'Hybrid-capable TLS endpoint',
        'invalid.qr.test': 'Certificate-validation failure',
        'timeout.qr.test': 'Bounded timeout',
        'mixed.qr.test': 'Two addresses with different hybrid observations',
        'consistent.qr.test': 'Two addresses with consistent hybrid observations',
        'sampled.qr.test': 'Four fixture addresses, three selected',
      };
      for (const hostname of configuration.targets ?? []) {
        const option = element('option', `${labels[hostname] ?? 'Controlled fixture'} · ${hostname}`);
        option.value = hostname;
        byId('demo-target').append(option);
      }
    }
    assessButton.disabled = false;
    byId('request-status').textContent = 'Ready. Each assessment requires permission for its exact hostname.';
  } catch (error) {
    configuration = undefined;
    showError(error.message || 'The local assessment service could not be reached.');
    byId('request-status').textContent = 'Assessments are unavailable until the local service is ready.';
  }
}

initialize();
