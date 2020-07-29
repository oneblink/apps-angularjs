'use strict'

export default function (renderService) {
  'ngInject'

  const self = this
  self.isDeleting = false
  self.currentIndexToDelete = null

  const setViewValue = (entries) => {
    self.ngModelCtrl.$setViewValue(entries)
    self.ngModelCtrl.$setDirty()
    self.ngModelCtrl.$validate()
    self.updateProperty({
      $value: entries,
    })
  }

  this.$onInit = function () {
    if (angular.isNumber(self.element.minSetEntries)) {
      self.ngModelCtrl.$validators.minEntries = function (
        modelValue,
        viewValue,
      ) {
        const entries = modelValue || viewValue || []
        return self.element.minSetEntries <= entries.length
      }
    }

    if (angular.isNumber(self.element.maxSetEntries)) {
      self.ngModelCtrl.$validators.maxEntries = function (
        modelValue,
        viewValue,
      ) {
        const entries = modelValue || viewValue || []
        return self.element.maxSetEntries >= entries.length
      }
    }
  }

  this.addEntry = function () {
    const entries = self.ngModelCtrl.$viewValue || []
    const entry = renderService.generateDefaultData(self.element.elements, {})
    entries.push(entry)
    setViewValue(entries)
  }

  this.removeEntryPrompt = function (index) {
    self.isDeleting = true
    self.currentIndexToDelete = index
  }

  this.removeEntry = function () {
    const entries = self.ngModelCtrl.$viewValue
    entries.splice(self.currentIndexToDelete, 1)
    setViewValue(entries)
    self.isDeleting = false
    self.currentIndexToDelete = null
  }

  this.cancelPrompt = function () {
    self.isDeleting = false
    self.currentIndexToDelete = null
  }
}
