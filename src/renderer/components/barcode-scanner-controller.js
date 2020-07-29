'use strict'

import 'getusermedia'
import bmCameraFactory from '@blinkmobile/camera'
import _find from 'lodash.find'
import jsQR from 'jsqr'

import './barcode-scanner.css'
import quaggaReader from '../../services/barcode-readers/quagger.js'

const MS_BETWEEN_IMAGE_PROCESSING = 10
const fadedSquareWidthInPixels = 200
const fadedSquareHeightInPixels = 150
const redLineHeightInPixels = 1

export default function ($log, $scope, $element, $timeout) {
  'ngInject'
  const ctrl = this

  let camera
  // eslint-disable-next-line angular/document-service
  const canvasElement = document.createElement('canvas')
  const canvasContext = canvasElement.getContext('2d')

  const finish = (barcode) => {
    $log.log('Barcode', barcode)
    ctrl.closeBarcodeScanner()
    ctrl.value = barcode
    ctrl.updateProperty({ value: barcode })
    ctrl.parentForm[ctrl.element.name].$setDirty()
    $scope.$applyAsync()
  }

  const stopBarcodeScanner = function () {
    if (timeout) {
      $timeout.cancel(timeout)
      timeout = undefined
    }
    if (camera) {
      camera.close()
      camera = undefined
    }
  }

  // Create timeout using $timeout outside of the scan function so
  // so that we can cancel it when navigating away from screen
  let timeout
  const scanImageForBarcode = (videoElement, waitInMS, options) => {
    // Using $timeout here instead of $interval as we dont know
    // exactly how long each processing of the image will take.
    timeout = $timeout(() => {
      if (!camera) return

      canvasElement.width = options.sourceWidth
      canvasElement.height = options.sourceHeight
      canvasContext.drawImage(
        videoElement,
        options.sourceX,
        options.sourceY,
        canvasElement.width,
        canvasElement.height,
        0,
        0,
        canvasElement.width,
        canvasElement.height,
      )

      if (
        !ctrl.element.restrictBarcodeTypes ||
        ctrl.element.restrictedBarcodeTypes.indexOf('qr_reader') > -1
      ) {
        const imageData = canvasContext.getImageData(
          0,
          0,
          canvasElement.width,
          canvasElement.height,
        )

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code) {
          return finish(code.data)
        }
      }

      if (
        !ctrl.element.restrictBarcodeTypes ||
        !(
          ctrl.element.restrictedBarcodeTypes.length === 1 &&
          ctrl.element.restrictedBarcodeTypes[0] === 'qr_reader'
        )
      ) {
        const base64Image = canvasElement.toDataURL('image/png')
        quaggaReader(
          {
            imgData: base64Image,
            barcodeTypes: ctrl.element.restrictedBarcodeTypes,
          },
          (quaggaResult) => {
            if (quaggaResult) {
              return finish(quaggaResult)
            }
            // Process an image again
            scanImageForBarcode(
              videoElement,
              MS_BETWEEN_IMAGE_PROCESSING,
              options,
            )
          },
        )
      } else {
        scanImageForBarcode(videoElement, MS_BETWEEN_IMAGE_PROCESSING, options)
      }
    }, waitInMS)
  }

  let selectedDeviceIndex = 0
  ctrl.switchCamera = function () {
    // We will just be rotating between the available camera.
    selectedDeviceIndex++
    let nextDevice = camera.availableDevices[selectedDeviceIndex]
    if (!nextDevice) {
      selectedDeviceIndex = 0
      nextDevice = camera.availableDevices[selectedDeviceIndex]
    }
    return camera.useDevice(nextDevice)
  }

  ctrl.$onInit = function () {
    ctrl.value = ctrl.initialValue || null
  }

  ctrl.openBarcodeScanner = function () {
    ctrl.error = undefined

    if (window.cordova) {
      return openNativeBarcodeScanner()
    }

    ctrl.loading = true
    ctrl.isCameraOpen = true
    const videoElement = $element.find('video')[0]
    camera = bmCameraFactory(videoElement)
    camera
      .open()
      .then(() => camera.getDevices())
      .then(() => {
        ctrl.multipleDevices = camera.availableDevices.length > 1
        $scope.$applyAsync()

        // Bit of hack to get the back camera opening first
        // on most devices (tested by Matt) that the label
        // includes the work "back" or "Back".
        if (ctrl.multipleDevices) {
          const backCamera = _find(camera.availableDevices, (device) => {
            return (
              angular.isString(device.label) &&
              device.label.toLowerCase().indexOf('back') > -1
            )
          })
          if (backCamera) {
            selectedDeviceIndex = camera.availableDevices.indexOf(backCamera)
            return camera.useDevice(backCamera)
          }
        }
      })
      .then(() => {
        ctrl.loading = false
        $scope.$applyAsync()

        const figureElement = $element.find('figure')[0]
        const fadedSquareElement = figureElement.getElementsByClassName(
          'ob-barcode-scanner__square',
        )[0]
        const redLineElement = figureElement.getElementsByClassName(
          'ob-barcode-scanner__line',
        )[0]
        $log.log('videoElement Width pixels', videoElement.clientWidth)
        $log.log('videoElement Height pixels', videoElement.clientHeight)
        $log.log('videoElement Width', videoElement.videoWidth)
        $log.log('videoElement Height', videoElement.videoHeight)

        // Faded Square needs its values set in pixels
        const fadedSquareLeftInPixels =
          (videoElement.clientWidth - fadedSquareWidthInPixels) / 2
        $log.log('fadedSquareLeftInPixels', fadedSquareLeftInPixels)
        const fadedSquareTopInPixels =
          (videoElement.clientHeight - fadedSquareHeightInPixels) / 2
        $log.log('fadedSquareTopInPixels', fadedSquareTopInPixels)

        fadedSquareElement.style[
          'border-bottom'
        ] = `${fadedSquareTopInPixels}px`
        fadedSquareElement.style['border-top'] = `${fadedSquareTopInPixels}px`
        fadedSquareElement.style['border-left'] = `${fadedSquareLeftInPixels}px`
        fadedSquareElement.style[
          'border-right'
        ] = `${fadedSquareLeftInPixels}px`
        fadedSquareElement.style['border-color'] = 'rgba(0, 0, 0, 0.25)'
        fadedSquareElement.style['border-style'] = 'solid'

        redLineElement.style.height = `${redLineHeightInPixels}px`
        redLineElement.style.top = `${
          (videoElement.clientHeight - redLineHeightInPixels) / 2
        }px`
        redLineElement.style.left = `${fadedSquareLeftInPixels}px`
        redLineElement.style.right = `${fadedSquareLeftInPixels}px`

        // Need to calculate the actual width, which is not in pixels
        const ratio = videoElement.videoWidth / videoElement.clientWidth
        $log.log('pixel to video Ratio', ratio)

        const left = ratio * fadedSquareLeftInPixels
        $log.log('left in video measurement', left)
        const top = ratio * fadedSquareTopInPixels
        $log.log('top in video measurement', top)

        const fadedSquareWidth = fadedSquareWidthInPixels * ratio
        $log.log('red square in video measurement', fadedSquareWidth)

        // Wait a little before scanning the first image
        // to prevent image processing staring before
        // camera is ready.
        scanImageForBarcode(videoElement, 250, {
          sourceX: left,
          sourceY: top,
          sourceWidth: fadedSquareWidth,
          sourceHeight: fadedSquareWidth,
        })
      })
      .catch((error) => {
        $log.error('Error while attempting to open camera', error)
        switch (error.name) {
          case 'NotSupportedError': {
            ctrl.error =
              'You browser does not support accessing your camera. Please click "Cancel" below and type in the barcode value manually.'
            break
          }
          case 'NotAllowedError': {
            ctrl.error =
              'Cannot scan for barcodes without granting the application access to the camera. Please click "Cancel" below to try again.'
            break
          }
          default: {
            ctrl.error =
              'An unknown error has occurred, please click "Cancel" below to try again. If the problem persists, please contact support.'
          }
        }
        ctrl.loading = false
        $scope.$applyAsync()
      })
  }

  ctrl.closeBarcodeScanner = function () {
    ctrl.isCameraOpen = false
    stopBarcodeScanner()
  }

  ctrl.$onDestroy = function () {
    ctrl.closeBarcodeScanner()
  }

  function openNativeBarcodeScanner() {
    window.cordova.plugins.barcodeScanner.scan(
      (result) => {
        if (!result.cancelled) {
          finish(result.text)
        }
      },
      (error) => {
        ctrl.error = `An error has occurred: "${error}". Please click "Cancel" below to try again. If the problem persists, please contact support.`
        ctrl.loading = false
        $scope.$applyAsync()
      },
      {
        showFlipCameraButton: true,
        showTorchButton: true,
      },
    )
  }
}
