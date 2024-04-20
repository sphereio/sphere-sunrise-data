import { deleteAllCarts } from './carts'
import {
  deleteAllCategories,
  importCategories
} from './categories'
import { deleteChannels, importChannels } from './channels'
import { deleteStores, importStores } from './stores'
import {
  deleteAllCustomers,
  deleteCustomerGroups,
  importCustomerGroups,
  importCustomers
} from './customers'
import { deleteInventory } from './inventory'
import {
  deleteAllLineItemStates,
  importLineItemStates
} from './lineitem-states'
import {
  importProductStates,
  deleteAllProductStates
} from './product-states'
import { deleteAllOrders, importOrders } from './orders'
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
  deleteStandalonePrice,
  importStandalonePrice
} from './standalonePrice'
const nconf = require('nconf')

const taskReducer = (result, fn) => result.then(fn)

const deleteAllData = () => {
  // eslint-disable-next-line no-console
  console.log('--Deleting all project data--')
  return [
    deleteAllProducts,
    deleteAllProductTypes,
    deleteAllCategories,
    deleteInventory,
    deleteAllOrders,
    deleteAllCarts,
    deleteAllLineItemStates,
    deleteAllProductStates,
    deleteAllCustomers,
    deleteCustomerGroups,
    deleteStores,
    deleteAllShippingMethods,
    deleteAllZones,
    deleteTaxCategories,
    deleteChannels,
    deleteTypes,
    deleteStandalonePrice
  ].reduce(taskReducer, Promise.resolve())
}

const importAllData = () => {
  // eslint-disable-next-line no-console
  console.log('--Importing all project data--')
  return [
    importTypes,
    importChannels,
    importTaxCategories,
    importZones,
    importProjectData,
    importLineItemStates,
    importProductStates,
    importStores,
    importShippingMethods,
    importCustomerGroups,
    importCustomers,
    importCategories,
    importProductTypes,
    importProducts,
    importStandalonePrice,
    // importing 150k inventory items takes too long
    //   it can be imported with npm run import:inventory
    // importInventory,
    importOrders
  ].reduce(taskReducer, Promise.resolve())
}

const deleteAndImport = () =>
  [deleteAllData, importAllData].reduce(
    taskReducer,
    Promise.resolve()
  )

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
