'use strict'

import _find from 'lodash.find'

import summaryResultTemplate from './summary-result-template.html'

export default function ($log, vocabularyService, utilsService) {
  'ngInject'

  this.summaryResult = null
  this.summaryError = false
  this.formElements = []
  const listeningElementIds = new Set()

  const reducer = (partialSummary, formElement, submission) => {
    if (
      formElement.type !== 'repeatableSet' &&
      !this.element.elementIds.some((elementId) => elementId === formElement.id)
    ) {
      return partialSummary
    }

    const formElementValue = submission[formElement.name]
    if (!formElementValue && formElementValue !== 0) {
      return partialSummary
    }

    switch (formElement.type) {
      case 'repeatableSet': {
        // If we found a repeatable set, look through child elements
        // to find the summary elements. Need to start a new array for
        // this structure and look at each entry in the repeatable set
        for (const entry of formElementValue) {
          const repeatableSetSummaryValues = formElement.elements.reduce(
            (partialSummary, formElement) =>
              reducer(partialSummary, formElement, entry),
            [],
          )
          if (repeatableSetSummaryValues.length) {
            partialSummary.push(repeatableSetSummaryValues)
          }
        }
        break
      }
      case 'select':
      case 'autocomplete':
      case 'radio':
      case 'checkboxes': {
        const optionValues = []
        if (angular.isArray(formElementValue)) {
          optionValues.push(...formElementValue)
        } else {
          optionValues.push(formElementValue)
        }
        if (angular.isArray(formElement.options)) {
          partialSummary.push(
            ...optionValues.reduce((optionLabels, optionValue) => {
              const option = _find(formElement.options, {
                value: optionValue,
              })
              if (option) {
                optionLabels.push(option.label)
              }
              return optionLabels
            }, []),
          )
        }
        break
      }
      case 'date': {
        partialSummary.push(
          vocabularyService.formatDate(new Date(formElementValue)),
        )
        break
      }
      case 'datetime': {
        partialSummary.push(
          vocabularyService.formatDatetime(new Date(formElementValue)),
        )
        break
      }
      case 'time': {
        partialSummary.push(
          vocabularyService.formatTime(new Date(formElementValue)),
        )
        break
      }
      default: {
        partialSummary.push(formElementValue.toString())
      }
    }

    return partialSummary
  }

  const evaluateSummary = () => {
    const submission = this.formRendererCtrl.getCurrentSubmissionDataWithoutBinary()
    const summary = this.formElements.reduce(
      (partialSummary, formElement) =>
        reducer(partialSummary, formElement, submission),
      [],
    )

    if (summary.length) {
      this.updateProperty({ value: summary })
      this.summaryResult = summary
    } else {
      this.updateProperty({ value: undefined })
      this.summaryResult = null
    }
  }

  const modelChangeListener = ({ element }) => {
    if (listeningElementIds.some((elementId) => elementId === element.id)) {
      evaluateSummary()
    }
  }

  this.$onInit = () => {
    // Flatten array of elements in pages (this does not flatten repeatable sets)
    this.formElements = this.formRendererCtrl.pages.reduce(
      (formElements, { elements }) => [...formElements, ...elements],
      [],
    )

    // Find repeatable set element id for nested elements
    // to listen for changes to those as well.
    utilsService.forEachElement(
      this.formElements,
      (formElement, parentFormElements) => {
        if (
          this.element.elementIds.some(
            (elementId) => elementId === formElement.id,
          )
        ) {
          listeningElementIds.add(formElement.id)
          parentFormElements.forEach((parentFormElement) => {
            listeningElementIds.add(parentFormElement.id)
          })
        }
      },
    )

    this.formRendererCtrl.registerModelChangeListener(modelChangeListener)
    evaluateSummary()
  }

  this.$onDestroy = () => {
    this.formRendererCtrl.unregisterModelChangeListener(modelChangeListener)
  }
}

angular.module('oneblink.forms.renderer').component('obSummaryResult', {
  template: summaryResultTemplate,
  controller: function () {
    'ngInject'

    this.isArray = angular.isArray
    this.isString = angular.isString
  },
  bindings: {
    result: '<',
  },
})
