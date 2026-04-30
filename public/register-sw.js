/* Unregister any existing workers so the network serves fresh app shells. No re-registration. */
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', function onLoad() {
    window.removeEventListener('load', onLoad);
    void navigator.serviceWorker
      .getRegistrations()
      .then(function (registrations) {
        registrations.forEach(function (r) {
          void r.unregister();
        });
      })
      .catch(function () {
        /* ignore */
      });
  });
}
