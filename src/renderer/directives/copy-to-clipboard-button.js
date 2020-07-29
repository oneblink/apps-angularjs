'use strict'

import copyToClipboardButtonTemplate from './copy-to-clipboard-button.html'

angular
  .module('oneblink.forms.renderer')
  .directive('obCopyToClipboardButton', function (utilsService) {
    'ngInject'

    return {
      template: copyToClipboardButtonTemplate,
      scope: {
        obCopyToClipboardButton: '<',
      },
      restrict: 'A',
      link: function link($scope, $element) {
        $scope.isInputButton = $element[0].classList.contains('is-input-addon')

        function onButtonClick() {
          utilsService.copyToClipboard($scope.obCopyToClipboardButton)
        }

        $element.on('click', onButtonClick)

        $scope.$on('$destroy', () => {
          $element.off('click', onButtonClick)
        })
      },
    }
  })
