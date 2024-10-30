import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';

// 定义请求体的接口
interface PixivProxyRequestBody {
  url: string;
  referer: string;
}

// 生成盐
const generateSalt = (length: number): string => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let salt = '';
    for (let i = 0; i < length; i++) {
      salt += letters[bytes[i] % letters.length];
    }
    return salt;
};

const generateToken = (salt: string, body: string, secret: string): string => {
    const data = salt + body + secret;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash;
};

/**
 * pixivProxy - 发送带有 referer 和参数的 POST 请求
 * @param baseUrl 要请求的 Base URL
 * @param referer 请求头中的 Referer
 * @param params 请求的查询参数
 * @returns 响应体
 */
async function pixivProxy<T>(
  baseUrl: string,
  referer: string,
  params: Record<string, any> = {}
): Promise<T> {
  // 构建请求体
  const reqBody: PixivProxyRequestBody = {
    url: baseUrl,
    referer: referer,
  };

  const salt = generateSalt(10);
  const token = generateToken(salt, JSON.stringify(reqBody), process.env.HTTP_SECRET);

  try {
    // 发送带有 params 和自定义请求头的 POST 请求
    const response: AxiosResponse<T> = await axios.post<T>(
      'http://www.yuanzhi.xyz/api/v2/proxy',
      reqBody,
      {
        headers: {
          'X-Salt': salt,
          'X-Token': token,
          'Content-Type': 'application/json',
        },
        params: params,
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error in pixivProxy:', error);
    throw new Error(`Request failed: ${error.message}`);
  }
}

export default pixivProxy;