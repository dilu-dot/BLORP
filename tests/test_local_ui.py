from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parents[1]
source=(base/'public/index.html').read_text()
for name in ['base','v5','v51']:
    source=source.replace(f'<link rel="stylesheet" href="/assets/{name}.css"/>', '<style>'+(base/f'public/assets/{name}.css').read_text()+'</style>')
for name in ['base','v5','v51']:
    source=source.replace(f'<script src="/assets/{name}.js"></script>', '<script>'+(base/f'public/assets/{name}.js').read_text()+'</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h in [(1512,900),(390,844)]:
        ctx=browser.new_context(viewport={'width':w,'height':h})
        page=ctx.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
        page.set_content(source,wait_until='domcontentloaded')
        if w<760:page.locator('#hamburger').click()
        page.locator('#localAiNav').click()
        assert page.locator('#localai').is_visible()
        page.locator('[data-local-mode="build"]').click()
        assert 'Describe the website' in page.locator('#localInputLabel').inner_text()
        page.locator('#localInput').fill('Build a modern coffee shop site')
        page.wait_for_timeout(350)
        assert 'Local AI Lab' in page.locator('#crumb').inner_text()
        overflow=page.evaluate('document.documentElement.scrollWidth-window.innerWidth')
        print(w,'overflow',overflow,'errors',errs)
        assert overflow<=1 and not errs
        page.screenshot(path=str(base/f'screen-local-ai-{w}.png'),full_page=True)
        ctx.close()
    browser.close()
