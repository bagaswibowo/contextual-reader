const puppeteer = require('puppeteer-core');
(async () => {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
    });
    await page.goto('https://reader.bagaswibowo.app/read/31', {waitUntil: 'networkidle2'});
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("HTML length:", html.length);
    await browser.disconnect();
})();
