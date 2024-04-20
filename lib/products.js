import { SingleBar, Presets } from 'cli-progress'
import {
  productsService,
  productTypesService,
  customerGroupService,
  channelsService
} from './services'
import {
  execute,
  NONE,
  getAll,
  setByKey,
  setBy,
  readJson,
  logAndExit,
  createStandardDelete
} from './helpers'
import { ignoreProducts } from './ignoreProducts'

require('dotenv').config()
const nconf = require('nconf')

export const deleteAllProducts = createStandardDelete({
  itemName: 'products',
  service: productsService,
  deleteFunction: (product) =>
    Promise.resolve(
      product.masterData.published
        ? execute({
            uri: productsService.byId(product.id).build(),
            method: 'POST',
            body: {
              version: product.version,
              actions: [
                {
                  action: 'unpublish'
                }
              ]
            }
          }).then(({ body }) => body)
        : product
    ).then((product) =>
      execute({
        uri: productsService
          .byId(product.id)
          .withVersion(product.version)
          .build(),
        method: 'DELETE'
      })
    )
})

export const deleteAllProductTypes = createStandardDelete({
  itemName: 'product types',
  service: productTypesService
})

export const importProductTypes = (
  typesPath = './data/product-type.json'
) =>
  readJson(typesPath)
    .then((productTypes) =>
      Promise.all(
        productTypes.map((element) => {
          const updateRequest = {
            uri: productTypesService.build(),
            method: 'POST',
            body: element
          }
          return execute(updateRequest)
        })
      )
    )
    .then(() =>
      // eslint-disable-next-line no-console
      console.log(
        '\x1b[32m%s\x1b[0m',
        'Product types imported'
      )
    )
    .catch((error) =>
      logAndExit(error, 'Failed to import product types')
    )
const asSlugsEn = (categoryString) =>
  categoryString
    .toLowerCase()
    .split(';')
    .filter((c) => c)
    .map((c) => c.replace(/>|\s/g, '-'))
const withCategories = (allCategories, categories) =>
  asSlugsEn(categories).map((slug) => {
    const category = allCategories.get(slug)
    if (!category) {
      throw new Error(
        `Cannot find category for slug:${slug}`
      )
    }
    return { key: category.key }
  })
const groupProducts = (products) =>
  products
    .map((p) => ({
      ...p,
      variantIdNum: Number(p.variantId)
    }))
    .reduce((grouped, product) => {
      if (product.variantIdNum === 1) {
        grouped.push([product])
        return grouped
      }
      grouped[grouped.length - 1].push(product)
      return grouped
    }, [])

const toPrice =
  (customerGroups, channels) => (stringPrice) => {
    const [currencyCode, amount, custGroup] =
      stringPrice.split(/\s/)
    const [newAmount, channel] = amount.split('#')
    const [cntry, newCurrencyCode] = currencyCode.split(/-/)
    const channelInfo = channel && {
      channel: {
        typeId: 'channel',
        id: channels.get(channel).id
      }
    }
    let centAmount = Number(channel ? newAmount : amount)
    // eslint-disable-next-line no-restricted-globals
    if (isNaN(centAmount)) {
      // prices like 1|2; 2 will be ignored
      centAmount = Number(
        (channel ? newAmount : amount).split('|')[0]
      )
    }
    const customerGroup = custGroup
      ? {
          customerGroup: {
            typeId: 'customer-group',
            id: customerGroups.get(custGroup).id
          }
        }
      : {}
    const country = newCurrencyCode
      ? { country: cntry }
      : {}
    return {
      value: {
        currencyCode: newCurrencyCode || currencyCode,
        centAmount
      },
      ...customerGroup,
      ...country,
      ...channelInfo
    }
  }
const toPrices = (stringPrices, customerGroups, channels) =>
  stringPrices
    .split(';')
    .map(toPrice(customerGroups, channels))
    .filter((x) => x)

const toImage = (url) => ({
  url,
  dimensions: {
    w: 0,
    h: 0
  }
})
const removeEmpty = (o) => {
  const ret = Object.entries(o).reduce(
    (result, [key, value]) =>
      value !== ''
        ? ((result[key] = value), result)
        : result,
    {}
  )
  return Object.keys(ret).length === 0 ? NONE : ret
}
const noAllEmpty = (o) =>
  Object.keys(o).length === 0 ? undefined : o
const toImages = (images) => images.split(';').map(toImage)
const toAttribute = (
  attributeName,
  value,
  attributeType
) => {
  if (value === undefined || value === '') {
    return NONE
  }
  if (attributeType.name === 'boolean') {
    value = value === 'TRUE'
  }
  // "dateTime","lenum", "enum" and "text" don't need anything
  if (attributeType.name === 'set') {
    if (attributeType.elementType.name === 'text') {
      return {
        name: attributeName,
        value: value.split(';').filter((x) => x)
      }
    }
    // details is set of ltext but does not have a value for any product
    //  therefor it is ignored for now
    return NONE
  }
  if (attributeType.name === 'ltext') {
    value = removeEmpty(value)
    if (Object.keys(value).length === 0) {
      return NONE
    }
  }

  return {
    name: attributeName,
    value
  }
}
const createVariant =
  (
    customerGroups,
    channels,
    attributesByType,
    productType
  ) =>
  (product) => {
    const { variantId, sku, prices, images, variantKey } =
      product
    return {
      id: Number(variantId),
      key: variantKey || sku,
      attributes: attributesByType
        .get(productType)
        .map(([attributeName, attributeType]) =>
          toAttribute(
            attributeName,
            product[attributeName],
            attributeType
          )
        )
        .filter((attribute) => attribute !== NONE),
      sku,
      prices: toPrices(prices, customerGroups, channels),
      images: toImages(images)
    }
  }
const toProduct =
  (
    categoriesBySlug,
    customerGroups,
    channels,
    attributesByType
  ) =>
  (products) => {
    const {
      productType,
      tax,
      categories,
      name,
      baseId,
      slug
    } = products[0]
    if (Object.keys(removeEmpty(name)).length === 0) {
      return {
        type: NONE,
        products,
        rejected: 'empty name'
      }
    }
    if (Object.keys(removeEmpty(slug)).length === 0) {
      return {
        type: NONE,
        products,
        rejected: 'empty slug'
      }
    }
    const metaDescription = noAllEmpty(
      removeEmpty(products[0].description)
    )
    const metaTitle = noAllEmpty(
      removeEmpty(products[0].metaTitle)
    )
    const metaKeywords = noAllEmpty(
      removeEmpty(products[0].metaKeywords)
    )
    const mainProduct = {
      key: baseId,
      productType: { key: productType }, // is ok
      masterVariant: createVariant(
        customerGroups,
        channels,
        attributesByType,
        productType
      )(products[0]),
      taxCategory: {
        key: tax
      },
      categories: withCategories(
        categoriesBySlug,
        categories
      ),
      variants: products
        .slice(1)
        .map(
          createVariant(
            customerGroups,
            channels,
            attributesByType,
            productType
          )
        ),
      name: removeEmpty(name),
      slug: removeEmpty(slug),
      publish: true,
      metaDescription,
      metaTitle,
      metaKeywords
      //Uncomment the below line if you wish to set the priceMode to Standalone
      // priceMode: 'Standalone'
    }

    return mainProduct
  }

export const importProducts = (
  productPath = './data/products.csv',
  categoriesPath = './data/categories.csv',
  typesPath = './data/product-type.json',
  limit = Number.POSITIVE_INFINITY
) => {
  const csv = require('csvtojson')
  const notifySave = new SingleBar(
    {
      format:
        'Save products      {bar} |' +
        '| {percentage}% || {value}/{total} master variants',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591'
    },
    Presets.rect
  )
  return Promise.resolve()
    .then(() =>
      Promise.all(
        [productPath, categoriesPath]
          .map((path) => csv().fromFile(path))
          .concat([
            getAll(
              execute,
              customerGroupService
            )({
              method: 'GET'
            }),
            getAll(
              execute,
              channelsService
            )({
              method: 'GET'
            }),
            readJson(typesPath)
          ])
      )
    )
    .then(
      ([
        rawProducts,
        rawCategories,
        customerGroups,
        channels,
        productTypes
      ]) => {
        const categoriesBySlug = setBy((x) => x.slug.en)(
          rawCategories
        )
        const customerGroupsByKey = setByKey(customerGroups)
        const channelsByKey = setByKey(channels)
        const attributesByType = [
          ...setBy((x) => x.key)(productTypes).entries()
        ].reduce(
          (result, [key, value]) =>
            result.set(
              key,
              value.attributes.map((v) => [v.name, v.type])
            ),
          new Map()
        )
        const groupedProducts = groupProducts(
          rawProducts
        ).slice(0, limit)
        notifySave.start(groupedProducts.length, 0, {})
        let processed = 0
        const productsToSave = groupedProducts
          .map(
            toProduct(
              categoriesBySlug,
              customerGroupsByKey,
              channelsByKey,
              attributesByType
            )
          )
          .filter(
            (p) =>
              !ignoreProducts.includes(p.masterVariant.sku)
          )
        return Promise.all(
          productsToSave.map(
            // product => product
            (product) =>
              execute({
                uri: productsService.build(),
                method: 'POST',
                body: product
              }).then((item) => {
                notifySave.update(++processed)
                return item
              })
          )
        ).then(() => {
          notifySave.stop()
        })
      }
    )
    .then(() =>
      // eslint-disable-next-line no-console
      console.log('\x1b[32m%s\x1b[0m', 'Products imported')
    )
    .catch((reject) => {
      notifySave.stop()
      return logAndExit(reject, 'Failed to import products')
    })
}
if (nconf.get('clean')) {
  deleteAllProducts().then(deleteAllProductTypes)
} else if (nconf.get('importtypes')) {
  importProductTypes(nconf.get('types'))
} else if (nconf.get('import')) {
  // eslint-disable-next-line no-console
  console.log('\x1b[32m%s\x1b[0m', 'Importing products...')
  importProducts(
    nconf.get('csv'),
    nconf.get('categories'),
    nconf.get('types')
  )
}
