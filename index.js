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
      // Load the HTML content into Cheerio
      const $ = cheerio.load(htmlContent);
      
      // Remove all img tags
      $('img').remove();
      
      // Return the HTML without images
      return $.html();
    } catch (error) {
      console.error('Error removing images:', error);
      return htmlContent; // Return original content if there's an error
    }
  }

// Function to format date in a readable format
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  }

app.get('/', async (req, res) => {
  try {
    const allFilteredItems = [];

    for (const { url, name } of RSS_URLS) {
      const response = await axios.get(url);
      const result = await xml2js.parseStringPromise(response.data);
      const items = result.rss.channel[0].item;

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14); // Set to 14 days ago

      const filteredItems = items.filter(item => {
        const pubDate = new Date(item.pubDate[0]);
        const category = item.category? item.category[0]:'';
        return pubDate >= twoWeeksAgo && keywords.some(keyword =>
          item.title[0].includes(keyword) || item.description[0].includes(keyword)|| category.includes(keyword)
        );
      });

      // Add website name to each item and process description to remove images
      const formattedItems = filteredItems.map(item => {
        const cleanDescription = removeImagesFromHtml(item.description[0]);
        return {
            ...item,
            description: [cleanDescription],
            source: name,
            formattedDate: formatDate(item.pubDate[0])
        };
    
      });

      allFilteredItems.push(...formattedItems);
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
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          h2 { color: #0056b3; }
          ul { list-style-type: none; padding: 0; }
          li { margin-bottom: 20px; }
          a { text-decoration: none; color: #0066cc; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Latest Space Articles</h1>
        ${Object.keys(groupedItems).map(source => `
          <h2>${source}</h2>
          <ul>
            ${groupedItems[source].map(item => `
              <li>
                <a href="${item.link[0]}" target="_blank">${item.title[0]}</a><br>
                <span class="date"> <em> Published on: ${item.formattedDate}</em></span><br>
                ${item.description[0]}
              </li>
            `).join('')}
          </ul>
        `).join('')}
      </body>
      </html>
    `);
  } catch (e) {
    res.status(500).send('Error fetching RSS feeds');
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
