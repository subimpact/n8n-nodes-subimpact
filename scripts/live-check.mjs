/**
 * Live check without n8n.
 *
 * Loads the built node class, executes it with a minimal IExecuteFunctions-style
 * context whose HTTP helper talks to the real Apify API, and prints item counts.
 *
 * Usage: APIFY_API_TOKEN=<your token> node scripts/live-check.mjs
 * The API token is read from APIFY_API_TOKEN and is never printed.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const { Subimpact } = require('../dist/nodes/Subimpact/Subimpact.node.js');
const { SUBIMPACT_CREDENTIAL_NAME } = require('../dist/nodes/Subimpact/GenericFunctions.js');

const token = process.env.APIFY_API_TOKEN;

if (!token) {
	console.error('APIFY_API_TOKEN is not set. Export your Apify token first.');
	process.exit(1);
}

function buildUrl(requestOptions) {
	const url = new URL(requestOptions.url);
	for (const [key, value] of Object.entries(requestOptions.qs ?? {})) {
		url.searchParams.set(key, String(value));
	}
	return url;
}

async function httpRequestWithAuthentication(_credentialName, requestOptions) {
	const url = buildUrl(requestOptions);
	const response = await fetch(url, {
		method: requestOptions.method ?? 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
	});

	const text = await response.text();
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		payload = text;
	}

	if (!response.ok) {
		const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
		throw new Error(`HTTP ${response.status} ${response.statusText}: ${detail.slice(0, 500)}`);
	}

	return payload;
}

function createContext(params, requests) {
	return {
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
		continueOnFail: () => false,
		helpers: {
			httpRequestWithAuthentication: async (credentialName, requestOptions) => {
				requests.push({ credentialName, requestOptions });
				return await httpRequestWithAuthentication(credentialName, requestOptions);
			},
		},
	};
}

const cases = [
	{
		label: 'Google SERP + AI Overviews, 1 query',
		params: {
			resource: 'googleSerp',
			operation: 'runSync',
			serpQueries: 'best crm for startups',
			serpCountry: 'us',
			serpLanguage: 'en',
			device: 'desktop',
			maxResults: 10,
			waitTimeoutSecs: 300,
		},
	},
	{
		label: 'Google AI Mode, 1 query',
		params: {
			resource: 'googleAiMode',
			operation: 'runSync',
			aiModeQueries: 'best crm for startups',
			aiModeCountry: 'us',
			aiModeLanguage: 'en',
			location: '',
			backend: 'android',
			skipCache: false,
			waitTimeoutSecs: 300,
		},
	},
	{
		label: 'foodpanda reviews, vendorCodes ["m1zd"], country my, maxTotalReviews 5',
		params: {
			resource: 'foodDelivery',
			operation: 'runSync',
			vendorCodes: 'm1zd',
			vendorUrls: '',
			locations: '',
			foodCountry: 'my',
			maxRestaurantsPerLocation: 20,
			maxReviewsPerVendor: 0,
			maxTotalReviews: 5,
			waitTimeoutSecs: 300,
		},
	},
];

const node = new Subimpact();
console.log(`Node loaded: ${node.description.displayName} (${node.description.name})`);
console.log(`Credential: ${SUBIMPACT_CREDENTIAL_NAME}`);
console.log('');

let failures = 0;

for (const testCase of cases) {
	const requests = [];
	const context = createContext(testCase.params, requests);
	const startedAt = Date.now();

	console.log(`== ${testCase.label}`);

	try {
		const result = await node.execute.call(context);
		const items = result[0];
		const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
		const request = requests[0]?.requestOptions;

		console.log(`   request: ${request?.method} ${buildUrl(request).toString()}`);
		console.log(`   body: ${JSON.stringify(request?.body)}`);
		console.log(`   elapsed: ${elapsed}s`);
		console.log(`   item count: ${items.length}`);

		if (items.length > 0) {
			console.log(`   first item keys: ${Object.keys(items[0].json).join(', ')}`);
		}

		if (items.length === 0) {
			console.log('   WARNING: the actor returned zero items');
		}
	} catch (error) {
		failures += 1;
		const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
		console.log(`   elapsed: ${elapsed}s`);
		console.log(`   FAILED: ${error.message}`);
	}

	console.log('');
}

if (failures > 0) {
	console.error(`${failures} of ${cases.length} live checks failed`);
	process.exit(1);
}

console.log(`All ${cases.length} live checks returned items.`);
