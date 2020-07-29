'use strict'

import _debounce from 'lodash.debounce'

const sliderBubbleWidthInPixels = 24

export default function ($timeout, $element) {
  'ngInject'

  const removeIsDraggingClass = _debounce((outputElement) => {
    if (outputElement.classList.contains('is-dragging')) {
      outputElement.classList.remove('is-dragging')
    }
  }, 500)

  const evaluateOutputPosition = (newValue) => {
    const outputElement = $element.find('output')[0]
    const inputElement = $element.find('input')[0]
    if (outputElement && inputElement) {
      const range = this.element.maxNumber - this.element.minNumber
      const percentage = (newValue - this.element.minNumber) / range
      const inputWidth = inputElement.getBoundingClientRect().width
      const outputWidth = outputElement.getBoundingClientRect().width
      const sliderBubbleOffSetPixels =
        (percentage - 0.5) * -sliderBubbleWidthInPixels

      outputElement.style.left = `${percentage * inputWidth}px`
      outputElement.style.marginLeft = `-${
        outputWidth / 2 - sliderBubbleOffSetPixels
      }px`

      if (!outputElement.classList.contains('is-dragging')) {
        outputElement.classList.add('is-dragging')
      }
      removeIsDraggingClass(outputElement)
    }
  }

  this.$onInit = () => {
    this.value =
      this.initialValue || this.initialValue === 0
        ? this.initialValue
        : this.element.isSlider
        ? this.element.minNumber
        : null
    $timeout(() => {
      evaluateOutputPosition(this.value)
    }, 100)
  }

  this.updateSlider = (newValue) => {
    evaluateOutputPosition(newValue)
    this.updateProperty({ value: newValue })
  }
}
