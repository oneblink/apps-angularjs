'use strict'

export default function ($log, $scope, $element, $q, downloadFileService) {
  'ngInject'

  const vm = this
  let inputElement

  vm.$onInit = function () {
    vm.value = vm.initialValue
    vm.restricted = vm.element.restrictFileTypes
    vm.restrictedTo = vm.element.restrictedFileTypes
    vm.restrictedMessage = (vm.restrictedTo || []).join(', ')
    vm.invalidFile = false
  }

  vm.checkIsImageType = (file) => {
    const matches = file.data.match(/data:(\w*\/\w*);base64/)
    if (!matches) {
      return false
    }
    return matches[1].indexOf('image/') === 0
  }

  vm.$postLink = function () {
    inputElement = $element.find('input')
    if (!inputElement || !inputElement[0]) {
      $log.warn('Could not find "input" element in File component template')
      return
    }

    vm.selectFiles = () => {
      inputElement[0].click()
    }

    inputElement.on('click', (clickEvent) => {
      clickEvent.target.value = null
    })

    inputElement.on('change', (changeEvent) => {
      vm.invalidFile = false
      if (
        !changeEvent.target ||
        !changeEvent.target.files ||
        !changeEvent.target.files.length
      ) {
        $log.log('No files selected')
      }

      $q.all(
        Array.from(changeEvent.target.files).map((file) => {
          if (vm.restricted) {
            const extension = file.name.split('.').pop()
            const isValid = vm.restrictedTo.some(
              (fileType) => fileType === extension,
            )
            if (!isValid) {
              vm.invalidFile = true
              $scope.$applyAsync()
              return $q.resolve(null)
            }
          }
          return getBase64(file).then((base64data) => ({
            fileName: file.name,
            data: base64data,
          }))
        }),
      ).then((newFiles) => {
        const newValue = [
          ...(vm.value || []),
          ...newFiles.filter((file) => !!file),
        ]
        vm.parentForm[vm.element.name].$setViewValue(
          newValue.length ? newValue : undefined,
        )
        $scope.$applyAsync()

        $log.log('Successfully updated ngModel')
      })
    })

    if (angular.isNumber(vm.element.minEntries)) {
      vm.parentForm[vm.element.name].$validators.minEntries = function (
        modelValue,
        viewValue,
      ) {
        const files = modelValue || viewValue || []
        return vm.element.minEntries <= files.length
      }
    }

    if (angular.isNumber(vm.element.maxEntries)) {
      vm.parentForm[vm.element.name].$validators.maxEntries = function (
        modelValue,
        viewValue,
      ) {
        const files = modelValue || viewValue || []
        return vm.element.maxEntries >= files.length
      }
    }
  }

  vm.$onDestroy = function () {
    inputElement.off()
  }

  vm.clear = (index) => {
    const newValue = (vm.value || []).filter((file, i) => index !== i)

    vm.parentForm[vm.element.name].$setViewValue(
      newValue.length ? newValue : undefined,
    )
  }

  vm.downloadFile = (file) => {
    downloadFileService.downloadFile(file.data, file.fileName || vm.element.id)
  }

  function getBase64(file) {
    return $q((resolve, reject) => {
      var reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = function () {
        resolve(reader.result)
      }
      reader.onerror = function (error) {
        reject(error)
      }
    })
  }
}
