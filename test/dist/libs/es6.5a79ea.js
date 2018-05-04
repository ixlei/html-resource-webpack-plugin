var _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) { return typeof e } : function(e) { return e && "function" == typeof Symbol && e.constructor === Symbol ? "symbol" : typeof e };
! function() { var e = { getItem: function(e) { var t = localStorage.getItem(e) || void 0; try { return t || null } catch (e) { return null } }, setItem: function(e, t) { try { localStorage.setItem(e, t) } catch (e) {} }, setCookie: function(e, t, n) { var o = new Date;
                o.setDate(o.getDate() + n), document.cookie = e + "=" + escape(t) + (null == n ? "" : ";expires=" + o.toGMTString()) }, getCookie: function(e) { return document.cookie.match(new RegExp("(^| )" + e + "=([^;]*)(;|$)")) ? decodeURIComponent(RegExp.$2) : "" }, uin: function() { var e = this.getCookie("ilive_uin") || this.getCookie("uin"); return e && parseInt(e.replace(/\D/g, ""), 10) || null }, param: function(e) { var t = []; for (var n in e) e.hasOwnProperty(n) && t.push(encodeURIComponent(n) + "=" + encodeURIComponent(e[n])); return t.join("&") }, query: function(e) { return location.search.match(new RegExp("(\\?|&)" + e + "=([^&]*)(&|$)")) ? decodeURIComponent(RegExp.$2) : "" } },
        t = { init: function() { var t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                this.opts = t, this.opts.uin = e.uin() || "", this.opts.whitelistUrl = this.opts.whitelistUrl || "/cgi-bin/now/web/user/is_in_white_list", this.cbArr = [], this.isSend = !1, this.whitelistKey = "__is_whitelist_" + e.uin(), this.isWhite = e.getItem(this.whitelistKey) || !1 }, ajax: function(e, t, n, o, i) { var r = null;
                r = window.XMLHttpRequest ? new XMLHttpRequest : new ActiveXObject("Microsoft.XMLHTTP"), e = e.toUpperCase(); var a = Math.random(); if ("object" == (void 0 === n ? "undefined" : _typeof(n))) { var s = ""; for (var c in n) s += c + "=" + n[c] + "&";
                    n = s.replace(/&$/, "") } switch (e) {
                    case "GET":
                        n ? r.open("GET", t + "?" + n, !0) : r.open("GET", t + "?t=" + a, !0), r.send(); break;
                    case "POST":
                        r.open("POST", t, !0), r.setRequestHeader("Content-type", "application/x-www-form-urlencoded"), r.send(n) } try { r.withCredentials = !0 } catch (e) {}
                r.onreadystatechange = function() { 4 === r.readyState && (200 === r.status ? o(r.responseText) : i && i(r.status)) } }, checkWhitelist: function(t, n) { var o = this;

                function i(e) { for (var t = 0, n = o.cbArr.length; t < n; t++) o.cbArr.pop()(e) }
                this.cbArr.push(t), "true" === this.isWhite ? i(!0) : !o.isSend || n ? (o.isSend = !0, this.ajax("GET", o.opts.whitelistUrl, {}, function(t) { try { if (0 === (t = JSON.parse(t)).retcode) { var n = t.result.is_in_white_list;
                            n && e.setItem(o.whitelistKey, n), o.isWhite = n, i(n) } else i(!1) } catch (e) { i(!1) } }, function() { i(!1) })) : i(!1) }, send: function(t, n) {
                (n = n || {})._ = Math.random(); var o = t + (t.match(/\?/) ? "&" : "?") + e.param(n);
                window.__UniRep ? window.__UniRep.push(o) : (new Image).src = o }, sendBadjs: function(e) { var t = this.opts,
                    n = t.badjsId,
                    o = t.uin;
                e = e || "", this.send("//now.qq.com/badjs", { id: n, from: location.href, uin: o, count: 1, "msg[0]": ["whitelist info", e.slice(0, 2e3), "packVersion: " + (window.pack ? window.pack.version : "")].join(","), "level[0]": 2 }) }, report: function(e, t, n) { var o = this; "object" === (void 0 === t ? "undefined" : _typeof(t)) || n || (n = { all: t }, t = null), n = n || {}; var i = e + (t ? ": " + JSON.stringify(t) : "");
                this.checkWhitelist(function(e) { e && n.vip && (i = "!" + i), (e || n.all) && o.sendBadjs(i) }) }, reportVip: function(e, t, n) {
                (n = n || {}).vip = !0, this.report(e, t, n) }, monitor: function(e) { this.send("//report.url.cn/report/report_vm", { monitors: "[" + ("number" == typeof e ? [e] : e).join(",") + "]" }) } };
    t.query = e.query, window._report_ = t }(),
function() { var e = [
        ["IOS", /\b(iPad|iPhone|iPod)\b.*? OS ([\d_]+)/, 2],
        ["android", /\bAndroid\s*([^;]+)/],
        ["QQBrowser", /\bMQQBrowser\/([\d\.]+)/],
        ["nowSDK", /\bNowSDK\/([\d\.]*)/i],
        ["QQ", /\bQQ\/([\d\.]+)/],
        ["weixin", /\bMicroMessenger\/([\d\.]*)/],
        ["now", /\bNow\/(\d+|LocalCompiled)/],
        ["nowDev", /\bNow\/LocalCompiled/],
        ["jiaoyou", /\bODApp\/([\d\.]+|LocalCompiled)/],
        ["jiaoyouDev", /\bODApp\/LocalCompiled/],
        ["huayang", /\bhuayangapp\/([\d\.]*)/],
        ["qzone", /\bQzone\/\w*_([\d\.]+)/],
        ["comicReader", /\bQQAC_Client(_\w+)?\/([\d\.]*)/i]
    ];

    function t() { return "undefined" != typeof navigator && navigator && navigator.userAgent || "" }

    function n(e) { return e.replace(/^./, function(e) { return e.toUpperCase() }) } var o = { userAgent: t, init: function() { var o = this;
            e.forEach(function(e) { o.addItem.apply(o, e) }), this.platform = this.isIOS ? "ios" : this.isAndroid ? "android" : "pc", e.forEach(function(e) { var t = e[0];
                o["is" + n(t)] && (o.type = t) }), this.netType = t().match(/NetType\/(\w+)/i) && RegExp.$1.toUpperCase() }, addItem: function(e, o) { var i = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : 1,
                r = t().match(o),
                a = (r && r[i] || "").replace(/_/g, ".") || null;
            this["is" + n(e)] = !!r, this[e + "Version"] = a }, version: function(e) { return this[e + "Version"] || null } };
    o.init(); var i, r = { options: { delay: 1e4, immediate: !1 }, cfg: function(e) { a(this.options, e || {}) }, extend: function(e) { var t = e.type,
                n = this;
            this.options[t] = e.options || {}, a(this[t] = function() { var e = [].slice.call(arguments);
                e.unshift(t), n.report.apply(n, e) }, e, { pool: [] }) }, report: function(e, t, n) { var o = this;
            n ? (t && o[e].pool.push(t), o._clear(e)) : (t && o[e].pool.push(t), setTimeout(function() { o._clear(e) }, 3e3)) }, _clear: function(e) { var t = this[e],
                n = t.pool;
            n.length && t.onReport.call(this, n.splice(0, n.length)) } };

    function a(e) { for (var t = [].slice.call(arguments, 1), n = 0; n < t.length; n++) { var o = t[n]; for (var i in o) o.hasOwnProperty(i) && ("object" === _typeof(e[i]) && e[i] && "object" === _typeof(o[i]) && o[i] ? a(e[i], o[i]) : e[i] = o[i]) } return e }

    function s(e) { try { var t, n = new RegExp("(^| )" + e + "=([^;]*)(;|$)"); return (t = document.cookie.match(n)) ? unescape(t[2]) : null } catch (e) { console.log(e) } }

    function c(e) { if ("undefined" == typeof location || !location.search) return ""; var t = location.search.match(new RegExp("(\\?|&)" + e + "=([^&]*)(&|$)")) ? decodeURIComponent(RegExp.$2) : ""; return t.match(/<\/?script>/i) && (console.wran('参数中包含"<script>"为防止门神反射-XSS漏洞自动去除', e, t), t = t.replace(/<\/?script>/gi, "")), t }
    r.extend({ type: "doReport", options: { url: "//report.url.cn/cgi-bin/tdbank" }, onReport: function(e) { var t = this.options.doReport,
                n = function(e, t) { var n = [],
                        o = {},
                        i = []; for (var r in e) { var s = a({}, t || {}, e[r]),
                            c = []; for (var p in n) c.push(""); for (var u in s) { var l = s[u]; if (null == l ? l = "" : "boolean" == typeof l && (l += ""), "string" == typeof l && l && (l = l.replace(/&/g, "@")), void 0 === o[u]) { for (var p in n.push(u), o[u] = n.length - 1, i) i[p].push("");
                                c.push(l) } else c[o[u]] = l }
                        i.push(c) } return { fields: n, datas: i } }(e, t.data);! function(e, t) {
                (t = t || {})._ = Math.random(); var n = e + "?" + function(e) { var t = []; for (var n in e) e.hasOwnProperty(n) && t.push(encodeURIComponent(n) + "=" + encodeURIComponent(e[n])); return t.join("&") }(t);
                window.__UniRep ? window.__UniRep.push(n) : (new Image).src = n }(t.url, { table_id: t.tid, busi_id: t.bid, fields: JSON.stringify(n.fields), datas: JSON.stringify(n.datas), pr_ip: "obj3", pr_t: "ts" }) } }), window.AVReport = r, window.AVReport.cfg({ doReport: { data: { uin: +(s("ilive_uin") || s("uin") || "").replace(/\D+/g, ""), from: c("from") || c("fromid"), network_type: (i = o.netType, i ? "WIFI" == i ? 1 : -2 : -3), platform: o.platform, environment: o.QQVersion || o.nowVersion || "", obj1: o.IOSVersion || o.androidVersion || "", obj2: o.type || "", obj3: "undefined" != typeof window && window.pack && window.pack.version || "" } } }) }();