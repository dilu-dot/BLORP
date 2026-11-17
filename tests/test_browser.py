from pathlib import Path
from playwright.sync_api import sync_playwright
import uuid
URL='about:blank'
html=(base_placeholder:=Path(__file__).resolve().parents[1])/'public/index.html'
source=html.read_text().replace('<link rel="stylesheet" href="/assets/base.css"/>','<style>'+ (base_placeholder/'public/assets/base.css').read_text()+'</style>').replace('<link rel="stylesheet" href="/assets/v5.css"/>','<style>'+ (base_placeholder/'public/assets/v5.css').read_text()+'</style>').replace('<script src="/assets/base.js"></script>','<script>'+ (base_placeholder/'public/assets/base.js').read_text()+'</script>').replace('<script src="/assets/v5.js"></script>','<script>'+ (base_placeholder/'public/assets/v5.js').read_text()+'</script>')
base=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h in [(1512,900),(1280,800),(390,844)]:
        ctx=browser.new_context(viewport={'width':w,'height':h})
        page=ctx.new_page();page.set_default_timeout(8000)
        errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
        page.set_content(source,wait_until='domcontentloaded')
        if w==1512:
            page.screenshot(path=str(base/'screen-dashboard.png'))
        print('loaded',w,h,'tab',page.locator('section.tab.active').get_attribute('id'),'errors',errs)
        assert page.locator('section.tab.active').get_attribute('id')=='account'
        assert not errs,errs
        if w<760:
            page.locator('#hamburger').click();page.locator('button[data-view="addons"]').click()
        else:
            page.locator('button[data-view="addons"]').click()
        assert page.locator('#addonGrid .addon-card').count()>=8
        page.locator('[data-config-addon="github"]').first.click()
        assert page.locator('#addonDialog').is_visible()
        page.locator('#addonForm button[type="submit"]').click()
        assert page.locator('#addonsDiscover').inner_text().count('Preview enabled')>0
        if w==1512:
            page.screenshot(path=str(base/'screen-addons.png'))
        if w<760:
            page.locator('#hamburger').click();page.locator('button[data-view="membership"]').click()
        else:
            page.locator('button[data-view="membership"]').click()
        page.locator('[data-billing="annual"]').click()
        assert page.locator('#builderPrice').inner_text()=='$18'
        if w==1512:page.screenshot(path=str(base/'screen-membership.png'))
        if w<760:
            page.locator('#hamburger').click();page.locator('button[data-view="playground"]').click()
        else:
            page.locator('button[data-view="playground"]').click()
        assert page.locator('#aiModel').is_visible()
        if w==1512:page.screenshot(path=str(base/'screen-chat.png'))
        if w<760:
            page.locator('#hamburger').click();page.locator('button[data-view="builder"]').click()
        else:
            page.locator('button[data-view="builder"]').click()
        assert page.locator('#buildPrompt').is_visible()
        page.locator('#buildPrompt').fill('Make a modern landing page with responsive cards, pricing and accessible forms')
        page.locator('#preparePlanBtn').click()
        assert page.locator('#buildThread article').count()==2
        if w==1512:
            page.screenshot(path=str(base/'screen-builder.png'))
            page.locator('button[data-view="multitask"]').click()
            initial=page.locator('#agentGrid .agent-card').count()
            page.locator('#newAgentBtn').click()
            page.locator('#agentName').fill('Content Writer')
            page.locator('#agentRole').select_option('Content')
            page.locator('#agentForm button[type=submit]').click()
            assert page.locator('#agentGrid .agent-card').count()==initial+1
            page.locator('button[data-view="workflows"]').click()
            assert page.locator('#allWorkflowList').is_visible()
            page.locator('button[data-view="projects"]').click()
            assert page.locator('#v5BackupProjects').is_visible()
            print('  preserved original Multi Task, agent creation and Workflows')
        if w==390:
            page.wait_for_timeout(380)
            page.screenshot(path=str(base/'screen-mobile.png'))
        overflow=page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        print('  checks: add-ons, pricing, chat, builder; overflow',overflow,'errors',errs)
        assert overflow<=1,overflow
        assert not errs,errs
        ctx.close()
    print('all frontend UI tests passed')
    browser.close()
