'use strict'

import _find from 'lodash.find'

angular
  .module('oneblink.forms.renderer')
  .service('renderService', function ($log, $q, $http, formsApiService) {
    'ngInject'

    const fnMap = {
      '>': (lhs, rhs) => lhs > rhs,
      '>=': (lhs, rhs) => lhs >= rhs,
      '===': (lhs, rhs) => lhs === rhs,
      '!==': (lhs, rhs) => lhs !== rhs,
      '<=': (lhs, rhs) => lhs <= rhs,
      '<': (lhs, rhs) => lhs < rhs,
    }

    const handleOptionsPredicate = (predicate, model, predicateElement) =>
      predicate.optionIds.some((optionId) => {
        const option = _find(predicateElement.options, (o) => o.id === optionId)
        if (option) {
          if (angular.isArray(model[predicateElement.name])) {
            return model[predicateElement.name].some((modelValue) => {
              return modelValue === option.value
            })
          } else {
            return option.value === model[predicateElement.name]
          }
        } else {
          return false
        }
      })

    const handlePredicate = (predicate, model, predicateElement) => {
      switch (predicate.type) {
        case 'VALUE': {
          return !predicate.hasValue === !model[predicateElement.name]
        }
        case 'NUMERIC': {
          const lhs = Number.parseFloat(model[predicateElement.name])
          const rhs = Number.parseFloat(predicate.value)

          // if either of the values is not a number or the operator fn doesn't exist, hide the control
          const operatorFn = fnMap[predicate.operator]
          if (!operatorFn || Number.isNaN(lhs) || Number.isNaN(rhs))
            return false

          return operatorFn(lhs, rhs)
        }
        case 'OPTIONS':
        default: {
          return handleOptionsPredicate(predicate, model, predicateElement)
        }
      }
    }

    const conditionallyShowByPredicate = (
      formElementsCtrl,
      predicate,
      pageElements,
      rootModel,
      elementsEvaluated,
    ) => {
      let predicateElement = _find(formElementsCtrl.elements, (element) => {
        return element.id === predicate.elementId
      })

      let model = formElementsCtrl.model
      // If we cant find the element used for the predicate,
      // we can check to see if the element being evaluated
      // is in a repeatable set and the predicate element is
      // in a parent list of elements.
      if (!predicateElement) {
        if (formElementsCtrl.parentFormElementsCtrl) {
          return conditionallyShowByPredicate(
            formElementsCtrl.parentFormElementsCtrl,
            predicate,
            pageElements,
            rootModel,
            elementsEvaluated,
          )
        } else {
          // Check if we can find the element in the page level elements
          const pageElement = _find(pageElements, (pageElement) => {
            predicateElement = _find(
              pageElement.elements,
              (pageLevelElement) => {
                return pageLevelElement.id === predicate.elementId
              },
            )
            return !!predicateElement
          })

          if (predicateElement) {
            // Here we will also need to check that the page the predicate element
            // is on, is also not hidden. If it is hidden we will treat this predicate
            // element as hidden as well.
            if (
              !conditionallyShowElement(
                { elements: [], model: rootModel },
                pageElement,
                pageElements,
                rootModel,
                elementsEvaluated,
              )
            ) {
              return false
            }

            // Found the element is on another page, this means
            // we must use the root level model to evaluate the predicate
            model = rootModel
          } else {
            // if we have not found the predicate on another page,
            // there is bad configuration and we will always show
            // the element.
            return true
          }
        }
      }

      // If the predicate element does not have any options to evaluate,
      // we will show the element.
      // Unless the predicate element is a has dynamic options and
      // options have not been fetched yet.
      if (
        (!predicate.type || predicate.type === 'OPTIONS') &&
        !angular.isArray(predicateElement.options)
      ) {
        return predicateElement.optionsType !== 'DYNAMIC'
      }

      // Check to see if the model has one of the valid values to show the element
      return (
        conditionallyShowElement(
          formElementsCtrl,
          predicateElement,
          pageElements,
          rootModel,
          elementsEvaluated,
        ) && handlePredicate(predicate, model, predicateElement)
      )
    }

    const conditionallyShowElement = (
      formElementsCtrl,
      elementToEvaluate,
      pageElements,
      rootModel,
      elementsEvaluated,
    ) => {
      // If the element does not have the `conditionallyShow` flag set,
      // we can always show the element.
      if (
        !elementToEvaluate ||
        !elementToEvaluate.conditionallyShow ||
        !angular.isArray(elementToEvaluate.conditionallyShowPredicates) ||
        !elementToEvaluate.conditionallyShowPredicates.length
      ) {
        return true
      }

      // Check to see if this element has already been used to evaluate
      // if the element should be shown based on parent element conditional logic
      if (
        elementsEvaluated.some(
          (elementId) => elementId === elementToEvaluate.id,
        )
      ) {
        throw new Error(
          'Your conditional logic has caused an infinite loop. Check the following Fields to ensure element A does not rely on element B if element B also relies on element A.',
        )
      } else {
        elementsEvaluated.push(elementToEvaluate.id)
      }

      const predicateFunction = (predicate) => {
        // Validate the predicate data, if it is invalid,
        // we will always show the field
        if (
          !predicate ||
          !predicate.elementId ||
          (predicate.type === 'OPTIONS' &&
            (!angular.isArray(predicate.optionIds) ||
              !predicate.optionIds.length)) ||
          (predicate.type === 'NUMERIC' &&
            (Object.keys(fnMap).indexOf(predicate.operator) === -1 ||
              !Number.isFinite(predicate.value)))
        ) {
          return true
        }

        return conditionallyShowByPredicate(
          formElementsCtrl,
          predicate,
          pageElements,
          rootModel,
          elementsEvaluated,
        )
      }

      if (elementToEvaluate.requiresAllConditionallyShowPredicates) {
        return elementToEvaluate.conditionallyShowPredicates.every(
          predicateFunction,
        )
      } else {
        return elementToEvaluate.conditionallyShowPredicates.some(
          predicateFunction,
        )
      }
    }

    // /////////////////////// conditional options

    const handleAttributePredicate = (predicate, model, predicateElement) => {
      const values = model[predicateElement.name]
      if (!values) return true

      if (
        angular.isArray(values) &&
        (!values.length || !values.filter(angular.isDefined).length)
      ) {
        return true
      }
      return handleOptionsPredicate(predicate, model, predicateElement)
    }

    const conditionallyShowOptionByPredicate = (
      formElementsCtrl,
      predicate,
      pageElements,
      rootModel,
      elementsEvaluated,
    ) => {
      let predicateElement = _find(formElementsCtrl.elements, (element) => {
        return element.id === predicate.elementId
      })

      let model = formElementsCtrl.model
      // If we cant find the element used for the predicate,
      // we can check to see if the element being evaluated
      // is in a repeatable set and the predicate element is
      // in a parent list of elements.
      if (!predicateElement) {
        if (formElementsCtrl.parentFormElementsCtrl) {
          return conditionallyShowOptionByPredicate(
            formElementsCtrl.parentFormElementsCtrl,
            predicate,
            pageElements,
            rootModel,
            elementsEvaluated,
          )
        } else {
          // Check if we can find the element in the page level elements
          let p = 0
          while (!predicateElement && p < pageElements.length) {
            predicateElement = _find(
              pageElements[p].elements,
              (pageLevelElement) => {
                return pageLevelElement.id === predicate.elementId
              },
            )
            p++
          }

          if (predicateElement) {
            // Found the element is on another page, this means
            // we must use the root level model to evaluate the predicate
            model = rootModel
          } else {
            // if we have not found the predicate on another page,
            // there is bad configuration and we will always show
            // the option.
            return true
          }
        }
      }

      // If the predicate element does not have any options to evaluate,
      // we will show the element.
      // Unless the predicate element is a has dynamic options and
      // options have not been fetched yet.
      if (!angular.isArray(predicateElement.options)) {
        return predicateElement.optionsType !== 'DYNAMIC'
      }

      const everyOptionIsShowing = predicate.optionIds.every((id) => {
        const predicateOption = _find(
          predicateElement.options,
          (o) => o.id === id,
        )
        if (!predicateOption) return false
        const modelval = model[predicateElement.name]
        const isVisible = conditionallyShowOption(
          { model },
          predicateOption,
          pageElements,
          rootModel,
          elementsEvaluated,
        )
        if (!isVisible) {
          if (
            angular.isArray(modelval) &&
            modelval.indexOf(predicateOption.value)
          ) {
            model[predicateElement.name][
              modelval.indexOf(predicateOption.value)
            ] = undefined
          } else if (modelval === predicateOption.value) {
            model[predicateElement.name] = undefined
          }
        }

        return isVisible
      })

      if (!everyOptionIsShowing) {
        return false
      }

      // Check to see if the model has one of the valid values to show the element
      return (
        conditionallyShowOption(
          formElementsCtrl,
          predicateElement,
          pageElements,
          rootModel,
          elementsEvaluated,
        ) && handleAttributePredicate(predicate, model, predicateElement)
      )
    }

    const isAttributeFilterValid = (
      formElementsCtrl,
      predicate,
      pageElements,
      rootModel,
      elementsEvaluated,
    ) => {
      let predicateElement = _find(formElementsCtrl.elements, (element) => {
        return element.id === predicate.elementId
      })

      let model = formElementsCtrl.model
      // If we cant find the element used for the predicate,
      // we can check to see if the element being evaluated
      // is in a repeatable set and the predicate element is
      // in a parent list of elements.
      if (!predicateElement) {
        if (formElementsCtrl.parentFormElementsCtrl) {
          return isAttributeFilterValid(
            formElementsCtrl.parentFormElementsCtrl,
            predicate,
            pageElements,
            rootModel,
            elementsEvaluated,
          )
        } else {
          // Check if we can find the element in the page level elements
          _find(pageElements, (pageElement) => {
            predicateElement = _find(
              pageElement.elements,
              (pageLevelElement) => {
                return pageLevelElement.id === predicate.elementId
              },
            )
            return !!predicateElement
          })
          if (predicateElement) {
            // Here we will also need to check that the page the predicate option
            // is on, is also not hidden. If it is hidden we will treat this predicate
            // element as hidden as well.

            // Found the element on another page, this means
            // we must use the root level model to evaluate the predicate
            model = rootModel
          } else {
            // if we have not found the predicate on another page,
            // there is bad configuration and the attribute filter is not valid
            // and wont be applied
            return false
          }
        }
      }

      // now we have the model and predicate element, verify that the predicate element
      // is not hidden
      if (
        !conditionallyShowElement(
          formElementsCtrl,
          predicateElement,
          pageElements,
          rootModel,
          [],
        )
      ) {
        return false
      }

      // verify that at least one option is selected
      const values = model[predicateElement.name]
      if (!values) return false
      // if the model value is an array, verify that it has a selection
      if (
        angular.isArray(values) &&
        (!values.length || !values.filter(angular.isDefined).length)
      ) {
        return false
      }

      return true
    }

    const conditionallyShowOption = (
      formElementsCtrl,
      optionToEvaluate,
      pageElements,
      rootModel,
      optionsEvaluated,
    ) => {
      // If the element does not have the `conditionallyShow` flag set,
      // we can always show the element.

      if (
        !optionToEvaluate ||
        !optionToEvaluate.attributes ||
        !angular.isArray(optionToEvaluate.attributes) ||
        !optionToEvaluate.attributes.length
      ) {
        return true
      }

      // Check to see if this element has already been used to evaluate
      // if the element should be shown based on parent element conditional logic
      if (
        optionsEvaluated.some((optionId) => optionId === optionToEvaluate.id)
      ) {
        throw new Error(
          'Your conditional logic has caused an infinite loop. Check the following Fields to ensure element A does not rely on element B if element B also relies on element A.',
        )
      } else {
        optionsEvaluated.push(optionToEvaluate.id)
      }

      const predicateFunction = (predicate) => {
        // Validate the predicate data, if it is invalid,
        // we will always show the field
        if (
          !predicate ||
          !predicate.elementId ||
          !predicate.optionIds ||
          !predicate.optionIds.length
        ) {
          return true
        }

        return conditionallyShowOptionByPredicate(
          formElementsCtrl,
          predicate,
          pageElements,
          rootModel,
          optionsEvaluated,
        )
      }

      const validPredicates = optionToEvaluate.attributes.filter(
        (predicate) => {
          return isAttributeFilterValid(
            formElementsCtrl,
            predicate,
            pageElements,
            rootModel,
            optionsEvaluated,
          )
        },
      )

      if (!validPredicates.length) return true
      return validPredicates.some(predicateFunction)
    }

    // ///////////////////////

    const generateDefaultData = (elements, preFillData) => {
      return elements.reduce((m, el) => {
        if (preFillData[el.name]) {
          m[el.name] = preFillData[el.name]
          return m
        }

        switch (el.type) {
          case 'checkboxes':
          case 'select':
          case 'autocomplete':
          case 'radio': {
            if (angular.isUndefined(el.defaultValue)) {
              break
            }
            // Cater for dynamic options
            if (el.optionsType === 'DYNAMIC') {
              m[el.name] = el.defaultValue
              break
            }
            // Cater for multi-select and checkboxes
            if (el.multi || el.type === 'checkboxes') {
              if (angular.isArray(el.defaultValue) && el.defaultValue.length) {
                m[el.name] = el.defaultValue.reduce(
                  (optionValues, optionId) => {
                    const option = _find(
                      el.options || [],
                      (option) => option.id === optionId,
                    )
                    if (option) {
                      optionValues.push(option.value)
                    }
                    return optionValues
                  },
                  [],
                )
              }
            } else {
              const option = _find(
                el.options || [],
                (option) => option.id === el.defaultValue,
              )
              if (option) {
                m[el.name] = option.value
              }
            }
            break
          }
          case 'number': {
            if (angular.isDefined(el.defaultValue)) {
              m[el.name] = el.defaultValue
            } else if (el.isSlider) {
              m[el.name] = el.minNumber
            }
            break
          }
          case 'form': {
            if (angular.isArray(el.elements)) {
              m[el.name] = generateDefaultData(el.elements, {})
            }
            break
          }
          case 'repeatableSet': {
            if (
              angular.isArray(el.elements) &&
              angular.isNumber(el.minSetEntries)
            ) {
              // add min number of entries by default
              m[el.name] = []
              for (let index = 0; index < el.minSetEntries; index++) {
                const entry = generateDefaultData(el.elements, {})
                m[el.name].push(entry)
              }
            }
            break
          }
          case 'file':
          case 'files':
          case 'camera':
          case 'draw':
          case 'location':
          case 'date':
          case 'datetime':
          case 'time':
          case 'text':
          case 'barcodeScanner':
          case 'email':
          case 'telephone':
          case 'textarea': {
            if (angular.isDefined(el.defaultValue)) {
              m[el.name] = el.defaultValue
            }
            break
          }
          case 'captcha':
          case 'page':
          case 'heading':
          case 'html':
          case 'image':
          case 'infoPage':
          case 'calculation':
          case 'summary':
            break
          default: {
            $log.warn(
              'Default value is not supported for element type',
              el.type,
            )
          }
        }

        return m
      }, angular.copy(preFillData))
    }

    const findUpElementById = (id, ctrl) => {
      const element = _find(ctrl.elements, (element) => {
        return element.id === id
      })

      if (element) return element

      if (ctrl.parentFormElementsCtrl) {
        return findUpElementById(id, ctrl.parentFormElementsCtrl)
      }
      // look through other pages for the element
      if (ctrl.formRendererCtrl) {
        let predicateElement
        _find(ctrl.formRendererCtrl.pages, (pageElement) => {
          predicateElement = _find(pageElement.elements, (pageLevelElement) => {
            return pageLevelElement.id === id
          })
          return !!predicateElement
        })

        if (predicateElement) return predicateElement
      }
    }

    const searchUrlForOptions = (value, url) => {
      return $http
        .get(`${url}?value=${value}`)
        .then((res) => res.data)
        .then((options) => {
          return options.map((option, index) => {
            return {
              id: option.value || index,
              value: option.value || index,
              label: option.label || index,
            }
          })
        })
    }

    const setOptionsForElement = (element, formElementsCtrl) => {
      if (!element.optionsType || element.optionsType === 'CUSTOM') {
        return $q.resolve()
      }

      if (element.optionsType !== 'DYNAMIC' || !element.dynamicOptionSetId) {
        return $q.resolve()
      }

      return formsApiService
        .getDynamicOptionsSetById(element.dynamicOptionSetId)
        .then((dynamicOptionsSet) => {
          if (!dynamicOptionsSet) {
            throw new Error(
              'Could not find Dynamic Options Set for Id: ' +
                element.dynamicOptionSetId,
            )
          }

          return $http.get(dynamicOptionsSet.url).then((res) => res.data)
        })
        .catch((error) => {
          $log.warn(
            'Error fetching dynamic options for element',
            element,
            error,
          )
          return []
        })
        .then((options) => {
          if (!angular.isArray(options)) {
            options = []
          }
          element.options = options.map((option, index) => {
            option = option || {}
            const optionsMap = (option.attributes || []).reduce(
              (memo, { label, value }) => {
                if (
                  !element.attributesMapping ||
                  !angular.isArray(element.attributesMapping)
                ) {
                  return memo
                }
                const attribute = _find(
                  element.attributesMapping,
                  (map) => map.attribute === label,
                )
                if (!attribute) return memo

                const elementId = attribute.elementId
                const predicateElement = findUpElementById(
                  elementId,
                  formElementsCtrl,
                )
                if (!predicateElement) return memo

                const predicateOption = _find(
                  predicateElement.options,
                  (option) => option.value === value,
                )
                if (elementId && predicateOption) {
                  memo[elementId] = memo[elementId] || {
                    elementId,
                    optionIds: [],
                  }
                  memo[elementId].optionIds.push(predicateOption.id)
                  element.conditionallyShowOptionsElementIds =
                    element.conditionallyShowOptionsElementIds || []
                  element.conditionallyShowOptionsElementIds.push(elementId)
                }
                return memo
              },
              {},
            )

            return {
              id: option.value || index,
              value: option.value || index,
              label: option.label || index,
              colour: option.colour || undefined,
              attributes: Object.keys(optionsMap).map((key) => optionsMap[key]),
            }
          })
        })
    }

    return {
      conditionallyShow: conditionallyShowElement,
      conditionallyShowOption,
      generateDefaultData,
      setOptionsForElement,
      searchUrlForOptions,
    }
  })
