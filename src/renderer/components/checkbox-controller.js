'use strict'

export default function (renderService) {
  'ngInject'

  this.$onInit = () => {
    this.value = this.initialValue || undefined
    this.isFetchingOptions = true
    renderService
      .setOptionsForElement(this.element, this.formElementsCtrl)
      .then(() => {
        this.isFetchingOptions = false
      })
  }

  this.toggle = (option) => {
    let currentValue = angular.copy(this.value)
    const index = this.indexOf(option)
    if (index !== -1) {
      currentValue.splice(index, 1)
      if (!currentValue.length) {
        currentValue = undefined
      }
    } else {
      currentValue = currentValue || []
      currentValue.push(option.value)
    }
    this.parentForm[this.element.name].$setViewValue(currentValue)
  }

  this.indexOf = (option) => {
    return (this.value || []).indexOf(option.value)
  }

  this.isChecked = (option) => {
    return this.indexOf(option) !== -1
  }
}
