const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

const RSS_URLS = [
  {url: 'https://spacenews.com/feed', name: 'Space News'},
  {url: 'https://spaceflightnow.com/feed/', name: 'Space Flight Now'},
  {url: 'https://www.spacedaily.com/spacedaily.xml', name: 'Space Daily'}
];

const keywords = [
  'commercial space station',
  'cld',
  'commercial low earth orbit',
  'commercial space',
  'iss',
  'international space station',
  'space station',
  'human spaceflight',
  'astronaut',
  'vast',
  'axiom',
  'orbital reef',
  'starlab'
];

function safeGet(arr) {
  if (!arr) return '';
  if (Array.isArray(arr)) return String(arr<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a> || '');
  return String(arr);
}

function matchesKeyword(text) {
  var lower = text.toLowerCase();
  for (var i = 0; i < keywords.length; i++) {
    if (lower.indexOf(keywords[i]) !== -1) return true;
  }
  return false;
}

function cleanHtml(html) {
  try {
    var d = cheerio.load(html);
    d('img').remove();
    return d.html();
  } catch (e) {
    return html;
  }
}


app.get('/', async function(req, res) {
  var allItems = [];
  var errors = [];

  for (var f = 0; f < RSS_URLS.length; f++) {
    var feedUrl = RSS_URLS[f].url;
    var feedName = RSS_URLS[f].name;
    try {
      var response = await axios.get(feedUrl, {
        timeout: 15000,
        headers: {'User-Agent': 'Mozilla/5.0 SpaceReader/1.0'}
      });
      var parsed = await xml2js.parseStringPromise(response.data);
      var channels = parsed.rss ? parsed.rss.channel : null;
      if (!channels) {
        errors.push(feedName + ': no channel found');
        continue;
      }
      var firstChannel = channels<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>;
      if (!firstChannel || !firstChannel.item) {
        errors.push(feedName + ': no items found');
        continue;
      }
      var items = firstChannel.item;
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var title = safeGet(item.title);
        var desc = safeGet(item.description);
        var link = safeGet(item.link);
        var pubDate = safeGet(item.pubDate);
        var category = safeGet(item.category);
        var date = new Date(pubDate);
        if (date >= cutoff) {
          if (matchesKeyword(title) || matchesKeyword(desc) || matchesKeyword(category)) {
            allItems.push({
              title: title,
              link: link,
              description: cleanHtml(desc),
              source: feedName,
              date: date.toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})
            });
          }
        }
      }
    } catch (err) {
      errors.push(feedName + ': ' + err.message);
    }
  }

  var html = '';
  html += '<html><head><title>Space Articles</title>';
  html += '<style>';
  html += 'body{font-family:Arial;max-width:900px;margin:0 auto;padding:20px}';
  html += 'h1{color:#333}';
  html += 'h2{color:#0056b3;border-bottom:2px solid #0056b3;padding-bottom:5px}';
  html += '.item{margin-bottom:20px;padding:10px;background:#f9f9f9;border-radius:5px}';
  html += 'a{color:#0066cc;text-decoration:none;font-weight:bold}';
  html += '.date{color:#666;font-size:0.9em}';
  html += '.errors{background:#fff3cd;padding:10px;border-radius:5px;margin:10px 0}';
  html += '</style></head><body>';
  html += '<h1>Latest Space Articles</h1>';
  html += '<p>Found ' + allItems.length + ' articles</p>';

  if (errors.length > 0) {
    html += '<div class="errors"><strong>Some feeds had issues:</strong><br>';
    for (var e = 0; e < errors.length; e++) {
      html += errors[e] + '<br>';
    }
    html += '</div>';
  }

  var sources = {};
  for (var j = 0; j < allItems.length; j++) {
    var src = allItems[j].source;
    if (!sources[src]) sources[src] = [];
    sources[src].push(allItems[j]);
  }

  var sourceNames = Object.keys(sources);
  for (var s = 0; s < sourceNames.length; s++) {
    var nm = sourceNames[s];
    html += '<h2>' + nm + ' (' + sources[nm].length + ')</h2>';
    for (var k = 0; k < sources[nm].length; k++) {
      var a = sources[nm][k];
      html += '<div class="item">';
      html += '<a href="' + a.link + '" target="_blank">' + a.title + '</a><br>';
      html += '<span class="date"><em>Published: ' + a.date + '</em></span><br>';
      html += a.description;
      html += '</div>';
    }
  }

  if (sourceNames.length === 0) {
    html += '<p>No matching articles found.</p>';
  }

  html += '</body></html>';
  res.send(html);
});

app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
