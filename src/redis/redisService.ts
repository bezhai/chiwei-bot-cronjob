import client from "./redisClient";

/**
 * 设置 Redis 键值对
 * @param key 键
 * @param value 值
 */
export async function setValue(key: string, value: string): Promise<void> {
  try {
    await client.set(key, value);
    console.log(`Value set: ${key} = ${value}`);
  } catch (err) {
    console.error("Error setting value in Redis:", err);
    throw err;
  }
}

/**
 * 获取 Redis 键的值
 * @param key 键
 * @returns 键的值或 null
 */
export async function getValue(key: string): Promise<string | null> {
  try {
    const value = await client.get(key);
    console.log(`Value retrieved: ${key} = ${value}`);
    return value;
  } catch (err) {
    console.error("Error getting value from Redis:", err);
    throw err;
  }
}

/**
 * 从 Redis 哈希表中获取字段的值
 * @param hashKey 哈希表的键
 * @param field 哈希表中的字段
 * @returns 字段的值或 null
 */
export async function hGetValue(
  hashKey: string,
  field: string
): Promise<string | undefined> {
  try {
    const value = await client.hGet(hashKey, field);
    console.log(`Hash value retrieved: ${hashKey}.${field} = ${value}`);
    return value;
  } catch (err) {
    console.error("Error getting hash value from Redis:", err);
    throw err;
  }
}

/**
 * 设置 Redis 哈希表中的字段
 * @param hashKey 哈希表键
 * @param field 哈希表字段
 * @param value 要设置的值
 * @returns {Promise<void>} 无返回值
 */
export async function hSetValue(
  hashKey: string,
  field: string,
  value: string
): Promise<void> {
  try {
    await client.hSet(hashKey, field, value);
    console.log(`Hash value set: ${hashKey}.${field} = ${value}`);
  } catch (err) {
    console.error(
      `Error setting hash value in Redis: ${hashKey}.${field}`,
      err
    );
    throw err;
  }
}

/**
 * 从 Redis 中获取集合的所有成员
 * @param key Redis 键
 * @returns {Promise<string[]>} Redis 集合的所有成员数组
 */
export async function getSetMembers(key: string): Promise<string[]> {
  try {
    // 获取指定键的集合成员
    const members = await client.sMembers(key);
    console.log(`Set members retrieved: ${key} = ${members}`);
    return members;
  } catch (err) {
    console.error(`Error retrieving set members from Redis: ${key}`, err);
    throw err;
  }
}
