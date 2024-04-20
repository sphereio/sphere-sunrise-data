import { productsService } from './services'
import { execute } from './helpers'
import { deleteAllCarts } from './carts'
import {
  deleteAllCategories,
  importCategories
} from './categories'
import { deleteChannels, importChannels } from './channels'
import {
  deleteAllCustomers,
  deleteCustomerGroups,
  importCustomerGroups,
  importCustomers
} from './customers'
import { deleteInventory } from './inventory'
import { deleteAllLineItemStates } from './lineitem-states'
import { deleteAllOrders } from './orders'
import {
  deleteAllProducts,
  importProductTypes,
  importProducts,
  deleteAllProductTypes
} from './products'
import {
  deleteAllShippingMethods,
  importShippingMethods
} from './shipping-method'
import {
  deleteTaxCategories,
  importTaxCategories
} from './tax-categories'
import { deleteTypes, importTypes } from './types'
import { deleteAllZones, importZones } from './zones'
import { importProjectData } from './project-setup'
import {
  deleteAllProductDiscounts,
  importProductDiscounts
} from './product-discount'
import {
  deleteStandalonePrice,
  importStandalonePrice
} from './standalonePrice'
const nconf = require('nconf')
const later = (time, arg) =>
  new Promise((r) => setTimeout(() => r(arg), time))
const updateOrders = () => {
  const WAIT_TIME = 15000
  const recur = ([toUpdate, index]) => {
    if (index >= toUpdate.length) {
      return
    }
    return execute({
      uri: productsService.build(),
      method: 'GET'
    }).then((result) => {
      const productToUpdate = result?.body?.results.find(
        (p) =>
          p.masterData.current.masterVariant.sku ===
          toUpdate[index]
      )
      if (!productToUpdate) {
        return later(WAIT_TIME, [toUpdate, index]).then(
          recur
        )
      }
      return later(WAIT_TIME)
        .then(() =>
          execute({
            uri: productsService
              .byId(productToUpdate.id)
              .build(),
            method: 'POST',
            body: {
              version: productToUpdate.version,
              actions: [
                {
                  action: 'setDescription',
                  description:
                    productToUpdate.masterData.current.name,
                  staged: false
                }
              ]
            }
          })
        )
        .then(() => later(WAIT_TIME))
        .then(() => recur([toUpdate, index + 1]))
    })
  }
  // eslint-disable-next-line no-console
  console.log(
    '\x1b[32m%s\x1b[0m',
    'Updating products (this could take a minute)'
  )
  return recur([['M0E20000000ELAJ', 'M0E20000000ELBX'], 0])
}

const taskReducer = (result, fn) => result.then(fn)

const deleteAllData = () => {
  // eslint-disable-next-line no-console
  console.log('--Deleting all project data--')
  return [
    deleteAllProductDiscounts,
    deleteAllProducts,
    deleteAllProductTypes,
    deleteAllCategories,
    deleteInventory,
    deleteAllOrders,
    deleteAllCarts,
    deleteAllLineItemStates,
    deleteAllCustomers,
    deleteCustomerGroups,
    deleteAllShippingMethods,
    deleteAllZones,
    deleteTaxCategories,
    deleteChannels,
    deleteTypes,
    deleteStandalonePrice
  ].reduce(taskReducer, Promise.resolve())
}
const importCIProducts = () =>
  importProducts(
    './data/products-ci.csv',
    undefined,
    undefined
  )
const importAllData = () => {
  // eslint-disable-next-line no-console
  console.log('--Importing all project data--')
  return [
    importTypes,
    importChannels,
    importTaxCategories,
    importZones,
    importProjectData,
    importShippingMethods,
    importCustomerGroups,
    importCustomers,
    importCategories,
    importProductTypes,
    importCIProducts,
    importProductDiscounts,
    importStandalonePrice
    // importing 150k inventory items takes too long
    //   it can be imported with npm run import:inventory
    // importInventory,
    // importOrders
  ].reduce(taskReducer, Promise.resolve())
}

const deleteAndImport = () =>
  [
    deleteAllData, // delete
    importAllData, // create
    updateOrders // update orders so last update is set correctly
  ].reduce(taskReducer, Promise.resolve())

if (nconf.get('all:clean')) {
  deleteAllData().then(() =>
    // eslint-disable-next-line no-console
    console.log('--The project data is deleted--')
  )
} else if (nconf.get('all:import')) {
  importAllData().then(() =>
    // eslint-disable-next-line no-console
    console.log('--All data is imported--')
  )
} else if (nconf.get('start')) {
  deleteAndImport().then(() =>
    // eslint-disable-next-line no-console
    console.log('--All data is imported--')
  )
}
