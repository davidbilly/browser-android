System.register('antitracking/time', ['core/cliqz'], function (_export) {
  /** Get datetime string of the current hour in the format YYYYMMDDHH
   */
  'use strict';

  var utils;

  _export('getTime', getTime);

  _export('newUTCDate', newUTCDate);

  _export('hourString', hourString);

  _export('dateString', dateString);

  _export('getHourTimestamp', getHourTimestamp);

  function getTime() {
    var ts = utils.getPref('config_ts', null);
    if (!ts) {
      var d = null;
      var m = null;
      var y = null;
      var h = null;
      var hr = null;
      var _ts = null;
      d = (new Date().getDate() < 10 ? "0" : "") + new Date().getDate();
      m = (new Date().getMonth() < 9 ? "0" : "") + parseInt(new Date().getMonth() + 1);
      h = (new Date().getUTCHours() < 10 ? "0" : "") + new Date().getUTCHours();
      y = new Date().getFullYear();
      _ts = y + "" + m + "" + d + "" + h;
    } else {
      h = (new Date().getUTCHours() < 10 ? "0" : "") + new Date().getUTCHours();
      _ts = ts + "" + h;
    }
    return _ts;
  }

  function newUTCDate() {
    var dayHour = getTime();
    return new Date(Date.UTC(dayHour.substring(0, 4), parseInt(dayHour.substring(4, 6)) - 1, dayHour.substring(6, 8), dayHour.substring(8, 10)));
  }

  function hourString(date) {
    var hour = date.getUTCHours().toString();
    return dateString(date) + (hour[1] ? hour : '0' + hour[0]);
  }

  function dateString(date) {
    var yyyy = date.getFullYear().toString();
    var mm = (date.getMonth() + 1).toString(); // getMonth() is zero-based
    var dd = date.getDate().toString();
    return yyyy + (mm[1] ? mm : "0" + mm[0]) + (dd[1] ? dd : "0" + dd[0]); // padding
  }

  function getHourTimestamp() {
    return getTime().slice(0, 10);
  }

  return {
    setters: [function (_coreCliqz) {
      utils = _coreCliqz.utils;
    }],
    execute: function () {
      ;

      ;

      ;

      ;
    }
  };
});
