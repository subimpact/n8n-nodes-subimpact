import type {
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class SubimpactApifyApi implements ICredentialType {
	name = 'subimpactApifyApi';

	displayName = 'Subimpact Apify API';

	icon: Icon = {
		light: 'file:subimpact.svg',
		dark: 'file:subimpact.dark.svg',
	};

	documentationUrl = 'https://console.apify.com/settings/integrations';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Apify API token. Create one at console.apify.com under Settings > Integrations.',
		},
	];

	authenticate = {
		type: 'generic' as const,
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.apify.com/v2',
			url: '/users/me',
			method: 'GET',
		},
	};
}
