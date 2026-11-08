import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

const { Subimpact } = require('../dist/nodes/Subimpact/Subimpact.node.js');
const {
	DEFAULT_WAIT_TIMEOUT_SECONDS,
	MAX_WAIT_TIMEOUT_SECONDS,
	normalizeTimeoutSeconds,
} = require('../dist/nodes/Subimpact/GenericFunctions.js');

const ACTOR_URL = 'https://api.apify.com/v2/acts';
const DATASET_URL = 'https://api.apify.com/v2/datasets';

function createContext(params, httpResponse, options = {}) {
	const calls = [];
	const context = {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _itemIndex, fallback) =>
			Object.prototype.hasOwnProperty.call(params, name) ? params[name] : fallback,
		getNode: () => ({
			name: 'Subimpact Web Data',
			type: 'n8n-nodes-subimpact.subimpact',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		continueOnFail: () => options.continueOnFail === true,
		helpers: {
			httpRequestWithAuthentication: async function (credentialName, requestOptions) {
				calls.push({ credentialName, requestOptions, context: this });
				if (options.httpError) {
					throw options.httpError;
				}
				return httpResponse;
			},
		},
	};

	return { context, calls };
}

async function execute(params, httpResponse, options) {
	const node = new Subimpact();
	const { context, calls } = createContext(params, httpResponse, options);
	const result = await node.execute.call(context);
	return { items: result[0], calls, context };
}

test('SERP run-sync maps fields to actor input and dataset items to n8n items', async () => {
	const { items, calls, context } = await execute(
		{
			resource: 'googleSerp',
			operation: 'runSync',
			serpQueries: 'best crm for startups\nnotion vs obsidian\n',
			serpCountry: 'my',
			serpLanguage: 'en',
			device: 'mobile',
			maxResults: 7,
			waitTimeoutSecs: 42,
		},
		[{ query: 'best crm for startups' }, { query: 'notion vs obsidian' }],
	);

	assert.equal(calls.length, 1);
	assert.equal(calls[0].credentialName, 'subimpactApifyApi');
	assert.equal(calls[0].context, context);

	const { requestOptions } = calls[0];
	assert.equal(requestOptions.method, 'POST');
	assert.equal(
		requestOptions.url,
		`${ACTOR_URL}/subimpact~google-serp-ai-overviews/run-sync-get-dataset-items`,
	);
	assert.deepEqual(requestOptions.qs, { timeout: 42 });
	assert.deepEqual(requestOptions.body, {
		queries: ['best crm for startups', 'notion vs obsidian'],
		gl: 'my',
		hl: 'en',
		maxResults: 7,
		mobile: true,
	});

	assert.equal(items.length, 2);
	assert.deepEqual(items[0].json, { query: 'best crm for startups' });
	assert.deepEqual(items[1].json, { query: 'notion vs obsidian' });
	assert.deepEqual(items[0].pairedItem, { item: 0 });
});

test('SERP desktop device maps mobile to false', async () => {
	const { calls } = await execute(
		{
			resource: 'googleSerp',
			operation: 'runSync',
			serpQueries: 'one query',
			serpCountry: 'us',
			serpLanguage: 'en',
			device: 'desktop',
			maxResults: 10,
			waitTimeoutSecs: 300,
		},
		[],
	);

	assert.equal(calls[0].requestOptions.body.mobile, false);
	assert.equal(calls[0].requestOptions.body.maxResults, 10);
});

test('run-sync timeout is clamped to the Apify limit of 300 seconds', async () => {
	assert.equal(normalizeTimeoutSeconds(999), MAX_WAIT_TIMEOUT_SECONDS);
	assert.equal(normalizeTimeoutSeconds(0), 1);
	assert.equal(normalizeTimeoutSeconds('nonsense'), DEFAULT_WAIT_TIMEOUT_SECONDS);

	const { calls } = await execute(
		{
			resource: 'googleSerp',
			operation: 'runSync',
			serpQueries: 'q',
			serpCountry: 'us',
			serpLanguage: 'en',
			device: 'desktop',
			maxResults: 10,
			waitTimeoutSecs: 1000,
		},
		[],
	);

	assert.deepEqual(calls[0].requestOptions.qs, { timeout: 300 });
});

test('AI Mode maps queries, market, backend, cache and location', async () => {
	const { items, calls } = await execute(
		{
			resource: 'googleAiMode',
			operation: 'runSync',
			aiModeQueries: 'best crm for startups\nnotion vs obsidian',
			aiModeCountry: 'my',
			aiModeLanguage: 'en',
			location: 'Kuala Lumpur,Federal Territory of Kuala Lumpur,Malaysia',
			backend: 'http',
			skipCache: true,
			waitTimeoutSecs: 120,
		},
		[{ answer: 'first' }, { answer: 'second' }],
	);

	const { requestOptions } = calls[0];
	assert.equal(
		requestOptions.url,
		`${ACTOR_URL}/subimpact~google-ai-mode-scraper/run-sync-get-dataset-items`,
	);
	assert.deepEqual(requestOptions.qs, { timeout: 120 });
	assert.deepEqual(requestOptions.body, {
		queries: ['best crm for startups', 'notion vs obsidian'],
		gl: 'my',
		hl: 'en',
		backend: 'http',
		skipCache: true,
		location: 'Kuala Lumpur,Federal Territory of Kuala Lumpur,Malaysia',
	});
	assert.equal(items.length, 2);
});

test('AI Mode omits empty location', async () => {
	const { calls } = await execute(
		{
			resource: 'googleAiMode',
			operation: 'runSync',
			aiModeQueries: 'q',
			aiModeCountry: 'us',
			aiModeLanguage: 'en',
			location: '   ',
			backend: 'android',
			skipCache: false,
			waitTimeoutSecs: 300,
		},
		[],
	);

	assert.equal('location' in calls[0].requestOptions.body, false);
	assert.equal(calls[0].requestOptions.body.backend, 'android');
	assert.equal(calls[0].requestOptions.body.skipCache, false);
});

test('food delivery reviews map codes, URLs, market and caps', async () => {
	const { items, calls } = await execute(
		{
			resource: 'foodDelivery',
			operation: 'runSync',
			vendorCodes: 'm1zd, zqj6\nabc',
			vendorUrls: 'https://www.foodpanda.my/restaurant/m1zd/example/reviews',
			locations: '',
			foodCountry: 'my',
			maxRestaurantsPerLocation: 5,
			maxReviewsPerVendor: 10,
			maxTotalReviews: 5,
			waitTimeoutSecs: 300,
		},
		[{ reviewId: 'a' }, { reviewId: 'b' }],
	);

	const { requestOptions } = calls[0];
	assert.equal(
		requestOptions.url,
		`${ACTOR_URL}/subimpact~foodpanda-reviews-api/run-sync-get-dataset-items`,
	);
	assert.deepEqual(requestOptions.body, {
		country: 'my',
		maxRestaurantsPerLocation: 5,
		maxReviewsPerVendor: 10,
		maxTotalReviews: 5,
		vendorCodes: ['m1zd', 'zqj6', 'abc'],
		vendorUrls: ['https://www.foodpanda.my/restaurant/m1zd/example/reviews'],
	});
	assert.equal('locations' in requestOptions.body, false);
	assert.equal(items.length, 2);
});

test('food delivery discovery mode maps locations', async () => {
	const { calls } = await execute(
		{
			resource: 'foodDelivery',
			operation: 'runSync',
			vendorCodes: '',
			vendorUrls: '',
			locations: 'Kuala Lumpur\n3.1390,101.6869',
			foodCountry: 'sg',
			maxRestaurantsPerLocation: 20,
			maxReviewsPerVendor: 0,
			maxTotalReviews: 1000,
			waitTimeoutSecs: 300,
		},
		[],
	);

	assert.deepEqual(calls[0].requestOptions.body.locations, [
		'Kuala Lumpur',
		'3.1390,101.6869',
	]);
	assert.equal('vendorCodes' in calls[0].requestOptions.body, false);
	assert.equal(calls[0].requestOptions.body.country, 'sg');
});

test('start run posts to the runs endpoint and returns run metadata', async () => {
	const { items, calls } = await execute(
		{
			resource: 'googleSerp',
			operation: 'startRun',
			serpQueries: 'q',
			serpCountry: 'us',
			serpLanguage: 'en',
			device: 'desktop',
			maxResults: 10,
		},
		{
			data: {
				id: 'run123',
				status: 'READY',
				defaultDatasetId: 'dataset123',
			},
		},
	);

	const { requestOptions } = calls[0];
	assert.equal(
		requestOptions.url,
		`${ACTOR_URL}/subimpact~google-serp-ai-overviews/runs`,
	);
	assert.equal(requestOptions.method, 'POST');
	assert.equal('qs' in requestOptions, false);
	assert.deepEqual(items, [
		{
			json: { id: 'run123', status: 'READY', defaultDatasetId: 'dataset123' },
			pairedItem: { item: 0 },
		},
	]);
});

test('get dataset items uses the dataset endpoint and waits for a dataset ID', async () => {
	const { items, calls } = await execute(
		{
			resource: 'googleSerp',
			operation: 'getDatasetItems',
			datasetId: 'dataset123',
		},
		[{ reviewId: 'a' }],
	);

	const { requestOptions } = calls[0];
	assert.equal(requestOptions.method, 'GET');
	assert.equal(requestOptions.url, `${DATASET_URL}/dataset123/items`);
	assert.deepEqual(requestOptions.qs, { format: 'json', clean: 'true' });
	assert.equal(items.length, 1);
});

test('missing dataset ID fails before any HTTP call', async () => {
	const node = new Subimpact();
	const { context, calls } = createContext({
		resource: 'googleSerp',
		operation: 'getDatasetItems',
		datasetId: '  ',
	});

	await assert.rejects(() => node.execute.call(context), /Dataset ID is required/);
	assert.equal(calls.length, 0);
});

test('continueOnFail returns the error as an item instead of throwing', async () => {
	const { items } = await execute(
		{
			resource: 'googleSerp',
			operation: 'runSync',
			serpQueries: 'q',
			serpCountry: 'us',
			serpLanguage: 'en',
			device: 'desktop',
			maxResults: 10,
			waitTimeoutSecs: 300,
		},
		undefined,
		{ continueOnFail: true, httpError: new Error('Apify responded with 402') },
	);

	assert.equal(items.length, 1);
	assert.equal(items[0].json.error, 'Apify responded with 402');
});

test('HTTP errors are rethrown as node errors', async () => {
	const node = new Subimpact();
	const { context } = createContext(
		{
			resource: 'googleSerp',
			operation: 'runSync',
			serpQueries: 'q',
			serpCountry: 'us',
			serpLanguage: 'en',
			device: 'desktop',
			maxResults: 10,
			waitTimeoutSecs: 300,
		},
		undefined,
		{ httpError: new Error('Apify responded with 402') },
	);

	await assert.rejects(() => node.execute.call(context), /Apify responded with 402/);
});
