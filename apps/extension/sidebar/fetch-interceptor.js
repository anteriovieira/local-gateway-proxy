/**
 * Patches window.fetch in the sidebar to capture response bodies and send them
 * to the background script. Must be loaded as external script (CSP compliance).
 */
(function () {
  var MAX = 102400
  var orig = window.fetch
  window.fetch = function () {
    return orig.apply(this, arguments).then(function (res) {
      try {
        var clone = res.clone()
        clone.text().then(function (text) {
          if (text && text.length <= MAX) {
            try {
              var u = res.url || ''
              var path = ''
              try {
                path = new URL(u).pathname
              } catch (e) {}
              chrome.runtime.sendMessage({
                type: 'response-body',
                payload: {
                  url: u,
                  method: (arguments[1] && arguments[1].method) || 'GET',
                  pathname: path,
                  body: text,
                  timestamp: Date.now(),
                },
              }).catch(function () {})
            } catch (e) {}
          }
        }).catch(function () {})
      } catch (e) {}
      return res
    })
  }
})()
