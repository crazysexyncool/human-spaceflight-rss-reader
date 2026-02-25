const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', function(req, res) {
  res.send('Hello World - Server is working!');
});

app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
