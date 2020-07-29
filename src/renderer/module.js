'use strict'

import 'angular-scroll'
import 'signature_pad/dist/signature_pad.umd.js'
import '@blinkmobile/angular-location'
import '@blinkmobile/canvas-manipulation'
import '@blinkmobile/angular-signature-pad'
import 'angular-recaptcha'

import authenticationModule from '../authentication/module.js'
import autoSaveModule from '../services/auto-save-service.js'
import dataCleanerModule from '../services/data-cleaner-service.js'

angular
  .module('oneblink.forms.renderer', [
    'ngRoute',
    'ngMessages',
    'duScroll',
    'bmLocation',
    'bmSignaturePad',
    'oneblink.forms.api',
    'oneblink.forms.s3-submit-service',
    'vcRecaptcha',
    authenticationModule,
    autoSaveModule,
    dataCleanerModule,
  ])
  .config(function (vcRecaptchaServiceProvider) {
    'ngInject'

    vcRecaptchaServiceProvider.setSiteKey(__RECAPTCHA_SITE_KEY__)
  })
  .filter('highlight', function ($sce) {
    'ngInject'

    return function (text, phrase) {
      if (phrase) {
        text = text.replace(new RegExp('(' + phrase + ')', 'gi'), '<b>$1</b>')
      }

      return $sce.trustAsHtml(text)
    }
  })
  .run(function ($rootScope) {
    'ngInject'
    $rootScope.googleMapsApiKey = __GOOGLE_MAPS_API_KEY__
  })
