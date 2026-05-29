const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const SHIPPO_KEY = 'shippo_test_d775e69c29b93dc27ce55da41e752c3e5606953b';

// Create shipment and get rates
app.post('/create-label', async (req, res) => {
  try {
    // Step 1: Create shipment
    const shipmentRes = await fetch('https://api.goshippo.com/shipments/', {
      method: 'POST',
      headers: {
        'Authorization': 'ShippoToken ' + SHIPPO_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address_from: {
          name: "J's Golf Performance & Repair",
          street1: '1 Markovich Lane',
          city: 'Richmond',
          state: 'CA',
          zip: '94806',
          country: 'US',
          phone: '5102321080'
        },
        address_to: req.body.address_to,
        parcels: req.body.parcels,
        async: false
      })
    });

    const shipment = await shipmentRes.json();

    if (!shipment.rates || shipment.rates.length === 0) {
      return res.status(400).json({ error: 'No rates returned. Please check the address.' });
    }

    // Step 2: Pick best rate (match service or use first)
    const service = req.body.service;
    const rate = shipment.rates.find(r => r.servicelevel && r.servicelevel.token === service)
              || shipment.rates[0];

    // Step 3: Purchase label
    const txRes = await fetch('https://api.goshippo.com/transactions/', {
      method: 'POST',
      headers: {
        'Authorization': 'ShippoToken ' + SHIPPO_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rate: rate.object_id,
        label_file_type: 'PDF',
        async: false
      })
    });

    const tx = await txRes.json();

    if (tx.status === 'SUCCESS' && tx.label_url) {
      return res.json({
        success: true,
        label_url: tx.label_url,
        tracking_number: tx.tracking_number,
        rate_amount: rate.amount,
        rate_provider: rate.provider,
        rate_service: rate.servicelevel ? rate.servicelevel.name : ''
      });
    } else {
      const msg = tx.messages ? tx.messages.map(m => m.text).join(' ') : 'Label generation failed.';
      return res.status(400).json({ error: msg });
    }

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.get('/', (req, res) => res.send("J's Golf Shippo Server is running."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
