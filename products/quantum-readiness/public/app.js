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

function renderFinding(finding, observationAnchors) {
  const article = element('article', undefined, 'finding');
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
      const references = element('ul', undefined, 'value-list');
      for (const reference of finding[key]) {
        const item = element('li');
        if (observationAnchors.has(reference)) {
          const link = element('a', reference);
          link.href = `#${observationAnchors.get(reference)}`;
          link.addEventListener('click', () => { byId('technical-appendix').open = true; });
          item.append(link);
        } else item.textContent = describe(reference);
        references.append(item);
      }
      description.append(references);
    } else description.append(renderValue(finding[key]));
    detail.append(description);
  }
  article.append(detail);
  return article;
}

function renderReport(report) {
  if (!report || typeof report.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(report.id)) {
    throw new Error('The service returned an invalid report identifier. Assessment results could not be displayed.');
  }
  const content = byId('report-content');
  content.replaceChildren();
  const observations = Array.isArray(report.observations) ? report.observations : [];
  const observationAnchors = new Map(observations.map((observation, index) => [observation.id, `measured-observation-${index}`]));
  const scope = report.scope ?? {};
  const scopeCard = element('div', undefined, 'report-scope panel');
  if (scope.demo) scopeCard.append(element('p', 'CONTROLLED DEMONSTRATION · task-owned endpoint', 'eyebrow'));
  scopeCard.append(element('h3', scope.hostname ?? 'Unknown hostname'));
  const metadata = element('p', `${scope.address ?? 'Address not observed'} · port ${scope.port ?? 'unknown'} · ${report.createdAt ?? 'Time not recorded'}`, 'report-meta');
  scopeCard.append(metadata);
  scopeCard.append(element('p', `Provider attribution: ${scope.provider ?? 'unknown'}`, 'report-meta'));
  scopeCard.append(renderValue(report.summary));
  content.append(scopeCard);
  content.append(reportSection('Evidence coverage', report.coverage));
  content.append(reportSection('Assessment boundaries', scope.limitations));
  content.append(reportSection('Business context', report.business));
  const findingsSection = element('section', undefined, 'report-section');
  findingsSection.append(element('h3', 'Findings and proposed actions'));
  if (Array.isArray(report.findings) && report.findings.length) {
    for (const finding of report.findings) findingsSection.append(renderFinding(finding, observationAnchors));
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
  appendix.append(element('summary', 'Technical evidence appendix — original observations and rule version'));
  appendix.append(element('p', 'The JSON export contains the complete report. These observations preserve the measured data without inferring untested systems.', 'hint'));
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
  byId('request-status').textContent = 'Measuring bounded TLS probe profiles. The report will distinguish successful, negative, and incomplete observations…';
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
