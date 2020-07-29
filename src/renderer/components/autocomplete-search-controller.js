'use strict'

import _find from 'lodash.find'
import _debounce from 'lodash.debounce'

export default function ($log, $element, filterFilter, renderService) {
  'ngInject'

  this.value = null
  let optionsContainerElement
  this.currentFocusedOptionIndex = 0
  this.options = []

  const onSelectOption = (option) => {
    if (this.value !== option.value) {
      this.label = option.label
      this.parentForm[this.element.name].$setViewValue(option.value)
    }
    this.currentFocusedOptionIndex = 0
    this.isAutocompleteOpen = false
  }

  this.getOptions = () => {
    return this.options
  }

  this.$onInit = () => {
    this.value = this.initialValue || null
    this.searchUrl = this.element.searchUrl
    this.isFetchingOptions = false
  }

  this.onFocus = () => {
    this.currentFocusedOptionIndex = 0
    this.isAutocompleteOpen = true
  }

  this.onBlur = () => {
    // When moving away from the input, if this is no value remove
    // the label to show the user they have not selected a value
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
        this.options.length - 1,
        this.currentFocusedOptionIndex + 1,
      )
    } else if (enterPressed) {
      const option = this.options[this.currentFocusedOptionIndex]
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

  this.fetchOptionsViaSearch = _debounce((newLabel) => {
    this.isFetchingOptions = true

    return renderService
      .searchUrlForOptions(newLabel, this.searchUrl)
      .then((options) => {
        this.options = options
        this.isFetchingOptions = false
      })
      .catch((error) => {
        this.options = []
        this.isFetchingOptions = false
        $log.log(error)
      })
  }, 750)

  this.onLabelChange = (newLabel) => {
    this.isAutocompleteOpen = true
    this.currentFocusedOptionIndex = 0
    if (!newLabel) {
      this.options = []
      return
    }
    // Remove value when changing label
    if (this.value) {
      this.value = undefined
      this.parentForm[this.element.name].$setViewValue(this.value)
    }
    this.fetchOptionsViaSearch(newLabel)
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
