'use strict'

import geolocation from '@blinkmobile/geolocation'

import template from './ob-confirm-location-on-map.html'

function ObConfirmLocationOnMapController(
  $log,
  $scope,
  $q,
  offlineService,
) {
  'ngInject'

  const goOnline = () => {
    $log.log('Enabling location widget while online')
    this.isOffline = false
    $scope.$applyAsync()
  }

  const goOffline = () => {
    $log.log('Disabling location widget while offline')
    this.isOffline = true
    $scope.$applyAsync()
  }

  this.$onInit = () => {
    this.isEditing = false
    this.coords = null
    this.isOffline = offlineService.isOffline()

    offlineService.onNetworkChange('online', $scope, goOnline)
    offlineService.onNetworkChange('offline', $scope, goOffline)

    this.ngModel.$render = () => {
      this.coords = this.ngModel.$viewValue
    }
  }

  this.$onDestroy = () => {
    delete this.ngModel.$render
  }

  this.$onChanges = () => {
    this.coords = this.ngModel.$viewValue
  }

  this.onCancel = () => {
    this.coords = this.ngModel.$viewValue
    this.isEditing = false
  }

  this.onChange = (value) => {
    this.coords = value
  }

  this.onClear = (event) => {
    this.coords = undefined
    this.ngModel.$setViewValue(this.coords, event)
  }

  this.onConfirm = (event) => {
    this.isEditing = false
    this.ngModel.$setViewValue(this.coords, event)
  }

  this.onEdit = () => {
    if (offlineService.isOffline()) {
      this.isOffline = true
    }
    if (this.coords) {
      this.isEditing = true
      return
    }

    this.loading = true
    $q.resolve()
      .then(() => geolocation.getCurrentPosition())
      .then((position) => {
        $log.log('Current position via geolocation', position)
        if (position.coords) {
          const { latitude = 0, longitude = 0 } = position.coords || {}
          return { latitude, longitude }
        } else {
          return null
        }
      })
      .catch((err) => {
        $log.warn(
          'An error occurred attempting to retrieve current position via geolocation',
          err,
        )
        return null
      })
      .then((coords) => {
        this.coords = coords
        this.loading = false
        this.isEditing = true
      })
  }
}

angular.module('oneblink.forms.renderer').component('obConfirmLocationOnMap', {
  template,
  controller: ObConfirmLocationOnMapController,
  require: {
    ngModel: 'ngModel',
  },
  bindings: {
    element: '<',
  },
})
