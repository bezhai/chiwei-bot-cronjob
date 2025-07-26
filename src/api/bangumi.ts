import axios, { AxiosResponse } from 'axios';

interface BangumiRequestOptions {
  path: string;
  params?: Record<string, any>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: Record<string, any>;
}

export async function bangumiRequest({
  path,
  params = {},
  method = 'GET',
  data = {}
}: BangumiRequestOptions): Promise<any> {
  const baseUrl = 'https://api.bgm.tv';
  const url = `${baseUrl}${path}`;
  
  const accessToken = process.env.BANGUMI_ACCESS_TOKEN;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'panda1234/search'
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response: AxiosResponse = await axios({
      method,
      url,
      params,
      data: Object.keys(data).length > 0 ? data : undefined,
      headers,
      timeout: 15000
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Bangumi API request failed: ${error.response?.status} ${error.response?.statusText}`);
    }
    throw error;
  }
}