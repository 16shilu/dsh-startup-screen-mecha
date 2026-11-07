/** Optional real Chromium verification. Set PLAYWRIGHT_CORE_PATH to an installed
 * playwright-core package; the plugin itself has no browser-test dependency. */
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core')
const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.resolve(root, '.test-output', 'browser')
await fs.mkdir(output, { recursive: true })
process.env.DSH_HOME = path.join(output, 'isolated-host')
const { apply } = await import('../lib/index.js')
const routes = []
let transformIndex
apply({
  webServer: { register(route) { routes.push(route); return () => {} }, tapIndex(fn) { transformIndex = fn; return () => {} } },
  connection: { requestRejection() {} }, effect() {}
})
const baseHTML = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Host integration</title></head><body><main id="host-app" style="background:#0b1521;position:fixed;inset:0;color:white;transition:opacity 1s">DSH HOST FIXTURE</main></body></html>'
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.gif': 'image/gif', '.wav': 'audio/wav', '.ico': 'image/x-icon' }
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname
    const route = routes.find(r => r.kind === 'exact' ? pathname === r.path : pathname.startsWith(r.path + '/'))
    if (route) return await route.handler(req, res)
    if (pathname === '/host-preview') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(transformIndex(baseHTML)) }
    const file = path.resolve(root, '.' + decodeURIComponent(pathname))
    const rel = path.relative(root, file)
    if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); return res.end() }
    const bytes = await fs.readFile(file)
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
    res.end(bytes)
  } catch (e) { res.writeHead(404); res.end('Not found') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({ headless: true })
const failures = []
const assertions = []
const check = (label, value) => { assert.ok(value, label); assertions.push(label) }
async function pageFor(viewport, query = '') {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
  page.on('pageerror', error => failures.push(error.message))
  page.on('response', response => { if (response.status() >= 400) failures.push(response.status() + ' ' + response.url()) })
  await page.goto(origin + '/test/fixtures/boot.html?clean=1&speed=3&voice=0&sound=0' + query)
  return page
}
async function stage(page, number) {
  await page.waitForSelector('#dsh-startup-root[data-stage="' + number + '"]', { timeout: 20000 })
  await page.waitForTimeout(220)
}
async function layout(page, name) {
  const result = await page.evaluate(() => {
    const box = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
    return { viewport: { width: innerWidth, height: innerHeight }, status: box('.dsu-status'), action: box('.dsu-action'), button: box('.dsu-btn'), footer: box('.dsu-progress'),
      imagesLoaded: [...document.querySelectorAll('#dsh-startup-root img')].every(i => i.complete && i.naturalWidth > 0),
      brand: box('.dsu-brand'), brandLogo: box('.dsu-brand-logo'), buttonPadding: parseFloat(getComputedStyle(document.querySelector('.dsu-btn')).paddingLeft),
      skin: document.getElementById('dsh-startup-root').className }
  })
  check(name + ' loads original icon images', result.imagesLoaded)
  check(name + ' keeps title inside viewport', result.status.x >= 0 && result.status.right <= result.viewport.width + 1)
  check(name + ' keeps button above footer', result.button.bottom < result.footer.y)
  check(name + ' separates heading and controls', result.status.bottom < result.action.y)
  check(name + ' keeps Chinese Logo above main content', result.brand.bottom < result.status.y && result.brandLogo.right < result.viewport.width)
  check(name + ' preserves button padding', result.buttonPadding >= 13)
  return result
}

function traceAudio() {
  window.__audioTrace = { played: [], ended: [], speech: 0, oscillators: 0, errors: [] }
  const trace = window.__audioTrace
  const originalFetch = window.fetch
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args)
    const arrayBuffer = response.arrayBuffer.bind(response)
    response.arrayBuffer = async function () { const b = await arrayBuffer(); b.__assetName = String(args[0]).split('/').pop(); return b }
    return response
  }
  const decode = BaseAudioContext.prototype.decodeAudioData
  BaseAudioContext.prototype.decodeAudioData = function (bytes) {
    return decode.call(this, bytes).then(buffer => { buffer.__assetName = bytes.__assetName; return buffer })
  }
  const source = BaseAudioContext.prototype.createBufferSource
  BaseAudioContext.prototype.createBufferSource = function () {
    const node = source.call(this), start = node.start.bind(node)
    node.start = function (...args) {
      trace.played.push({ name: node.buffer?.__assetName, time: performance.now(), duration: node.buffer?.duration, rate: node.playbackRate.value })
      return start(...args)
    }
    return node
  }
  const oscillator = BaseAudioContext.prototype.createOscillator
  BaseAudioContext.prototype.createOscillator = function () { trace.oscillators++; return oscillator.call(this) }
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    const name = this.src.split('/').pop()
    trace.played.push({ name, time: performance.now(), rate: this.playbackRate })
    this.addEventListener('ended', () => trace.ended.push(name), { once: true })
    this.addEventListener('error', () => { if (this.getAttribute('src')) trace.errors.push(name) }, { once: true })
    return play.call(this)
  }
  if (window.speechSynthesis) window.speechSynthesis.speak = function () { trace.speech++ }
}

async function checkOriginalAudio(url, protocolName) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  page.on('pageerror', error => failures.push(error.message))
  await page.addInitScript(traceAudio)
  await page.goto(url)
  await stage(page, 1)
  check(protocolName + ' defaults to original game media', await page.evaluate(() => window.__DSH_STARTUP_API__.config.voiceSource === 'asset' && window.__DSH_STARTUP_API__.config.sfx === 'audio'))
  await page.keyboard.press('Enter')
  await stage(page, 2)
  await page.keyboard.press('Enter')
  await stage(page, 3)
  check(protocolName + ' shows particle-filling line', (await page.locator('.dsu-status-zh').innerText()).replace(/\s/g, '') === '方晶粒子填充')
  await stage(page, 4)
  await stage(page, 5)
  check(protocolName + ' keeps full system line inside viewport', await page.locator('.dsu-status-zh').evaluate(el => el.getBoundingClientRect().right <= innerWidth))
  await page.waitForSelector('#dsh-startup-root', { state: 'detached', timeout: 20000 })
  const trace = await page.evaluate(() => window.__audioTrace)
  const names = trace.played.map(item => item.name)
  check(protocolName + ' plays actual game confirm WAV', names.includes('mecha-ui-confirm.wav'))
  check(protocolName + ' plays all three startup segments and welcome', ['particles', 'sync', 'system', 'welcome'].every(part => names.includes('mecha-voice-' + part + '.wav')))
  check(protocolName + ' uses no TTS or oscillator synthesis', trace.speech === 0 && trace.oscillators === 0)
  check(protocolName + ' keeps original playback speed', trace.played.every(item => item.rate === 1))
  check(protocolName + ' has no audio decoding errors', trace.errors.length === 0)
  if (protocolName === 'file') check('file preview finishes all voice recordings', ['particles', 'sync', 'system', 'welcome'].every(part => trace.ended.includes('mecha-voice-' + part + '.wav')))
  await page.close()
  return trace
}

try {
  const desktop = await pageFor({ width: 1440, height: 900 })
  await desktop.waitForTimeout(450)
  await desktop.screenshot({ path: path.join(output, '01-intro.png') })
  await stage(desktop, 1)
  const layouts = { desktop: await layout(desktop, 'desktop') }
  await desktop.screenshot({ path: path.join(output, '02-pilot-access.png') })
  await desktop.keyboard.press('Enter')
  await stage(desktop, 2)
  layouts.identity = await layout(desktop, 'identity')
  check('pilot card displays identity', (await desktop.locator('.dsu-card').innerText()).includes('PILOT 0087'))
  await desktop.screenshot({ path: path.join(output, '03-pilot-identity.png') })
  await desktop.keyboard.press('Enter')
  await desktop.waitForSelector('#dsh-startup-root[data-stage="6"]')
  await desktop.waitForTimeout(250)
  await desktop.screenshot({ path: path.join(output, '04-link-established.png') })
  await desktop.waitForSelector('#dsh-startup-root', { state: 'detached' })
  check('complete sequence removes overlay', await desktop.evaluate(() => !document.documentElement.classList.contains('dsu-lock')))

  const mobile = await pageFor({ width: 390, height: 844 })
  await stage(mobile, 1)
  layouts.mobile = await layout(mobile, 'mobile')
  await mobile.keyboard.press('Enter')
  await stage(mobile, 2)
  layouts.mobileIdentity = await layout(mobile, 'mobile identity')
  await mobile.screenshot({ path: path.join(output, '05-mobile.png') })
  await mobile.keyboard.press('Escape')
  await mobile.waitForSelector('#dsh-startup-root', { state: 'detached' })
  check('Escape unlocks mobile preview', await mobile.evaluate(() => !document.documentElement.classList.contains('dsu-lock')))

  const light = await pageFor({ width: 1280, height: 800 }, '&theme=light')
  await stage(light, 1)
  layouts.light = await layout(light, 'light')
  await light.screenshot({ path: path.join(output, '06-light.png') })
  await light.close()

  const controls = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  controls.on('pageerror', error => failures.push(error.message))
  await controls.goto(origin + '/test/fixtures/boot.html?speed=3&voice=0&sound=0')
  await stage(controls, 1)
  check('preview tools stay sharp above glass', await controls.locator('#console').evaluate(el => getComputedStyle(el).filter === 'none'))
  await controls.locator('#btnSettings').click()
  await controls.locator('#fIdentity').fill('ACE 0042')
  await controls.locator('#btnReplay').click()
  await stage(controls, 1)
  await controls.locator('.dsu-btn').click()
  await stage(controls, 2)
  check('preview controls apply identity on replay', (await controls.locator('.dsu-card').innerText()).includes('ACE 0042'))
  await controls.close()

  const animated = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' })
  animated.on('pageerror', error => failures.push(error.message))
  await animated.goto(origin + '/test/fixtures/boot.html?clean=1&speed=3&voice=0&sound=0')
  await stage(animated, 1)
  check('normal motion uses official animated GIF', await animated.locator('.dsu-core-emblem img').evaluate(i => i.complete && i.naturalWidth === 240 && i.src.endsWith('mecha-emblem-animated.gif')))
  check('header uses supplied Chinese Logo', await animated.locator('.dsu-brand-logo').evaluate(i => i.complete && i.naturalWidth === 2243 && i.src.endsWith('mecha-logo-cn.png')))
  const frame = () => animated.locator('.dsu-core-emblem img').evaluate(img => {
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
    const context = canvas.getContext('2d'); context.drawImage(img, 0, 0)
    return { image: canvas.toDataURL(), cornerAlpha: context.getImageData(0, 0, 1, 1).data[3] }
  })
  const frameA = await frame()
  // Canvas deliberately reads an animated image's poster frame (HTML standard).
  // Compare screenshots on a solid backing to inspect the presented GIF frames.
  await animated.locator('.dsu-core-emblem img').evaluate(img => { img.style.background = '#07111a' })
  const presentedA = await animated.locator('.dsu-core-emblem img').screenshot({ animations: 'disabled' })
  await animated.waitForTimeout(850)
  const presentedB = await animated.locator('.dsu-core-emblem img').screenshot({ animations: 'disabled' })
  const frameB = await frame()
  check('original GIF frames actually advance', !presentedA.equals(presentedB))
  check('animated icon preserves transparent background', frameA.cornerAlpha === 0 && frameB.cornerAlpha === 0)
  await animated.locator('.dsu-core-emblem img').evaluate(img => { img.style.background = '' })
  await animated.screenshot({ path: path.join(output, '09-animated-icon.png') })
  await animated.close()

  const broken = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' })
  await broken.route('**/mecha-emblem-animated.gif', route => route.fulfill({ status: 404, body: '' }))
  await broken.goto(origin + '/test/fixtures/boot.html?clean=1&speed=3&voice=0&sound=0')
  await stage(broken, 1)
  check('missing animation falls back to supplied transparent icon', await broken.locator('.dsu-core-emblem img').evaluate(i => i.complete && i.naturalWidth === 660 && i.src.endsWith('mecha-emblem.png') && i.getAttribute('data-dsu-media') === 'static'))
  await broken.close()

  const animatedFile = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' })
  const nativeFileUrl = pathToFileURL(path.join(root, 'test/fixtures/boot.html')); nativeFileUrl.search = '?clean=1&speed=3&voice=0&sound=0'
  await animatedFile.goto(nativeFileUrl.href)
  await stage(animatedFile, 1)
  check('offline preview loads the local animated icon', await animatedFile.locator('.dsu-core-emblem img').evaluate(i => i.complete && i.naturalWidth === 240 && i.src.endsWith('mecha-emblem-animated.gif')))
  await animatedFile.close()

  const audioTrace = await checkOriginalAudio(origin + '/test/fixtures/boot.html?clean=1&speed=3', 'http')
  const fileUrl = pathToFileURL(path.join(root, 'test/fixtures/boot.html'))
  fileUrl.search = '?clean=1&speed=3'
  const fileAudioTrace = await checkOriginalAudio(fileUrl.href, 'file')
  await fs.writeFile(path.join(output, 'audio-playback-results.json'), JSON.stringify({ audioTrace, fileAudioTrace }, null, 2))

  // Real Host routes, HTML injection, configuration persistence and replay.
  const configured = await fetch(origin + '/dsh-startup/config', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patch: { mode: 'always', speed: 3, voice: false, sound: false, identity: '测试驾驶员' } }) })
  check('Host configuration POST succeeds', configured.ok && (await configured.json()).ok)
  const host = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  host.on('pageerror', error => failures.push(error.message))
  await host.goto(origin + '/host-preview')
  await stage(host, 1)
  check('Host serves transparent fallback PNG for reduced motion', await host.locator('.dsu-core-emblem img').evaluate(i => i.complete && i.naturalWidth === 660 && i.src.endsWith('mecha-emblem.png')))
  await host.keyboard.press('Enter')
  await stage(host, 2)
  check('Host supplies saved identity', (await host.locator('.dsu-card').innerText()).includes('测试驾驶员'))
  await host.keyboard.press('Escape')
  await host.waitForSelector('#dsh-startup-root', { state: 'detached' })
  check('Host backdrop transition restored', await host.locator('#host-app').evaluate(el => el.style.transition === 'opacity 1s'))
  await host.evaluate(() => window.__DSH_STARTUP_API__.replay())
  await stage(host, 1)
  check('replay creates a fresh instance', await host.evaluate(() => window.__DSH_STARTUP_GEN__ === 2))
  await host.keyboard.press('Escape')
  await host.waitForSelector('#dsh-startup-root', { state: 'detached' })
  await host.waitForTimeout(2000)
  check('completed playback reports stopped state', await host.evaluate(() => window.__DSH_STARTUP_RUNNING__ === false && window.__DSH_STARTUP_FINISHED__ === true))
  check('browser has no script/resource errors', failures.length === 0)
  if (process.env.MECHA_RECORD === '1') {
    const recording = await browser.newContext({ viewport: { width: 1280, height: 800 },
      reducedMotion: 'no-preference', recordVideo: { dir: output, size: { width: 1280, height: 800 } } })
    const movie = await recording.newPage()
    movie.on('pageerror', error => failures.push(error.message))
    await movie.goto(origin + '/test/fixtures/boot.html?clean=1&speed=1.3&voice=1&sound=1')
    await stage(movie, 1)
    await movie.waitForTimeout(1100)
    await movie.keyboard.press('Enter')
    await stage(movie, 2)
    await movie.waitForTimeout(1100)
    await movie.keyboard.press('Enter')
    await movie.waitForSelector('#dsh-startup-root', { state: 'detached', timeout: 30000 })
    await movie.waitForTimeout(500)
    const video = movie.video()
    await recording.close()
    await video.saveAs(path.join(output, 'mecha-boot.webm'))
    check('normal-motion playback has no script errors', failures.length === 0)
  }
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify({ assertions, layouts, failures }, null, 2))
  console.log(JSON.stringify({ passed: assertions.length, failures, output }, null, 2))
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
