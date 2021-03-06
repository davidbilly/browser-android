System.register('antitracking/tp_events', ['core/cliqz', 'antitracking/md5', 'antitracking/domain', 'antitracking/telemetry', 'platform/browser'], function (_export) {
    'use strict';

    var utils, md5, sameGeneralDomain, telemetry, browser, debug, stats, tp_events;

    // Class to hold a page load and third party urls loaded by this page.
    function PageLoadData(url, isPrivate) {

        // Create a short md5 hash of the input string s
        this._shortHash = function (s) {
            if (!s) return '';
            return md5(s).substring(0, 16);
        };

        this.url = url.toString();
        this.hostname = url.hostname;
        this.path = this._shortHash(url.path);
        this.scheme = url.protocol;
        this['private'] = isPrivate;
        this.c = 1;
        this.s = new Date().getTime();
        this.e = null;
        this.tps = {};
        this.redirects = [];

        this._plainObject = null;

        // Get a stat counter object for the given third party host and path in
        // this page load.
        this.getTpUrl = function (tp_host, tp_path) {
            // reset cached plain object
            this._plainObject = null;
            var path_key = tp_path; // TODO hash it?
            if (!(tp_host in this.tps)) {
                this.tps[tp_host] = {};
            }
            if (!(path_key in this.tps[tp_host])) {
                this.tps[tp_host][path_key] = this._tpStatCounter();
            }
            return this.tps[tp_host][path_key];
        };

        // Returns true if the given referrer matches this page load.
        // This can be either a direct referral (referrer matches page load url),
        // or nth degree (referrer is somewhere in the graph of referrals originating
        // from the original page load url).
        this.isReferredFrom = function (ref_parts) {
            if (!ref_parts) return false;
            if (sameGeneralDomain(ref_parts.hostname, this.hostname)) {
                return true;
            }
            // not a direct referral, but could be via a third party
            if (ref_parts.hostname in this.tps) {
                return true;
            }
            return false;
        };

        this._tpStatCounter = tp_events._newStatCounter;

        // Creates a plain, aggregated version of this object, suitable for converting
        // to JSON, and sending as telemetry.
        this.asPlainObject = function () {
            return this._plainObject || this._buildPlainObject();
        };

        this._buildPlainObject = function () {
            var _this = this;

            var self = this,
                obj = {
                hostname: this._shortHash(this.hostname),
                path: this.path,
                scheme: this.scheme,
                c: this.c,
                t: this.e - this.s,
                ra: this.ra || 0,
                tps: {},
                redirects: this.redirects.filter(function (hostname) {
                    return !sameGeneralDomain(hostname, self.hostname);
                })
            };
            if (!obj.hostname) return obj;

            var _loop = function (tp_domain) {
                tp_domain_data = _this.tps[tp_domain];
                tp_paths = Object.keys(tp_domain_data);

                // skip same general domain
                if (sameGeneralDomain(self.hostname, tp_domain)) {
                    return 'continue';
                }
                if (tp_paths.length > 0) {
                    // aggregate stats per tp domain.
                    path_data = tp_paths.map(function (k) {
                        tp_domain_data[k]['paths'] = [self._shortHash(k)];
                        return tp_domain_data[k];
                    });

                    obj['tps'][tp_domain] = path_data.reduce(_this._sumStats);

                    // Remove the keys which have value == 0;
                    stats.forEach(function (eachKey) {
                        if (obj['tps'][tp_domain] && obj['tps'][tp_domain][eachKey] == 0) delete obj['tps'][tp_domain][eachKey];
                    });
                }
            };

            for (var tp_domain in this.tps) {
                var tp_domain_data, tp_paths;
                var path_data;

                var _ret = _loop(tp_domain);

                if (_ret === 'continue') continue;
            }
            // This was added to collect data for experiment, safe to stop collecting it now.
            // checkBlackList(this.url, obj);
            // checkFingerPrinting(this.url, obj);
            this._plainObject = obj;
            return obj;
        };

        this._sumStats = function (a, b) {
            var c = {},
                stats_keys = new Set(Object.keys(a).concat(Object.keys(b)));
            // paths is a special case
            stats_keys['delete']('paths');
            stats_keys.forEach(function (s) {
                c[s] = (a[s] || 0) + (b[s] || 0);
            });
            c['paths'] = a['paths'].concat(b['paths']);
            return c;
        };
    }return {
        setters: [function (_coreCliqz) {
            utils = _coreCliqz.utils;
        }, function (_antitrackingMd5) {
            md5 = _antitrackingMd5['default'];
        }, function (_antitrackingDomain) {
            sameGeneralDomain = _antitrackingDomain.sameGeneralDomain;
        }, function (_antitrackingTelemetry) {
            telemetry = _antitrackingTelemetry['default'];
        }, function (_platformBrowser) {
            browser = _platformBrowser;
        }],
        execute: function () {
            debug = false;
            ;

            stats = ['c'];
            tp_events = {
                _active: {},
                _old_tab_idx: {},
                _staged: [],
                _last_clean: 0,
                _clean_interval: 1000 * 10, // 10s
                _push_interval: 1000 * 60 * 20, // 20 minutes decreasing the frequency from 5 minutes to 20 minutes.
                _last_push: 0,
                telemetryAnnotators: [],
                ignore: new Set(['self-repair.mozilla.org']),
                // Called when a url is loaded on windowID source.
                // Returns the PageLoadData object for this url.
                //  or returns null if the url is malformed or null.
                onFullPage: function onFullPage(url, tab_id, isPrivate) {
                    // previous request finished. Move to staged
                    this.stage(tab_id);
                    // create new page load entry for tab
                    if (url && url.hostname && tab_id > 0 && !this.ignore.has(url.hostname)) {
                        this._active[tab_id] = new PageLoadData(url, isPrivate || false);
                        return this._active[tab_id];
                    } else {
                        return null;
                    }
                },
                onRedirect: function onRedirect(url_parts, tab_id, isPrivate) {
                    if (tab_id in this._active) {
                        var prev = this._active[tab_id];
                        this._active[tab_id] = new PageLoadData(url_parts, isPrivate);
                        this._active[tab_id].redirects = prev.redirects;
                        this._active[tab_id].redirects.push(prev.hostname);
                    } else {
                        this.onFullPage(url_parts, tab_id, isPrivate);
                    }
                },
                // Get a stats object for the request to url, referred from ref, on tab source.
                // url_parts and ref_parts contain the decomposed parts (from parseURL) of url and ref respectively.
                // returns an object containing keys specified in tp_events._stats representing the running stats
                // for the requesting third party on the source page.
                // Returns null if the referrer is not valid.
                get: function get(url, url_parts, ref, ref_parts, source) {
                    if (source <= 0 || source === null || source === undefined) {
                        if (debug) utils.log("No source for request, not logging!", "tp_events");
                        return null;
                    }

                    if (!(source in this._active)) {
                        if (!ref || !ref_parts || !ref_parts.hostname) {
                            return null;
                        }
                        if (debug) utils.log("No fullpage request for referrer: " + ref + " -> " + url, "tp_events");
                        return null;
                    }

                    var page_graph = this._active[source];
                    if (!page_graph.isReferredFrom(ref_parts)) {
                        if (!ref || !ref_parts || !ref_parts.hostname) return null;
                        if (source in this._old_tab_idx) {
                            var prev_graph = this._staged[this._old_tab_idx[source]];
                            if (prev_graph && prev_graph.isReferredFrom(ref_parts)) {
                                if (debug) utils.log("Request for expired tab " + ref_parts.hostname + " -> " + url_parts.hostname + " (" + prev_graph['hostname'] + ")", 'tp_events');
                                return prev_graph.getTpUrl(url_parts.hostname, url_parts.path);
                            }
                        }
                        if (debug) utils.log("tab/referrer mismatch " + ref_parts.hostname + " -> " + url_parts.hostname + " (" + page_graph['hostname'] + ")", 'tp_events');
                        return null;
                    }

                    return page_graph.getTpUrl(url_parts.hostname, url_parts.path);
                },
                // Move the PageLoadData object for windowID to the staging area.
                stage: function stage(windowID) {
                    if (windowID in this._active) {
                        this._active[windowID]['e'] = new Date().getTime();
                        // push object to staging and save its id
                        this._old_tab_idx[windowID] = this._staged.push(this._active[windowID]) - 1;
                        delete this._active[windowID];
                    }
                },
                // Periodically stage any tabs which are no longer active.
                // Will run at a period specifed by tp_events._clean_interval, unless force_clean is true
                // If force_stage is true, will stage all tabs, otherwise will only stage inactive.
                commit: function commit(force_clean, force_stage) {
                    var now = new Date().getTime();
                    if (now - this._last_clean > this._clean_interval || force_clean == true) {
                        for (var k in this._active) {
                            var active = browser.isWindowActive(k);
                            if (!active || force_stage == true) {
                                if (debug) utils.log('Stage tab ' + k, 'tp_events');
                                this.stage(k);
                            }
                        }
                        this._last_clean = now;
                    }
                },
                // Push staged PageLoadData to human web.
                // Will run at a period specified by tp_events._push_interval, unless force_push is true.
                push: function push(force_push) {
                    var now = new Date().getTime();
                    if (this._staged.length > 0 && (now - this._last_push > this._push_interval || force_push == true)) {
                        // convert staged objects into simple objects, and aggregate.
                        // then filter out ones with bad data (undefined hostname or no third parties)
                        var payload_data = this._staged.filter(function (pl) {
                            // remove private tabs
                            return !pl['private'];
                        }).map(function (item) {
                            return item.asPlainObject();
                        }).filter(function (item) {
                            return item['hostname'].length > 0 && Object.keys(item['tps']).length > 0;
                        });

                        // if we still have some data, send the telemetry
                        if (payload_data.length > 0) {
                            if (debug) utils.log('Pushing data for ' + payload_data.length + ' requests', 'tp_events');
                            var basePayload = tp_events.telemetryAnnotators.reduce(function (obj, fn) {
                                return fn(obj);
                            }, {});
                            for (var i = 0; i < payload_data.length; i++) {
                                var payl = Object.assign({
                                    'data': [payload_data[i]]
                                }, basePayload);
                                telemetry.telemetry({ 'type': telemetry.msgType, 'action': 'attrack.tp_events', 'payload': payl });
                            }
                        }
                        this._staged = [];
                        this._old_tab_idx = {};
                        this._last_push = now;
                    }
                },
                _newStatCounter: function _newStatCounter() {
                    var ctr = {},
                        stats_keys = stats;
                    for (var s in stats_keys) {
                        ctr[stats_keys[s]] = 0;
                    }
                    return ctr;
                },
                incrementStat: function incrementStat(req_log, stat_key, n) {
                    if (req_log != null) {
                        if (!(stat_key in req_log)) {
                            req_log[stat_key] = 0;
                        }
                        if (!Number.isInteger(n)) {
                            n = 1;
                        }
                        req_log[stat_key] += n;
                    }
                }
            };

            _export('default', tp_events);
        }
    };
});