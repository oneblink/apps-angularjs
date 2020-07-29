'use strict'

import Flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'

function link(scope, element, $attrs, ngModel) {
  const fpOpts = scope.fpOpts()
  const el = element[0]

  const vp = new Flatpickr(el, fpOpts)

  if (scope.fpOnSetup) {
    scope.fpOnSetup({
      fpItem: vp,
    })
  }

  // Custom blur listener to allow dates to be typed in and set
  // without having to press the "Enter" key, courtesy of this guy:
  // https://github.com/flatpickr/flatpickr/issues/1551#issuecomment-646679246
  if (fpOpts.allowInput) {
    const format = fpOpts.altInput ? fpOpts.altFormat : fpOpts.dateFormat
    const onBlurListener = (e) => {
      const date = Flatpickr.parseDate(e.target.value, format)
      if (date) {
        ngModel.$setDate(date)
      } else {
        vp.clear()
      }
    }

    const input = fpOpts.altInput ? vp.altInput : el
    input.addEventListener('blur', onBlurListener)
    element.on('$destroy', function () {
      input.removeEventListener('blur', onBlurListener)
    })
  }

  // destroy the flatpickr instance when the dom element is removed
  element.on('$destroy', function () {
    vp.destroy()
  })

  // Due to this bug: https://github.com/flatpickr/flatpickr/issues/831
  // Observe changes to disabled attribute if using ngDisabled
  if ($attrs.ngDisabled) {
    $attrs.$observe('disabled', (disabled) => {
      element.parent().children()[1].disabled = disabled
    })
  }

  /* eslint-disable angular/document-service, angular/definedundefined */

  //
  // The following functions were copied from the flatpickr library
  // to allow use to set a date in that is invalid (e.g. outside of min.max)
  // and display validation errors instead of the default behaviour of
  // the library which is to clear in the input if an invalid date is set.
  //
  // Issue is being tracked here: https://github.com/flatpickr/flatpickr/issues/1224
  //

  function triggerEvent(event, data) {
    // If the instance has been destroyed already, all hooks have been removed
    if (vp.config === undefined) return

    const hooks = vp.config[event]

    if (hooks !== undefined && hooks.length > 0) {
      for (let i = 0; hooks[i] && i < hooks.length; i++) {
        hooks[i](vp.selectedDates, vp.input.value, vp, data)
      }
    }

    if (event === 'onChange') {
      vp.input.dispatchEvent(createEvent('change'))

      // many front-end frameworks bind to the input event
      vp.input.dispatchEvent(createEvent('input'))
    }
  }

  function createEvent(name) {
    const e = document.createEvent('Event')
    e.initEvent(name, true, true)
    return e
  }

  function getDateStr(format) {
    return vp.selectedDates
      .map((dObj) => vp.formatDate(dObj, format))
      .filter(
        (d, i, arr) =>
          vp.config.mode !== 'range' ||
          vp.config.enableTime ||
          arr.indexOf(d) === i,
      )
      .join(
        vp.config.mode !== 'range'
          ? vp.config.conjunction
          : vp.l10n.rangeSeparator,
      )
  }

  /**
   * Updates the values of inputs associated with the calendar
   */
  function updateValue(triggerChange = true) {
    if (vp.mobileInput !== undefined && vp.mobileFormatStr) {
      vp.mobileInput.value =
        vp.latestSelectedDateObj !== undefined
          ? vp.formatDate(vp.latestSelectedDateObj, vp.mobileFormatStr)
          : ''
    }

    vp.input.value = getDateStr(vp.config.dateFormat)

    if (vp.altInput !== undefined) {
      vp.altInput.value = getDateStr(vp.config.altFormat)
    }

    if (triggerChange !== false) triggerEvent('onValueUpdate')
  }

  ngModel.$setDate = (date) => {
    if ((date !== 0 && !date) || (date instanceof Array && date.length === 0)) {
      return vp.clear(true)
    }

    vp.selectedDates = [vp.parseDate(date)]

    vp.showTimeInput = vp.selectedDates.length > 0
    vp.latestSelectedDateObj = vp.selectedDates[0]

    vp.redraw()
    vp.jumpToDate()

    vp._setHoursFromDate()
    if (vp.selectedDates.length === 0) {
      vp.clear(false)
    }

    updateValue(true)

    triggerEvent('onChange')
  }

  /* eslint-enable angular/document-service, angular/definedundefined */
}

angular
  .module('oneblink.forms.renderer')
  .directive('obDatePicker', function () {
    'use strict'
    return {
      require: 'ngModel',
      restrict: 'A',
      scope: {
        fpOpts: '&',
        fpOnSetup: '&',
      },
      link,
    }
  })
