# Sunrise Data

[![Build Status](https://travis-ci.org/commercetools/commercetools-sunrise-data.svg?branch=master)](https://travis-ci.org/commercetools/commercetools-sunrise-data)

## Prerequisites

1. Access to a commercetools Project and the Merchant Center. If you do not have a commercetools Project, follow our [Getting started guide](https://docs.commercetools.com/getting-started/initial-setup).
2. [Node.js](https://nodejs.org/en/download/) (version 10 or later) must be installed on your computer.

## Setting up your Sunrise Data project

1. [Clone](https://help.github.com/articles/cloning-a-repository/) this repository to your computer.
2. Go to the root of the project, where `package.json` is located, and install all node dependencies with:

```
npm install
```

3. Go to service.js file -> right click on createRequestBuilder and Go to definition(F12)
   Add the below code in api-request-builder.cjs.js file any where in services or after line number 296

```
  standalonePrice: {
    type: 'standalone-price',
    endpoint: '/standalone-prices',
    features: [create, update, del, query, queryOne, queryExpand]
  }
```

4. [Create an API client](https://docs.commercetools.com/getting-started/create-api-client) in the Merchant Center.
5. Download the `Environment Variables (.env)` file.

![Client credential in dot env file ](img/client-credentails-in-dotenv.png)

6. Rename this file `.env` and move it to the root of the project.

![The .env file in Visual Studio Code](https://user-images.githubusercontent.com/77231096/172971883-372d4fdd-9d50-4711-ab57-36a0c38c6774.png)

## Commands

1. Clean all existing Project data and import new:

   ```
       npm run start
   ```

2. Clean project data:

   ```
       npm run clean:data
   ```

3. Import Project data:

   ```
       npm run import:data
   ```

4. Clean or import certain data _(e.g. Categories, Products, Customers, etc.)_

   ```
       npm run clean:categories
   ```

   or

   ```
       npm run import:products
   ```

   or

   ```
       npm run import:customers
   ```
