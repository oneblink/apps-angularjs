'use strict'

export default function ($sce) {
  'ngInject'
  const self = this

  self.sanitiseHtml = (html) => {
    return $sce.trustAsHtml(html)
  }
}
