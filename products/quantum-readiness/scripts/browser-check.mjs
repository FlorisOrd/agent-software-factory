import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startDemo } from './demo.mjs';
import { escapeHtml } from '../src/report.mjs';

const productRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = join(productRoot, '.artifacts');
await mkdir(artifactRoot, { recursive: true });
const evidence = {
  suite: 'QR-MVP-02 controlled browser journey with QR-MVP-01 regressions',
  startedAt: new Date().toISOString(),
  runtime: { node: process.versions.node, openssl: process.versions.openssl },
  scope: 'Task-owned local TLS fixtures only. Hostile-string rendering uses a separately labelled mocked response.',
  checks: [],
  reports: [],
  browserErrors: [],
};
let app;
let coverageApp;
let browser;
let failure;

async function check(name, operation) {
  const started = Date.now();
  try {
    const details = await operation();
    evidence.checks.push({ name, status: 'passed', durationMs: Date.now() - started, ...details });
    console.log(`PASS ${name}`);
  } catch (error) {
    evidence.checks.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.stack ?? error.message });
    throw error;
  }
}

async function loadPlaywright() {
  if (!process.env.QR_PLAYWRIGHT_PATH) return import('playwright');
  let location = resolve(process.env.QR_PLAYWRIGHT_PATH);
  if ((await stat(location)).isDirectory()) location = join(location, 'index.mjs');
  return import(pathToFileURL(location).href);
}

try {
  const { chromium } = await loadPlaywright();
  app = await startDemo();
  browser = await chromium.launch({ headless: true, ...(process.env.QR_BROWSER_EXECUTABLE ? { executablePath: process.env.QR_BROWSER_EXECUTABLE } : {}) });
  evidence.runtime.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => evidence.browserErrors.push(error.message));
  let scanRequests = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/assess')) scanRequests++; });
  await page.goto(app.url);
  await page.locator('#assess-button:enabled').waitFor();
  await check('Controlled demo and privacy boundaries are visible', async () => {
    assert.equal(await page.locator('#demo-banner').isVisible(), true);
    assert.match(await page.locator('#demo-banner').innerText(), /real local TLS connections/);
    assert.match(await page.locator('#retention-note').innerText(), /20 reports.*30 minutes/);
    assert.equal(await page.locator('#demo-target option').count(), 8);
  });
  await page.locator('#demo-target').selectOption('classical.qr.test');
  await check('Missing permission prevents the browser from requesting a probe', async () => {
    await page.locator('#assess-button').click();
    assert.match(await page.locator('#form-error').innerText(), /permission.*exact hostname/);
    assert.equal(scanRequests, 0);
    assert.equal(await page.locator('#report').isVisible(), false);
  });
  await check('Authorization is bound to the normalized target', async () => {
    await page.locator('#authorized').check();
    await page.locator('#hostname').fill('  CLASSICAL.QR.TEST  ');
    assert.equal(await page.locator('#authorized').isChecked(), true);
    await page.locator('#hostname').fill('hybrid.qr.test');
    assert.equal(await page.locator('#authorized').isChecked(), false);
    assert.match(await page.locator('#permission-host').innerText(), /^hybrid\.qr\.test$/);
  });
  await check('Invalid hostname returns a visible error without a report', async () => {
    await page.locator('#hostname').fill('https://classical.qr.test/path');
    await page.locator('#authorized').check();
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/assess'));
    await page.locator('#assess-button').click();
    const response = await responsePromise;
    assert.equal(response.status(), 400);
    await page.locator('#form-error').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#form-error').innerText()).length > 8);
    assert.equal(await page.locator('#report').isVisible(), false);
    await page.locator('#assess-button:enabled').waitFor();
    return { httpStatus: response.status(), displayedError: await page.locator('#form-error').innerText() };
  });

  async function assess(hostname) {
    await page.locator('#demo-target').selectOption(hostname);
    await page.locator('#authorized').check();
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/assess'));
    await page.locator('#assess-button').click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const { report } = await response.json();
    await page.locator('#report').waitFor({ state: 'visible' });
    await page.locator('#assess-button:enabled').waitFor();
    assert.equal(report.scope.hostname, hostname);
    assert.equal(report.scope.demo, true);
    assert.match(await page.locator('#report-content').innerText(), /CONTROLLED DEMONSTRATION/);
    assert.match(await page.locator('#report-content').innerText(), /Provider attribution: unknown/);
    evidence.reports.push(report);
    return report;
  }

  let classicalReport;
  await check('Classical fixture produces an evidence-backed migration finding', async () => {
    await page.goto(app.url);
    await page.locator('#assess-button:enabled').waitFor();
    await page.locator('#demo-target').selectOption('classical.qr.test');
    await page.locator('#authorized').check();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(artifactRoot, 'browser-demo.png') });
    classicalReport = await assess('classical.qr.test');
    const observation = classicalReport.observations.find((item) => item.id === 'classical-tls13-v1');
    assert.equal(observation.status, 'negotiated');
    assert.equal(observation.certificateValidation.status, 'verified');
    assert.equal(observation.keyExchangeGroup, 'X25519');
    const finding = classicalReport.findings.find((item) => item.id === 'classical-classical-tls13-v1');
    assert.ok(finding?.observationRefs.includes(observation.id));
    assert.match(await page.locator('#report-content').innerText(), /Classical key establishment observed/);
    assert.equal(classicalReport.business.sensitivity, 'unknown');
    assert.equal(classicalReport.business.confidentiality, 'unknown');
    assert.match(classicalReport.coverage, /Incomplete/);
    return { hostname: classicalReport.scope.hostname, observedGroup: observation.keyExchangeGroup, finding: finding.id, coverage: classicalReport.coverage };
  });
  await check('HTML and JSON downloads preserve the measured report and scope', async () => {
    const downloads = [];
    for (const extension of ['json', 'html']) {
      const downloadPromise = page.waitForEvent('download');
      await page.locator(`#export-${extension}`).click();
      const download = await downloadPromise;
      assert.equal(await download.failure(), null);
      assert.match(download.suggestedFilename(), new RegExp(`^quantum-readiness-[a-f0-9-]+\\.${extension}$`));
      const downloaded = await readFile(await download.path(), 'utf8');
      if (extension === 'json') assert.deepEqual(JSON.parse(downloaded), classicalReport);
      else {
        assert.match(downloaded, /CONTROLLED DEMONSTRATION/);
        assert.match(downloaded, /classical\.qr\.test/);
        assert.match(downloaded, /Technical evidence appendix/);
        assert.match(downloaded, /X25519/);
        assert.match(downloaded, /No blanket quantum-safe verdict/);
      }
      downloads.push({ extension, filename: download.suggestedFilename(), bytes: Buffer.byteLength(downloaded) });
    }
    return { downloads };
  });
  let hybridReport;
  await check('Hybrid fixture measures standardized hybrid group and separate classical authentication', async () => {
    await page.locator('#sensitivity').selectOption('sensitive');
    await page.locator('#confidentiality').selectOption('over-10-years');
    hybridReport = await assess('hybrid.qr.test');
    const observation = hybridReport.observations.find((item) => item.id === 'hybrid-mlkem-tls13-v1');
    assert.equal(observation.status, 'negotiated');
    assert.equal(observation.certificateValidation.status, 'verified');
    assert.equal(observation.keyExchangeGroup, 'X25519MLKEM768');
    assert.ok(observation.clientCapability.offeredGroups.includes('X25519MLKEM768'));
    assert.ok(hybridReport.findings.some((item) => item.id === 'hybrid-hybrid-mlkem-tls13-v1'));
    assert.ok(hybridReport.findings.some((item) => item.category === 'Authentication and signature migration' && /Classical/.test(item.title)));
    assert.match(await page.locator('#report-content').innerText(), /Standardized hybrid key establishment observed/);
    assert.match(await page.locator('#report-content').innerText(), /Classical certificate authentication key observed/);
    assert.equal(hybridReport.business.sensitivity, 'sensitive');
    assert.equal(hybridReport.business.confidentiality, 'over-10-years');
    assert.match(hybridReport.business.source, /operator-supplied/);
    await page.locator('#report').evaluate((node) => node.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.screenshot({ path: join(artifactRoot, 'browser-report.png') });
    return { hostname: hybridReport.scope.hostname, observedGroup: observation.keyExchangeGroup, certificateType: observation.certificate.publicKeyType, coverage: hybridReport.coverage };
  });
  await check('Finding references open the original observation appendix', async () => {
    const link = page.locator('.finding a[href="#measured-observation-0"]').first();
    await link.click();
    assert.equal(await page.locator('#technical-appendix').getAttribute('open'), '');
    const original = JSON.parse(await page.locator('#measured-observation-0 pre').innerText());
    assert.deepEqual(original, hybridReport.observations[0]);
  });
  await check('Certificate failure is an incomplete assessment with no successful connection verdict', async () => {
    const report = await assess('invalid.qr.test');
    assert.ok(report.observations.some((item) => item.status === 'certificate-error'));
    assert.ok(report.observations.every((item) => item.certificateValidation.status !== 'verified'));
    assert.match(report.coverage, /Incomplete/);
    assert.match(await page.locator('#report-content').innerText(), /Probe did not establish a validated connection/);
    return { statuses: report.observations.map((item) => item.status), coverage: report.coverage };
  });
  await check('Timeout fixture returns bounded incomplete observations', async () => {
    const started = Date.now();
    const report = await assess('timeout.qr.test');
    const durationMs = Date.now() - started;
    assert.ok(report.observations.every((item) => item.status === 'timeout'));
    assert.ok(durationMs < 15000, `Timeout UI took ${durationMs}ms`);
    assert.match(report.coverage, /Incomplete/);
    return { statuses: report.observations.map((item) => item.status), durationMs };
  });
  // A second task-owned process gives the new demonstration its own assessment
  // rate window; production rate-limit behavior is not changed or bypassed.
  coverageApp = await startDemo();
  await page.goto(coverageApp.url);
  await page.locator('#assess-button:enabled').waitFor();
  let sampledReport;
  for (const hostname of ['mixed.qr.test', 'consistent.qr.test', 'sampled.qr.test']) {
    await check(`Multi-address coverage, actual endpoints and exported sampling: ${hostname}`, async () => {
      const report = await assess(hostname);
      const sampling = report.scope.sampling;
      assert.equal(await page.locator('#coverage-total').innerText(), String(sampling.totalValidatedAddresses));
      assert.equal(await page.locator('#coverage-assessed').innerText(), String(sampling.assessedCount));
      assert.equal(await page.locator('#coverage-unassessed').innerText(), String(sampling.unassessedCount));
      assert.equal(await page.locator('#per-address-evidence .address-card').count(), sampling.selectedCount);
      const coverageText = await page.locator('#address-coverage').innerText();
      for (const address of report.scope.resolvedAddresses) assert.ok(coverageText.includes(address.address));
      assert.ok(coverageText.includes(sampling.reason));
      assert.match(coverageText, /not validated as public production destinations/);
      assert.equal(new Set(report.observations.map(o => o.connectedAddress)).size, sampling.assessedCount);
      assert.ok(report.observations.every(o => o.connectedAddress === o.resolvedAddress));
      if (hostname === 'mixed.qr.test') {
        assert.ok(report.crossAddressFindings.some(f => f.id === 'cross-address-hybrid'));
        assert.match(await page.locator('#cross-address-findings').innerText(), /not proof.*absent/);
        await page.locator('#address-coverage').screenshot({ path: join(artifactRoot, 'browser-multi-coverage.png') });
        await page.locator('#per-address-evidence').screenshot({ path: join(artifactRoot, 'browser-multi-evidence.png') });
      } else {
        assert.equal(report.crossAddressFindings.length, 0);
        assert.match(await page.locator('#cross-address-findings').innerText(), /No cross-address inconsistency was identified/);
      }
      const downloads = [];
      for (const extension of ['json', 'html']) {
        const downloadPromise = page.waitForEvent('download');
        await page.locator(`#export-${extension}`).click();
        const download = await downloadPromise;
        assert.equal(await download.failure(), null);
        const downloaded = await readFile(await download.path(), 'utf8');
        if (extension === 'json') assert.deepEqual(JSON.parse(downloaded), report);
        else assert.ok(downloaded.includes(escapeHtml(JSON.stringify(report, null, 2))), 'HTML must retain complete original observations and sampling');
        downloads.push({ extension, filename: download.suggestedFilename(), bytes: Buffer.byteLength(downloaded) });
      }
      const last = report.observations.length - 1;
      await page.locator(`#per-address-evidence a[href="#measured-observation-${last}"]`).click();
      assert.deepEqual(JSON.parse(await page.locator(`#measured-observation-${last} pre`).innerText()), report.observations[last]);
      const ids = await page.locator('#report [id]').evaluateAll(nodes => nodes.map(node => node.id));
      assert.equal(new Set(ids).size, ids.length, 'Every evidence/finding anchor must be unique');
      if (hostname === 'sampled.qr.test') {
        sampledReport = report;
        assert.equal(sampling.totalValidatedAddresses, 4);assert.equal(sampling.selectedCount, 3);assert.equal(sampling.unassessedCount, 1);
        assert.equal(coverageApp.fixtures.counts.byEndpoint['sampled.qr.test|127.0.0.3'], undefined);
        await page.locator('#address-coverage').screenshot({ path: join(artifactRoot, 'browser-sampled-coverage.png') });
      }
      return { hostname, sampling, crossAddressFindings: report.crossAddressFindings.map(f => f.id), downloads };
    });
  }
  await check('Multi-address report remains readable on a narrow screen', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    assert.ok(dimensions.scroll <= dimensions.viewport, JSON.stringify(dimensions));
    assert.equal(await page.locator('#coverage-assessed').innerText(), String(sampledReport.scope.sampling.assessedCount));
    await page.locator('#address-coverage').screenshot({ path: join(artifactRoot, 'browser-multi-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1100 });
    return dimensions;
  });
  await page.goto(app.url);
  await page.locator('#assess-button:enabled').waitFor();
  await coverageApp.close();
  coverageApp = undefined;
  await check('Untrusted report fields render as text (mocked response only)', async () => {
    const marker = '<img src=x onerror="window.qrInjected=true">';
    const hostile = structuredClone(classicalReport);
    hostile.summary = marker;
    hostile.findings[0].title = marker;
    hostile.findings[0].sources = [{ title: marker, url: 'javascript:window.qrInjected=true' }];
    await page.route('**/api/assess', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: hostile }) }), { times: 1 });
    await page.locator('#demo-target').selectOption('classical.qr.test');
    await page.locator('#authorized').check();
    await page.locator('#assess-button').click();
    await page.getByRole('heading', { name: marker, exact: true }).waitFor();
    assert.ok((await page.locator('#report-content').innerText()).includes(marker));
    assert.equal(await page.locator('#report img').count(), 0);
    assert.equal(await page.locator('#report a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => window.qrInjected), undefined);
  });
  await check('Narrow-screen form remains usable without horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(app.url);
    await page.locator('#assess-button:enabled').waitFor();
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    assert.ok(dimensions.scroll <= dimensions.viewport, JSON.stringify(dimensions));
    assert.equal(await page.locator('#hostname').isVisible(), true);
    await page.screenshot({ path: join(artifactRoot, 'browser-mobile.png'), fullPage: true });
    return dimensions;
  });
  assert.deepEqual(evidence.browserErrors, []);
  evidence.status = 'passed';
  evidence.scanRequests = scanRequests;
  console.log(`Browser checks passed: ${evidence.checks.length}. Real TLS reports: ${evidence.reports.length}.`);
} catch (error) {
  failure = error;
  evidence.status = 'failed';
  evidence.error = error.stack ?? error.message;
  console.error(error);
} finally {
  evidence.finishedAt = new Date().toISOString();
  await writeFile(join(artifactRoot, 'browser-check.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  await browser?.close();
  await coverageApp?.close();
  await app?.close();
}
if (failure) process.exitCode = 1;
