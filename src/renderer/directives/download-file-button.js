'use strict'

import downloadFileButtonTemplate from './download-file-button.html'

angular
  .module('oneblink.forms.renderer')
  .directive('obDownloadFileButton', function (downloadFileService) {
    'ngInject'

    return {
      template: downloadFileButtonTemplate,
      scope: {
        obDownloadFileButton: '<',
      },
      restrict: 'A',
      link: function link($scope, $element, $attrs) {
        $scope.isInputButton = $element[0].classList.contains('is-input-addon')

        function onButtonClick() {
          $element[0].disabled = true
          $scope.isDownloading = true
          $scope.$applyAsync()
          const dataURI = $scope.obDownloadFileButton
          const fileName = $attrs.obDownloadFileName

          downloadFileService.downloadFile(dataURI, fileName).then(() => {
            $element[0].disabled = false
            $scope.isDownloading = false
            $scope.$applyAsync()
          })
        }

        $element.on('click', onButtonClick)

        $scope.$on('$destroy', () => {
          $element.off('click', onButtonClick)
        })
      },
    }
  })
