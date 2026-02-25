const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const app = express();

const PORT = process.env.PORT || 3000;

const RSS_URLS = [
  { url: 'https://www.space.com/feeds/all', name: 'Space.com' },
  { url: 'https://spacenews.com/feed', name: 'Space News' },
  { url: 'https://www.spacedaily.com/spacedaily.xml', name: 'Space Daily' },
  { url: 'https://spaceflightnow.com/feed/', name: 'Space Flight Now' },
  { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', name: 'NASA News' },
  { url: 'https://www.esa.int/rssfeed/TopNews', name: 'ESA News' }
];

const keywords = [
  'Commercial Space Station', 'CLD', 'Commercial low earth orbit destination', 'commercial space',
  'ISS', 'International Space Station', 'space station', 'human spaceflight', 'astronaut', 'astronauts',
  'vast', 'axiom', 'orbital reef', 'starlab'
];

function removeImagesFromHtml(htmlContent) {
  try {
    const $ = cheerio.load(htmlContent || '');
    $('img').remove();
    return $.html();
  } catch (error) {
    console.error('Error removing images:', error);
    return htmlContent || '';
  }
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return 'Unknown date';
  }
}

// Extract items from different RSS/Atom feed formats
function extractItems(result) {
  if (
    result.rss &&
    result.rss.channel &&
    result.rss.channel<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> &&
    result.rss.channel<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>.item
  ) {
    return result.rss.channel<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>.item;
  }
  if (result['rdf:RDF'] && result['rdf:RDF'].item) {
    return result['rdf:RDF'].item;
  }
  if (result.feed && result.feed.entry) {
    return result.feed.entry.map(function(entry) {
      return {
        title: entry.title,
        link: entry.link ? [entry.link<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>.$.href || entry.link<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>] : [''],
        description: entry.summary || entry.content || [''],
        pubDate: entry.published || entry.updated || [''],
        category: entry.category ? [entry.category<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>.$.term || entry.category<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>] : ['']
      };
    });
  }
  return null;
}


app.get('/', async (req, res) => {
  const allFilteredItems = [];
  const errors = [];

  for (const { url, name } of RSS_URLS) {
    try {
      console.log(`Fetching: ${name} (${url})`);

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SpaceRSSReader/1.0)'
        }
      });

      const result = await xml2js.parseStringPromise(response.data);
      const items = extractItems(result);

      if (!items) {
        console.log(`No items found for ${name}`);
        errors.push(`${name}: No items found in feed`);
        continue;
      }

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const filteredItems = items.filter(item => {
        try {
          const title = item.title ? (Array.isArray(item.title) ? item.title<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> : item.title) : '';
          const description = item.description ? (Array.isArray(item.description) ? item.description<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> : item.description) : '';
          const category = item.category ? (Array.isArray(item.category) ? item.category<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> : item.category) : '';
          const pubDateStr = item.pubDate ? (Array.isArray(item.pubDate) ? item.pubDate<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> : item.pubDate) : '';

          // Handle title that might be an object (Atom feeds)
          const titleText = typeof title === 'object' ? (title._ || JSON.stringify(title)) : title;
          const descText = typeof description === 'object' ? (description._ || JSON.stringify(description)) : description;
          const catText = typeof category === 'object' ? (category._ || category.$.term || JSON.stringify(category)) : category;

          const pubDate = new Date(pubDateStr);

          // If date is invalid, include the item anyway
          const isRecent = isNaN(pubDate.getTime()) || pubDate >= twoWeeksAgo;

          return isRecent && keywords.some(keyword =>
            titleText.toLowerCase().includes(keyword.toLowerCase()) ||
            descText.toLowerCase().includes(keyword.toLowerCase()) ||
            catText.toLowerCase().includes(keyword.toLowerCase())
          );
        } catch (filterError) {
          console.error(`Error filtering item in ${name}:`, filterError.message);
          return false;
        }
      });

      const formattedItems = filteredItems.map(item => {
        const title = item.title ? (Array.isArray(item.title) ? item.title<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> : item.title) : 'No title';
        const titleText = typeof title === 'object' ? (title._ || 'No title') : title;
        const link = item.link ? (Array.isArray(item.link) ? item.link<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> : item.link) : '#';
        const description = item.description ? (Array.isArray(item.description) ? item.description<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> : item.description) : '';
        const descText = typeof description === 'object' ? (description._ || '') : description;
        const pubDateStr = item.pubDate ? (Array.isArray(item.pubDate) ? item.pubDate<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> : item.pubDate) : '';

        const cleanDescription = removeImagesFromHtml(descText);
        return {
          title: titleText,
          link: typeof link === 'object' ? (link.$.href || '#') : link,
          description: cleanDescription,
          source: name,
          formattedDate: formatDate(pubDateStr)
        };
      });

      console.log(`${name}: Found ${filteredItems.length} matching articles`);
      allFilteredItems.push(...formattedItems);

    } catch (feedError) {
      console.error(`Error fetching ${name}:`, feedError.message);
      errors.push(`${name}: ${feedError.message}`);
    }
  }

  // Group items by source
  const groupedItems = allFilteredItems.reduce((acc, item) => {
    if (!acc[item.source]) {
      acc[item.source] = [];
    }
    acc[item.source].push(item);
    return acc;
  }, {});

  res.send(`
    <html>
    <head>
      <title>Latest Space Articles</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; max-width: 900px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        h2 { color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 5px; }
        ul { list-style-type: none; padding: 0; }
        li { margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-radius: 5px; }
        a { text-decoration: none; color: #0066cc; font-weight: bold; }
        a:hover { text-decoration: underline; }
        .date { color: #666; font-size: 0.9em; }
        .error-section { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .stats { color: #666; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h1>🚀 Latest Space Articles</h1>
      <p class="stats">Found ${allFilteredItems.length} articles from the past 2 weeks | Last updated: ${new Date().toLocaleString('en-US')}</p>

      ${errors.length > 0 ? `
        <div class="error-section">
          <strong>⚠️ Some feeds had issues:</strong><br>
          ${errors.map(e => `• ${e}`).join('<br>')}
        </div>
      ` : ''}

      ${Object.keys(groupedItems).length === 0 ? '<p>No matching articles found in the past 2 weeks.</p>' : ''}

      ${Object.keys(groupedItems).map(source => `
        <h2>${source} (${groupedItems[source].length})</h2>
        <ul>
          ${groupedItems[source].map(item => `
            <li>
              <a href="${item.link}" target="_blank">${item.title}</a><br>
              <span class="date"><em>Published on: ${item.formattedDate}</em></span><br>
              ${item.description}
            </li>
          `).join('')}
        </ul>
      `).join('')}
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
