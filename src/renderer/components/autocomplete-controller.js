'use strict'

import _includes from 'lodash.includes'
import _find from 'lodash.find'

export default function ($log, $element, filterFilter, renderService) {
  'ngInject'

  this.value = null
  let optionsContainerElement
  this.currentFocusedOptionIndex = 0
  this.isFetchingOptions = true
  this.filteredOptions = []

  const onSelectOption = (option) => {
    if (this.value !== option.value) {
      this.label = option.label
      this.parentForm[this.element.name].$setViewValue(option.value)
    }
    this.currentFocusedOptionIndex = 0
    this.isAutocompleteOpen = false
  }

  this.getFilteredOptions = (newLabel) => {
    const filteredOptions = this.element.conditionallyShowOptions
      ? filterFilter(
          this.element.options,
          this.conditionallyShowOptionFilter(this),
        )
      : this.element.options
    // If the user has typed nothing in, display all options
    if (!newLabel) {
      return filteredOptions
    }

    const lowerCase = newLabel.toLowerCase()

    return filteredOptions.filter((option) => {
      return _includes(option.label.toLowerCase(), lowerCase)
    })
  }

  const resetFilteredOptions = (newLabel) => {
    this.filteredOptions = this.getFilteredOptions(newLabel)
  }

  this.$onInit = () => {
    this.value = this.initialValue || null
    renderService
      .setOptionsForElement(this.element, this.formElementsCtrl)
      .then(() => {
        // Set default label and value
        this.label = undefined
        if (this.initialValue) {
          const defaultOption = _find(
            this.element.options,
            (option) => option.value === this.initialValue,
          )
          if (defaultOption) {
            this.label = defaultOption.label
          }
        }

        resetFilteredOptions(this.label)
        this.isFetchingOptions = false
      })
  }

  this.onFocus = () => {
    this.currentFocusedOptionIndex = 0
    this.isAutocompleteOpen = true
    resetFilteredOptions(this.label)
  }

  this.onBlur = () => {
    // When moving away from the input, if this is no value remove
    // the label to show the user they have not selected a value
    $log.log(
      'Setting value or removing label after blurring away from autocomplete',
    )
    this.isAutocompleteOpen = false
    if (!this.value) {
      // If there is no option currently selected but the typed in label
      // matches an option's label, set that option as the value, otherwise remove label
      if (this.label) {
        const lowerCase = this.label.toLowerCase()
        const option = _find(
          this.element.options,
          (option) => option.label.toLowerCase() === lowerCase,
        )
        if (option) {
          onSelectOption(option)
          return
        }
      }
      this.label = undefined
    }
  }

  this.onClickOption = ($event, option) => {
    $log.log('Selected element option in autocomplete', option)

    $event.preventDefault()
    $event.stopPropagation()

    onSelectOption(option)
  }

  this.onKeyUp = ($event) => {
    const enterPressed = $event.keyCode === 13
    const upArrowPressed = $event.keyCode === 38
    const downArrowPressed = $event.keyCode === 40
    if (upArrowPressed || downArrowPressed || enterPressed) {
      $event.preventDefault()
      $event.stopPropagation()
    }

    const previousFocusedOptionIndex = this.currentFocusedOptionIndex

    if (upArrowPressed) {
      this.currentFocusedOptionIndex = Math.max(
        0,
        this.currentFocusedOptionIndex - 1,
      )
    } else if (downArrowPressed) {
      this.currentFocusedOptionIndex = Math.min(
        this.filteredOptions.length - 1,
        this.currentFocusedOptionIndex + 1,
      )
    } else if (enterPressed) {
      const option = this.filteredOptions[this.currentFocusedOptionIndex]
      if (option) {
        onSelectOption(option)
      }
    }

    // If the index has changed, need to ensure the active option is visible
    if (previousFocusedOptionIndex !== this.currentFocusedOptionIndex) {
      const activeOptionElement = angular.element(
        $element.find('a')[this.currentFocusedOptionIndex],
      )
      if (!optionsContainerElement) {
        optionsContainerElement = angular.element(
          $element[0].getElementsByClassName(
            'ob-autocomplete__dropdown-content',
          ),
        )
      }
      if (activeOptionElement && optionsContainerElement) {
        optionsContainerElement
          .scrollTo(activeOptionElement, 50, 250)
          .catch(angular.noop)
      }
    }
  }

  this.onLabelChange = (newLabel) => {
    this.isAutocompleteOpen = true
    this.currentFocusedOptionIndex = 0

    // Remove value when changing label
    if (this.value) {
      this.value = undefined
      this.parentForm[this.element.name].$setViewValue(this.value)
    }

    resetFilteredOptions(newLabel)
  }

  this.syncValueWithLabel = (newValue) => {
    if (newValue === null || angular.isUndefined(newValue)) {
      return
    }

    const option = _find(
      this.element.options,
      (option) => option.value === newValue,
    )
    if (option && this.label !== option.label) {
      this.label = option.label
    }
  }
}
