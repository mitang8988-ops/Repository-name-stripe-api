const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

/**
 * 价格表（单位：美元）
 * 这里已经按你之前的计划价格写好了
 */
const PRICING = {
  '1':  { '1': 9.9,  '2': 19.8, '3': 29.7 },
  '3':  { '1': 19,   '2': 38,   '3': 57 },
  '6':  { '1': 32,   '2': 64,   '3': 96 },
  '12': { '1': 49,   '2': 98,   '3': 147 },
  '24': { '1': 79,   '2': 158,  '3': 237 },
  '36': { '1': 99,   '2': 198,  '3': 297 }
};

/**
 * 你的收款钱包地址（必须改）
 * PayLex 文档要求你提供自己的钱包地址
 */
const YOUR_WALLET_ADDRESS = '0xc58b6e0f933bfd6353ae1d123731de65991c0579';

/**
 * 你的 API 对外地址（必须改）
 * 这里填你 Railway 的真实 API 地址
 * 例如：
 * https://repository-name-stripe-api-production.up.railway.app
 */
const API_BASE_URL = 'https://repository-name-stripe-api-production.up.railway.app';

/**
 * 获取价格
 */
function getPrice(plan, device) {
  if (!PRICING[plan] || !PRICING[plan][device]) {
    return null;
  }
  return PRICING[plan][device];
}

/**
 * 首页测试
 */
app.get('/', (req, res) => {
  res.send('PayLex API running');
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'paylex-api'
  });
});

/**
 * 创建 PayLex 支付链接
 */
app.post('/create-paylex-payment', async (req, res) => {
  try {
    const { plan, device, email } = req.body;

    if (!plan || !device || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: plan, device, email'
      });
    }

    const normalizedPlan = String(plan).replace('m', '').trim();
    const normalizedDevice = String(device).trim();
    const normalizedEmail = String(email).trim();

    const amount = getPrice(normalizedPlan, normalizedDevice);

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan or device'
      });
    }

    /**
     * 唯一订单号
     */
    const orderId = Date.now().toString();

    /**
     * 回调地址
     * PayLex 文档要求 callback 携带唯一参数
     */
    const callbackUrl = encodeURIComponent(
      `${API_BASE_URL}/paylex-callback?order_id=${orderId}`
    );

    /**
     * 第一步：创建钱包
     * PayLex 文档接口
     */
    const walletApiUrl =
      `https://api.paylex.org/control/wallet.php?address=${YOUR_WALLET_ADDRESS}&callback=${callbackUrl}`;

    const walletResponse = await fetch(walletApiUrl);
    const walletData = await walletResponse.json();

    if (!walletData || !walletData.address_in) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create payment wallet'
      });
    }

    /**
     * 第二步：生成支付页链接
     * PayLex Checkout 地址
     */
    const payUrl =
      `https://checkout.paylex.org/pay.php?address=${walletData.address_in}` +
      `&amount=${amount}` +
      `&email=${encodeURIComponent(normalizedEmail)}` +
      `&currency=USD`;

    return res.json({
      success: true,
      url: payUrl,
      orderId,
      amount
    });

  } catch (err) {
    console.error('PayLex create payment error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Unknown server error'
    });
  }
});

/**
 * PayLex 回调接口
 * 支付成功后 PayLex 会请求这里
 */
app.get('/paylex-callback', (req, res) => {
  try {
    const {
      order_id,
      value_coin,
      coin,
      txid_in,
      txid_out,
      address_in
    } = req.query;

    console.log('✅ PayLex callback received:', {
      order_id,
      value_coin,
      coin,
      txid_in,
      txid_out,
      address_in
    });

    /**
     * 这里你后续可以做：
     * 1. 标记订单 paid
     * 2. 发账号
     * 3. 发 WhatsApp / Email
     */

    return res.send('OK');
  } catch (err) {
    console.error('PayLex callback error:', err);
    return res.status(500).send('ERROR');
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
