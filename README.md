# n8n-nodes-subimpact

n8n community node package for three Subimpact Apify actors. Each run returns one n8n item per dataset item, so you can map the actor output straight into the rest of your workflow.

Actors included:

| Node resource | Apify actor | Store page |
| --- | --- | --- |
| Google Search (SERP + AI Overviews) | `subimpact~google-serp-ai-overviews` | https://apify.com/subimpact/google-serp-ai-overviews |
| Google AI Mode Answer | `subimpact~google-ai-mode-scraper` | https://apify.com/subimpact/google-ai-mode-scraper |
| Food Delivery Review | `subimpact~foodpanda-reviews-api` | https://apify.com/subimpact/foodpanda-reviews-api |

More actors from the same publisher: https://apify.com/subimpact

## Installation

In n8n, open **Settings > Community Nodes**, choose **Install**, and enter:

```text
n8n-nodes-subimpact
```

Self-hosted n8n installations can also install the package with npm in their n8n user folder. The package has no runtime dependencies outside n8n itself.

## Credential setup

The node uses one credential, **Subimpact Apify API**, with a single field:

- **API Token**: your Apify API token.

Get the token from https://console.apify.com/settings/integrations and paste it into the credential. The credential test calls `GET https://api.apify.com/v2/users/me` with `Authorization: Bearer <token>`.

All actor runs are executed on your own Apify account with this token.

## Operations

Each resource supports three operations:

- **Run and Get Results**: calls `POST /v2/acts/<actorId>/run-sync-get-dataset-items?timeout=<seconds>` and returns the dataset items. The wait timeout is configurable from 1 to 300 seconds and defaults to 300.
- **Start Run**: calls `POST /v2/acts/<actorId>/runs` and returns the run object, including `id` and `defaultDatasetId`, without waiting for the run to finish.
- **Get Dataset Items**: calls `GET /v2/datasets/<datasetId>/items` and returns the items of an existing dataset.

Use **Start Run** and then **Get Dataset Items** for jobs that take longer than 300 seconds.

## Inputs

The node sends the same input property names that the actors document in their input schemas. Only the fields below are set by the node, other actor inputs keep their actor defaults.

### Google Search (SERP + AI Overviews)

| Node field | Actor input | Notes |
| --- | --- | --- |
| Queries | `queries` | One query per line |
| Country | `gl` | Two letter country code, default `us` |
| Language | `hl` | Language code, default `en` |
| Device | `mobile` | Desktop maps to `false`, Mobile maps to `true` |
| Max Results | `maxResults` | Organic results per query, 1 to 10 |

### Google AI Mode Answer

| Node field | Actor input | Notes |
| --- | --- | --- |
| Queries | `queries` | One question per line |
| Country | `gl` | Two letter country code, default `us` |
| Language | `hl` | Language code, default `en` |
| Location | `location` | Optional Google canonical location, omitted when empty |
| Backend | `backend` | `android` (default) or `http` |
| Skip Cache | `skipCache` | Always fetch a fresh answer |

### Food Delivery Review

| Node field | Actor input | Notes |
| --- | --- | --- |
| Restaurant Codes | `vendorCodes` | Comma or newline separated restaurant codes |
| Restaurant URLs | `vendorUrls` | Newline separated restaurant or reviews URLs |
| Locations | `locations` | City presets or `lat,lng` pairs, one per line |
| Country | `country` | Market code, default `my` |
| Max Restaurants per Location | `maxRestaurantsPerLocation` | Discovery mode only |
| Max Reviews per Restaurant | `maxReviewsPerVendor` | `0` means all available |
| Max Total Reviews | `maxTotalReviews` | Safety cap for the whole run, `0` means no cap |

## Example workflows

Importable workflow JSON files are in the `examples` folder:

- [Google Search with AI Overviews](examples/google-serp-ai-overviews.json)
- [Google AI Mode answers](examples/google-ai-mode.json)
- [Food delivery reviews](examples/foodpanda-reviews.json)

Import a file with **Workflows > Import from File**, open the Subimpact node, and select your **Subimpact Apify API** credential before executing.

Minimal SERP example:

```json
{
  "name": "Subimpact Google Search with AI Overviews",
  "nodes": [
    {
      "parameters": {},
      "name": "When clicking Execute Workflow",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [-220, 0]
    },
    {
      "parameters": {
        "resource": "googleSerp",
        "operation": "runSync",
        "serpQueries": "best crm for startups",
        "serpCountry": "us",
        "serpLanguage": "en",
        "device": "desktop",
        "maxResults": 10,
        "waitTimeoutSecs": 300
      },
      "name": "Subimpact Web Data",
      "type": "n8n-nodes-subimpact.subimpact",
      "typeVersion": 1,
      "position": [0, 0]
    }
  ],
  "connections": {
    "When clicking Execute Workflow": {
      "main": [[{ "node": "Subimpact Web Data", "type": "main", "index": 0 }]]
    }
  }
}
```

## Pricing

Each actor run is billed pay-per-result on the Apify account that owns the API token. The package does not include Apify usage, does not resell usage, and does not add an affiliate parameter to the actor calls. Check the Store page of each actor for its current pricing:

- https://apify.com/subimpact/google-serp-ai-overviews
- https://apify.com/subimpact/google-ai-mode-scraper
- https://apify.com/subimpact/foodpanda-reviews-api

## Development

```bash
npm install
npm run build
npm run lint
npm test
```

The tests use the built node classes and a stubbed HTTP helper, so they do not call the Apify API.

There is also a live check script that loads the built node and runs one request per actor against the real Apify API. It reads the token from `APIFY_API_TOKEN` and never prints it:

```bash
export APIFY_API_TOKEN=<your Apify API token>
node scripts/live-check.mjs
```

## License

[MIT](LICENSE)
