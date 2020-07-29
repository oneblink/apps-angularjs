'use strict'

import lookupNotificationTemplate from './lookup-notification.html'
import lookupButtonTemplate from './lookup-button.html'

angular
  .module('oneblink.forms.renderer')
  .directive('obLookup', function () {
    'ngInject'

    return {
      restrict: 'A',
      scope: {
        obLookup: '<',
      },
      controller: function ($scope) {
        'ngInject'

        this.element = $scope.obLookup
        this.isOffline = false
        this.isLookingUp = false
        this.isCancellable = false
        this.hasLookupSucceeded = false
        this.hasLookupFailed = false
        this.lookupErrorMessage = null
      },
    }
  })
  .component('obLookupNotification', {
    template: lookupNotificationTemplate,
    require: {
      obLookupCtrl: '^obLookup',
    },
  })
  .directive('obLookupButton', function (
    $log,
    $q,
    $http,
    $timeout,
    formsApiService,
    offlineService,
  ) {
    'ngInject'

    return {
      template: lookupButtonTemplate,
      require: ['^formRenderer', '^formElements', '^obLookup', '^form'],
      scope: {
        obLookup: '<',
      },
      restrict: 'A',
      link: function link($scope, $element, $attrs, controllers) {
        const formRendererCtrl = controllers[0]
        const formElementsCtrl = controllers[1]
        const obLookupCtrl = controllers[2]
        const parentFormCtrl = controllers[3]
        const ngModelCtrl = parentFormCtrl[obLookupCtrl.element.name]

        if (
          !obLookupCtrl.element.isDataLookup &&
          !obLookupCtrl.element.isElementLookup
        ) {
          return
        }

        if (!ngModelCtrl) {
          $log.warn(
            'Element has not been correctly implemented, it is missing an "ng-model" attribute with a "name" attribute',
            obLookupCtrl.element,
          )
          return
        }

        const withoutButtonLookupTypeElements = [
          'radio',
          'select',
          'autocomplete',
          'location',
        ]

        const hideButton =
          withoutButtonLookupTypeElements.find(
            (type) => obLookupCtrl.element.type === type,
          ) && !obLookupCtrl.element.multi

        obLookupCtrl.element.hasClickedLookupButton =
          obLookupCtrl.element.hasClickedLookupButton || false

        // Set lookup validation to false to enforce lookup
        const validateLookupButton = () => {
          const isEmpty = ngModelCtrl.$isEmpty(ngModelCtrl.$viewValue)
          ngModelCtrl.$setValidity(
            'lookup',
            isEmpty ||
              (obLookupCtrl.isOffline && !obLookupCtrl.element.required)
              ? true
              : obLookupCtrl.element.hasClickedLookupButton,
          )

          if (!hideButton) {
            $element[0].disabled =
              isEmpty ||
              (ngModelCtrl.$invalid &&
                Object.keys(ngModelCtrl.$error).length > 1)
          }
        }
        ngModelCtrl.$viewChangeListeners.push(validateLookupButton)
        validateLookupButton()

        $scope.obLookupCtrl = obLookupCtrl
        $scope.isInputButton = $element[0].classList.contains('is-input-addon')
        $element[0].classList.add('ob-lookup__button')

        let canceler = null

        const finishRequest = (isStillLookingUp) => {
          if (canceler) {
            canceler.resolve()
            canceler = null
          }
          obLookupCtrl.isLookingUp = isStillLookingUp
          if (!hideButton) {
            $element[0].disabled = false
          }
        }

        function triggerLookup() {
          const hasValue =
            !ngModelCtrl.$isEmpty(ngModelCtrl.$viewValue) &&
            (ngModelCtrl.$valid ||
              (ngModelCtrl.$error &&
                Object.keys(ngModelCtrl.$error).length === 1 &&
                ngModelCtrl.$error.lookup))

          // if the element triggering the lookup has no value..
          // ..return and do nothing
          if (!hasValue) return

          parentFormCtrl.$submitted = false

          if (offlineService.isOffline()) {
            obLookupCtrl.isOffline = true
            obLookupCtrl.hasLookupFailed = true
            obLookupCtrl.isLookingUp = true
            $scope.$applyAsync()
            validateLookupButton()
            return
          }

          if (!hideButton) {
            $element[0].disabled = true
          }
          obLookupCtrl.isOffline = false
          obLookupCtrl.isCancellable = false
          obLookupCtrl.hasLookupSucceeded = false
          obLookupCtrl.hasLookupFailed = false
          obLookupCtrl.lookupErrorMessage = null
          obLookupCtrl.isLookingUp = true

          // After certain amount of time, show the cancel button
          const timeoutPromise = $timeout(() => {
            obLookupCtrl.isCancellable = !!canceler && obLookupCtrl.isLookingUp
          }, 5000)

          canceler = $q.defer()

          const payload = {
            submission: formRendererCtrl.getCurrentSubmissionDataWithoutBinary(),
          }
          const config = {
            timeout: canceler.promise,
          }

          let dataLookup = $q.resolve()
          if (obLookupCtrl.element.dataLookupId) {
            $log.log(
              'Attempting to retrieve form element lookup for id:',
              obLookupCtrl.element.dataLookupId,
            )
            dataLookup = formsApiService
              .getFormElementLookupById(obLookupCtrl.element.dataLookupId)
              .then((formElementLookup) => {
                if (!formElementLookup || !formElementLookup.url) {
                  $log.log(
                    'Could not find URL for form element lookup for id:',
                    obLookupCtrl.element.dataLookupId,
                    formElementLookup,
                  )
                  throw new Error('Could not find element lookup configuration')
                }
                $log.log(
                  'Attempting a data lookup request to:',
                  formElementLookup.url,
                )
                return $http
                  .post(formElementLookup.url, payload, config)
                  .then((response) => {
                    $log.log(
                      'Response from data lookup to:',
                      formElementLookup.url,
                      response,
                    )
                    // Check isLookingUp again incase it was cancelled.
                    if (response.data && obLookupCtrl.isLookingUp) {
                      formRendererCtrl.mergeLookupData(response.data)
                    }
                  })
              })
          }

          let elementLookup = $q.resolve()
          if (obLookupCtrl.element.elementLookupId) {
            const currentPageIndex = formRendererCtrl.currentPageIndex
            $log.log(
              'Attempting to retrieve form element lookup for id:',
              obLookupCtrl.element.elementLookupId,
            )
            elementLookup = formsApiService
              .getFormElementLookupById(obLookupCtrl.element.elementLookupId)
              .then((formElementLookup) => {
                if (!formElementLookup || !formElementLookup.url) {
                  $log.log(
                    'Could not find URL for form element lookup for id:',
                    obLookupCtrl.element.elementLookupId,
                    formElementLookup,
                  )
                  throw new Error('Could not find element lookup configuration')
                }
                formRendererCtrl.removeInjectedPages(obLookupCtrl.element.id)
                formElementsCtrl.injectElementsAfter(obLookupCtrl.element, [])
                $log.log(
                  'Attempting an element lookup request to:',
                  formElementLookup.url,
                )
                return $http
                  .post(formElementLookup.url, payload, config)
                  .then((response) => {
                    $log.log(
                      'Response from element lookup to:',
                      formElementLookup.url,
                      response,
                    )
                    // Check isLookingUp again incase it was cancelled.
                    if (response.data && obLookupCtrl.isLookingUp) {
                      if (
                        response.data &&
                        response.data[0] &&
                        response.data[0].type === 'page'
                      ) {
                        formRendererCtrl.injectPagesAfter(
                          currentPageIndex,
                          obLookupCtrl.element.id,
                          response.data,
                        )
                      } else {
                        formElementsCtrl.injectElementsAfter(
                          obLookupCtrl.element,
                          response.data,
                        )
                      }
                    }
                  })
              })
          }
          $q.all([dataLookup, elementLookup])
            .then(() => {
              obLookupCtrl.hasLookupSucceeded = true
              obLookupCtrl.element.hasClickedLookupButton = true
              validateLookupButton()

              // After certain amount of time, hide the lookup succeeded message
              return $timeout(() => false, 750)
            })
            .catch((error) => {
              // Cancelling will throw an error. If there is no canceler
              // we know that it was a request error and not a cancelled request
              if (canceler) {
                $log.warn('Error from lookup:', error)
                obLookupCtrl.hasLookupFailed = true

                // if lookup fails and element is not required
                // allow user to still submit the form

                if (!obLookupCtrl.element.required) {
                  ngModelCtrl.$setValidity('lookup', true)
                }

                if (error.status === 400 && error.data && error.data.message) {
                  obLookupCtrl.lookupErrorMessage = error.data.message
                } else {
                  obLookupCtrl.lookupErrorMessage =
                    'It looks like something went wrong.<br/> Please try again.<br /> If the issue continues, please contact support.'
                }
                return true
              }
              return false
            })
            .then((isStillLookingUp) => finishRequest(isStillLookingUp))
            .then(() => $timeout.cancel(timeoutPromise))
        }

        // For certain elements, do not add click event
        // instead, watch model for changes and trigger lookup function

        // we must check for 'isMulti' to cater for multiple selects
        if (hideButton) {
          // remove button html element for these types
          $element.remove()
          ngModelCtrl.$viewChangeListeners.push(triggerLookup)
          triggerLookup()
        } else {
          // element uses a lookup button, so add a click listener
          $element.on('click', triggerLookup)
        }
        obLookupCtrl.onCancelLookup = () => {
          $log.log('Lookup was cancelled')
          finishRequest()
        }
      },
    }
  })
