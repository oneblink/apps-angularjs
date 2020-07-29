'use strict'

import loadImage from 'blueimp-load-image'

export default function (
  $log,
  $document,
  $scope,
  $element,
  $timeout,
  scrollingService,
) {
  'ngInject'

  const vm = this
  let inputElement
  let htmlInputElement

  vm.openCamera = () => {
    if (window.cordova && navigator.camera && navigator.camera.getPicture) {
      vm.loading = true
      navigator.camera.getPicture(
        (base64Data) => {
          updateValue(`data:image/jpeg;base64,${base64Data}`)
        },
        (error) => {
          $log.warn('An error occurred while attempting to take a photo', error)
          vm.error = error
          vm.loading = false
          $scope.$applyAsync()
        },
        {
          quality: 100,
          destinationType: window.Camera.DestinationType.DATA_URL,
          sourceType: window.Camera.PictureSourceType.CAMERA,
          allowEdit: false,
          encodingType: window.Camera.EncodingType.JPEG,
          mediaType: window.Camera.MediaType.PICTURE,
          correctOrientation: true,
          saveToPhotoAlbum: false,
          cameraDirection: window.Camera.Direction.BACK,
        },
      )
    } else if (htmlInputElement) {
      htmlInputElement.click()
    } else {
      $log.error('Could not find "input" element in Camera component template')
    }
  }

  vm.clearImage = () => {
    vm.parentForm[vm.element.name].$setViewValue(undefined)
  }

  vm.annotate = () => {
    vm.annotation = null
    vm.isAnnotating = true

    // Timeout to get the canvas element on the next digest cycle
    // after the canvas has been rendered
    $timeout(() => {
      const bmSignaturePadElement = $element.find('bm-signature-pad')[0]

      if (!bmSignaturePadElement) {
        $log.warn('Could not find "bm-signature-pad" HTML element')
        return
      }

      const canvasElement = bmSignaturePadElement.children[0]
      const annotationContentElement = bmSignaturePadElement.parentElement

      const maxWidth = annotationContentElement.clientWidth
      const maxHeight = annotationContentElement.clientHeight

      const i = new Image()
      i.onload = function () {
        const imageWidth = i.width
        const imageHeight = i.height
        let canvasWidth = imageWidth
        let canvasHeight = imageHeight

        if (imageWidth > maxWidth || imageHeight > maxHeight) {
          const widthRatio = maxWidth / imageWidth
          const heightRatio = maxHeight / imageHeight
          const ratio = Math.min(widthRatio, heightRatio)

          canvasWidth = ratio * imageWidth
          canvasHeight = ratio * imageHeight
        }

        bmSignaturePadElement.style.width = `${canvasWidth}px`
        bmSignaturePadElement.style.height = `${canvasHeight}px`
        bmSignaturePadElement.style.backgroundSize = 'cover'
        bmSignaturePadElement.style.backgroundImage = `url(${vm.value})`
        canvasElement.width = canvasWidth
        canvasElement.height = canvasHeight

        // Disable scrolling to allow for smooth drawing
        scrollingService.disableScrolling()
      }
      i.src = vm.value
    })
  }

  vm.cancelAnnotation = () => {
    vm.isAnnotating = false
    vm.annotation = null
    // Re-enable scroll on body when inactive
    scrollingService.enableScrolling()
  }

  vm.saveAnnotation = () => {
    if (!vm.annotation) {
      vm.cancelAnnotation()
      return
    }

    vm.loading = true
    vm.isAnnotating = false

    const canvas = $document[0].createElement('canvas')
    const ctx = canvas.getContext('2d')

    const image = new Image()
    image.onload = function () {
      canvas.width = image.width
      canvas.height = image.height

      ctx.drawImage(image, 0, 0)

      const annotationImage = new Image()
      annotationImage.onload = function () {
        ctx.drawImage(annotationImage, 0, 0, canvas.width, canvas.height)

        const base64Data = canvas.toDataURL()
        vm.cancelAnnotation()

        updateValue(base64Data)
      }
      annotationImage.src = vm.annotation
    }
    image.src = vm.value
  }

  vm.$onInit = function () {
    vm.value = vm.initialValue
    vm.annotationButtonColours = [
      '#000000',
      '#ffffff',
      '#f44336',
      '#e91e63',
      '#9c27b0',
      '#673ab7',
      '#3f51b5',
      '#2196f3',
      '#03a9f4',
      '#00bcd4',
      '#009688',
      '#4caf50',
      '#8bc34a',
      '#cddc39',
      '#ffee58',
      '#ffca28',
      '#ffa726',
      '#ff5722',
    ]
    vm.annotationOptions = {
      penColor: vm.annotationButtonColours[0],
    }
  }

  vm.$postLink = function () {
    inputElement = $element.find('input')
    if (!inputElement || !inputElement[0]) {
      $log.warn('Could not find "input" element in Camera component template')
      return
    }

    htmlInputElement = inputElement[0]

    inputElement.on('change', (changeEvent) => {
      if (
        changeEvent.target &&
        changeEvent.target.files &&
        changeEvent.target.files[0]
      ) {
        vm.loading = true
        $scope.$applyAsync()
        vm.clearImage()

        $log.log('File selected event', changeEvent)
        // Unfortunately, photos taken from a native camera can come in with an incorrect
        // orientation. Luckily, we are not the only people in the work have this issue
        // and someone else has already solved with this nice library.
        // https://nsulistiyawan.github.io/2016/07/11/Fix-image-orientation-with-Javascript.html
        const file = changeEvent.target.files[0]
        loadImage.parseMetaData(file, function (data) {
          const options = {
            // should be set to canvas : true to activate auto fix orientation
            canvas: true,
            // if exif data available, update orientation
            orientation: data.exif ? data.exif.get('Orientation') : 0,
          }
          $log.log('Loading image onto canvas to correct orientation')
          loadImage(
            file,
            (canvas) => {
              const base64data = canvas.toDataURL(file.type)
              updateValue(base64data)
            },
            options,
          )
        })
      }
    })
  }

  vm.$onDestroy = function () {
    inputElement.off()
  }

  function updateValue(newValue) {
    vm.loading = false
    vm.parentForm[vm.element.name].$setViewValue(newValue)
    $scope.$applyAsync()

    $log.log('Successfully updated ngModel')
  }
}
