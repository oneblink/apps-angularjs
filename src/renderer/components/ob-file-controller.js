'use strict'

export default function ($log, $scope, $element, $q) {
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

  vm.$postLink = function () {
    inputElement = $element.find('input')
    if (!inputElement || !inputElement[0]) {
      $log.warn('Could not find "input" element in File component template')
      return
    }

    inputElement.on('click', (clickEvent) => {
      clickEvent.target.value = null
    })

    inputElement.on('change', (changeEvent) => {
      vm.invalidFile = false
      if (
        changeEvent.target &&
        changeEvent.target.files &&
        changeEvent.target.files[0]
      ) {
        const file = changeEvent.target.files[0]
        if (vm.restricted) {
          const extension = file.name.split('.').pop()
          const isValid = vm.restrictedTo.some(
            (fileType) => fileType === extension,
          )
          if (!isValid) {
            vm.invalidFile = true
            $scope.$applyAsync()
            return
          }
        }
        return getBase64(file).then((base64data) => {
          vm.fileName = file.name
          vm.parentForm[vm.element.name].$setViewValue(base64data)
          $scope.$applyAsync()

          $log.log('Successfully updated ngModel')
        })
      } else {
        $log.log('No files selected')
      }
    })
  }

  vm.$onDestroy = function () {
    inputElement.off()
  }

  vm.clear = () => {
    vm.fileName = undefined
    vm.parentForm[vm.element.name].$setViewValue()
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
