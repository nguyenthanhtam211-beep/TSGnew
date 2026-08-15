import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  await page.goto('http://localhost:3000');
  
  // Click on customers tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const customerTab = tabs.find(t => t.innerText.includes('Khách hàng'));
    if (customerTab) customerTab.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
