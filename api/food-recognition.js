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
  if (!apiKey || !secretKey) {
    throw new Error("缺少百度API密钥环境变量");
  }
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  tokenCache.accessToken = data.access_token;
  tokenCache.expireTime = now + data.expires_in * 1000;
  return tokenCache.accessToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    const params = new URLSearchParams();
    params.append("image", imageBase64);
    const result = await fetch(
      `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${token}`,
      {
        method: "POST",
        body: params
      }
    );
    const resultData = await result.json();
    const foods = resultData.result
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
