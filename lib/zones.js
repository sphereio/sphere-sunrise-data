import { config } from './config';
import { client, zonesService } from './services';
import { createClient } from '@commercetools/sdk-client';
import { createAuthMiddlewareForClientCredentialsFlow } from '@commercetools/sdk-middleware-auth';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http'

import { createRequestBuilder } from '@commercetools/api-request-builder';

export const zones = {
    "name": "Europe",
    "description": "",
    "locations": [{ "country": "AT", "state": "" },
    { "country": "DE", "state": "" }
    ]
};

const addZones = () => {
    const updateRequest = {
        uri: zonesService.build(),
        method: 'POST',
        body: zones
    }

    client.execute(updateRequest)
        .then(result => console.log(result))
        .catch(error => console.log(error.body.errors));
}

addZones();