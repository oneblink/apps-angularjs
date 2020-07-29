'use strict'

import headingTemplate from './heading-template.html'
import textTemplate from './text-template.html'
import textareaTemplate from './textarea-template.html'
import dateTemplate from './date-template.html'
import dateTimeTemplate from './date-time-template.html'
import timeTemplate from './time-template.html'
import numberTemplate from './number-template.html'
import radioTemplate from './radio-template.html'
import checkboxTemplate from './checkbox-template.html'
import selectBoxTemplate from './select-template.html'
import locationTemplate from './location-template.html'
import cameraTemplate from './camera-template.html'
import signatureTemplate from './signature-template.html'
import repeatableSetTemplate from './repeatable-set-template.html'
import formElementsTemplate from './form-elements-template.html'
import obHtmlTemplate from './ob-html-template.html'
import barcodeScannerTemplate from './barcode-scanner-template.html'
import captchaTemplate from './captcha-template.html'
import emailTemplate from './email-template.html'
import imageTemplate from './ob-image-template.html'
import fileTemplate from './ob-file-template.html'
import filesTemplate from './ob-files-template.html'
import calculationTemplate from './calculation-template.html'
import telephoneTemplate from './telephone-template.html'
import autocompleteTemplate from './autocomplete-template.html'
import autocompleteSearchTemplate from './autocomplete-search-template.html'
import summaryTemplate from './summary-template.html'

import barcodeScannerController from './barcode-scanner-controller.js'
import checkboxController from './checkbox-controller.js'
import cameraController from './camera-controller.js'
import dateController from './date-controller'
import repeatableSetController from './repeatable-set-controller.js'
import obHtmlController from './ob-html-controller.js'
import obFileController from './ob-file-controller.js'
import obFilesController from './ob-files-controller.js'
import numberController from './number-controller.js'
import calculationController from './calculation-controller'
import autocompleteController from './autocomplete-controller'
import autocompleteSearchController from './autocomplete-search-controller'
import summaryController from './summary-controller'

import './signature.css'
import './checkbox.css'

function generateComponent(name, template, controller) {
  controller =
    controller ||
    function ($log, renderService, scrollingService) {
      'ngInject'
      const self = this

      this.$onInit = function () {
        self.value = self.initialValue || null
        self.isFetchingOptions = true
        renderService
          .setOptionsForElement(self.element, self.formElementsCtrl)
          .then(() => {
            self.isFetchingOptions = false

            if (self.value && angular.isArray(self.element.options)) {
              // check that the model value and the option values for the dynamic option set
              // are the same type. If they are not, default value will not be set,
              // so display a helpful console message for the developer...
              const selected = self.element.options.find(
                (option) => option.value == self.value,
              )
              if (!selected) {
                return
              }

              const optionSetType = typeof selected.value
              const modelType = typeof self.value
              if (optionSetType !== modelType) {
                $log.warn(
                  `Default values for ${name} cannot be shown: the data type of the dynamic options \`value\` property (${optionSetType}) does not match the data type for the value for \`${name}\` (${modelType})`,
                )
              }
            }
          })
      }

      if (window.cordova) {
        this.bmSignaturePadOptions = {
          onBegin: scrollingService.disableScrolling,
          onEnd: scrollingService.enableScrolling,
        }
      } else {
        this.bmSignaturePadOptions = {}
      }
    }
  angular.module('oneblink.forms.renderer').component(name, {
    template,
    controller,
    bindings: {
      element: '<',
      initialValue: '<',
      parentFormName: '<',
      updateProperty: '&',
      conditionallyShowOptionFilter: '&',
    },
    require: {
      formRendererCtrl: '^formRenderer',
      parentForm: '^^form',
      formElementsCtrl: '^^formElements',
    },
  })
}

generateComponent('heading', headingTemplate)
generateComponent('text', textTemplate)
generateComponent('textArea', textareaTemplate)
generateComponent('date', dateTemplate, dateController)
generateComponent('dateTime', dateTimeTemplate, dateController)
generateComponent('time', timeTemplate, dateController)
generateComponent('number', numberTemplate, numberController)
generateComponent('radio', radioTemplate)
generateComponent('checkbox', checkboxTemplate, checkboxController)
generateComponent('selectBox', selectBoxTemplate)
generateComponent('location', locationTemplate)
generateComponent('camera', cameraTemplate, cameraController)
generateComponent('signature', signatureTemplate)
generateComponent('obHtml', obHtmlTemplate, obHtmlController)
generateComponent(
  'barcodeScanner',
  barcodeScannerTemplate,
  barcodeScannerController,
)
generateComponent('captcha', captchaTemplate)
generateComponent('email', emailTemplate)
generateComponent('obImage', imageTemplate)
generateComponent('obFile', fileTemplate, obFileController)
generateComponent('obFiles', filesTemplate, obFilesController)
generateComponent('telephone', telephoneTemplate)
generateComponent(
  'obAutocomplete',
  autocompleteTemplate,
  autocompleteController,
)
generateComponent(
  'obAutocompleteSearch',
  autocompleteSearchTemplate,
  autocompleteSearchController,
)
generateComponent('calculation', calculationTemplate, calculationController)
generateComponent('obSummary', summaryTemplate, summaryController)

angular
  .module('oneblink.forms.renderer')
  .component('repeatableSet', {
    template: repeatableSetTemplate,
    controller: repeatableSetController,
    bindings: {
      element: '<',
      conditionallyShow: '<',
      conditionallyShowOptionFilter: '<',
      oddOrEven: '@',
      updateNestedProperty: '&',
      updateProperty: '&',
      parentFormName: '<',
    },
    require: {
      ngModelCtrl: 'ngModel',
    },
  })
  .component('formElements', {
    template: formElementsTemplate,
    bindings: {
      model: '<',
      elements: '<',
      conditionallyShow: '<',
      conditionallyShowOptionFilter: '<',
      oddOrEven: '@',
      onChange: '&',
      onChangeElements: '&',
      parentFormName: '<',
    },
    require: {
      ngFormCtrl: '^form',
      parentFormElementsCtrl: '?^^formElements',
      formRendererCtrl: '^^formRenderer',
    },
    controller: function ($log, renderService) {
      'ngInject'
      this.onUpdateNestedProperty = (
        element,
        nestedElementNamePath,
        nestedElement,
        value,
      ) => {
        this.model[element.name] = this.model[element.name] || {}
        this.model[element.name][nestedElement.name] = value
        this.onChange({
          $elementNamePath: element.name + '|' + nestedElementNamePath,
          $element: nestedElement,
          $value: value,
        })
      }
      this.onUpdateProperty = (element, value) => {
        this.model[element.name] = value
        this.onChange({
          $elementNamePath: element.name,
          $element: element,
          $value: value,
        })
      }

      this.injectElementsAfter = (element, newElements) => {
        const indexOfElement = this.elements.indexOf(element)
        if (indexOfElement === -1) {
          $log.log('Could not find element', element)
          return
        }

        const defaultData = renderService.generateDefaultData(
          newElements,
          this.model,
        )
        Object.assign(this.model, defaultData)

        // Filter out already injected elements
        const allElements = this.elements.filter(
          (e) => e.injectedByElementId !== element.id,
        )
        allElements.splice(
          indexOfElement + 1,
          0,
          ...newElements.map((e) => {
            e.injectedByElementId = element.id
            return e
          }),
        )

        this.onChangeElements({
          $elements: allElements,
        })
      }
    },
  })
