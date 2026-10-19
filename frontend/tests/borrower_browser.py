import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)
        page = await browser.new_page(viewport={'width':1440,'height':1000})
        await page.emulate_media(reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto('http://127.0.0.1:5174/register')
        await page.get_by_label('Legal First Name').fill('Browser')
        await page.get_by_label('Legal Last Name').fill('Borrower')
        import time
        email = f'browser{int(time.time())}@example.com'
        await page.get_by_label('Email Address', exact=True).fill(email)
        await page.get_by_placeholder('Create password').fill('BorrowerPass123!')
        await page.get_by_placeholder('Re-enter password').fill('BorrowerPass123!')
        await page.locator('input[type=checkbox]').check()
        await page.get_by_role('button', name='Complete Registration', exact=True).click()
        await page.get_by_text('No loan applications yet.', exact=True).wait_for(timeout=15000)
        print('PASS new registration empty dashboard')
        await page.wait_for_timeout(400)
        await page.screenshot(path='/tmp/credvidhi-empty-desktop.png', full_page=True)
        await page.get_by_role('button', name='Apply for a Loan', exact=True).click()
        await page.get_by_role('button', name='Save & Proceed').click()
        await page.get_by_label('Contact Phone').fill('+919123456789')
        await page.get_by_label('Date of Birth').fill('1990-01-01')
        await page.get_by_label('Residential Address').fill('Borrower supplied address')
        await page.get_by_role('button', name='Save & Proceed').click()
        await page.get_by_label('Employer / Business Name').fill('Borrower supplied employer')
        await page.get_by_label('Job Title', exact=True).fill('Engineer')
        await page.get_by_label('Gross Monthly Income', exact=True).fill('95000')
        await page.get_by_role('button', name='Save & Proceed').click()
        await page.locator('#consent').check()
        await page.get_by_role('button', name='Submit Application to CredVidhi').click()
        await page.get_by_text('Application Submitted', exact=True).wait_for(timeout=15000)
        print('PASS persisted real application submission')
        await page.wait_for_timeout(400)
        await page.screenshot(path='/tmp/credvidhi-application-desktop.png', full_page=True)
        token = await page.evaluate("localStorage.getItem('credvidhi_access_token')")
        result = await page.request.get('http://127.0.0.1:8000/api/v1/queues/applicant', headers={'Authorization': 'Bearer ' + token})
        own_apps = (await result.json())['data']
        assert len(own_apps) == 1 and own_apps[0]['status'] == 'SUBMITTED'
        app_reference = own_apps[0]['reference_number']
        assert await page.get_by_text('Credit Score Not Available', exact=True).is_visible()
        await page.reload()
        await page.get_by_text('Application Submitted', exact=True).wait_for(timeout=15000)
        print('PASS existing borrower reload restores only persisted records')
        await page.get_by_title('Sign Out / Switch Account').click()
        await page.get_by_label('Email Address', exact=True).wait_for()
        email_b = f'borrowerb{int(time.time())}@example.com'
        registered = await page.request.post('http://127.0.0.1:8000/api/v1/auth/register', data={
            'email': email_b, 'password': 'BorrowerPass123!', 'first_name': 'Second', 'last_name': 'Borrower'})
        assert registered.status == 201
        await page.get_by_label('Email Address', exact=True).fill(email_b)
        await page.get_by_label('Password', exact=True).fill('BorrowerPass123!')
        await page.locator('button[type=submit]').click()
        await page.get_by_text('No loan applications yet.', exact=True).wait_for(timeout=15000)
        assert app_reference not in await page.locator('body').inner_text()
        assert await page.evaluate("localStorage.getItem('credvidhi_applications_v1')") is None
        print('PASS logout and borrower B login clear borrower A data')
        await page.set_viewport_size({'width':390,'height':844})
        await page.wait_for_timeout(400)
        await page.screenshot(path='/tmp/credvidhi-empty-mobile.png', full_page=True)
        await page.set_viewport_size({'width':1440,'height':1000})
        # Forward the actual frontend request to the local Postman failure simulation.
        async def fail_queue(route):
            response = await route.fetch(url='http://127.0.0.1:4901/credvidhi/queues/applicant')
            await route.fulfill(response=response)
        await page.route('**/queues/applicant?*', fail_queue)
        await page.get_by_role('button', name='Connected to FastAPI backend. Click to re-sync.').click()
        await page.get_by_text('Account data is temporarily unavailable. Please retry.', exact=True).wait_for()
        assert not await page.get_by_text('No loan applications yet.', exact=True).is_visible()
        assert app_reference not in await page.locator('body').inner_text()
        await page.wait_for_timeout(400)
        await page.screenshot(path='/tmp/credvidhi-api-failure.png', full_page=True)
        await page.unroute('**/queues/applicant?*', fail_queue)
        await page.get_by_role('button', name='Retry', exact=True).click()
        await page.get_by_text('No loan applications yet.', exact=True).wait_for(timeout=15000)
        print('PASS API failure is distinct from empty state; retry restores real data')
        await page.get_by_title('Sign Out / Switch Account').click()
        await page.get_by_role('button', name='Back to CredVidhi Home').click()
        await page.get_by_role('button', name='Launch Staff Workbench Demo').click()
        await page.get_by_role('heading', name='Adjudication & Verification Queue').wait_for(timeout=15000)
        await page.get_by_text('Demo Mode — Simulated Data', exact=True).first.wait_for()
        assert await page.evaluate("localStorage.getItem('credvidhi_access_token')") is None
        await page.get_by_role('button', name='Workbench', exact=True).first.click()
        await page.get_by_text('Verification Checklist', exact=True).wait_for(timeout=15000)
        print('PASS explicit staff demo and document workbench use isolated memory without bearer credentials')
        await page.wait_for_timeout(400)
        await page.screenshot(path='/tmp/credvidhi-staff-demo.png', full_page=True)
        assert not errors, errors
        await browser.close()

asyncio.run(main())
