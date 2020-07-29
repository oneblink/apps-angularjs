'use strict'

import Quagga from 'quagga'

const BARCODE_TYPES = [
  'code_128_reader',
  'ean_reader',
  'ean_8_reader',
  'code_39_reader',
  'code_39_vin_reader',
  'codabar_reader',
  'upc_reader',
  'upc_e_reader',
  'i2of5_reader',
  '2of5_reader',
  'code_93_reader',
]

export default function ({ imgData, barcodeTypes }, callback) {
  if (!barcodeTypes || !barcodeTypes.length) {
    barcodeTypes = BARCODE_TYPES
  }

  Quagga.decodeSingle(
    {
      decoder: {
        readers: barcodeTypes.filter((type) => type !== 'qr_reader'),
      },
      locate: true, // try to locate the barcode in the image
      src: imgData,
    },
    function (result) {
      if (result && result.codeResult) {
        callback(result.codeResult.code)
      } else {
        callback()
      }
    },
  )
}
