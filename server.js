const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();

app.use(cors());
app.use(express.json());

const secretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = secretKey ? new Stripe(secretKey) : null;

const PRODUCT_NAME = 'Pet Supplies';
const SUCCESS_URL = 'https://awesome-tv.online/payment-success';
const CANCEL_URL = 'https://awesome-tv.online/payment-cancelled';

const PRICING = {
  '1':  { '1': 990,  '2': 1980, '3': 2970 },
  '3':  { '1': 1900, '2': 3800, '3': 5700 },
  '6':  { '1': 3200, '2': 6400, '3': 9600 },
  '12': { '1': 4900, '2': 9800, '3': 14700 },
  '24': { '1': 7900, '2': 15800, '3': 23700 },
  '36': { '1': 9900, '2': 19800, '3': 29700 }
};

app.get('/', (req, res) => {
  res.send('API is running');
});

app.get('/env-check', (req, res) => {
  res.json({
    hasKey: !!secretKey,
    prefix: secretKey ? secretKey.substring(0, 7) : 'EMPTY'
  });
});

function getPrice(plan, device) {
  if (!PRICING[plan] || !PRICING[plan][device]) return null;
  return PRICING[plan][device];
}

app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { plan, device } = req.body;

    if (!plan || !device) {
      return res.status(400).json({ error: 'Missing plan/device' });
    }

    const normalizedPlan = String(plan).replace('m', '').trim();
    const normalizedDevice = String(device).trim();

    const amount = getPrice(normalizedPlan, normalizedDevice);

    if (!amount) {
      return res.status(400).json({ error: 'Invalid plan/device' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: PRODUCT_NAME
            },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message || 'Unknown server error' });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
