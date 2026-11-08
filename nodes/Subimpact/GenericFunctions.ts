import type { IDataObject, IHttpRequestOptions, INodeExecutionData } from 'n8n-workflow';

export const APIFY_API_BASE_URL = 'https://api.apify.com/v2';

export const SUBIMPACT_CREDENTIAL_NAME = 'subimpactApifyApi';

export const ACTOR_IDS = {
	googleSerp: 'subimpact~google-serp-ai-overviews',
	googleAiMode: 'subimpact~google-ai-mode-scraper',
	foodDelivery: 'subimpact~foodpanda-reviews-api',
} as const;

export type SubimpactResource = keyof typeof ACTOR_IDS;

export type SubimpactOperation = 'runSync' | 'startRun' | 'getDatasetItems';

/** Apify's run-sync endpoints accept a timeout of at most 300 seconds. */
export const MAX_WAIT_TIMEOUT_SECONDS = 300;

export const DEFAULT_WAIT_TIMEOUT_SECONDS = 300;

export type ParameterGetter = (name: string) => unknown;

/**
 * Splits a multi-line (or array) parameter into a trimmed list of non-empty strings.
 * Array input is passed through with trimming so pre-set values keep working.
 */
export function splitList(value: unknown, separator: RegExp = /\r?\n/): string[] {
	if (Array.isArray(value)) {
		return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
	}

	if (typeof value === 'string') {
		return value
			.split(separator)
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
	}

	return [];
}

/** One query per line, so commas inside a query are preserved. */
export function parseQueries(value: unknown): string[] {
	return splitList(value);
}

/** Restaurant codes are comma or newline separated. */
export function parseCodeList(value: unknown): string[] {
	return splitList(value, /[\r\n,]/);
}

/** URLs and locations are newline separated so commas inside them are preserved. */
export function parseLineList(value: unknown): string[] {
	return splitList(value);
}

export function normalizeTimeoutSeconds(value: unknown): number {
	const parsed = Number(value);

	if (!Number.isFinite(parsed)) {
		return DEFAULT_WAIT_TIMEOUT_SECONDS;
	}

	return Math.min(MAX_WAIT_TIMEOUT_SECONDS, Math.max(1, Math.trunc(parsed)));
}

export function buildActorInput(resource: SubimpactResource, get: ParameterGetter): IDataObject {
	switch (resource) {
		case 'googleSerp': {
			return {
				queries: parseQueries(get('serpQueries')),
				gl: String(get('serpCountry') ?? '').trim() || 'us',
				hl: String(get('serpLanguage') ?? '').trim() || 'en',
				maxResults: Number(get('maxResults')),
				mobile: get('device') === 'mobile',
			};
		}

		case 'googleAiMode': {
			const input: IDataObject = {
				queries: parseQueries(get('aiModeQueries')),
				gl: String(get('aiModeCountry') ?? '').trim() || 'us',
				hl: String(get('aiModeLanguage') ?? '').trim() || 'en',
				backend: String(get('backend') ?? 'android'),
				skipCache: get('skipCache') === true,
			};

			const location = String(get('location') ?? '').trim();
			if (location.length > 0) {
				input.location = location;
			}

			return input;
		}

		case 'foodDelivery': {
			const input: IDataObject = {
				country: String(get('foodCountry') ?? '').trim() || 'my',
				maxRestaurantsPerLocation: Number(get('maxRestaurantsPerLocation')),
				maxReviewsPerVendor: Number(get('maxReviewsPerVendor')),
				maxTotalReviews: Number(get('maxTotalReviews')),
			};

			const vendorCodes = parseCodeList(get('vendorCodes'));
			if (vendorCodes.length > 0) {
				input.vendorCodes = vendorCodes;
			}

			const vendorUrls = parseLineList(get('vendorUrls'));
			if (vendorUrls.length > 0) {
				input.vendorUrls = vendorUrls;
			}

			const locations = parseLineList(get('locations'));
			if (locations.length > 0) {
				input.locations = locations;
			}

			return input;
		}
	}
}

export function buildRunSyncRequest(
	actorId: string,
	input: IDataObject,
	waitTimeoutSeconds: unknown,
): IHttpRequestOptions {
	return {
		method: 'POST',
		url: `${APIFY_API_BASE_URL}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`,
		qs: { timeout: normalizeTimeoutSeconds(waitTimeoutSeconds) },
		body: input,
		json: true,
	};
}

export function buildStartRunRequest(actorId: string, input: IDataObject): IHttpRequestOptions {
	return {
		method: 'POST',
		url: `${APIFY_API_BASE_URL}/acts/${encodeURIComponent(actorId)}/runs`,
		body: input,
		json: true,
	};
}

export function buildDatasetItemsRequest(datasetId: string): IHttpRequestOptions {
	return {
		method: 'GET',
		url: `${APIFY_API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/items`,
		qs: { format: 'json', clean: 'true' },
		json: true,
	};
}

/**
 * Run-sync and dataset endpoints return an array of dataset items.
 * Start run returns an object that wraps the run in `data`.
 */
export function toExecutionItems(response: unknown): INodeExecutionData[] {
	if (Array.isArray(response)) {
		return response.map((entry) => ({ json: entry as IDataObject }));
	}

	if (response !== null && typeof response === 'object') {
		const data = (response as IDataObject).data;

		if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
			return [{ json: data as IDataObject }];
		}

		return [{ json: response as IDataObject }];
	}

	return [{ json: { value: response } as IDataObject }];
}
