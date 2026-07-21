import { chromium, Browser } from "playwright";

export interface ScrapeResult {
  businessName: string;
  location: string;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  reviews: number | null;
}

export interface ScrapeOptions {
  query: string;
  location: string;
  maxResults: number;
  proxyUrl?: string;
  renderDelay?: number;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

export async function searchGoogleMaps(options: ScrapeOptions): Promise<ScrapeResult[]> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-IN",
  });

  const page = await context.newPage();
  const results: ScrapeResult[] = [];

  try {
    const searchQuery = encodeURIComponent(`${options.query} ${options.location}`);
    await page.goto(`https://www.google.com/maps/search/${searchQuery}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForSelector('div[role="feed"]', { timeout: 10000 });

    let previousHeight = 0;
    let noChangeCount = 0;

    while (results.length < options.maxResults && noChangeCount < 3) {
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollBy(0, 2000);
      });

      await page.waitForTimeout(options.renderDelay || 500);

      const items = await page.$$('div[role="feed"] > div > div[aria-label]');
      const currentCount = items.length;

      if (currentCount === previousHeight) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
      }
      previousHeight = currentCount;
    }

    const cards = await page.$$('div[role="feed"] > div > div[aria-label]');
    for (const card of cards.slice(0, options.maxResults)) {
      try {
        const businessName = await card.$eval("a", (el) => el.getAttribute("aria-label") || "");
        const location = options.location;
        const phone = null;
        const website = null;
        const category = null;
        const rating = null;
        const reviews = null;

        results.push({ businessName, location, phone, website, category, rating, reviews });
      } catch {
        // skip unparseable cards
      }
    }
  } finally {
    await page.close();
    await context.close();
  }

  return results;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
