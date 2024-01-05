var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  Ecwt: () => Ecwt,
  EcwtExpiredError: () => EcwtExpiredError,
  EcwtFactory: () => EcwtFactory,
  EcwtInvalidError: () => EcwtInvalidError,
  EcwtRevokedError: () => EcwtRevokedError
});
module.exports = __toCommonJS(main_exports);

// src/factory.js
var import_snowflake = require("@kirick/snowflake");
var import_cbor_x = require("cbor-x");
var import_evilcrypt = require("evilcrypt");
var import_lru_cache = require("lru-cache");
var import_redis = require("redis");

// src/utils/time.js
function toSeconds(value) {
  return Math.floor(value / 1e3);
}

// src/token.js
function assign(target, key, value) {
  Object.defineProperty(
    target,
    key,
    {
      value,
      enumerable: true,
      writable: false,
      configurable: false
    }
  );
}
var Ecwt = class {
  #ecwtFactory;
  #ttl_initial;
  /**
   * Token string representation.
   * @type {string}
   * @readonly
   */
  token;
  /**
   * Token ID.
   * @type {string}
   * @readonly
   */
  id;
  /**
   * Snowflake associated with token.
   * @type {Snowflake}
   * @readonly
   */
  snowflake;
  /**
   * Timestamp when token expires in seconds.
   * @type {number?}
   * @readonly
   */
  ts_expired;
  /**
   * Data stored in token.
   * @type {{ [key: string]: any }}
   * @readonly
   */
  data;
  /**
   * @param {EcwtFactory} ecwtFactory -
   * @param {object} options -
   * @param {string} options.token String representation of token.
   * @param {Snowflake} options.snowflake -
   * @param {number?} options.ttl_initial Time to live in seconds at the moment of token creation.
   * @param {object} options.data Data stored in token.
   */
  constructor(ecwtFactory, {
    token,
    snowflake,
    ttl_initial,
    data
  }) {
    this.#ecwtFactory = ecwtFactory;
    this.#ttl_initial = ttl_initial;
    assign(this, "token", token);
    assign(
      this,
      "id",
      snowflake.toBase62()
    );
    assign(this, "snowflake", snowflake);
    assign(
      this,
      "ts_expired",
      this.#getTimestampExpired()
    );
    assign(
      this,
      "data",
      Object.freeze(data)
    );
  }
  #getTimestampExpired() {
    if (this.#ttl_initial === null) {
      return null;
    }
    return toSeconds(this.snowflake.timestamp) + this.#ttl_initial;
  }
  /**
   * Actual time to live in seconds.
   * @returns {number | null} -
   */
  getTTL() {
    if (this.#ttl_initial === null) {
      return null;
    }
    return this.#ttl_initial - toSeconds(Date.now() - this.snowflake.timestamp);
  }
  /* async */
  revoke() {
    return this.#ecwtFactory._revoke({
      token_id: this.id,
      ts_ms_created: this.snowflake.timestamp,
      ttl_initial: this.#ttl_initial
    });
  }
};

// src/utils/base62.js
var import_base_x = __toESM(require("base-x"), 1);
var base62 = (0, import_base_x.default)("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

// src/utils/errors.js
var InvalidPackageInstanceError = class extends TypeError {
  constructor(property, class_name, package_name) {
    super(`Value ${property} must be an instance of ${class_name} from package "${package_name}". That error is probably caused by two separate installations of "${package_name}". Please, make sure that "${package_name}" in your project is matches "peerDependencies" of "ecwt" package.`);
  }
};
var EcwtInvalidError = class extends Error {
  constructor(ecwt) {
    super("Ecwt token is invalid.");
    this.ecwt = ecwt;
  }
};
var EcwtExpiredError = class extends EcwtInvalidError {
  constructor(ecwt) {
    super();
    this.ecwt = ecwt;
    this.message = "Ecwt is expired.";
  }
};
var EcwtRevokedError = class extends EcwtInvalidError {
  constructor(ecwt) {
    super();
    this.ecwt = ecwt;
    this.message = "Ecwt is revoked.";
  }
};

// src/factory.js
var REDIS_PREFIX = "@ecwt:";
function getAllKeysList(value) {
  const keys = [];
  for (const key in value) {
    keys.push(key);
  }
  return keys.sort().join(",");
}
var redisClient = (0, import_redis.createClient)();
var redis_client_constructor_name = redisClient.constructor.name;
var redis_client_keys = getAllKeysList(redisClient);
var EcwtFactory = class {
  #redisClient;
  #lruCache;
  #snowflakeFactory;
  #redis_keys = {};
  #encryption_key;
  #schema;
  #schema_keys_sorted;
  /**
   *
   * @param {object} param0 -
   * @param {import('redis').RedisClientType} [param0.redisClient] RedisClient instance. If not provided, tokens will not be revoked and cannot be checked for revocation.
   * @param {LRUCache} [param0.lruCache] LRUCache instance. If not provided, tokens will be decrypted every time they are verified.
   * @param {SnowflakeFactory} param0.snowflakeFactory SnowflakeFactory instance.
   * @param {object} param0.options -
   * @param {string} [param0.options.namespace] Namespace for Redis keys.
   * @param {Buffer} param0.options.key Encryption key, 64 bytes
   * @param {{ [key: string]: (value: any) => boolean }} param0.options.schema Schema for token data. Each property is a validator function that returns true if value is valid.
   */
  constructor({
    redisClient: redisClient2 = null,
    lruCache = null,
    snowflakeFactory,
    options: {
      namespace = null,
      key,
      schema = {}
    }
  }) {
    if (redisClient2 !== null && (redisClient2.constructor.name !== redis_client_constructor_name || getAllKeysList(redisClient2) !== redis_client_keys)) {
      throw new InvalidPackageInstanceError(
        "redisClient",
        "Commander extends RedisClient",
        "redis"
      );
    }
    this.#redisClient = redisClient2;
    if (lruCache !== null && lruCache instanceof import_lru_cache.LRUCache !== true) {
      throw new InvalidPackageInstanceError(
        "lruCache",
        "LRUCache",
        "lru-cache"
      );
    }
    this.#lruCache = lruCache;
    if (snowflakeFactory instanceof import_snowflake.SnowflakeFactory !== true) {
      throw new InvalidPackageInstanceError(
        "snowflakeFactory",
        "SnowflakeFactory",
        "@kirick/snowflake"
      );
    }
    this.#snowflakeFactory = snowflakeFactory;
    this.#redis_keys.revoked = `${REDIS_PREFIX}${namespace}:revoked`;
    this.#encryption_key = key;
    this.#schema = schema;
    this.#schema_keys_sorted = Object.keys(schema).sort();
  }
  /**
   * Creates new token.
   * @async
   * @param {object} data Data to be stored in token.
   * @param {object} [options] -
   * @param {number} [options.ttl] Time to live in seconds. By default, token will never expire.
   * @returns {Promise<Ecwt>} -
   */
  async create(data, {
    ttl
  } = {}) {
    const payload = [];
    for (const key of this.#schema_keys_sorted) {
      const value = data[key];
      const validator = this.#schema[key];
      if (typeof validator === "function" && validator(value) !== true) {
        throw new TypeError(`Value "${value}" of property "${key}" is invalid.`);
      }
      payload.push(value);
    }
    if (typeof ttl !== "number" && Number.isNaN(ttl) !== true && ttl !== null) {
      throw new TypeError("TTL must be a number or null.");
    }
    const snowflake = await this.#snowflakeFactory.createSafe();
    const token_raw = (0, import_cbor_x.encode)([
      snowflake.toBuffer(),
      ttl,
      payload
    ]);
    const token_encrypted = await import_evilcrypt.v2.encrypt(
      token_raw,
      this.#encryption_key
    );
    const token = base62.encode(token_encrypted);
    this.#setCache(
      token,
      {
        snowflake,
        ttl_initial: ttl,
        data
      }
    );
    return new Ecwt(
      this,
      {
        token,
        snowflake,
        ttl_initial: ttl,
        data
      }
    );
  }
  #setCache(token, data) {
    this.#lruCache?.set(
      token,
      data,
      {
        ttl: data.ttl * 1e3
      }
    );
  }
  /**
   * Parses token.
   * @async
   * @param {string} token String representation of token.
   * @returns {Promise<Ecwt>} -
   */
  async verify(token) {
    if (typeof token !== "string") {
      throw new TypeError("Token must be a string.");
    }
    let snowflake;
    let ttl_initial;
    let data;
    const cached_entry = this.#lruCache?.info(token);
    if (cached_entry === void 0) {
      const token_encrypted = Buffer.from(
        base62.decode(token)
      );
      const token_raw = await (0, import_evilcrypt.decrypt)(
        token_encrypted,
        this.#encryption_key
      );
      const [
        snowflake_buffer,
        _ttl_initial,
        payload
      ] = (0, import_cbor_x.decode)(token_raw);
      snowflake = this.#snowflakeFactory.parse(snowflake_buffer);
      ttl_initial = _ttl_initial;
      data = {};
      for (const [index, key] of this.#schema_keys_sorted.entries()) {
        data[key] = payload[index];
      }
      this.#setCache(
        token,
        {
          snowflake,
          ttl_initial,
          data
        }
      );
    } else {
      ({
        snowflake,
        ttl_initial,
        data
      } = cached_entry.value);
    }
    const ecwt = new Ecwt(
      this,
      {
        token,
        snowflake,
        ttl_initial,
        data
      }
    );
    if (typeof ttl_initial === "number" && Number.isNaN(ttl_initial) !== true && snowflake.timestamp + ttl_initial * 1e3 < Date.now()) {
      throw new EcwtExpiredError(ecwt);
    }
    if (this.#redisClient) {
      const score = await this.#redisClient.ZSCORE(
        this.#redis_keys.revoked,
        ecwt.id
      );
      if (score !== null) {
        throw new EcwtRevokedError(ecwt);
      }
    }
    return ecwt;
  }
  /**
   * Revokes token.
   * @async
   * @param {object} options -
   * @param {string} options.token_id -
   * @param {number} options.ts_ms_created -
   * @param {number} options.ttl_initial -
   * @returns {Promise<void>} -
   */
  async _revoke({
    token_id,
    ts_ms_created,
    ttl_initial
  }) {
    if (this.#redisClient) {
      ttl_initial = ttl_initial ?? Number.MAX_SAFE_INTEGER;
      const ts_ms_expired = ts_ms_created + ttl_initial * 1e3;
      if (ts_ms_expired > Date.now()) {
        await this.#redisClient.sendCommand([
          "ZADD",
          this.#redis_keys.revoked,
          String(ts_ms_expired),
          token_id
        ]);
      }
    } else {
      console.warn("[ecwt] Redis client is not provided. Tokens cannot be revoked.");
    }
  }
  /**
   * Purges cache.
   * @private
   * @returns {void} -
   */
  _purgeCache() {
    this.#lruCache?.clear();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Ecwt,
  EcwtExpiredError,
  EcwtFactory,
  EcwtInvalidError,
  EcwtRevokedError
});
