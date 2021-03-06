System.register('adblocker/window', ['core/cliqz', 'q-button/buttons', 'adblocker/adblocker'], function (_export) {
  'use strict';

  var utils, simpleBtn, checkBox, CliqzADB, adbEnabled, adbABTestEnabled, ADB_PREF_VALUES, ADB_PREF_OPTIMIZED, ADB_PREF, _default;

  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  return {
    setters: [function (_coreCliqz) {
      utils = _coreCliqz.utils;
    }, function (_qButtonButtons) {
      simpleBtn = _qButtonButtons.simpleBtn;
      checkBox = _qButtonButtons.checkBox;
    }, function (_adblockerAdblocker) {
      CliqzADB = _adblockerAdblocker['default'];
      adbEnabled = _adblockerAdblocker.adbEnabled;
      adbABTestEnabled = _adblockerAdblocker.adbABTestEnabled;
      ADB_PREF_VALUES = _adblockerAdblocker.ADB_PREF_VALUES;
      ADB_PREF_OPTIMIZED = _adblockerAdblocker.ADB_PREF_OPTIMIZED;
      ADB_PREF = _adblockerAdblocker.ADB_PREF;
    }],
    execute: function () {
      _default = (function () {
        function _default(settings) {
          _classCallCheck(this, _default);

          this.window = settings.window;
        }

        _createClass(_default, [{
          key: 'init',
          value: function init() {
            if (adbEnabled()) {
              CliqzADB.initWindow(this.window);
              this.window.adbinit = true;
            }
          }
        }, {
          key: 'unload',
          value: function unload() {
            if (adbEnabled()) {
              CliqzADB.unloadWindow(this.window);
              this.window.adbinit = false;
            }
          }
        }, {
          key: 'createAdbButton',
          value: function createAdbButton() {
            var win = this.window;
            var doc = win.document;
            var adbBtn = doc.createElement('menu');
            var adbPopup = doc.createElement('menupopup');

            adbBtn.setAttribute('label', utils.getLocalizedString('adb-menu-option'));

            // we must create the whole ADB popup every time we show it
            // because parts of it depend on the current URL
            adbPopup.addEventListener('popupshowing', function () {
              // clean the whole popup
              while (adbPopup.lastChild) {
                adbPopup.removeChild(adbPopup.lastChild);
              }

              var currentURL = win.gBrowser.currentURI.spec;
              var adbDisabled = !adbEnabled();

              var isCorrectUrl = utils.isUrl(currentURL);
              var disabledForUrl = false;
              var disabledForDomain = false;

              // Check if adblocker is disabled on this page
              if (isCorrectUrl) {
                disabledForDomain = CliqzADB.adBlocker.isDomainInBlacklist(currentURL);
                disabledForUrl = CliqzADB.adBlocker.isUrlInBlacklist(currentURL);
              }

              var disableUrl = checkBox(doc, 'cliqz-adb-url', utils.getLocalizedString('adb-menu-disable-url'), true, function () {
                CliqzADB.adBlocker.toggleUrl(currentURL);
              }, disabledForUrl);

              var disableDomain = checkBox(doc, 'cliqz-adb-domain', utils.getLocalizedString('adb-menu-disable-domain'), true, function () {
                CliqzADB.adBlocker.toggleUrl(currentURL, true);
              }, disabledForDomain);

              // We disabled the option of adding a custom rule for URL
              // in case the whole domain is disabled
              disableUrl.setAttribute('disabled', adbDisabled || disabledForDomain || !isCorrectUrl);
              disableDomain.setAttribute('disabled', adbDisabled || !isCorrectUrl);

              adbPopup.appendChild(disableUrl);
              adbPopup.appendChild(disableDomain);
              adbPopup.appendChild(doc.createElement('menuseparator'));

              Object.keys(ADB_PREF_VALUES).forEach(function (name) {
                var item = doc.createElement('menuitem');

                item.setAttribute('label', utils.getLocalizedString('adb-menu-option-' + name.toLowerCase()));
                item.setAttribute('class', 'menuitem-iconic');
                item.option = ADB_PREF_VALUES[name];

                if (utils.getPref(ADB_PREF, ADB_PREF_VALUES.Disabled) === item.option) {
                  item.style.listStyleImage = 'url(' + utils.SKIN_PATH + 'checkmark.png)';
                }

                item.addEventListener('command', function () {
                  utils.setPref(ADB_PREF, item.option);
                  if (adbEnabled() && !win.adbinit) {
                    CliqzADB.initWindow(win);
                    win.adbinit = true;
                  }
                  if (!adbEnabled() && win.adbinit) {
                    CliqzADB.unloadWindow(win);
                    win.adbinit = false;
                  }
                  utils.telemetry({
                    type: 'activity',
                    action: 'cliqz_menu_button',
                    button_name: 'adb_option_' + item.option
                  });
                }, false);

                adbPopup.appendChild(item);
              });

              adbPopup.appendChild(doc.createElement('menuseparator'));

              adbPopup.appendChild(simpleBtn(doc, CliqzUtils.getLocalizedString('adb-menu-more'), function () {
                utils.openTabInWindow(win, 'https://cliqz.com/whycliqz/adblocking');
              }, 'cliqz-adb-more'));
            });

            adbBtn.appendChild(adbPopup);

            return adbBtn;
          }
        }, {
          key: 'createButtonItem',
          value: function createButtonItem() {
            if (adbABTestEnabled()) {
              return [this.createAdbButton()];
            }
            return [];
          }
        }, {
          key: 'status',
          value: function status() {
            if (!adbABTestEnabled()) {
              return;
            }

            var currentURL = this.window.gBrowser.currentURI.spec;
            var adbDisabled = !adbEnabled();

            var isCorrectUrl = utils.isUrl(currentURL);
            var disabledForUrl = false;
            var disabledForDomain = false;
            var disabledEverywhere = false;

            // Check if adblocker is disabled on this page
            if (isCorrectUrl) {
              disabledForDomain = CliqzADB.adBlocker.isDomainInBlacklist(currentURL);
              disabledForUrl = CliqzADB.adBlocker.isUrlInBlacklist(currentURL);
            }

            var state = Object.keys(ADB_PREF_VALUES).map(function (name) {
              return {
                name: name.toLowerCase(),
                selected: utils.getPref(ADB_PREF, ADB_PREF_VALUES.Disabled) == ADB_PREF_VALUES[name]
              };
            });

            var report = CliqzADB.adbStats.report(currentURL);
            var enabled = CliqzUtils.getPref(ADB_PREF, false) !== ADB_PREF_VALUES.Disabled;

            if (isCorrectUrl) {
              disabledForDomain = CliqzADB.adBlocker.isDomainInBlacklist(currentURL);
              disabledForUrl = CliqzADB.adBlocker.isUrlInBlacklist(currentURL);
            }
            disabledEverywhere = !enabled && !disabledForUrl && !disabledForDomain;

            return {
              visible: true,
              enabled: enabled && !disabledForDomain && !disabledForUrl,
              optimized: CliqzUtils.getPref(ADB_PREF_OPTIMIZED, false) == true,
              disabledForUrl: disabledForUrl,
              disabledForDomain: disabledForDomain,
              disabledEverywhere: disabledEverywhere,
              totalCount: report.totalCount,
              advertisersList: report.advertisersList,
              state: !enabled ? 'off' : disabledForUrl || disabledForDomain ? 'off' : 'active',
              off_state: disabledForUrl ? 'off_website' : disabledForDomain ? 'off_domain' : disabledEverywhere ? 'off_all' : 'off_website'
            };
          }
        }]);

        return _default;
      })();

      _export('default', _default);
    }
  };
});