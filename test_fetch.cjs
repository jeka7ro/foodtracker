const https = require('https');
https.get('https://foodtrackerfoodtracker-worker.onrender.com/api/pos/discrepancies', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.substring(0, 500)));
}).on('error', err => console.error(err));
