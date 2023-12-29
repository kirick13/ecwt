
import { toSeconds } from './utils/time.js';

/**
 * @typedef {import('@kirick/snowflake').Snowflake} Snowflake
 * @typedef {import('./factory.js').EcwtFactory} EcwtFactory
 */

/**
 * Assigns property to object.
 * @param {object} target -
 * @param {string} key -
 * @param {any} value -
 */
function assign(target, key, value) {
	Object.defineProperty(
		target,
		key,
		{
			value,
			enumerable: true,
			writable: false,
			configurable: false,
		},
	);
}

export class Ecwt {
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
	constructor(
		ecwtFactory,
		{
			token,
			snowflake,
			ttl_initial,
			data,
		},
	) {
		this.#ecwtFactory = ecwtFactory;

		this.#ttl_initial = ttl_initial;

		assign(this, 'token', token);
		assign(
			this,
			'id',
			snowflake.toBase62(),
		);
		assign(this, 'snowflake', snowflake);
		assign(
			this,
			'ts_expired',
			this.#getTimestampExpired(),
		);
		assign(
			this,
			'data',
			Object.freeze(data),
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

	/* async */ revoke() {
		return this.#ecwtFactory._revoke({
			token_id: this.id,
			ts_ms_created: this.snowflake.timestamp,
			ttl_initial: this.#ttl_initial,
		});
	}
}
