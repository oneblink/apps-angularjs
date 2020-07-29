'use strict'

import _throttle from 'lodash.throttle'
import _find from 'lodash.find'
import jwtDecode from 'jwt-decode'

import template from './template.html'

function formRendererController(
  $scope,
  $q,
  $http,
  $location,
  $window,
  $document,
  $log,
  renderService,
  scrollingService,
  autoSaveService,
) {
  'ngInject'

  const self = this
  let throttledAutoSave
  const getThrottledAutoSave = () => {
    if (!throttledAutoSave) {
      throttledAutoSave = _throttle(() => {
        self.isAutoSaving = true
        $log.log('Auto saving...')
        $q.resolve()
          .then(() =>
            autoSaveService.upsert(
              self.definition.id,
              self.externalId,
              self.jobId,
              self.model,
            ),
          )
          .catch((error) => $log.error('Error while auto saving', error))
          .then(() => {
            self.isAutoSaving = false
          })
      }, 9580) // https://en.wikipedia.org/wiki/100_metres
    }

    return throttledAutoSave
  }

  this.isInformationForm = false

  const cancelThrottledAutoSave = () => {
    if (angular.isDefined(throttledAutoSave)) {
      throttledAutoSave.cancel()
      throttledAutoSave = undefined
    }
  }

  const unregisterLocationChangeListener = $scope.$on(
    '$locationChangeStart',
    (event) => {
      // When attempting to navigate away, if the form is not submitted
      // and is dirty (values changed), prompt to save draft
      if ($scope.obForm.$dirty) {
        event.preventDefault()
        self.cancelConfirm = true
      }
    },
  )

  const deleteAutoSaveData = () => {
    return autoSaveService
      .delete(this.form.id, self.externalId, self.jobId)
      .catch((error) => $log.log('Error removing auto save data: ', error))
  }

  this.$onDestroy = () => {
    cancelThrottledAutoSave()
    unregisterLocationChangeListener()
    // Enable scroll when navigating away
    scrollingService.enableScrolling()
  }

  const hasInputElement = function (elements) {
    return elements.reduce((memo, el) => {
      if (memo) return memo

      if (el.elements) return hasInputElement(el.elements)

      return (
        ['heading', 'html', 'image', 'infoPage'].indexOf(
          el.type.toLowerCase(),
        ) === -1
      )
    }, false)
  }

  this.$onInit = function () {
    self.isSubmitting = false
    self.submissionResult = null
    self.draftDetails = false
    self.isAutoSaving = false
    self.cancelConfirm = false

    if (self.draft) {
      $log.log('Resuming draft:', self.draft)
      self.draftTitle = self.draft.title
      self.draftId = self.draft.draftId
    } else {
      self.draftTitle = self.form.name
    }

    const startDate = self.form.publishStartDate
      ? new Date(self.form.publishStartDate)
      : null
    const endDate = self.form.publishEndDate
      ? new Date(self.form.publishEndDate)
      : null
    const now = new Date()
    // If now is before startDate or after endDate
    if ((startDate && now < startDate) || (endDate && now > endDate)) {
      const error = new Error('This form is currently unpublished.')
      error.title = 'Form Unavailable'
      self.errorTitle = error.title || null
      self.error = error.message
      return
    }


    autoSaveService.get(self.form.id, self.externalId, self.jobId)
      .then((autoSaveModel) => {
        self.isInformationForm = !hasInputElement(self.form.elements)
        $log.log(
          `Form ${
            self.isInformationForm ? 'is' : 'is not'
          } an informational form`,
        )

        if (self.form.isMultiPage) {
          self.pages = self.form.elements.map((pageElement, index) => {
            pageElement.index = index
            return pageElement
          })
        } else {
          self.form.index = 0
          self.pages = [self.form]
        }
        self.hasAutoSaveModel = !!autoSaveModel && !self.isPreview

        self.startFormSubmission = () => {
          const visiblePages = self.getVisiblePages()
          if (visiblePages[0]) {
            self.currentPageIndex = visiblePages[0].index
          }

          self.hasAutoSaveModel = false
          self.definition = self.form
        }

        self.startNewFormSubmission = () => {
          // Build up model based on each page. On submit we will
          // flatten the model to get submission data.
          self.model = {}
          self.pages.forEach((pageElement) => {
            const model = renderService.generateDefaultData(
              pageElement.elements,
              self.initialModel,
            )
            Object.assign(self.model, model)
          })

          self.startFormSubmission()
        }

        // If we found in progress form data, we will set that as the model
        // and prompt the user to start fresh of use this data
        if (!self.draft && self.hasAutoSaveModel) {
          self.model = autoSaveModel
        } else {
          self.startNewFormSubmission()
        }
      })
      .catch((error) => {
        self.errorTitle = error.title || null
        self.error = error.message
      })
  }

  this.showConfirmCancel = () => {
    // check if there has been an auto save
    if ($scope.obForm.$dirty) {
      self.cancelConfirm = true
    } else {
      self.cancelForm()
    }
  }

  this.hideConfirmCancel = () => {
    self.cancelConfirm = false
  }

  const modelChangeListeners = []

  this.registerModelChangeListener = (listener) => {
    modelChangeListeners.push(listener)
  }
  this.unregisterModelChangeListener = (listener) => {
    const index = modelChangeListeners.indexOf(listener)
    if (index !== -1) {
      modelChangeListeners.splice(index, 1)
    }
  }

  this.handleModelChange = (elementNamePath, element, value) => {
    if (!self.isPreview) {
      getThrottledAutoSave()()
    }
    modelChangeListeners.forEach((modelChangeListener) =>
      modelChangeListener({
        elementNamePath,
        element,
        value,
      }),
    )
  }

  this.cancelForm = () => {
    const allowCancel = self.beforeCancelForm()

    if (!allowCancel) {
      return
    }

    unregisterLocationChangeListener()
    cancelThrottledAutoSave()
    deleteAutoSaveData().then(() => {
      return self.onCancelForm()
    })
  }

  this.postSubmissionAction = () => {
    if (
      self.submissionResult &&
      self.submissionResult.isOffline &&
      !self.submissionResult.isInPendingQueue
    ) {
      self.submissionResult = null
      return
    }

    unregisterLocationChangeListener()
    cancelThrottledAutoSave()

    const submissionResult =
      self.submissionResult || createSubmissionResultBase()

    deleteAutoSaveData().then(() =>
      self.onPostSubmissionAction({ submissionResult }),
    )
  }

  this.getCurrentPage = () => {
    return _find(self.pages, (pageElement) => {
      return pageElement.index === this.currentPageIndex
    })
  }

  this.getCurrentPageNumber = () => {
    const currentPage = this.getCurrentPage()
    if (currentPage) {
      return this.getVisiblePages().indexOf(currentPage) + 1
    }
  }

  this.getVisiblePages = () => {
    return self.pages.filter((pageElement) => {
      return self.conditionallyShow(
        {
          elements: [],
          model: self.model,
        },
        pageElement,
      )
    })
  }

  this.conditionallyShow = (formElementsCtrl, element) => {
    const elementsEvaluated = []
    try {
      return renderService.conditionallyShow(
        formElementsCtrl,
        element,
        self.pages,
        self.model,
        elementsEvaluated,
      )
    } catch (error) {
      // self.onConditionallyShowError({ error })
      self.errorTitle = 'Bad Form Configuration'
      self.error = error.message
      self.elementsEvaluatedForConditionalLogic = elementsEvaluated
      self.definition = null
      return false
    }
  }

  this.conditionallyShowOptionFilter = (formElementsControl, element) => (
    option,
  ) => {
    if (!element.conditionallyShowOptions) return true
    const elementsEvaluated = []
    try {
      return renderService.conditionallyShowOption(
        formElementsControl,
        option,
        self.pages,
        self.model,
        elementsEvaluated,
      )
    } catch (error) {
      // self.onConditionallyShowError({ error })
      self.errorTitle = 'Bad Form Configuration'
      self.error = error.message
      self.elementsEvaluatedForConditionalLogic = elementsEvaluated
      self.definition = null
      return true
    }
  }

  this.setPageIndex = (index) => {
    checkCanSaveForm(
      $scope.obForm[`ngForm_pageElements_${self.currentPageIndex}`],
    )
    if (index < self.pages.length) {
      $document.scrollTop(0, 250)
      self.currentPageIndex = index
    }
    if (this.isStepsHeaderActive) {
      this.toggleStepsNavigation()
    }
  }

  this.goToNextPage = () => {
    const visiblePages = self.getVisiblePages()
    for (let i = 0; i < visiblePages.length; i++) {
      const page = visiblePages[i]
      if (page.index === self.currentPageIndex) {
        const nextVisiblePage = visiblePages[i + 1]
        if (nextVisiblePage) {
          self.setPageIndex(nextVisiblePage.index)
        }
        break
      }
    }
  }

  this.goToPreviousPage = () => {
    const visiblePages = self.getVisiblePages()
    for (let i = visiblePages.length - 1; i > -1; i--) {
      const page = visiblePages[i]
      if (page && page.index === self.currentPageIndex) {
        const previousVisiblePage = visiblePages[i - 1]
        if (previousVisiblePage) {
          self.setPageIndex(previousVisiblePage.index)
        }
        break
      }
    }
  }

  this.isShowingMultiplePages = () => {
    return self.getVisiblePages().length > 1
  }

  this.isLastVisiblePage = () => {
    const visiblePages = self.getVisiblePages()
    const lastVisiblePage = visiblePages[visiblePages.length - 1]
    return lastVisiblePage && lastVisiblePage.index === self.currentPageIndex
  }

  this.isFirstVisiblePage = () => {
    const visiblePages = self.getVisiblePages()
    const firstVisiblePage = visiblePages[0]
    return firstVisiblePage && firstVisiblePage.index === self.currentPageIndex
  }

  this.pageHasErrors = (index) => {
    const ctrl = $scope.obForm[`ngForm_pageElements_${index}`]
    if (ctrl) {
      return evaluateControllerValidity(ctrl)
    }
  }

  const evaluateControllerValidity = (ctrl) => {
    return ctrl.$getControls().some((childCtrl) => {
      if (angular.isFunction(childCtrl.$getControls)) {
        return evaluateControllerValidity(childCtrl)
      } else {
        return childCtrl.$invalid && childCtrl.$dirty
      }
    })
  }

  const checkCanSaveForm = (ngFormCtrl) => {
    return ngFormCtrl.$getControls().reduce((canSave, control) => {
      if (angular.isFunction(control.$getControls)) {
        return checkCanSaveForm(control) && canSave
      }

      control.$validate()

      if (control.$invalid) {
        control.$setDirty()
        return false
      }
      return canSave
    }, true)
  }

  const getCurrentSubmissionData = (stripBinaryData) => {
    const captchaTokens = []
    const submission = {}
    // Clear data from submission on fields that are hidden on visible pages
    const visiblePages = self.getVisiblePages()
    visiblePages.forEach((pageElement) => {
      pageElement.elements.forEach((element) => {
        submission[element.name] = clearModelValue(
          stripBinaryData,
          pageElement.elements,
          element,
          self.model,
          captchaTokens,
        )
      })
    })

    return { submission, captchaTokens }
  }

  this.getCurrentSubmissionData = () => {
    return getCurrentSubmissionData(false).submission
  }

  this.getCurrentSubmissionDataWithoutBinary = () => {
    return getCurrentSubmissionData(true).submission
  }

  function getKeyId() {
    const jwtToken = self.accessKey
    if (jwtToken) {
      $log.log('Attempting to decode JWT in query string')
      try {
        const tokenPayload = jwtDecode(jwtToken)
        return tokenPayload.iss
      } catch (error) {
        $log.error('Could not decode JWT in query string', error)
      }
    }
  }

  const createSubmissionResultBase = () => {
    const { captchaTokens, submission } = getCurrentSubmissionData(false)

    return {
      definition: self.definition,
      submission,
      pendingTimestamp: new Date().toISOString(),
      externalId: self.externalId,
      jobId: self.jobId,
      draftId: self.draftId,
      captchaTokens,
      preFillFormDataId: self.preFillFormDataId,
      keyId: getKeyId(),
    }
  }

  this.submit = () => {
    // Validate all inputs and show errors if required
    // if all inputs are valid, we can save the form
    if (!checkCanSaveForm($scope.obForm)) {
      return
    }

    cancelThrottledAutoSave()

    self.submissionResult = null
    self.isSubmitting = true

    const submissionData = createSubmissionResultBase()

    this.onSubmit({submissionData})
      .then((submissionResult) => {
        self.submissionResult = submissionResult

        // If redirecting after submission, execute post submission
        // action immediately without stopping the submitting animation
        if (
          submissionResult.submissionId &&
          (self.definition.postSubmissionAction === 'URL' ||
            submissionResult.payment)
        ) {
          return self.postSubmissionAction()
        }

        self.isSubmitting = false
      })
      .catch((error) => {
        self.isSubmissionError = true
        self.isSubmitting = false
        self.onSubmissionError({ error })
      })
  }

  const clearModelValue = (
    stripBinaryData,
    elements,
    element,
    model,
    captchaTokens,
    parentFormElementsCtrl,
  ) => {
    const isShowing = self.conditionallyShow(
      {
        elements,
        model,
        parentFormElementsCtrl,
      },
      element,
    )

    switch (element.type) {
      // For content element types, we just need to set true for shown and false for hidden.
      // This is to allow renderers of the data to know when to show/hide the content
      case 'image':
      case 'heading':
      case 'html': {
        return stripBinaryData ? undefined : isShowing
      }
      // Need to remove captcha tokens and save
      // them to POST them to the server for validation
      case 'captcha': {
        captchaTokens.push(model[element.name])
        return undefined
      }
      case 'camera':
      case 'file':
      case 'draw': {
        if (stripBinaryData || !isShowing) {
          return undefined
        } else {
          return model[element.name]
        }
      }
      case 'infoPage':
      case 'form': {
        // Here we will check to make sure that each embedded form
        // also has its values wiped if the element is hidden based on conditional logic
        if (
          isShowing &&
          angular.isArray(element.elements) &&
          element.elements.length &&
          angular.isDefined(model[element.name])
        ) {
          return element.elements.reduce((formModel, e) => {
            formModel[e.name] = clearModelValue(
              stripBinaryData,
              element.elements,
              e,
              model[element.name],
              captchaTokens,
              {
                elements,
                model,
                parentFormElementsCtrl,
              },
            )
            return formModel
          }, {})
        }
        break
      }
      case 'repeatableSet': {
        // Here we will check to make sure that each repeatable set entry
        // also has its values wiped if the element is hidden based on conditional logic
        if (
          isShowing &&
          angular.isArray(element.elements) &&
          element.elements.length &&
          angular.isArray(model[element.name]) &&
          model[element.name].length
        ) {
          return model[element.name].map((entry) => {
            return element.elements.reduce((entryModel, e) => {
              entryModel[e.name] = clearModelValue(
                stripBinaryData,
                element.elements,
                e,
                entry,
                captchaTokens,
                {
                  elements,
                  model,
                  parentFormElementsCtrl,
                },
              )
              return entryModel
            }, {})
          })
        }
        break
      }
      default: {
        if (isShowing) {
          return model[element.name]
        }
      }
    }
  }

  this.saveDraft = () => {
    cancelThrottledAutoSave()
    self.isSavingDraft = true
    // get the model
    // For drafts we dont need to save the captcha tokens,
    // they will need to prove they are not robot again
    const draftSubmission = {
      definition: self.definition,
      submission: this.getCurrentSubmissionData(),
      keyId: getKeyId(),
    }

    const draft = {
      draftId: self.draftId,
      formId: self.form.id,
      externalId: self.externalId,
      jobId: self.jobId,
      title: self.draftTitle,
      updatedAt: new Date().toISOString(),
    }
    $log.log('Draft data created from in-progress form', draft)
    return self.onSaveDraft({ draft, draftSubmission })
      .then(deleteAutoSaveData)
      .then(() => {
        if (self.accessKey) {
          self.isSavingDraft = false
          self.draftDetails = false
          return self.postSubmissionAction()
        }
        self.cancelForm()
      })
      .catch((error) => {
        $log.error('Error saving draft: ', error)
        self.isSavingDraft = false
        self.draftDetails = false
        self.isSubmissionError = true
        self.error = error.message || error
      })
  }

  this.showDraftDetails = () => {
    if (getKeyId()) {
      this.saveDraft()
    } else {
      self.cancelConfirm = false
      self.draftDetails = true
    }
  }

  this.hideDraftDetails = () => {
    self.draftDetails = false
  }

  this.toggleStepsNavigation = () => {
    this.isStepsHeaderActive = !this.isStepsHeaderActive

    if (this.isStepsHeaderActive) {
      const activeStepElement = angular.element(
        $document[0].getElementById(
          `steps-navigation-step-${self.currentPageIndex}`,
        ),
      )
      const stepsElement = angular.element(
        $document[0].getElementById('steps-navigation'),
      )
      if (stepsElement && activeStepElement) {
        stepsElement.scrollTo(activeStepElement, 50)
      }

      scrollingService.disableScrolling()
    } else {
      // Re-enable scroll on body when inactive
      scrollingService.enableScrolling()
    }
  }

  this.removeInjectedPages = (elementId) => {
    if (self.definition.elements[0].type !== 'page') {
      return
    }
    self.definition.elements = self.definition.elements.filter(
      (pageElement) => pageElement.injectedByElementId !== elementId,
    )
    self.pages = self.definition.elements.map((pageElement, index) => {
      pageElement.index = index
      return pageElement
    })
  }

  this.injectPagesAfter = (currentPageIndex, elementId, newPageElements) => {
    if (self.definition.elements[0].type !== 'page') {
      self.definition.elements = [
        {
          id: self.definition.id,
          type: 'page',
          label: 'Page 1',
          elements: self.definition.elements,
        },
      ]
    }

    newPageElements.forEach((pageElement) => {
      pageElement.injectedByElementId = elementId
      const model = renderService.generateDefaultData(
        pageElement.elements,
        self.model || {},
      )
      Object.assign(self.model, model)
    })

    self.definition.elements.splice(
      (currentPageIndex || 0) + 1,
      0,
      ...newPageElements,
    )

    self.pages = self.definition.elements.map((pageElement, index) => {
      pageElement.index = index
      if (!pageElement.label) {
        pageElement.label = `Page ${index + 1}`
      }
      if (!pageElement.elements) {
        pageElement.elements = []
      }
      return pageElement
    })
  }

  this.mergeLookupData = (data) => {
    if (!data) {
      return
    }
    const visiblePages = self.getVisiblePages()
    visiblePages.forEach((pageElement, index) => {
      const pageFormName = `ngForm_pageElements_${index}`
      const controllers = $scope.obForm[pageFormName].$getControls()
      setLookupDataForElement(pageElement, data, controllers)
    })
  }

  const setLookupDataForElement = (element, data, controllers) => {
    element.elements.forEach((element) => {
      if (element.type === 'form') {
        setLookupDataForElement(element, data, controllers)
      } else {
        const ngModelCtrl = _find(
          controllers,
          (ctrl) => ctrl.$name === element.name,
        )
        if (ngModelCtrl && angular.isDefined(data[ngModelCtrl.$name])) {
          if (ngModelCtrl.$setDate) {
            ngModelCtrl.$setDate(data[ngModelCtrl.$name])
          } else {
            ngModelCtrl.$setViewValue(data[ngModelCtrl.$name])
          }
          ngModelCtrl.$render()
        }
      }
    })
  }
}

angular.module('oneblink.forms.renderer').component('formRenderer', {
  template,
  controller: formRendererController,
  bindings: {
    form: '<',
    draft: '<',
    initialModel: '<',
    accessKey: '<',
    externalId: '<',
    jobId: '<',
    preFillFormDataId: '<',
    isDraftsEnabled: '<',
    isPreview: '<',
    beforeCancelForm: '&',
    onCancelForm: '&',
    onPostSubmissionAction: '&',
    onSubmissionError: '&',
    onSubmit: '&',
    onSaveDraft: '&',
  },
})
