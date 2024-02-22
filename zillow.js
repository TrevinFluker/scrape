const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');

// Use the plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const app = express();
const port = 3000;

app.use(express.json());

// Endpoint to scrape Zillow listings based on city and state
app.get('/scrape', async (req, res) => {
    const { city, state } = req.query;

    if (!city || !state) {
        return res.status(400).send({ error: 'Please provide both city and state' });
    }

    const formattedCityState = `${city}-${state}`.toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.zillow.com/${formattedCityState}/`;

    try {
        const properties = await scrapeProperties(url);
        res.send(properties);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Failed to scrape properties' });
    }
});

const scrapeProperties = async (url) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url);

    let properties = [];
    let hasNextPage = true;

    while (hasNextPage) {
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => document.getElementById("search-page-list-container").scrollBy(0, 500));
            await page.waitForTimeout(1500);
        }

        const cardSelector = '.StyledCard-c11n-8-84-3__sc-rmiu6p-0.jZuLiI.StyledPropertyCardBody-c11n-8-84-3__sc-1p5uux3-0.gHYrNO.PropertyCardWrapper__StyledPropertyCardBody-srp__sc-16e8gqd-4.gDHJqa';
        const cards = await page.$$(cardSelector);

        for (const card of cards) {
            const property = await extractDataFromCard(card);
            properties.push(property);
        }

        const nextPageButton = await page.$('[title="Next page"]');
        if (nextPageButton) {
            await nextPageButton.click();
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
        } else {
            hasNextPage = false;
        }
    }

    await browser.close();
    return properties;
};

const extractDataFromCard = async (card) => {
    const priceSelector = '.PropertyCardWrapper__StyledPriceLine-srp__sc-16e8gqd-1.iMKTKr';
    const addressSelector = '[data-test="property-card-addr"]';

    const price = await card.$eval(priceSelector, element => element.innerText);
    const address = await card.$eval(addressSelector, element => element.innerText);

    return { price, address };
};

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
