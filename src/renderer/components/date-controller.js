'use strict'

export default function (vocabularyService) {
  'ngInject'

  const self = this

  this.$onInit = function () {
    self.value = self.initialValue
      ? new Date(self.initialValue === 'NOW' ? Date.now() : self.initialValue)
      : null
  }

  this.formatDate = vocabularyService.formatDate
  this.formatDatetime = vocabularyService.formatDatetime
  this.formatTime = vocabularyService.formatTime

  this.createDateOptions = (elementOpts) => {
    const config = {
      altInput: true,
      defaultDate: self.value,
      dateFormat: 'Y-m-d',
      altFormat: vocabularyService.flatpickrDateFormat,
      allowInput: true,
      altInputClass: 'input ob-input cypress-date-control',
    }

    config.onChange = function (selectedDates) {
      if (selectedDates[0] instanceof Date || !selectedDates[0]) {
        self.updateProperty({ value: selectedDates[0] || null })
      }
    }

    if (elementOpts.fromDate) {
      config.minDate = elementOpts.fromDate
    }
    if (elementOpts.toDate) {
      config.maxDate = elementOpts.toDate
    }

    if (elementOpts.type === 'datetime') {
      config.enableTime = true
      config.dateFormat = 'Y-m-dTH:i:S'
      config.altFormat = vocabularyService.flatpickrDatetimeFormat
      config.allowInput = false
      config.altInputClass = 'input ob-input cypress-date-time-control'
    }

    if (elementOpts.type === 'time') {
      config.noCalendar = true
      config.enableTime = true
      config.dateFormat = 'H:i'
      config.altFormat = vocabularyService.flatpickrTimeFormat
      config.time_24hr = false
      config.allowInput = false
      config.altInputClass = 'input ob-input cypress-time-control'
    }

    return config
  }
}
