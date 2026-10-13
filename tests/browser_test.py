from playwright.sync_api import sync_playwright
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765')
 assert page.locator('.fighter-card').count()==7
 page.click('#start');page.wait_for_timeout(2200)
 assert page.locator('#clock').inner_text()!='00:00.0'
 page.click('#play');clock=page.locator('#clock').inner_text();page.wait_for_timeout(300);assert page.locator('#clock').inner_text()==clock
 page.click('[data-speed="4"]');assert 'selected' in page.locator('[data-speed="4"]').get_attribute('class')
 page.click('#editorOpen');page.fill('#fighterName','浏览器测试角色');page.fill('#avatar','🚀');page.fill('#hp','333');page.select_option('#skill','hook');page.click('#fighterForm button[type=submit]')
 assert page.locator('.fighter-card').count()==8
 page.click('#dataOpen');data=json.loads(page.locator('#json').input_value());assert any(f['name']=='浏览器测试角色' for f in data['fighters'])
 page.fill('#json','{"fighters":[]}');page.click('#import');assert page.locator('#dataError').inner_text()
 page.fill('#json',json.dumps(data,ensure_ascii=False));page.click('#import');assert not page.locator('#dataDialog').is_visible()
 page.reload();assert page.locator('.fighter-card').count()==8
 # Upload an original safe SVG, rasterize and export as data URI.
 page.click('#editorOpen');page.locator('#upload').set_input_files({'name':'icon.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="cyan"/></svg>'})
 page.wait_for_function("document.querySelector('#avatarPreview img') !== null")
 page.fill('#fighterName','SVG测试');page.click('#fighterForm button[type=submit]');page.click('#dataOpen');data=json.loads(page.locator('#json').input_value());assert data['fighters'][-1]['avatar'].startswith('data:image/png;base64,');page.click('[data-close="dataDialog"]')
 page.select_option('#scenario','crystal-fire');page.click('#start');page.wait_for_timeout(500);page.screenshot(path=str(ROOT/'preview-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(ROOT/'preview-mobile.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.click('#sound');assert page.locator('#sound').get_attribute('aria-pressed')=='true'
 page.click('#camera');assert page.locator('#camera').get_attribute('aria-pressed')=='true'
 assert errors==[],errors
 browser.close()
 print('PASS: load, battle, pause, speed, custom fighter, invalid/valid JSON import, persistence, SVG upload, mobile overflow, sound/camera controls; no JS errors')
