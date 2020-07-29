'use strict'

import ExpressionParser from 'morph-expressions'
import escapeString from 'escape-string-regexp'

export default function ($sce, $log) {
  'ngInject'
  const exprParser = new ExpressionParser()
  exprParser.registerFunction('ROUND', (value, precision) => {
    if (!Number.isNaN(value) && Number.isFinite(value)) {
      return parseFloat(value.toFixed(precision))
    }
    return null
  })
  exprParser.registerFunction('ISNULL', (value, defaultValue) => {
    if (isUnenteredValue(value)) {
      return defaultValue || 0
    }
    return value
  })

  this.htmlValue = null
  this.calculationError = false
  let calculation = null
  const calculationParameterElements = []

  const isUnenteredValue = (value) => {
    return !value && value !== 0
  }
  const setHtml = (htmlTemplate, value) => {
    // Add commas in number
    const [number, decimal] = (value || 0).toString().split('.')
    const numberWithCommas = number.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const stringValue = decimal
      ? `${numberWithCommas}.${decimal}`
      : numberWithCommas
    this.htmlValue = $sce.trustAsHtml(
      (htmlTemplate || '').replace(/{result}/gi, stringValue),
    )
  }

  const evaluateCalculation = () => {
    if (!calculation) return
    const submission = this.formRendererCtrl.getCurrentSubmissionDataWithoutBinary()
    const value = calculation.eval(submission)
    if (!isNaN(value)) {
      this.updateProperty({ value })
      setHtml(this.element.defaultValue, value)
    } else {
      this.updateProperty({ value: undefined })
      setHtml(this.element.preCalculationDisplay)
    }
  }

  const registerProperty = ({
    parentFormName,
    replacement,
    nestedElementNames,
  }) => {
    exprParser.registerProperty(replacement, (submission) => {
      let defaultAccumulator = submission
      // ACCOUNT FOR NESTED FORM CASE
      if (parentFormName) {
        for (const level of parentFormName.split('|')) {
          if (defaultAccumulator) {
            defaultAccumulator = defaultAccumulator[level]
          }
        }
      }
      defaultAccumulator = defaultAccumulator[nestedElementNames[0]]

      return nestedElementNames.reduce((elementValue, elementName, index) => {
        // Numbers can just be returned as is
        if (angular.isNumber(elementValue)) {
          return elementValue
        }

        // attempt to get a number from the element value as a string.
        // NaN is accounted for is the calculation
        // so we can return that from here
        if (angular.isString(elementValue)) {
          return parseFloat(elementValue)
        }

        if (angular.isArray(elementValue)) {
          // If there are no entries, we can return null
          // to prevent the calculation from running.
          if (!elementValue.length) {
            return NaN
          }

          // An array could be an element that allows multiple
          // values e.g. checkboxes. If thats that case, we just
          // add them all together and move on
          const elementValues = elementValue.map((entry) => parseFloat(entry))
          if (elementValues.every((entry) => !Number.isNaN(entry))) {
            return elementValues.reduce((number, entry) => number + entry, 0)
          }

          // Other wise attempt to process it as a repeatable set
          // If we found another repeatable set to process,
          // pass it to the next element name to
          // iterate over the entries

          // If we are processing the entries in a repeatable set,
          // we can sum the numbers elements in the entries
          const currentElementName = nestedElementNames[index + 1]

          let isNestedRepeatableSet = false
          const nestedElementValues = elementValue.reduce(
            (nestedElementValues, entry) => {
              if (entry) {
                const nextElementValue = entry[currentElementName]
                if (angular.isArray(nextElementValue)) {
                  if (nextElementValue.length) {
                    nestedElementValues.push(...nextElementValue)
                    isNestedRepeatableSet = true
                  }
                } else {
                  nestedElementValues.push(nextElementValue)
                }
              }
              return nestedElementValues
            },
            [],
          )

          // If the nested element values are all arrays, we can pass them on the the next
          if (isNestedRepeatableSet) {
            return nestedElementValues
          }

          return nestedElementValues.reduce((total, nestedElementValue) => {
            if (Number.isNaN(total)) {
              return NaN
            }
            const value = parseFloat(nestedElementValue)
            if (Number.isNaN(value)) {
              return NaN
            }
            const newTotal =
              total + (Number.isFinite(value) ? value : nestedElementValue)
            return newTotal
          }, 0)
        }

        // We did not find a number value from the known elements,
        // we will assume we are at the end of the line.
        return NaN
      }, defaultAccumulator)
    })
  }

  const modelChangeListener = ({ elementNamePath }) => {
    if (
      calculationParameterElements.some((calculationParameterElement) => {
        // ACCOUNT FOR NESTED FORM CASE
        const dependancyElementPathName = calculationParameterElement.parentFormName
          ? `${calculationParameterElement.parentFormName}|${calculationParameterElement.elementName}`
          : calculationParameterElement.elementName
        return (
          dependancyElementPathName.substring(0, elementNamePath.length) ===
          elementNamePath
        )
      })
    ) {
      evaluateCalculation()
    }
  }

  this.$onInit = () => {
    try {
      let matches
      const elementNames = []
      const re = /({ELEMENT:)([^}]+)(})/g

      while ((matches = re.exec(this.element.calculation)) !== null) {
        elementNames.push(matches[2])
      }
      const code = elementNames.reduce((code, elementName, index) => {
        const regex = new RegExp(escapeString(`{ELEMENT:${elementName}}`), 'g')
        const replacement = `a${index}`
        const parentFormName = this.parentFormName ? this.parentFormName : null

        registerProperty({
          parentFormName,
          elementName,
          replacement,
          nestedElementNames: elementName.split('|'),
        })

        calculationParameterElements.push({
          parentFormName,
          elementName,
          replacement,
          nestedElementNames: elementName.split('|'),
        })
        return code.replace(regex, replacement)
      }, this.element.calculation)
      calculation = exprParser.parse(code.trim())
      this.formRendererCtrl.registerModelChangeListener(modelChangeListener)
      evaluateCalculation()
    } catch (e) {
      this.calculationError = true
      $log.warn(
        'Error while setting up parsing for calculation element',
        this.element,
        e,
      )
    }
  }

  this.$onDestroy = () => {
    this.formRendererCtrl.unregisterModelChangeListener(modelChangeListener)
  }
}
