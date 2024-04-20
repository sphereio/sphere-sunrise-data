import { standalonePriceService } from './services'
import { logAndExit, execute } from './helpers'
import { csv } from 'csvtojson'
import { SingleBar, Presets } from 'cli-progress'
import { createStandardDelete } from './helpers'

require('dotenv').config()
const nconf = require('nconf')

export const deleteStandalonePrice = createStandardDelete({
  itemName: 'standalone price',
  service: standalonePriceService
})

export const importStandalonePrice = (
  pricePath = './data/standaloneprice.csv'
) =>
  Promise.all([csv().fromFile(pricePath)]).then(
    ([price]) => {
      const notifySave = new SingleBar(
        {
          format:
            'Save inventory      {bar} |' +
            '| {percentage}% || {value}/{total} items',
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591'
        },
        Presets.rect
      )
      notifySave.start(price.length, 0, {})
      let processed = 0
      return Promise.all(
        price
          .map((standalonePrice) => {
            return {
              key: standalonePrice.key,
              sku: standalonePrice.sku,
              value: {
                centAmount: +standalonePrice.centAmount,
                currencyCode: standalonePrice.currencyCode,
                type: standalonePrice.type,
                fractionDigits:
                  +standalonePrice.fractionDigits
              },
              country: standalonePrice.country
            }
          })
          .map((priceDraft) => {
            return execute({
              uri: standalonePriceService.build(),
              method: 'POST',
              body: priceDraft
            }).then(() => notifySave.update(++processed))
          })
      )
        .then(() => notifySave.stop())
        .then(() =>
          // eslint-disable-next-line no-console
          console.log(
            '\x1b[32m%s\x1b[0m',
            'Standalone Prices imported'
          )
        )
        .catch((err) => {
          notifySave.stop()
          return logAndExit(
            err,
            'Failed to import standalonePrices'
          )
        })
    }
  )

if (nconf.get('clean')) {
  deleteStandalonePrice()
} else if (nconf.get('import')) {
  // eslint-disable-next-line no-console
  console.log(
    '\x1b[32m%s\x1b[0m',
    'Importing StandalonePrices...'
  )
  importStandalonePrice()
}
