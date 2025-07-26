declare namespace NodeJS {
  interface ProcessEnv {
    REDIS_PASSWORD: string;
    APP_ID: string;
    APP_SECRET: string;
    ENCRYPT_KEY: string;
    ROBOT_TOKEN: string;
    MONGO_INITDB_ROOT_USERNAME: string;
    MONGO_INITDB_ROOT_PASSWORD: string;
    BAIDU_TRANS_APPID: string;
    BAIDU_TRANS_APIKEY: string;
    ROBOT_OPEN_ID: string;
    ROBOT_SENDER_ID: string;
    SELF_CHAT_ID: string;
    HTTP_SECRET: string;
    END_POINT: string;
    OSS_ACCESS_KEY_ID: string;
    OSS_ACCESS_KEY_SECRET: string;
    OSS_BUCKET: string;
    DATA_HOST_IP: string;
    CHAT_API_KEY: string;
    REDIS_HOST: string;
    BANGUMI_ACCESS_TOKEN: string;
    MONGO_HOST: string;
  }
}
