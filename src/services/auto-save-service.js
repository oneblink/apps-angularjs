'use strict'

const moduleName = 'oneblink.forms.auto-save'

angular
  .module(moduleName, [])
  .service('autoSaveService', function (utilsService) {
    'ngInject'

    const service = {}
    const defaultExternalId = 'NO_EXTERNAL_ID'
    const defaultJobId = 'NO_JOB_ID'

    function getAutoSaveKey(formId, externalId, jobId) {
      return `AUTO_SAVE_${formId}_${externalId || defaultExternalId}_${jobId || defaultJobId}`
    }

    service.get = function (formId, externalId, jobId) {
      const key = getAutoSaveKey(formId, externalId, jobId)
      return utilsService.getLocalForageItem(key)
    }

    service.upsert = function (formId, externalId, jobId, model) {
      const key = getAutoSaveKey(formId, externalId, jobId)
      return utilsService.setLocalForageItem(key, model)
    }

    service.delete = function (formId, externalId, jobId) {
      const key = getAutoSaveKey(formId, externalId, jobId)
      return utilsService.removeLocalForageItem(key)
    }

    return service
  })

export default moduleName
