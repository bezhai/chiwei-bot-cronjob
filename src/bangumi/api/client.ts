/**
 * Bangumi API 客户端
 * 提供统一的 API 请求处理和限流机制
 */

import axios, { AxiosInstance, AxiosResponse } from "axios";
import { bangumiConfig } from "../config";
import {
  defaultRateLimiter,
  characterRateLimiter,
  RateLimiter,
} from "../utils/rateLimiter";
import { BangumiApiRequest, BangumiApiResponse } from "../types";

export class BangumiApiClient {
  private axiosInstance: AxiosInstance;
  private config = bangumiConfig.get();

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.config.api.baseUrl,
      timeout: this.config.api.timeout,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.config.api.userAgent,
      },
    });

    // 添加认证头
    if (this.config.api.accessToken) {
      this.axiosInstance.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${this.config.api.accessToken}`;
    }

    // 响应拦截器
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const message = `Bangumi API request failed: ${status} ${error.response?.statusText}`;

          // 记录错误日志
          console.error(message, {
            url: error.config?.url,
            params: error.config?.params,
            status,
            data: error.response?.data,
          });

          throw new Error(message);
        }
        throw error;
      }
    );
  }

  /**
   * 发送请求（带限流）
   */
  async request<T = any>(
    options: BangumiApiRequest,
    rateLimiter?: RateLimiter
  ): Promise<T> {
    // 使用指定的限流器或默认限流器
    const limiter = rateLimiter || defaultRateLimiter;
    await limiter.limit();

    const response: AxiosResponse<T> = await this.axiosInstance({
      method: options.method || "GET",
      url: options.path,
      params: options.params,
      data: options.data,
    });

    return response.data;
  }

  /**
   * 获取条目列表
   */
  async getSubjects(params?: Record<string, any>): Promise<BangumiApiResponse> {
    return this.request<BangumiApiResponse>({
      path: "/v0/subjects",
      params,
    });
  }

  /**
   * 获取单个条目详情
   */
  async getSubject(id: number): Promise<any> {
    return this.request({
      path: `/v0/subjects/${id}`,
    });
  }

  /**
   * 获取条目关联的角色列表
   */
  async getSubjectCharacters(subjectId: number): Promise<any[]> {
    return this.request(
      {
        path: `/v0/subjects/${subjectId}/characters`,
      },
      characterRateLimiter
    );
  }

  /**
   * 获取角色详细信息（使用 1 QPS 限流）
   */
  async getCharacter(characterId: number): Promise<any> {
    return this.request(
      {
        path: `/v0/characters/${characterId}`,
      },
      characterRateLimiter
    );
  }

  /**
   * 批量获取条目
   */
  async *getSubjectsBatch(
    params: Record<string, any> = {},
    batchSize?: number
  ): AsyncGenerator<any[], void, unknown> {
    const limit = batchSize || this.config.sync.batchSize;
    let offset = params.offset || 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getSubjects({
        ...params,
        limit,
        offset,
      });

      if (!response.data || response.data.length === 0) {
        hasMore = false;
        break;
      }

      yield response.data;

      offset += limit;
      if (offset >= response.total) {
        hasMore = false;
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(): void {
    this.config = bangumiConfig.get();

    // 更新 axios 实例配置
    this.axiosInstance.defaults.baseURL = this.config.api.baseUrl;
    this.axiosInstance.defaults.timeout = this.config.api.timeout;

    if (this.config.api.accessToken) {
      this.axiosInstance.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${this.config.api.accessToken}`;
    }

    // 更新限流器
    defaultRateLimiter.updateQPS(this.config.rateLimit.defaultQPS);
    characterRateLimiter.updateQPS(this.config.rateLimit.characterDetailQPS);
  }
}

// 导出单例
export const bangumiApiClient = new BangumiApiClient();
