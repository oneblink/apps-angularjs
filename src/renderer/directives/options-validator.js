'use strict'

angular
  .module('oneblink.forms.renderer')
  .directive('obOptionsValidator', function ($log) {
    'ngInject'

    return {
      require: ['ngModel', '^formRenderer'],
      restrict: 'A',
      scope: {
        obOptionsValidator: '&',
        obElement: '<',
      },
      link: function link($scope, $element, $attrs, controllers) {
        const ngModel = controllers[0]

        ngModel.$validators.isValidOption = function (modelValue, viewValue) {
          const options = $scope.obOptionsValidator()
          const value = modelValue || viewValue

          // Not validating required
          if (value === null || angular.isUndefined(value)) {
            return true
          }

          if (angular.isArray(value)) {
            if (value.length) {
              for (let i = 0; i < value.length; i++) {
                if (!options.some((option) => option.value === value[i])) {
                  return false
                }
              }
            }
            // If there are no options selected for an input that allows multiple,
            // it is valid unless it is required, which is not validated here.
            return true
          } else {
            return options.some((option) => option.value === value)
          }
        }

        if (
          $scope.obElement.conditionallyShowOptions &&
          angular.isArray(
            $scope.obElement.conditionallyShowOptionsElementIds,
          ) &&
          $scope.obElement.conditionallyShowOptionsElementIds.length
        ) {
          const formRendererCtrl = controllers[1]
          const modelChangeListener = ({ element }) => {
            if (
              $scope.obElement.conditionallyShowOptionsElementIds.some(
                (elementId) => elementId === element.id,
              )
            ) {
              $log.log(
                'Validating element with options due to filtering element changing',
                element,
              )
              if (
                !ngModel.$validators.isValidOption(
                  ngModel.$modelValue,
                  ngModel.$viewValue,
                )
              ) {
                ngModel.$setViewValue(undefined)
                ngModel.$render()
              }
            }
          }

          formRendererCtrl.registerModelChangeListener(modelChangeListener)

          // clean up listener when scope is destroyed
          $scope.$on('$destroy', () => {
            formRendererCtrl.unregisterModelChangeListener(modelChangeListener)
          })
        }
      },
    }
  })
