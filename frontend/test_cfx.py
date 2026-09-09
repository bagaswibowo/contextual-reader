import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # Use our pre-installed firefox via browser_harness if possible, or a local browser
        browser = await p.firefox.launch()
        page = await browser.new_page()
        
        errors = []
        page.on("pageerror", lambda err: errors.append("PAGE ERR: " + err.message))
        page.on("console", lambda msg: errors.append("CONSOLE " + msg.type + ": " + msg.text) if msg.type == "error" else None)
        
        await page.goto('https://reader.bagaswibowo.app/read/31', wait_until='networkidle')
        print("Captured Errors:")
        for e in errors:
            print(e)
            
        await browser.close()

asyncio.run(main())
