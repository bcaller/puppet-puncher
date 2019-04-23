// Example from official puppeteer documentation
// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageexposefunctionname-puppeteerfunction

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

puppeteer.launch().then(async browser => {
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE SAYS', msg.text()));

  await page.exposeFunction('readfile', async filePath => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, text) => {
        if (err)
          reject(err);
        else
          resolve(text);
      });
    });
  });

  // Actually load external content (here a page with puppet-puncher)
  await page.goto(`file://${path.join(__dirname, 'puppet-puncher.html')}`, {waitUntil: 'domcontentloaded'})

  await page.evaluate(async () => {
    // use window.readfile to read contents of a file
    const content = await window.readfile('/etc/hosts');
    console.log(content);
  });
  await browser.close();
});
