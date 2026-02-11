(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.Bmob = factory());
}(this, (function() { 'use strict';

    var Bmob = {};
    Bmob._config = {
        applicationId: '',
        applicationKey: '',
        // 🚀 改回标准域名，配合 script.js 的自动重命名，这是最稳的组合
        host: 'https://api.bmobcloud.com' 
    };

    Bmob.initialize = function(appId, appKey) {
        Bmob._config.applicationId = appId;
        Bmob._config.applicationKey = appKey;
    };

    function request(path, method, data) {
        return new Promise((resolve, reject) => {
            if (!Bmob._config.applicationId) return reject("未初始化");

            var url = Bmob._config.host + path;
            var xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
            
            xhr.setRequestHeader('X-Bmob-Application-Id', Bmob._config.applicationId);
            xhr.setRequestHeader('X-Bmob-REST-API-Key', Bmob._config.applicationKey);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            var res = JSON.parse(xhr.responseText);
                            resolve(res.results || res); 
                        } catch (e) { resolve(xhr.responseText); }
                    } else {
                        try {
                            var err = JSON.parse(xhr.responseText);
                            reject(err);
                        } catch (e) { reject(xhr.statusText); }
                    }
                }
            };
            xhr.send(data ? JSON.stringify(data) : null);
        });
    }

    Bmob.Query = function(tableName) {
        return {
            tableName: tableName,
            _where: {},
            _order: '-createdAt',
            _limit: 100,
            equalTo: function(key, operator, value) {
                if (value === undefined) { value = operator; operator = null; }
                this._where[key] = value;
                return this;
            },
            order: function(key) { this._order = key; return this; },
            limit: function(limit) { this._limit = limit; return this; },
            find: function() {
                var params = [];
                if (Object.keys(this._where).length > 0) params.push('where=' + encodeURIComponent(JSON.stringify(this._where)));
                if (this._order) params.push('order=' + this._order);
                if (this._limit) params.push('limit=' + this._limit);
                var queryStr = params.length > 0 ? '?' + params.join('&') : '';
                return request('/1/classes/' + this.tableName + queryStr, 'GET');
            },
            get: function(objectId) {
                var _this = this;
                return new Promise((resolve, reject) => {
                     request('/1/classes/' + _this.tableName + '/' + objectId, 'GET').then(data => {
                         resolve(wrapObject(_this.tableName, data));
                     }).catch(reject);
                });
            },
            set: function(key, value) {
                if(!this._newData) this._newData = {};
                this._newData[key] = value;
                return this;
            },
            save: function() {
                if(this._newData) return request('/1/classes/' + this.tableName, 'POST', this._newData);
                return Promise.reject("没有数据");
            },
            destroy: function(objectId) {
                 return request('/1/classes/' + this.tableName + '/' + objectId, 'DELETE');
            }
        };
    };

    function wrapObject(tableName, data) {
        var obj = data || {};
        obj.objectId = data.objectId;
        obj._updates = {};
        obj.set = function(key, value) { this._updates[key] = value; };
        obj.save = function() {
            if(Object.keys(this._updates).length === 0) return Promise.resolve(this);
            return request('/1/classes/' + tableName + '/' + this.objectId, 'PUT', this._updates);
        };
        return obj;
    }

    Bmob.File = function(name, file) {
        return {
            save: function() {
                return new Promise((resolve, reject) => {
                    // 使用 REST API 文件上传
                    var url = Bmob._config.host + '/2/files/' + encodeURIComponent(name);
                    var xhr = new XMLHttpRequest();
                    xhr.open('POST', url, true);
                    xhr.setRequestHeader('X-Bmob-Application-Id', Bmob._config.applicationId);
                    xhr.setRequestHeader('X-Bmob-REST-API-Key', Bmob._config.applicationKey);
                    // 强制指定类型，防止浏览器乱猜
                    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); 
                    
                    xhr.onreadystatechange = function() {
                        if(xhr.readyState === 4) {
                            if(xhr.status >= 200 && xhr.status < 300) {
                                try {
                                    var res = JSON.parse(xhr.responseText);
                                    // 深度查找任何可能的 URL 字段
                                    var finalUrl = res.url || res.cdn || res.fileUrl || "";
                                    // 就算 URL 是空的，也要返回 res，方便 script.js 里的逻辑判断
                                    resolve([{ url: finalUrl, filename: res.filename, originalRes: res }]); 
                                } catch(e) { reject(e); }
                            } else {
                                reject("上传失败: " + xhr.status);
                            }
                        }
                    };
                    xhr.send(file);
                });
            }
        }
    };
    return Bmob;
})));