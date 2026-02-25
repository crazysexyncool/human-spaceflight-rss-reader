var express = require('express');
var axios = require('axios');
var xml2js = require('xml2js');
var cheerio = require('cheerio');
var app = express();
var PORT = process.env.PORT || 3000;

var RSS_URLS = new Array();
RSS_URLS.push({url: 'https://spacenews.com/feed', name: 'Space News'});
RSS_URLS.push({url: 'https://spaceflightnow.com/feed/', name: 'Space Flight Now'});
RSS_URLS.push({url: 'https://www.spacedaily.com/spacedaily.xml', name: 'Space Daily'});
RSS_URLS.push({url: 'https://www.space.com/feeds/all', name: 'Space.com'});
RSS_URLS.push({url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', name: 'NASA News'});
RSS_URLS.push({url: 'https://www.esa.int/rssfeed/TopNews', name: 'ESA News'});

var keywords = new Array();
keywords.push('commercial space station');
keywords.push('cld');
keywords.push('commercial low earth orbit');
keywords.push('commercial space');
keywords.push('iss');
keywords.push('international space station');
keywords.push('space station');
keywords.push('human spaceflight');
keywords.push('astronaut');
keywords.push('astronauts');
keywords.push('vast');
keywords.push('axiom');
keywords.push('orbital reef');
keywords.push('starlab');

function first(arr) {
  if (!arr) return '';
  if (Array.isArray(arr)) return String(arr.shift() || '');
  return String(arr);
}

function matchesKeyword(text) {
  var lower = text.toLowerCase();
  var found = false;
  keywords.forEach(function(kw) {
    if (lower.indexOf(kw) !== -1) found = true;
  });
  return found;
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

function formatDate(str) {
  try {
    var d = new Date(str);
    return d.toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'});
  } catch(e) {
    return 'Unknown date';
  }
}

app.get('/', async function(req, res) {
  var allItems = new Array();
  var errors = new Array();

  for (var f = 0; f < RSS_URLS.length; f++) {
    var feedUrl = RSS_URLS.at(f).url;
    var feedName = RSS_URLS.at(f).name;
    try {
      var response = await axios.get(feedUrl, {
        timeout: 15000,
        headers: {'User-Agent': 'Mozilla/5.0 SpaceReader/1.0'}
      });
      var parsed = await xml2js.parseStringPromise(response.data);

      if (!parsed.rss || !parsed.rss.channel) {
        errors.push(feedName + ': not a valid RSS feed');
        continue;
      }

      var channel = parsed.rss.channel.shift();
      if (!channel || !channel.item) {
        errors.push(feedName + ': no items in feed');
        continue;
      }

      var items = channel.item;
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);

      items.forEach(function(item) {
        var title = first(item.title);
        var desc = first(item.description);
        var link = first(item.link);
        var pubDate = first(item.pubDate);
        var category = first(item.category);
        var date = new Date(pubDate);

        if (date >= cutoff) {
          if (matchesKeyword(title) || matchesKeyword(desc) || matchesKeyword(category)) {
            allItems.push({
              title: title,
              link: link,
              description: cleanHtml(desc),
              source: feedName,
              date: formatDate(pubDate)
            });
          }
        }
      });

    } catch (err) {
      errors.push(feedName + ': ' + err.message);
    }
  }

  var sources = {};
  allItems.forEach(function(item) {
    if (!sources.hasOwnProperty(item.source)) {
      sources[item.source] = new Array();
    }
    sources[item.source].push(item);
  });

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
  html += '<h1>Latest Human Spaceflight Articles</h1>';
  html += '<p>Found ' + allItems.length + ' articles | Updated: ' + new Date().toLocaleString() + '</p>';

  if (errors.length > 0) {
    html += '<div class="errors"><strong>Some feeds had issues:</strong><br>';
    errors.forEach(function(e) {
      html += e + '<br>';
    });
    html += '</div>';
  }

  var sourceNames = Object.keys(sources);
  sourceNames.forEach(function(nm) {
    var list = sources[nm];
    html += '<h2>' + nm + ' (' + list.length + ')</h2>';
    list.forEach(function(a) {
      html += '<div class="item">';
      html += '<a href="' + a.link + '" target="_blank">' + a.title + '</a><br>';
      html += '<span class="date"><em>Published: ' + a.date + '</em></span><br>';
      html += a.description;
      html += '</div>';
    });
  });

  if (sourceNames.length === 0) {
    html += '<p>No matching articles found in the past 2 weeks.</p>';
  }

  html += '</body></html>';
  res.send(html);
});

app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
