import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

import {
	ACTOR_IDS,
	buildActorInput,
	buildDatasetItemsRequest,
	buildRunSyncRequest,
	buildStartRunRequest,
	SUBIMPACT_CREDENTIAL_NAME,
	toExecutionItems,
	type SubimpactOperation,
	type SubimpactResource,
} from './GenericFunctions';

export class Subimpact implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Subimpact Web Data',
		name: 'subimpact',
		icon: {
			light: 'file:subimpact.svg',
			dark: 'file:subimpact.dark.svg',
		},
		usableAsTool: true,
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description:
			'Run Subimpact Apify actors for Google Search with AI Overviews, Google AI Mode answers and food delivery reviews. Pricing is pay-per-result on your own Apify account. Store pages: https://apify.com/subimpact/google-serp-ai-overviews, https://apify.com/subimpact/google-ai-mode-scraper, https://apify.com/subimpact/foodpanda-reviews-api.',
		defaults: {
			name: 'Subimpact Web Data',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: SUBIMPACT_CREDENTIAL_NAME,
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Google Search (SERP + AI Overviews)',
						value: 'googleSerp',
					},
					{
						name: 'Google AI Mode Answer',
						value: 'googleAiMode',
					},
					{
						name: 'Food Delivery Review',
						value: 'foodDelivery',
					},
				],
				default: 'googleSerp',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Run and Get Results',
						value: 'runSync',
						action: 'Run and get results',
						description:
							'Run the actor and wait for the dataset items, up to the wait timeout',
					},
					{
						name: 'Start Run',
						value: 'startRun',
						action: 'Start a run',
						description:
							'Start the actor without waiting and return the run ID and dataset ID',
					},
					{
						name: 'Get Dataset Items',
						value: 'getDatasetItems',
						action: 'Get dataset items',
						description: 'Fetch the items of an existing dataset by dataset ID',
					},
				],
				default: 'runSync',
			},

			// Google Search (SERP + AI Overviews)
			{
				displayName: 'Queries',
				name: 'serpQueries',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				placeholder: 'best crm for startups',
				description:
					'One search query per line. The actor accepts up to 1000 queries per run.',
				displayOptions: {
					show: {
						resource: ['googleSerp'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Country',
				name: 'serpCountry',
				type: 'string',
				default: 'us',
				description:
					'Two-letter country code for Google results, for example us, my or sg. Maps to the actor gl input.',
				displayOptions: {
					show: {
						resource: ['googleSerp'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Language',
				name: 'serpLanguage',
				type: 'string',
				default: 'en',
				description:
					'Google interface language code, for example en, de or pt-BR. Maps to the actor hl input.',
				displayOptions: {
					show: {
						resource: ['googleSerp'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Device',
				name: 'device',
				type: 'options',
				options: [
					{
						name: 'Desktop',
						value: 'desktop',
					},
					{
						name: 'Mobile',
						value: 'mobile',
					},
				],
				default: 'desktop',
				description:
					'Device the SERP is fetched with. Maps to the actor mobile flag.',
				displayOptions: {
					show: {
						resource: ['googleSerp'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Max Results',
				name: 'maxResults',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 10 },
				default: 10,
				description:
					'How many organic results to return per query, from 1 to 10',
				displayOptions: {
					show: {
						resource: ['googleSerp'],
						operation: ['runSync', 'startRun'],
					},
				},
			},

			// Google AI Mode
			{
				displayName: 'Queries',
				name: 'aiModeQueries',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				placeholder: 'best crm for startups',
				description:
					'One question per line. Write the questions in the same language as the Language setting.',
				displayOptions: {
					show: {
						resource: ['googleAiMode'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Country',
				name: 'aiModeCountry',
				type: 'string',
				default: 'us',
				description:
					'Two-letter country code for the market whose AI Mode answers you want. Maps to the actor gl input.',
				displayOptions: {
					show: {
						resource: ['googleAiMode'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Language',
				name: 'aiModeLanguage',
				type: 'string',
				default: 'en',
				description:
					'Language code for the interface and the answer, for example en, ar or ms. Maps to the actor hl input.',
				displayOptions: {
					show: {
						resource: ['googleAiMode'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: '',
				description:
					'Optional Google canonical location, for example Kuala Lumpur,Federal Territory of Kuala Lumpur,Malaysia. Leave empty for the main city of the country.',
				displayOptions: {
					show: {
						resource: ['googleAiMode'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Backend',
				name: 'backend',
				type: 'options',
				options: [
					{
						name: 'Android Chrome (Real AI Mode Tab)',
						value: 'android',
					},
					{
						name: 'Legacy Browserless (Classic SERP)',
						value: 'http',
					},
				],
				default: 'android',
				description:
					'Android Chrome renders the real AI Mode tab. The legacy backend only returns AI answers that Google embeds in the classic results page.',
				displayOptions: {
					show: {
						resource: ['googleAiMode'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Skip Cache',
				name: 'skipCache',
				type: 'boolean',
				default: false,
				description:
					'Whether to always fetch a fresh answer instead of serving a cached answer from the last hour',
				displayOptions: {
					show: {
						resource: ['googleAiMode'],
						operation: ['runSync', 'startRun'],
					},
				},
			},

			// Food delivery reviews
			{
				displayName: 'Restaurant Codes',
				name: 'vendorCodes',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				placeholder: 'm1zd',
				description:
					'Restaurant codes from foodpanda, Yemeksepeti or foodora URLs. Separate several codes with commas or new lines.',
				displayOptions: {
					show: {
						resource: ['foodDelivery'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Restaurant URLs',
				name: 'vendorUrls',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				placeholder: 'https://www.foodpanda.my/restaurant/m1zd/example/reviews',
				description:
					'Restaurant or reviews URLs. The code and market are read from the URL. Separate several URLs with new lines.',
				displayOptions: {
					show: {
						resource: ['foodDelivery'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Locations',
				name: 'locations',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				placeholder: 'Kuala Lumpur',
				description:
					'Discovery mode: city preset names or lat,lng pairs. Ignored when restaurant codes or URLs are set.',
				displayOptions: {
					show: {
						resource: ['foodDelivery'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Country',
				name: 'foodCountry',
				type: 'options',
				options: [
					{ name: 'Bangladesh (foodpanda.com.bd)', value: 'bd' },
					{ name: 'Cambodia (foodpanda.com.kh)', value: 'kh' },
					{ name: 'Czechia (foodora.cz)', value: 'cz' },
					{ name: 'Hong Kong (foodpanda.hk)', value: 'hk' },
					{ name: 'Hungary (foodora.hu)', value: 'hu' },
					{ name: 'Laos (foodpanda.la)', value: 'la' },
					{ name: 'Malaysia (foodpanda.my)', value: 'my' },
					{ name: 'Myanmar (foodpanda.com.mm)', value: 'mm' },
					{ name: 'Norway (foodora.no)', value: 'no' },
					{ name: 'Pakistan (foodpanda.pk)', value: 'pk' },
					{ name: 'Philippines (foodpanda.ph)', value: 'ph' },
					{ name: 'Singapore (foodpanda.sg)', value: 'sg' },
					{ name: 'Taiwan (foodpanda.com.tw)', value: 'tw' },
					{ name: 'Turkey (yemeksepeti.com)', value: 'tr' },
				],
				default: 'my',
				description: 'Market for the reviews API',
				displayOptions: {
					show: {
						resource: ['foodDelivery'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Max Restaurants per Location',
				name: 'maxRestaurantsPerLocation',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 20,
				description:
					'How many restaurants to take from the listing for each location. Only used in discovery mode.',
				displayOptions: {
					show: {
						resource: ['foodDelivery'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Max Reviews per Restaurant',
				name: 'maxReviewsPerVendor',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description:
					'Maximum reviews to fetch per restaurant. Set to 0 to fetch all available reviews.',
				displayOptions: {
					show: {
						resource: ['foodDelivery'],
						operation: ['runSync', 'startRun'],
					},
				},
			},
			{
				displayName: 'Max Total Reviews',
				name: 'maxTotalReviews',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 1000,
				description:
					'Safety cap on the total number of reviews across all restaurants in the run. Set to 0 for no cap.',
				displayOptions: {
					show: {
						resource: ['foodDelivery'],
						operation: ['runSync', 'startRun'],
					},
				},
			},

			// Shared options
			{
				displayName: 'Wait Timeout (Seconds)',
				name: 'waitTimeoutSecs',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 300 },
				default: 300,
				description:
					'How long to wait for the run to finish, from 1 to 300 seconds. Use Start Run for jobs that take longer.',
				displayOptions: {
					show: {
						operation: ['runSync'],
					},
				},
			},
			{
				displayName: 'Dataset ID',
				name: 'datasetId',
				type: 'string',
				default: '',
				required: true,
				description:
					'ID of the dataset to read. Start Run returns a defaultDatasetId that you can use here.',
				displayOptions: {
					show: {
						operation: ['getDatasetItems'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as SubimpactResource;
				const operation = this.getNodeParameter('operation', itemIndex) as SubimpactOperation;

				let requestOptions;

				if (operation === 'getDatasetItems') {
					const datasetId = String(
						this.getNodeParameter('datasetId', itemIndex, '') ?? '',
					).trim();

					if (datasetId.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Dataset ID is required to get dataset items',
							{ itemIndex },
						);
					}

					requestOptions = buildDatasetItemsRequest(datasetId);
				} else {
					const actorId = ACTOR_IDS[resource];

					if (actorId === undefined) {
						throw new NodeOperationError(
							this.getNode(),
							`Unknown resource: ${String(resource)}`,
							{ itemIndex },
						);
					}

					const input = buildActorInput(resource, (name) =>
						this.getNodeParameter(name, itemIndex),
					);

					requestOptions =
						operation === 'startRun'
							? buildStartRunRequest(actorId, input)
							: buildRunSyncRequest(
									actorId,
									input,
									this.getNodeParameter('waitTimeoutSecs', itemIndex, 300),
								);
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					SUBIMPACT_CREDENTIAL_NAME,
					requestOptions,
				);

				const newItems = toExecutionItems(response).map((entry) => ({
					...entry,
					pairedItem: { item: itemIndex },
				}));

				returnData.push(...newItems);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		}

		return [returnData];
	}
}
