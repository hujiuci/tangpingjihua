const axios = require('axios');

// 缓存百度access_token，30天有效期，提前60秒刷新
let tokenCache = {
  accessToken: null,
  expireTime: 0
};

async function getBaiduToken() {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expireTime > now + 60 * 1000) {
    return tokenCache.accessToken;
  }
  const apiKey = process.env.BAIDU_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY;
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`
  const res = await axios.post(url);
  tokenCache.accessToken = res.data.access_token;
  tokenCache.expireTime = now + res.data.expires_in * 1000;
  return tokenCache.accessToken;
}

// Vercel Serverless入口函数
module.exports = async function handler(req, res) {
  // 跨域配置，允许Lovable网站访问
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理浏览器OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.json({success:false,msg:"请使用POST上传图片"});
  }

  try {
    const {imageBase64} = req.body;
    if (!imageBase64) {
      return res.json({ success: false, msg: "请上传图片文件" });
    }
    const token = await getBaiduToken();
    const result = await axios.post(
      `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${token}`,
      { image: imageBase64 },
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    // 过滤，只保留食物分类，去重
    const foods = result.data.result
      .filter(item => item.root_object === "食物")
      .map(item => item.keyword);
    const uniqueFoods = [...new Set(foods)];
    return res.json({
      success: true,
      foods: uniqueFoods
    })
  } catch (err) {
    console.error(err);
    return res.json({ success: false, msg: "图片识别失败，请重新拍摄清晰食物照片" });
  }
}
