var express = require('express');
var axios = require('axios');
var xml2js = require('xml2js');
var app = express();
var PORT = process.env.PORT || 3000;

app.get('/', async function(req, res) {
  try {
    var response = await axios.get('https://spacenews.com/feed', {timeout: 15000});
    var parsed = await xml2js.parseStringPromise(response.data);
    var channel = parsed.rss.channel.shift();
    var items = channel.item;
    var html = '<h1>Space News</h1>';
    items.forEach(function(item) {
      var title = String(item.title);
      var link = String(item.link);
      html += '<p><a href="' + link + '">' + title + '</a></p>';
    });
    res.send(html);
  } catch(e) {
    res.send('Error: ' + e.message);
  }
});

app.listen(PORT, function() {
  console.log('Running on port ' + PORT);
});
